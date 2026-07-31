-- ═══════════════════════════════════════════════════════════════════════════
-- PLATFORM PHASE B — inv_current_actor() crossed firm boundaries
--
-- C4 fixed exactly this bug in crm_has_permission and said so in its header.
-- inv_current_actor() was missed, and it is the authorization root of the
-- entire Inventory & Procurement module:
--
--   20260703191114_inventory_a_ledger_foundation.sql:97
--     left join crm_roles r on r.id = cp.role_id        ← no firm predicate
--
-- crm_roles.id is a GLOBAL text primary key, not firm-scoped. So the join
-- resolves a role id belonging to ANY firm, and the very next line —
--   coalesce(r.is_admin, p.role = 'owner')
-- — hands back that foreign role's is_admin. inv_require() returns immediately
-- when is_admin is true, so a crm_profiles row carrying another tenant's admin
-- role id passes every check in every inventory RPC: material requests, RFQs,
-- purchase orders, goods receipts, stock adjustments, transfers.
--
-- The column is writable across firms because user_invites.role_id is bare
-- `text` with NO foreign key, and invite_finalize (w1a:301-306) copies it into
-- crm_profiles unchecked. create_invite does validate the role against the
-- caller's firm — but it is not the only writer, and a bare text column with no
-- FK is not an invariant, it is a convention.
--
-- Both halves are closed here, and they are closed together deliberately: the
-- operator console added in phase C introduces vastos_invite_firm_user, a
-- SECOND writer of user_invites.role_id operating across every tenant. Widening
-- that surface before scoping the read would be the wrong order.
--
-- Audit refs: C4 (same defect in crm_has_permission), H1, W1a.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · inv_current_actor ──────────────────────────────────────────────────
-- The fix is the `and r.firm_id = cp.firm_id` on the crm_roles join. Note it
-- must be part of the LEFT JOIN's ON clause and not a WHERE predicate: a WHERE
-- would turn the outer join inner and drop the whole actor row for anyone
-- without an RBAC role, which would take firm owners (who resolve through the
-- `p.role = 'owner'` fallback) out of the inventory module entirely.
--
-- search_path also moves from 'public' to '' with everything fully qualified,
-- per house convention for SECURITY DEFINER — the body is being rewritten
-- anyway and a definer that resolves unqualified names through a mutable
-- search_path is the standard hazard.
create or replace function public.inv_current_actor()
returns table(firm_id uuid, profile_id text, role_id text, is_admin boolean, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select pr.firm_id, pr.email, pr.full_name, pr.role
    from public.profiles pr where pr.auth_uid = auth.uid() limit 1
  )
  select p.firm_id,
         cp.id::text,
         cp.role_id::text,
         coalesce(r.is_admin, p.role = 'owner'),
         p.full_name
  from p
  left join public.crm_profiles cp on cp.email = p.email and cp.firm_id = p.firm_id
  left join public.crm_roles r on r.id = cp.role_id and r.firm_id = cp.firm_id;
$$;


-- ── 2 · invite_finalize: refuse to persist a foreign role id ───────────────
-- The write that let the bad state exist. invite_finalize already performs a
-- firm-scoped lookup to derive v_role (w1a:277-279 — `where r.id = v_inv.role_id
-- and r.firm_id = v_inv.firm_id`); when that lookup finds nothing it falls back
-- to 'engineer' for profiles.role but still copies the unresolvable role_id
-- verbatim into crm_profiles.role_id. This nulls it instead.
--
-- NULL is the correct outcome, not an exception: the invitee has already
-- created an auth account by this point, and raising here would burn the token
-- and strand them — the exact W1a lockout that migration existed to fix. A NULL
-- role_id yields a user with no RBAC grants who an admin can then assign a real
-- role to, which is recoverable in-app.
create or replace function public.invite_finalize(
  p_invite_id uuid,
  p_auth_uid  uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv     record;
  v_pid     uuid;
  v_role    public.user_role;
  v_role_id text;
  v_n       integer;
begin
  if p_auth_uid is null then
    raise exception 'an auth uid is required' using errcode = '22023';
  end if;

  select id, firm_id, email, full_name, role_id, accepted_at
    into v_inv
  from public.user_invites
  where id = p_invite_id;

  if not found then
    raise exception 'unknown invite' using errcode = '22023';
  end if;
  if v_inv.accepted_at is null then
    raise exception 'invite was never claimed' using errcode = '22023';
  end if;

  -- One auth identity, one profile. Without this an invite could re-point an
  -- existing user's identity at a second firm.
  --
  -- Worth naming for phase C: this is also what stops a platform operator
  -- redeeming an invite into a customer tenant. An operator already holds a
  -- profiles row in the Vasto Internal firm, so any attempt to claim a customer
  -- firm's invite lands here and raises. Operators can provision a firm; they
  -- cannot become a member of one.
  if exists (
    select 1 from public.profiles pr
    where pr.auth_uid = p_auth_uid
      and not (pr.firm_id = v_inv.firm_id and lower(pr.email) = lower(v_inv.email))
  ) then
    raise exception 'that identity is already linked to another profile'
      using errcode = '23505';
  end if;

  -- ONE firm-scoped lookup now drives both outputs. Phase B: a role id that
  -- does not resolve inside the invite's own firm is not merely downgraded to
  -- 'engineer' for profiles.role, it is refused for crm_profiles.role_id too —
  -- otherwise this function is the writer that plants a cross-firm role id and
  -- inv_current_actor reads it back as another tenant's admin.
  select r.id,
         case
           when r.key in ('owner', 'architect', 'engineer', 'client')
             then r.key::public.user_role
           else 'engineer'::public.user_role
         end
    into v_role_id, v_role
  from public.crm_roles r
  where r.id = v_inv.role_id and r.firm_id = v_inv.firm_id;

  v_role := coalesce(v_role, 'engineer'::public.user_role);

  if v_inv.role_id is not null and v_role_id is null then
    raise warning 'invite_finalize: invite % carried role_id % which does not belong to firm % — storing NULL',
      v_inv.id, v_inv.role_id, v_inv.firm_id;
  end if;

  -- The write W1a never checked. UPSERT rather than UPDATE, so a missing
  -- placeholder — the exact condition that locked people out — is repaired
  -- rather than silently matching zero rows.
  insert into public.profiles (firm_id, email, full_name, role, auth_uid)
  values (v_inv.firm_id, v_inv.email,
          coalesce(v_inv.full_name, split_part(v_inv.email, '@', 1)),
          v_role, p_auth_uid)
  on conflict (firm_id, email) do update
    set auth_uid  = excluded.auth_uid,
        full_name = coalesce(public.profiles.full_name, excluded.full_name)
  returning id into v_pid;

  get diagnostics v_n = row_count;
  if v_n <> 1 or v_pid is null then
    raise exception 'linking the invite to a profile affected % row(s)', v_n
      using errcode = '25000';
  end if;

  -- The RBAC row. Also upserted, for the same reason. v_role_id, not
  -- v_inv.role_id.
  insert into public.crm_profiles (id, firm_id, email, full_name, role, role_id)
  values (gen_random_uuid()::text, v_inv.firm_id, v_inv.email,
          coalesce(v_inv.full_name, split_part(v_inv.email, '@', 1)),
          v_role::text, v_role_id)
  on conflict (firm_id, lower(email)) do update
    set role_id = coalesce(excluded.role_id, public.crm_profiles.role_id);

  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'linking the invite to an RBAC profile affected % row(s)', v_n
      using errcode = '25000';
  end if;

  -- Belt and braces: prove the account can actually resolve its firm before
  -- telling anyone the redemption succeeded. This is the precise condition
  -- W1a left unverified.
  if not exists (
    select 1 from public.profiles pr
    where pr.auth_uid = p_auth_uid and pr.firm_id = v_inv.firm_id
  ) then
    raise exception 'redemption did not produce a usable profile'
      using errcode = '25000';
  end if;

  return jsonb_build_object(
    'profile_id', v_pid,
    'firm_id',    v_inv.firm_id,
    'email',      v_inv.email
  );
end $$;

-- create or replace does not reset grants, but invite_finalize is service_role
-- only (W1a §5) and this must stay true if the function is ever dropped and
-- recreated rather than replaced.
revoke all on function public.invite_finalize(uuid, uuid) from public, anon, authenticated;
grant execute on function public.invite_finalize(uuid, uuid) to service_role;


-- ── 3 · Repair any row the old code already planted ────────────────────────
-- Fix-forward for state, not just for code. A cross-firm role_id sitting in
-- crm_profiles today is a live privilege grant; replacing the function does not
-- retract it.
do $$
declare v_fixed integer;
begin
  update public.crm_profiles cp
     set role_id = null
   where cp.role_id is not null
     and not exists (
       select 1 from public.crm_roles r
       where r.id = cp.role_id and r.firm_id = cp.firm_id
     );
  get diagnostics v_fixed = row_count;
  if v_fixed > 0 then
    raise warning 'Platform-B: cleared % crm_profiles.role_id value(s) that resolved outside their own firm', v_fixed;
  end if;

  delete from public.user_invites i
   where i.role_id is not null
     and i.accepted_at is null
     and not exists (
       select 1 from public.crm_roles r
       where r.id = i.role_id and r.firm_id = i.firm_id
     );
  get diagnostics v_fixed = row_count;
  if v_fixed > 0 then
    raise warning 'Platform-B: revoked % outstanding invite(s) carrying a foreign role id', v_fixed;
  end if;
end $$;


-- ── 4 · Assertions ─────────────────────────────────────────────────────────

-- The standing invariant: no stored role id resolves outside its own firm.
do $$
declare v_bad integer;
begin
  select count(*) into v_bad
  from public.crm_profiles cp
  where cp.role_id is not null
    and not exists (
      select 1 from public.crm_roles r
      where r.id = cp.role_id and r.firm_id = cp.firm_id
    );
  if v_bad > 0 then
    raise exception 'Platform-B: % crm_profiles row(s) still carry a cross-firm role_id', v_bad;
  end if;

  select count(*) into v_bad
  from public.user_invites i
  where i.role_id is not null
    and i.accepted_at is null
    and not exists (
      select 1 from public.crm_roles r
      where r.id = i.role_id and r.firm_id = i.firm_id
    );
  if v_bad > 0 then
    raise exception 'Platform-B: % outstanding invite(s) still carry a cross-firm role_id', v_bad;
  end if;

  raise notice 'Platform-B verified: every stored role id resolves inside its own firm';
end $$;

-- The join predicate itself must still be there. Strip -- comments before
-- matching, or this passes on the prose above rather than on the code: the
-- header of this very migration contains the string it is looking for.
do $$
declare src text;
begin
  select string_agg(regexp_replace(line, '--.*$', ''), E'\n')
    into src
  from regexp_split_to_table(pg_get_functiondef('public.inv_current_actor()'::regprocedure), E'\n') as line;

  if src !~* 'left\s+join\s+public\.crm_roles\s+r\s+on\s+r\.id\s*=\s*cp\.role_id\s+and\s+r\.firm_id\s*=\s*cp\.firm_id' then
    raise exception 'Platform-B: inv_current_actor no longer scopes the crm_roles join to the actor''s firm';
  end if;

  raise notice 'Platform-B verified: inv_current_actor joins crm_roles within the actor''s own firm';
end $$;

-- invite_finalize must persist the firm-scoped role id, never the raw invite
-- column. Same comment-stripping caveat.
-- Positional rather than one big regex: Postgres ARE caps a bounded repetition
-- at 255, so the obvious `crm_profiles[\s\S]{0,400}v_inv\.role_id` is not a
-- valid pattern at all — it raises "invalid repetition count(s)" and would have
-- looked like a failing assertion rather than a broken one.
do $$
declare
  src  text;
  tail text;
begin
  select string_agg(regexp_replace(line, '--.*$', ''), E'\n')
    into src
  from regexp_split_to_table(pg_get_functiondef('public.invite_finalize(uuid,uuid)'::regprocedure), E'\n') as line;

  if position('insert into public.crm_profiles' in lower(src)) = 0 then
    raise exception 'Platform-B: invite_finalize no longer writes crm_profiles at all';
  end if;

  tail := substr(src, position('insert into public.crm_profiles' in lower(src)));

  if tail ~* 'v_inv\.role_id' then
    raise exception 'Platform-B: invite_finalize still writes the unvalidated invite role_id into crm_profiles';
  end if;
  if tail !~* 'v_role_id' then
    raise exception 'Platform-B: invite_finalize does not write the firm-resolved role id into crm_profiles';
  end if;

  raise notice 'Platform-B verified: invite_finalize persists only a firm-resolved role id';
end $$;
