-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 2 — C6 · in-tenant privilege escalation by self-assigned role
--
-- NOT IN THE ORIGINAL AUDIT. Found while building the H4 approval gate, by
-- asking the obvious follow-up question: if approval requires a permission,
-- can the caller simply give themselves that permission?
--
-- They could. Confirmed live against a local database built from the full
-- migration tree, as an ordinary site engineer holding a valid session:
--
--   PATCH /rest/v1/profiles?email=eq.engineer@…   {"role":"owner"}        → 200
--   PATCH /rest/v1/crm_profiles?id=eq.crm-eng-1   {"role_id":"role-admin"} → 200
--     crm_has_permission('purchase','approve')  false → TRUE
--
-- Both tables carry `_mod` policies of the form
--   for all to authenticated using (firm_id = current_firm_id())
--                          with check (firm_id = current_firm_id())
-- which is correct for TENANT isolation — Phase 1 verified cross-firm writes
-- are refused — but says nothing about WHICH COLUMNS a member may rewrite
-- inside their own firm. `role` and `role_id` are the inputs to every
-- authorization decision in the system:
--
--   crm_has_permission()  → profiles.role = 'owner', or crm_profiles.role_id
--   inv_current_actor()   → coalesce(crm_roles.is_admin, profiles.role='owner')
--
-- So any authenticated member of a firm was one PATCH away from being its
-- administrator. Every server-side permission gate in the application — the
-- inv_* ledger RPCs, the marketing policies, and the H4 PO-approval gate added
-- in this same phase — rests on values the subject of the check could rewrite.
-- This lands with H4 because H4 is meaningless without it.
--
-- RLS cannot express "these columns are off limits"; policies are row-scoped,
-- not column-scoped. Column-level REVOKE could, but fails open in an
-- unpleasant direction: a column added by a later migration is not covered by
-- the grant list, and the failure appears as a broken feature rather than as a
-- security error. A trigger states the rule once, in one place, and any new
-- privileged column is added to the same list.
--
-- Audit refs: C4 (same class, different vector), H4 (depends on this).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · Who counts as an administrator ─────────────────────────────────────
-- Resolved entirely from auth.uid(), never from a client-supplied value —
-- the Phase 1 rule. Mirrors crm_has_permission()'s admin arm so there is one
-- definition of "admin" rather than two that can drift.
create or replace function public.crm_actor_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.auth_uid = auth.uid() and pr.role = 'owner'
  )
  or exists (
    select 1
    from public.profiles pr
    join public.crm_profiles cp
      on cp.email = pr.email and cp.firm_id = pr.firm_id
    join public.crm_roles r
      on r.id = cp.role_id and r.firm_id = cp.firm_id
    where pr.auth_uid = auth.uid()
      and r.enabled
      and r.is_admin
  );
$$;


-- ── 2 · The guard ──────────────────────────────────────────────────────────
-- Two rules, in order:
--   1. You may never change the privilege columns on your OWN row. Not even as
--      an administrator — that is the segregation-of-duties principle H4 asks
--      for, applied to the permission system itself. An admin who needs their
--      own role changed asks another admin, exactly as they would for an
--      approval.
--   2. Anyone else's privilege columns may only be changed by an administrator.
--
-- auth.uid() IS NULL means there is no end-user session: the service role, an
-- edge function, or a migration. Those are allowed through — they already
-- bypass RLS entirely, so refusing here would only break the accept-invite
-- function while adding no protection. anon cannot reach these tables at all
-- (C1 left it with zero table grants), so this is not a hole.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_self boolean;
begin
  if auth.uid() is null then
    return new;                                   -- service_role / migration
  end if;

  if tg_op = 'UPDATE'
     and new.role    is not distinct from old.role
     and new.firm_id is not distinct from old.firm_id then
    return new;                                   -- nothing privileged changed
  end if;

  if tg_op = 'INSERT' and new.role = 'engineer' then
    return new;                                   -- the least-privilege default
  end if;

  select exists (
    select 1 from public.profiles pr
    where pr.auth_uid = auth.uid()
      and pr.email = coalesce(new.email, old.email)
      and pr.firm_id = coalesce(new.firm_id, old.firm_id)
  ) into v_is_self;

  if v_is_self then
    raise exception
      'you cannot change your own role — ask another administrator'
      using errcode = '42501';
  end if;

  if not public.crm_actor_is_admin() then
    raise exception
      'only an administrator may set a user role'
      using errcode = '42501';
  end if;

  return new;
end $$;


-- crm_profiles carries the RBAC role id; same rules, different column.
create or replace function public.guard_crm_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_self boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.role_id is not distinct from old.role_id
     and new.firm_id is not distinct from old.firm_id then
    return new;
  end if;

  -- An INSERT with no role at all grants nothing; let it through so ordinary
  -- profile creation does not require admin.
  if tg_op = 'INSERT' and new.role_id is null then
    return new;
  end if;

  select exists (
    select 1 from public.profiles pr
    where pr.auth_uid = auth.uid()
      and pr.email = coalesce(new.email, old.email)
      and pr.firm_id = coalesce(new.firm_id, old.firm_id)
  ) into v_is_self;

  if v_is_self then
    raise exception
      'you cannot change your own role — ask another administrator'
      using errcode = '42501';
  end if;

  if not public.crm_actor_is_admin() then
    raise exception
      'only an administrator may set a user role'
      using errcode = '42501';
  end if;

  return new;
end $$;


drop trigger if exists guard_profile_privileges_trg on public.profiles;
create trigger guard_profile_privileges_trg
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();

drop trigger if exists guard_crm_profile_privileges_trg on public.crm_profiles;
create trigger guard_crm_profile_privileges_trg
  before insert or update on public.crm_profiles
  for each row execute function public.guard_crm_profile_privileges();


-- ── 3 · Close the second door: a duplicate self-row ────────────────────────
-- crm_current_role_id() and crm_has_permission() resolve the caller's identity
-- with `... where pr.auth_uid = auth.uid() limit 1`. With no uniqueness on
-- (firm_id, email), a member could INSERT a SECOND crm_profiles row carrying
-- their own email and an admin role_id; the join would then have two candidate
-- rows and `limit 1` could return the privileged one. The trigger above
-- already refuses that insert, but the ambiguity is worth removing outright —
-- an authorization lookup that depends on `limit 1` over a non-unique set is a
-- latent bug regardless of who can write to it.
do $$
declare dupes int;
begin
  select count(*) into dupes from (
    select firm_id, lower(email) from public.crm_profiles
    group by firm_id, lower(email) having count(*) > 1
  ) d;
  if dupes > 0 then
    raise warning
      'C6: % (firm_id, email) duplicate group(s) already exist in crm_profiles; '
      'the unique index is being skipped. Resolve them, then add it by hand.', dupes;
  else
    create unique index if not exists crm_profiles_firm_email_uniq
      on public.crm_profiles (firm_id, lower(email));
  end if;
end $$;


-- ── 4 · Assertions ─────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'C6: profiles missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname  = 'guard_profile_privileges_trg'
      and not tgisinternal
  ) then
    raise exception 'C6: the profiles privilege guard is not installed';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.crm_profiles'::regclass
      and tgname  = 'guard_crm_profile_privileges_trg'
      and not tgisinternal
  ) then
    raise exception 'C6: the crm_profiles privilege guard is not installed';
  end if;

  raise notice 'C6 verified: privilege guards installed on profiles and crm_profiles';
end $$;

-- ── C6b · production drift had re-opened the role tables ───────────────────
-- The role tables must stay unwritable by clients: Phase 1 gives crm_roles a
-- SELECT policy only, because an is_admin flip sidesteps every guard above.
-- The assertion at the foot of this block was written to confirm that.
--
-- On the first production deploy it FIRED, and it was right to. Production
-- carried two policies that exist in no migration:
--
--   crm_roles_mod             TO authenticated USING (firm_id = current_firm_id())
--   crm_role_permissions_mod  TO authenticated USING (firm_id = current_firm_id())
--
-- No command clause means FOR ALL, so any authenticated member of a firm could
--     update crm_roles set is_admin = true where firm_id = <their own>
-- and become an administrator directly — the C4/C6 escalation, live, through a
-- door that only ever existed on the deployed database. Created out-of-band and
-- never recorded, so no amount of reading the migration tree would have found
-- it; only running the assertion against production did.
--
-- Asserting is therefore not enough. Drop any client-writable policy on these
-- two tables first, then assert. The drop is generic rather than by name so it
-- also catches whatever the next out-of-band edit is called.
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('crm_roles', 'crm_role_permissions')
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and roles && array['authenticated', 'anon', 'public']::name[]
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    raise warning 'C6b: dropped client-writable policy %.% — it allowed a '
                  'direct is_admin flip', r.tablename, r.policyname;
  end loop;
end $$;

-- Now assert. Reaching this with anything left means the drop above missed it.
do $$
declare w text;
begin
  select string_agg(policyname, ', ') into w
  from pg_policies
  where schemaname = 'public'
    and tablename in ('crm_roles', 'crm_role_permissions')
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and roles && array['authenticated','anon','public']::name[];

  if w is not null then
    raise exception
      'C6: crm_roles/crm_role_permissions have client-writable policies (%) — '
      'is_admin could be flipped directly', w;
  end if;
  raise notice 'C6 verified: role tables remain read-only to clients';
end $$;
