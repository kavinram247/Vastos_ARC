-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 1 — C4 (header-driven RBAC) + C1 (blanket anon access)
--
-- These two ship together and cannot be split. crm_has_permission() reads
-- crm_roles as the CALLER (security invoker), so the moment anon loses its
-- grants the function returns false for everyone and every marketing policy
-- denies. It must become security definer in the same transaction that
-- revokes anon.
--
-- Ordering inside this file is load-bearing:
--   1. C4 — resolve RBAC identity from auth.uid() instead of a client header
--   2. Compensating policies for tables that ONLY had an anon policy
--   3. C1 — drop every anon policy, revoke every anon grant
--   4. Assertion — fail the migration if any table is left unreachable
--
-- Audit refs: C1, C3 (partial), C4. See the security audit artifact.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · C4 — RBAC identity from the session, not from the client ───────────
-- Was: current_setting('request.headers')->>'x-crm-role-id', i.e. whatever the
-- caller asserted. `curl -H "x-crm-role-id: role-admin"` satisfied every
-- permission check. Now resolved from auth.uid() exactly as inv_current_actor()
-- does — the pattern already proven in the inventory module.
--
-- security definer is required: post-revoke, crm_roles is readable only within
-- the caller's own firm, and this lookup must work before that is established.
-- search_path is pinned empty, so every reference below is fully qualified.

create or replace function public.crm_current_role_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cp.role_id::text
  from public.profiles pr
  join public.crm_profiles cp
    on cp.email = pr.email
   and cp.firm_id = pr.firm_id
  where pr.auth_uid = auth.uid()
  limit 1;
$$;

-- Firm owners pass unconditionally (mirrors inv_current_actor's
-- coalesce(r.is_admin, p.role = 'owner')). Everyone else needs an explicit
-- grant on their role. The r.firm_id = i.firm_id join prevents a role id from
-- one firm being used to authorize against another.
create or replace function public.crm_has_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select pr.firm_id, pr.email, pr.role
    from public.profiles pr
    where pr.auth_uid = auth.uid()
    limit 1
  ),
  ident as (
    select a.firm_id, a.role as profile_role, cp.role_id
    from actor a
    left join public.crm_profiles cp
      on cp.email = a.email
     and cp.firm_id = a.firm_id
  )
  select exists (select 1 from ident where profile_role = 'owner')
      or exists (
        select 1
        from ident i
        join public.crm_roles r
          on r.id = i.role_id
         and r.firm_id = i.firm_id
        where r.enabled
          and (
            r.is_admin
            or exists (
              select 1
              from public.crm_role_permissions rp
              where rp.role_id = r.id
                and rp.module  = p_module
                and p_action   = any(rp.actions)
            )
          )
      );
$$;


-- ── 2 · Compensating policies ──────────────────────────────────────────────
-- Eight tables carried ONLY an anon policy. RLS is enabled on all of them, and
-- "RLS on with no matching policy" means deny-all — so revoking anon without
-- these would lock authenticated users out of RBAC, subscriptions and tasks.

-- crm_roles / crm_role_permissions: readable within your own firm, and NOT
-- writable by anyone. This closes the privilege escalation in C4 directly —
-- `UPDATE crm_roles SET is_admin = true` no longer has a policy to pass.
-- Role mutation must go through an admin-checked RPC (Phase 2).
create policy crm_roles_sel on public.crm_roles
  for select to authenticated
  using (firm_id = public.current_firm_id());

create policy crm_role_permissions_sel on public.crm_role_permissions
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- subscription_plans is a global catalogue, not firm-scoped: every logged-in
-- user may read the tiers. It holds no customer data.
create policy subscription_plans_sel on public.subscription_plans
  for select to authenticated
  using (true);

-- firm_subscriptions is firm-scoped and read-only to the client; billing state
-- is written by the platform, never by the tenant.
create policy firm_subscriptions_sel on public.firm_subscriptions
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- Task manager: all three tables carry firm_id directly, so a plain firm
-- predicate is sufficient — no join through tasks required.
do $$
declare t text;
begin
  foreach t in array array['task_lists','task_subtasks','task_activity'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (firm_id = public.current_firm_id())',
      t||'_sel', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (firm_id = public.current_firm_id()) with check (firm_id = public.current_firm_id())',
      t||'_mod', t);
  end loop;
end $$;

-- crm_dashboard_layouts: saved dashboard configurations, firm-scoped. Caught by
-- the assertion at the foot of this file rather than by static analysis — it is
-- the one anon-only table with no anon_dev-style policy name.
-- Firm scope is the security boundary; the per-user `scope`/`user_id` split is a
-- product concern the app already handles.
create policy crm_dashboard_layouts_sel on public.crm_dashboard_layouts
  for select to authenticated
  using (firm_id = public.current_firm_id());

create policy crm_dashboard_layouts_mod on public.crm_dashboard_layouts
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- user_invites — DELIBERATELY LEFT WITH NO POLICY. (C3)
-- invites.token is a gen_random_bytes(32) bearer credential that exchanges for
-- a confirmed account. It must never be client-readable by any role. The
-- accept-invite edge function runs with the service role, which bypasses RLS,
-- so the redemption path is unaffected.
--
-- KNOWN BREAKAGE, fix-forward:
--   · AcceptInvitePage.tsx:26 pre-flight lookup  → needs a validate-invite fn
--   · UserManagementPage.tsx:387 invite creation → needs a create_invite RPC
-- Both are C3 remediation items. No policy is added here on purpose.


-- ── 3 · C1 — remove anon entirely ──────────────────────────────────────────
-- Drops every policy naming anon, whatever it is called. The audit's suggested
-- filter matched on '%anon_dev%'; that misses any anon policy named otherwise,
-- so this matches on the role itself.
do $$
declare r record; n int := 0;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and 'anon' = any(roles)
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    n := n + 1;
  end loop;
  raise notice 'C1: dropped % anon policies', n;
end $$;

-- The grants are the load-bearing half. RLS policies are only consulted after
-- the role passes table privileges, so revoking these closes the hole even if
-- an anon policy were somehow missed above.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Functions need care, and the obvious revoke is NOT enough. PostgreSQL grants
-- EXECUTE on every function to PUBLIC by default, and anon is a member of
-- PUBLIC — so `revoke ... from anon` removes only the explicit grants and
-- leaves the implicit one intact. Verified locally: after revoking from anon,
-- has_function_privilege('anon', …, 'EXECUTE') was still true for 229
-- functions, including every SECURITY DEFINER inv_* RPC that writes the stock
-- ledger. The grant has to be taken from PUBLIC.
revoke all on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

-- Restore for the roles that should keep it. This is not a widening: both roles
-- already had EXECUTE on everything via the PUBLIC grant just removed. The
-- inv_* RPCs gate themselves internally through inv_require() → inv_current_actor(),
-- which resolves from auth.uid() and raises for an unauthenticated caller.
grant execute on all functions in schema public to authenticated, service_role;

-- Schema usage is intentionally NOT revoked: PostgREST needs it to answer with
-- a clean permission error rather than failing to introspect at all.


-- ── 4 · Assertion — fail loudly if anything became unreachable ─────────────
-- A table with RLS enabled and no policy for authenticated (or public) is
-- invisible to the app. Better to fail the migration than to discover it as a
-- silently empty page.
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename  = c.relname
        and (p.roles && array['authenticated','public']::name[])
    )
    -- Deliberate deny-all: service-role or SECURITY DEFINER RPC access only.
    and c.relname not in (
      'user_invites',              -- C3, above
      'stock_movements',           -- inventory ledger: written only by inv_* RPCs
      'inventory_alerts',
      'inventory_item_settings',
      'inventory_outbox',
      'inventory_number_seq'
    );

  if missing is not null then
    raise exception
      'Phase 1 would leave these tables unreachable by authenticated users: %', missing;
  end if;
end $$;

-- Residual anon reachability — expected to be zero rows.
do $$
declare leftover text;
begin
  select string_agg(distinct tablename, ', ')
    into leftover
  from pg_policies
  where schemaname = 'public' and 'anon' = any(roles);

  if leftover is not null then
    raise exception 'anon policies still present on: %', leftover;
  end if;
end $$;

-- anon must be able to reach nothing: no table privilege, no function EXECUTE.
-- This is the check that caught the PUBLIC-grant inheritance above; keep it.
do $$
declare n_tbl int; n_fn int;
begin
  select count(*) into n_tbl
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public';

  -- Extension-owned functions (vector, ltree, pg_trgm) are excluded: they grant
  -- EXECUTE to PUBLIC as part of the extension, are not revokable by the
  -- migration role, and are pure computation holding no data. `revoke ... from
  -- public` above emits a harmless WARNING for each. Only app functions matter.
  select count(*) into n_fn
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where ns.nspname = 'public'
    and d.objid is null
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if n_tbl > 0 or n_fn > 0 then
    raise exception
      'anon still reachable: % table grants, % executable functions', n_tbl, n_fn;
  end if;
  raise notice 'C1 verified: anon has 0 table grants and 0 executable functions';
end $$;
