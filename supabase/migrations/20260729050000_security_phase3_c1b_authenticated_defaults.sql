-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 3 — C1b (second half) · the same landmine, for `authenticated`
--
-- Phase 2 (20260728025000) disarmed the ALTER DEFAULT PRIVILEGES that re-granted
-- every new object to `anon`. It cleared anon ONLY. `authenticated` was left
-- armed, and measured on a database built from the full tree:
--
--     create table public.zz_probe (id int primary key, secret text);
--     → authenticated holds DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
--       TRUNCATE, UPDATE
--
-- So every table a future migration creates is fully writable by any logged-in
-- user of any tenant from the moment it exists. RLS is the only thing standing
-- in the way, and a table whose author forgets `enable row level security` — or
-- writes one permissive policy — has no second line of defence. That is how H2b
-- happened, and it is a landmine under every future table.
--
-- Phase 3's own C8 migration caught this on crm_telephony_calls via its
-- assertion, which is the only reason it was noticed at all: the previous
-- session had to add an explicit revoke to a table it had just created.
--
-- The convention this replaces was "every new table must
-- `revoke all … from anon, authenticated, public` explicitly". That is
-- vigilance, and vigilance is what C1b exists to stop relying on. After this
-- migration the posture inverts: a new table grants NOTHING to a client role,
-- and a migration that wants PostgREST access must say so —
--
--     grant select, insert, update, delete on public.<table> to authenticated;
--
-- which is a deliberate act, reviewable in a diff, next to the RLS policies
-- that scope it. Forgetting it produces a table nobody can read, which surfaces
-- immediately in development; forgetting the old revoke produced a table
-- everybody could write, which surfaces in an audit.
--
-- service_role keeps its defaults. It bypasses RLS, is the edge functions'
-- identity, and is already an unrestricted credential — withholding table
-- grants from it buys nothing and would break every function that reaches
-- PostgREST with the service key.
--
-- EXISTING tables are untouched. Their grants were materialised into their ACLs
-- when they were created; revoking those would break the application outright.
-- RLS is the boundary for them, and Phases 1–3 are what closed it.
--
-- Audit refs: C1b (the `authenticated` half). See also 20260728025000.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · Disarm ─────────────────────────────────────────────────────────────
-- Per-grantor, exactly as Phase 2 did for anon. On hosted Supabase the
-- migration role is `postgres`, which is not a superuser and cannot alter
-- defaults owned by `supabase_admin`; that failure is caught and reported
-- rather than aborting the tree.
do $$
declare r text;
begin
  foreach r in array array['postgres', 'supabase_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke all on tables from authenticated', r);
      execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from authenticated', r);
      execute format(
        'alter default privileges for role %I in schema public revoke all on functions from authenticated', r);

      raise notice 'C1b: cleared authenticated default privileges granted by %', r;
    exception when insufficient_privilege then
      raise warning 'C1b: cannot alter default privileges for role % (needs membership); '
                    'run this statement as that role from the dashboard SQL editor', r;
    end;
  end loop;
end $$;


-- ── 2 · Assertion — the BEHAVIOUR, not the state ───────────────────────────
-- Create a table, look at what a client role received, drop it. A default that
-- can be undone by the next CREATE TABLE has fixed nothing, and only an actual
-- create proves otherwise. This is the assertion Phase 2 wrote for anon; it is
-- the one that would have caught this gap had it also covered authenticated.
do $$
declare leaked text;
begin
  create table public.zz_c1b_authenticated_probe (id int primary key, secret text);

  select string_agg(grantee || ': ' || privilege_type, ', ' order by grantee, privilege_type)
    into leaked
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name   = 'zz_c1b_authenticated_probe'
    and grantee in ('anon', 'authenticated', 'PUBLIC');

  drop table public.zz_c1b_authenticated_probe;

  if leaked is not null then
    raise exception
      'C1b: a newly created table still grants a client role: %. Default '
      'privileges are still armed — every future migration would ship a '
      'client-writable table.', leaked;
  end if;
  raise notice 'C1b verified: a newly created table grants no client role anything';
end $$;

-- Same proof for sequences: a client that can nextval() a sequence it should
-- not see can enumerate and disrupt id allocation on a serial column.
do $$
declare leaked text;
begin
  create table public.zz_c1b_seq_probe (id serial primary key);

  select string_agg(grantee || ': ' || privilege_type, ', ' order by grantee, privilege_type)
    into leaked
  from information_schema.role_usage_grants
  where object_schema = 'public'
    and object_name   = 'zz_c1b_seq_probe_id_seq'
    and grantee in ('anon', 'authenticated', 'PUBLIC');

  drop table public.zz_c1b_seq_probe;

  if leaked is not null then
    raise exception 'C1b: a newly created sequence still grants a client role: %', leaked;
  end if;
  raise notice 'C1b verified: a newly created sequence grants no client role anything';
end $$;

-- And for functions, so a future RPC is not executable until it is granted.
do $$
begin
  create function public.zz_c1b_fn_probe2() returns int language sql immutable as 'select 1';

  if has_function_privilege('authenticated', 'public.zz_c1b_fn_probe2()', 'EXECUTE')
     or has_function_privilege('anon', 'public.zz_c1b_fn_probe2()', 'EXECUTE') then
    drop function public.zz_c1b_fn_probe2();
    raise exception
      'C1b: a newly created function is still executable by a client role — '
      'default privileges are still armed';
  end if;

  drop function public.zz_c1b_fn_probe2();
  raise notice 'C1b verified: a newly created function is not client-executable';
end $$;


-- ── 3 · The application must still work ────────────────────────────────────
-- Existing tables keep the grants they were created with. If this migration had
-- swept them the way Phase 1 swept anon, the product would be dead on arrival,
-- so prove a representative sample is still reachable by `authenticated`.
-- Their tenancy is enforced by RLS, which Phases 1–3 closed; these grants are
-- what let PostgREST reach the policies at all.
do $$
declare
  t       text;
  missing text := '';
begin
  foreach t in array array['profiles', 'crm_profiles', 'crm_leads', 'crm_contacts',
                           'catalog_products', 'quotations', 'purchase_orders'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not has_table_privilege('authenticated', 'public.' || t, 'SELECT') then
      missing := missing || t || ' ';
    end if;
  end loop;

  if missing <> '' then
    raise exception
      'C1b: existing tables lost their authenticated grants (%). This migration '
      'must change DEFAULTS only, never sweep tables that already exist.', missing;
  end if;
  raise notice 'C1b verified: existing tables remain reachable by authenticated';
end $$;


-- ── 4 · Residual, stated plainly ───────────────────────────────────────────
-- Same limit as Phase 2's: on Supabase the migration role `postgres` is not a
-- superuser and cannot alter default privileges owned by `supabase_admin`.
-- Migrations do not run as supabase_admin, so no application object is
-- affected, but the owner should clear it from the dashboard SQL editor, which
-- connects with more privilege. Combined with the statement Phase 2 already
-- asked for, the full pair is:
--
--   alter default privileges for role supabase_admin in schema public
--     revoke all on tables, sequences, functions from anon;
--   alter default privileges for role supabase_admin in schema public
--     revoke all on tables, sequences, functions from authenticated;
--
-- A warning, not an exception: failing the tree for something a migration is
-- structurally unable to fix would only make it unusable.
do $$
declare armed text;
begin
  select string_agg(distinct pg_get_userbyid(d.defaclrole), ', ') into armed
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and array_to_string(d.defaclacl, ',') ~ '(anon|authenticated)=';

  if armed is not null then
    raise warning
      'C1b: default privileges in schema public still grant a client role for '
      'grantor(s): %. Application migrations run as postgres and are '
      'unaffected — clear this from the dashboard SQL editor to fully disarm.',
      armed;
  else
    raise notice 'C1b verified: no grantor in schema public defaults to any client role';
  end if;
end $$;
