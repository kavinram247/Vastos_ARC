-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 2 — C1b · disarm the default privileges that re-grant anon
--
-- NOT IN THE ORIGINAL AUDIT. Found while adding the Phase 2 RPCs, when an
-- assertion carried over from Phase 1 failed on a function that had never been
-- granted to anyone.
--
-- Phase 1 (C1) revoked every anon grant and asserted "anon holds 0 table grants
-- and 0 executable app functions". That was true at the moment it ran, and it
-- is still true now. But it is a CLEANUP, not a BOUNDARY: the Supabase image
-- ships ALTER DEFAULT PRIVILEGES in schema public granting, to anon,
--
--     tables    → arwdDxtm   (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, …)
--     functions → X          (EXECUTE)
--     sequences → rwU
--
-- for BOTH the `postgres` and `supabase_admin` grantors. So every object a
-- future migration creates is handed to anon the instant it exists. Measured on
-- a local database built from the full tree, immediately after Phase 1:
--
--     create table public.zz_probe (id int primary key, secret text);
--     → anon holds DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--     → the C1 assertion's count goes 0 → 7
--
-- One ordinary CREATE TABLE in any later feature migration silently reopens
-- C1 on that table. The next developer to add a table would have shipped a
-- publicly readable and writable table without doing anything wrong.
--
-- This migration removes the grant mechanism itself, so C1 stays closed by
-- default instead of by vigilance. It is ordered BEFORE the Phase 2 RPCs so
-- that those functions are never granted to anon in the first place.
--
-- Audit refs: C1 (durability of). See the security audit artifact.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · Disarm ─────────────────────────────────────────────────────────────
-- Default ACLs are recorded per grantor role. Both grantors present in the
-- Supabase image must be cleared, or objects created by the other one still
-- carry the grant. Wrapped per-role: on hosted Supabase the migration runs as
-- `postgres`, which may not be permitted to alter defaults owned by
-- `supabase_admin`. A failure there must not abort the migration — the
-- assertion at the foot reports precisely what remains.
do $$
declare
  r text;
begin
  foreach r in array array['postgres', 'supabase_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke all on tables from anon', r);
      execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from anon', r);
      execute format(
        'alter default privileges for role %I in schema public revoke all on functions from anon', r);

      -- PUBLIC is the other route by which anon inherits EXECUTE (Phase 1 §3),
      -- and it needs the GLOBAL form — deliberately no `in schema public`.
      -- PostgreSQL's built-in default grants EXECUTE on every new function to
      -- PUBLIC. Schema-scoped default privileges are ADDED TO that built-in
      -- default, they do not replace it, so the `in schema public` variant
      -- leaves the `=X/postgres` (PUBLIC) ACL entry untouched and anon keeps
      -- EXECUTE through its PUBLIC membership. Verified both ways locally:
      -- with `in schema public` a fresh function still returned
      -- has_function_privilege('anon', …) = true; without it, false.
      --
      -- The global form reaches functions this role creates in any schema.
      -- That is intended: EXECUTE-to-PUBLIC by default is the exact mechanism
      -- Phase 1 had to clean up by hand. Callers that should keep access are
      -- granted explicitly — the schema-public defaults still carry
      -- authenticated and service_role.
      execute format(
        'alter default privileges for role %I revoke execute on functions from public', r);

      raise notice 'C1b: cleared default privileges granted by %', r;
    exception when insufficient_privilege then
      raise warning 'C1b: cannot alter default privileges for role % (needs membership); '
                    'run this statement as that role', r;
    end;
  end loop;
end $$;


-- ── 2 · Sweep anything the defaults already handed out ─────────────────────
-- Phase 1 ran before these Phase 2 objects existed; re-run the revoke so the
-- post-condition holds at this point in the tree regardless of what was created
-- in between.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;


-- ── 3 · Assertion — prove the mechanism is disarmed, not just tidied ────────
-- Phase 1 asserted the STATE (0 grants). This asserts the BEHAVIOUR: create a
-- table, look at what anon received, drop it. A cleanup that can be undone by
-- the next CREATE TABLE has not fixed anything, and only an actual create
-- proves otherwise.
do $$
declare
  leaked text;
begin
  create table public.zz_c1b_default_privilege_probe (id int primary key);

  select string_agg(privilege_type, ', ' order by privilege_type) into leaked
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name   = 'zz_c1b_default_privilege_probe'
    and grantee      = 'anon';

  drop table public.zz_c1b_default_privilege_probe;

  if leaked is not null then
    raise exception
      'C1b: a newly created table still grants anon: %. Default privileges are '
      'still armed — every future migration would reopen C1.', leaked;
  end if;
  raise notice 'C1b verified: a newly created table grants anon nothing';
end $$;

-- Same proof for functions.
do $$
begin
  create function public.zz_c1b_fn_probe() returns int language sql immutable as 'select 1';

  if has_function_privilege('anon', 'public.zz_c1b_fn_probe()', 'EXECUTE') then
    drop function public.zz_c1b_fn_probe();
    raise exception
      'C1b: a newly created function is still anon-executable — default '
      'privileges are still armed';
  end if;

  drop function public.zz_c1b_fn_probe();
  raise notice 'C1b verified: a newly created function is not anon-executable';
end $$;

-- And the Phase 1 post-condition still holds.
do $$
declare n_tbl int;
begin
  select count(*) into n_tbl
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public';
  if n_tbl > 0 then
    raise exception 'C1b: anon holds % table grants', n_tbl;
  end if;
end $$;


-- ── 4 · Residual, stated plainly ───────────────────────────────────────────
-- The probes above create their objects as the migration role. On Supabase the
-- migration role is `postgres`, which is NOT a superuser (pg_user.usesuper = f,
-- confirmed locally) and therefore cannot alter default privileges owned by
-- `supabase_admin` — that statement fails with "permission denied to change
-- default privileges".
--
-- So this migration disarms the grantor that actually creates application
-- objects, and cannot disarm the Supabase-owned one. Objects created BY
-- supabase_admin in schema public would still be granted to anon. Migrations
-- do not run as supabase_admin, so no application table is affected; the gap is
-- real but out of reach from here, and the owner should clear it from the
-- dashboard SQL editor (which connects with more privilege):
--
--   alter default privileges for role supabase_admin in schema public
--     revoke all on tables, sequences, functions from anon;
--
-- Reported as a WARNING, not an exception: failing the migration for something
-- a migration is structurally unable to fix would only make the tree unusable.
do $$
declare armed text;
begin
  select string_agg(distinct pg_get_userbyid(d.defaclrole), ', ') into armed
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and array_to_string(d.defaclacl, ',') like '%anon=%';

  if armed is not null then
    raise warning
      'C1b: default privileges still grant anon for grantor(s): %. Application '
      'migrations run as postgres and are unaffected, but clear this from the '
      'dashboard SQL editor to fully disarm.', armed;
  else
    raise notice 'C1b verified: no grantor in schema public defaults to anon';
  end if;
end $$;
