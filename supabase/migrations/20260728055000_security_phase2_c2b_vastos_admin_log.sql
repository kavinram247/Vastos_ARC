-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 2 — C2b · the platform audit log was readable and forgeable
--                          by every authenticated user
--
-- FOUND AT DEPLOY TIME, NOT IN THE TREE. Like C6b, this exists only on the
-- production database and in no migration — the local tree does not create the
-- policy, so no amount of reading migrations would have surfaced it. It was
-- caught by H2b's schema-wide "no unconditional client write policy" assertion
-- refusing to pass against production:
--
--   CREATE POLICY "vastos_admin_log_auth" ON "public"."vastos_admin_log"
--     TO "authenticated" USING (true) WITH CHECK (true);
--
-- vastos_admin_log is the PLATFORM operator's audit trail, not a tenant table.
-- It carries firm_id, firm_name and a details jsonb for every suspend,
-- blacklist and delete performed across every firm. `using (true)` on both
-- sides meant any authenticated user of any tenant could:
--
--   · read the full cross-tenant administration history — which firms exist,
--     which were suspended or blacklisted and why;
--   · INSERT forged entries attributing actions to other firms;
--   · UPDATE or DELETE real ones, so the record of an action could be removed
--     by anyone it was recorded against.
--
-- An audit log that its own subjects can rewrite is not an audit log.
--
-- The table becomes deny-all for client roles, following crm_webhook_tokens
-- (C9) and user_invites (C3): no policy, no grants, reachable only by
-- service_role or a SECURITY DEFINER function. Nothing breaks — C2 removed the
-- super-admin console from the router, and VastosAdminPage.tsx is unreachable
-- dead code (grep: no import, no route). If it is ever revived it needs an
-- operator-checked definer RPC, which is the pattern C3, C8 and C9 established.
--
-- Audit refs: C2 (the console this logged for), H2b (whose assertion caught it).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare r record;
begin
  if to_regclass('public.vastos_admin_log') is null then
    raise notice 'C2b: vastos_admin_log not present, skipping';
    return;
  end if;

  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'vastos_admin_log'
  loop
    execute format('drop policy if exists %I on public.vastos_admin_log', r.policyname);
    raise warning 'C2b: dropped client policy vastos_admin_log.% — the platform '
                  'audit log was readable and forgeable by any authenticated user',
                  r.policyname;
  end loop;

  execute 'alter table public.vastos_admin_log enable row level security';
  execute 'revoke all on public.vastos_admin_log from anon, authenticated, public';
end $$;


-- ── Assertion ──────────────────────────────────────────────────────────────
do $$
declare bad text;
begin
  if to_regclass('public.vastos_admin_log') is null then
    return;
  end if;

  select string_agg(policyname, ', ') into bad
  from pg_policies
  where schemaname = 'public' and tablename = 'vastos_admin_log';
  if bad is not null then
    raise exception 'C2b: vastos_admin_log still carries client policies: %', bad;
  end if;

  select string_agg(grantee, ', ') into bad
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'vastos_admin_log'
    and grantee in ('anon', 'authenticated', 'PUBLIC');
  if bad is not null then
    raise exception 'C2b: vastos_admin_log is still reachable by: %', bad;
  end if;

  raise notice 'C2b verified: the platform audit log is deny-all for client roles';
end $$;
