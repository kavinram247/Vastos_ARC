-- ═══════════════════════════════════════════════════════════════════════════
-- PLATFORM PHASE A — schema repair · the drift the login path already depends on
--
-- Three columns that production has and no migration creates. Same class as
-- C6b and C2b: changes made straight against the production database, never
-- captured in the tree. This one is worse than those two, because it is
-- LOAD-BEARING — the application does not merely tolerate the drift, it
-- requires it:
--
--   AuthContext.resolveSession() selects `deleted_at` from firms (line 47) and
--   bails when the read errors. On any database built from this tree PostgREST
--   answers 42703 (undefined column), `fe` is truthy, resolveSession returns
--   null — and NOBODY CAN LOG IN. Verified against a local stack built from the
--   full tree: firms had exactly id, name, gstin, address, logo_url,
--   payment_split_default, created_at.
--
-- So a from-scratch rebuild of this product — a restore into a new project, a
-- disaster-recovery drill, a second region — produces an application no user
-- can enter, and the failure presents as a silent redirect back to the login
-- screen with no error. That is the whole reason this migration exists
-- separately and first.
--
-- Also repaired here:
--   · vastos_admin_log gains the actor columns it never had. It records WHAT
--     happened to WHICH firm and never WHO did it, which makes it a changelog,
--     not an audit log. Phase C attributes every write.
--   · firm_subscriptions.seats_purchased loses NOT NULL *and* its DEFAULT 3.
--
-- Ordered before the operator console because vastos_list_firms selects
-- firms.deleted_at / blacklisted_at / blacklist_reason; with check_function_bodies
-- on, creating that function in the same file as the columns it reads would
-- fail at parse time.
--
-- Audit refs: C2b (the log this repairs), C6b (same out-of-band-drift class).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · firms: the lifecycle columns ───────────────────────────────────────
-- Declared to match production exactly (checked against weckowkvqpamnlcqwvfh:
-- all three timestamptz/text, all nullable, in this order). On production every
-- one of these is a no-op; on a fresh database this is what makes login work.
alter table public.firms add column if not exists blacklisted_at   timestamptz;
alter table public.firms add column if not exists blacklist_reason text;
alter table public.firms add column if not exists deleted_at       timestamptz;

comment on column public.firms.deleted_at is
  'Soft delete, set by the platform operator console. resolveSession() refuses '
  'to resolve a session whose firm has this set — so it is an immediate, '
  'irreversible-from-the-UI lockout for every member of the firm.';
comment on column public.firms.blacklisted_at is
  'Operator flag. NOTE: unlike deleted_at this enforces nothing on its own — '
  'resolveSession does not consult it. Blacklisting is suspend + a recorded '
  'reason; the subscription status is what actually blocks access.';


-- ── 2 · vastos_admin_log ───────────────────────────────────────────────────
-- Mirrors production's live DDL column-for-column (id/action/firm_id/firm_name/
-- details/created_at, with those exact types, nullabilities and defaults).
-- `create table if not exists` is a no-op against production, so a declaration
-- that DISAGREED with production would not error — it would silently create a
-- third schema variant, which is precisely the C2b/C6b failure mode. Read the
-- live DDL before ever editing this block.
create table if not exists public.vastos_admin_log (
  id         uuid        primary key default gen_random_uuid(),
  action     text        not null,
  firm_id    uuid,
  firm_name  text,
  details    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- The columns C2b's table never had. An audit trail that cannot name the actor
-- records only that "a firm was deleted", which is not accountability.
alter table public.vastos_admin_log add column if not exists actor_auth_uid uuid;
alter table public.vastos_admin_log add column if not exists actor_email    text;

-- UNCONDITIONAL, and deliberately outside any create branch. C2b guards its
-- entire body on `to_regclass('public.vastos_admin_log') is not null` and
-- therefore does nothing at all on a database built from this tree — it was
-- written to repair production, where the table already existed. This migration
-- is consequently the ONLY thing that establishes the deny-all posture locally,
-- and re-asserting it on production costs nothing.
alter table public.vastos_admin_log enable row level security;
revoke all on table public.vastos_admin_log from anon, authenticated, public;

create index if not exists vastos_admin_log_created_idx
  on public.vastos_admin_log (created_at desc);
create index if not exists vastos_admin_log_firm_created_idx
  on public.vastos_admin_log (firm_id, created_at desc);


-- ── 3 · firm_subscriptions.seats_purchased ─────────────────────────────────
-- The column means "custom seat override; NULL = fall back to the plan's
-- max_users" — that is how AuthContext:75 (`seats_purchased ?? max_users`) and
-- VastosAdminPage.effectiveLimit both read it, and the console has a
-- "Reset to plan default" button that writes NULL.
--
-- It could never be NULL. So the fallback was dead code and EVERY firm was
-- capped at the literal default 3 regardless of plan — a Growth firm that paid
-- for 25 seats got 3, an Enterprise firm with max_users = NULL (unlimited) got
-- 3. Dropping NOT NULL alone would not fix that: with `default 3` still in
-- place every newly provisioned firm keeps landing on 3, so the default goes
-- too and an unset override is now genuinely unset.
--
-- No backfill. firm_subscriptions is empty on production (verified: 0 rows —
-- this is a pre-launch database), so there is no existing row whose literal 3
-- would have to be disambiguated from a deliberate choice. Were rows present,
-- that ambiguity would be unresolvable and the right move would be to leave
-- them and let an operator set them explicitly.
alter table public.firm_subscriptions alter column seats_purchased drop not null;
alter table public.firm_subscriptions alter column seats_purchased drop default;

comment on column public.firm_subscriptions.seats_purchased is
  'Custom seat override. NULL = use the plan''s max_users (which may itself be '
  'NULL for unlimited). NOT enforced server-side anywhere — see the seat-cap '
  'note in the phase C header.';


-- ── 4 · Assertions ─────────────────────────────────────────────────────────

-- Exercise the ACTUAL read resolveSession performs, rather than asking
-- information_schema whether the columns exist. information_schema would still
-- pass if the column were there but unreadable; this fails the same way the
-- browser would.
do $$
begin
  perform 1 from (
    select id, name, address, logo_url, created_at, deleted_at
    from public.firms limit 1
  ) t;

  perform 1 from (
    select blacklisted_at, blacklist_reason from public.firms limit 1
  ) t;

  raise notice 'Platform-A verified: resolveSession''s firms read succeeds — login is possible on a tree-built database';
end $$;

-- seats_purchased must genuinely accept NULL. Prove it by writing one and
-- rolling back, rather than trusting the catalog — a CHECK constraint would
-- satisfy information_schema and still reject the write.
--
-- The probe UPDATEs an existing row wherever one exists and only INSERTs into
-- an empty table. firm_subscriptions has a UNIQUE index on firm_id, so the
-- obvious "insert a probe row" would raise 23505 against any database that
-- already has a subscription (it does locally) and abort this migration.
do $$
declare v_probe text;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'firm_subscriptions'
               and column_name = 'seats_purchased'
               and (is_nullable <> 'YES' or column_default is not null)) then
    raise exception 'Platform-A: seats_purchased is still NOT NULL or still carries a default';
  end if;

  begin
    if exists (select 1 from public.firm_subscriptions) then
      update public.firm_subscriptions set seats_purchased = null
       where id = (select id from public.firm_subscriptions order by id limit 1);
      v_probe := 'updated an existing row to NULL';
    else
      insert into public.firm_subscriptions (firm_id, plan_id, status, seats_purchased)
      select f.id, sp.id, 'trial', null
      from public.firms f cross join public.subscription_plans sp
      order by f.created_at, sp.name limit 1;
      v_probe := case when found then 'inserted a row with NULL'
                      else 'skipped — no firm/plan to probe with' end;
    end if;
    raise exception 'platform_a_rollback_probe';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'platform_a_rollback_probe' then raise; end if;
  end;

  raise notice 'Platform-A verified: seats_purchased accepts NULL (probe %, rolled back)', v_probe;
end $$;

-- The audit log must be deny-all AND able to name an actor.
do $$
declare v_bad text;
begin
  select string_agg(policyname, ', ') into v_bad
  from pg_policies where schemaname = 'public' and tablename = 'vastos_admin_log';
  if v_bad is not null then
    raise exception 'Platform-A: vastos_admin_log carries client policies: %', v_bad;
  end if;

  select string_agg(grantee, ', ') into v_bad
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'vastos_admin_log'
    and grantee in ('anon', 'authenticated', 'PUBLIC');
  if v_bad is not null then
    raise exception 'Platform-A: vastos_admin_log is reachable by: %', v_bad;
  end if;

  if not exists (select 1 from pg_class
                 where oid = 'public.vastos_admin_log'::regclass and relrowsecurity) then
    raise exception 'Platform-A: vastos_admin_log does not have RLS enabled';
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'vastos_admin_log'
                   and column_name = 'actor_auth_uid') then
    raise exception 'Platform-A: vastos_admin_log cannot name an actor';
  end if;

  raise notice 'Platform-A verified: vastos_admin_log is deny-all and has an actor column';
end $$;
