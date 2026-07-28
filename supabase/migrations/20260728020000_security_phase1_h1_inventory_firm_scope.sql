-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 1 — H1 (inventory ledger tenant isolation)
--
-- Two distinct defects, both cross-tenant reads by an AUTHENTICATED user.
-- Neither was closed by C1: C1 revoked anon, and anon is not the actor here.
--
--   H1a · `or current_firm_id() is null` on 20 inventory policies.
--         current_firm_id() returns NULL whenever no profiles row matches
--         auth.uid(). The disjunct then evaluates TRUE for every row, so a
--         logged-in user with no matching profile row — a half-provisioned
--         account, an invite mid-redemption, a profile whose auth_uid was
--         never backfilled — reads every firm's ledger. The policy grants
--         MORE access the less identifiable the caller is.
--
--   H1b · stock_balances and stock_position are owner-privileged views.
--         A view without `security_invoker` executes as its owner. The owner
--         here is the migration role, which also owns stock_movements, and a
--         table owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set.
--         So `select * from stock_balances` returned every firm's stock
--         regardless of the policies on the base table. Fixing H1a alone
--         would have left this open — the view is the more direct read.
--
-- The originating migrations (inventory_a/b/c) are corrected in place as well,
-- so a fresh `db reset` builds correctly. This file repairs databases where
-- those already ran.
--
-- Audit ref: H1. See the security audit artifact.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · Preconditions ──────────────────────────────────────────────────────
-- security_invoker views are PostgreSQL 15+. There is no clean equivalent on
-- 14 (the alternatives are revoking the view outright or rewriting it against
-- a security-definer function), so fail loudly rather than silently skip H1b.
do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception
      'H1b needs PostgreSQL 15+ for security_invoker views; found %',
      current_setting('server_version');
  end if;
end $$;


-- ── 1 · H1b — views resolve RLS as the caller, not as their owner ──────────
-- stock_position reads stock_balances, purchase_orders, po_line_items,
-- material_requests and material_request_items. All five carry
-- `to authenticated` policies, so invoker rights are sufficient for a
-- legitimate user and the projection stays firm-scoped end to end.
alter view stock_balances set (security_invoker = true);
alter view stock_position set (security_invoker = true);


-- ── 2 · H1a — rebuild the 20 read policies without the null-firm disjunct ──
-- Also pinned `to authenticated`: these were unqualified, so they applied to
-- PUBLIC. That is redundant now C1 has revoked anon's table grants, but a
-- policy should not depend on a grant elsewhere for its scope.
do $$
declare t text; n int := 0;
begin
  foreach t in array array[
    -- inventory_a · ledger foundation
    'stock_movements','inventory_item_settings','inventory_alerts','inventory_outbox',
    -- inventory_b · requests and RFQ
    'material_requests','material_request_items','rfqs','rfq_items','rfq_vendors','rfq_quote_items',
    -- inventory_c · receipts, transfers, counts
    'goods_receipts','goods_receipt_items','stock_transfers','stock_transfer_items',
    'stock_adjustments','stock_adjustment_items','physical_counts','physical_count_items',
    'stock_consumptions','stock_consumption_items'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (firm_id = public.current_firm_id())',
      t||'_sel', t);
    n := n + 1;
  end loop;
  raise notice 'H1a: rebuilt % inventory select policies', n;
end $$;

-- Writes are unaffected: there are no write policies on any of these tables.
-- Every mutation goes through a SECURITY DEFINER inv_* RPC gated by
-- inv_require() → inv_current_actor(), which resolves from auth.uid() and
-- raises for an unauthenticated caller. That path is the target architecture
-- and is deliberately left alone.


-- ── 3 · Assertions ─────────────────────────────────────────────────────────
-- No policy anywhere may widen access when the caller cannot be identified.
-- Scoped to the whole schema, not just the 20 above, so the pattern cannot
-- reappear in another module without failing this migration.
do $$
declare bad text;
begin
  select string_agg(format('%s.%s', tablename, policyname), ', ' order by format('%s.%s', tablename, policyname))
    into bad
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual, '') ilike '%current_firm_id() IS NULL%'
      or coalesce(with_check, '') ilike '%current_firm_id() IS NULL%');

  if bad is not null then
    raise exception 'H1a: null-firm disjunct still present on: %', bad;
  end if;
  raise notice 'H1a verified: no policy widens access for an unidentified caller';
end $$;

-- Both views must resolve RLS as the invoker.
do $$
declare bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into bad
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relkind  = 'v'
    and c.relname in ('stock_balances','stock_position')
    and coalesce((
      select o.option_value
      from pg_options_to_table(c.reloptions) o
      where o.option_name = 'security_invoker'
    ), 'false') <> 'true';

  if bad is not null then
    raise exception 'H1b: views still execute with owner rights: %', bad;
  end if;
  raise notice 'H1b verified: stock_balances and stock_position are security_invoker';
end $$;

-- Re-assert C1: this migration must not have handed anything back to anon.
do $$
declare n_tbl int;
begin
  select count(*) into n_tbl
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public';

  if n_tbl > 0 then
    raise exception 'H1 regressed C1: anon holds % table grants', n_tbl;
  end if;
end $$;
