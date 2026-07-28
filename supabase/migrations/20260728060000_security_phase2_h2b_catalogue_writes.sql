-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 2 — H2b · the shared catalogue was writable by any tenant
--
-- NOT IN THE ORIGINAL AUDIT as a write finding. The audit filed H2 as "IDOR on
-- every update/delete path" across crmApi / attendanceApi / poApi / docsApi.
-- Tested against a local database built from the full migration tree, that
-- claim does not reproduce — see the note at the foot of this file. What DID
-- reproduce was this, which the audit did not have:
--
--   Nine catalogue tables carry
--       for all to authenticated using (true) with check (true)
--   i.e. no firm predicate at all, on either side.
--
-- Confirmed live as an ordinary owner of firm B, against firm A's data and the
-- shared catalogue:
--
--   PATCH /rest/v1/catalog_products?id=eq.<global row>
--     {"gst_rate":0,"waste_factor":0.99,"name":"POISONED BY FIRM B"}   → 200
--   PATCH /rest/v1/labour_activities?id=eq.<any>                       → 200
--   PATCH /rest/v1/product_skus?id=eq.<any>                            → 200
--
-- Every firm's BOQ is priced from these rows: catalog_products.gst_rate and
-- waste_factor, product_skus rates, labour_activities. A competitor with a
-- trial account could set a rival's waste factor to 0.99 or their GST to zero
-- and silently corrupt every estimate that firm produces. It is a
-- financial-integrity defect, not merely a data-integrity one.
--
-- ── What this migration does, and what it does NOT do ──────────────────────
-- THIS IS A PARTIAL MITIGATION. H2b is NOT closed by it. Read the numbers
-- before relying on it — they were measured, not assumed:
--
--   after this migration, the identical PATCH above
--     · as a site engineer (low-privilege insider)  → 200, 0 rows changed  BLOCKED
--     · as a firm owner    (any signed-up tenant)   → 200, 1 row changed   STILL WORKS
--
-- The policy requires catalog:edit. crm_has_permission() passes firm owners
-- unconditionally — correctly, they administer their own firm — and every
-- account that signs up is the owner of its own firm. So the gate stops a
-- low-privilege user inside a tenant, which is a real and worthwhile
-- reduction, and does NOT stop the attacker in the reproduction above, who
-- only had to register.
--
-- The complete fix is to make global (firm_id IS NULL) rows read-only to every
-- tenant. That is not taken here because on this database EVERY catalogue row
-- is global — catalog_products 38/38, labour_activities 16/16,
-- module_templates 14/14 — and CatalogAdminPage's waste-factor editor, the
-- module template editor and the rule editor all write exactly those rows.
-- Making them read-only closes the finding and simultaneously breaks three
-- working admin surfaces for every tenant, with no migration path for the
-- per-firm overrides that would have to replace them.
--
-- That is the open question the audit already flagged against
-- 20260622184203_09_boq_rls_and_functions.sql:27 — are these rows a global
-- catalogue, and may a tenant write one? It needs a product decision
-- (most likely per-firm override rows, copy-on-write), not a unilateral one
-- taken inside a security migration.
--
--   RESIDUAL, OPEN — any tenant owner can still edit a shared global catalogue
--   row, and the edit is visible to every other firm. Financial integrity of
--   every tenant's estimates depends on a product decision that has not been
--   made. Do not record H2b as closed.
--
-- Audit refs: H2 (reframed), and the global-catalogue product question.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  t         text;
  has_firm  boolean;
  pred      text;
begin
  foreach t in array array[
    'catalog_categories', 'catalog_products', 'catalog_embeddings',
    'labour_activities',  'module_rules',     'module_templates',
    'product_alternates', 'product_skus',     'regions'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise warning 'H2b: %s not present, skipping', t;
      continue;
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'firm_id'
    ) into has_firm;

    -- Firm-scoped rows stay firm-scoped. Global rows (firm_id IS NULL) remain
    -- writable — see the residual above. Tables with no firm_id at all are
    -- global by construction and get the permission check only.
    if has_firm then
      pred := '(firm_id = public.current_firm_id() or firm_id is null)'
              || ' and public.crm_has_permission(''catalog'', ''edit'')';
    else
      pred := 'public.crm_has_permission(''catalog'', ''edit'')';
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_mod', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (%s) with check (%s)',
      t || '_mod', t, pred, pred);
  end loop;
end $$;


-- ── Assertion ──────────────────────────────────────────────────────────────
-- No write policy for a client role anywhere in the schema may be
-- unconditional. This is schema-wide on purpose: it catches the next table
-- someone adds with `using (true)` as well as the nine fixed above.
do $$
declare bad text;
begin
  select string_agg(tablename || '.' || policyname, ', ' order by tablename)
    into bad
  from pg_policies
  where schemaname = 'public'
    and roles && array['authenticated','anon','public']::name[]
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and (coalesce(qual, 'true') = 'true' and coalesce(with_check, 'true') = 'true');

  if bad is not null then
    raise exception
      'H2b: unconditional client write policies remain: %', bad;
  end if;
  raise notice 'H2b verified: no unconditional client write policy in schema public';
end $$;


-- ── For the record: the audit's H2, as filed, does not reproduce ───────────
-- The tables named in the finding (crm_* via crmApi, attendance_records,
-- purchase_orders, purchase_material_requests) all carry
--   for all to authenticated
--     using (firm_id = current_firm_id()) with check (firm_id = current_firm_id())
-- and current_firm_id() is SECURITY DEFINER resolving from auth.uid(), so it is
-- not forgeable the way the x-crm-role-id header was (C4). Tested as firm B's
-- owner against firm A's rows: PATCH and DELETE both returned 200 with an empty
-- result set — zero rows matched — and the target rows were unchanged.
--
-- The missing `.eq('firm_id', …)` in those client helpers is therefore a
-- defence-in-depth gap, not a live IDOR: RLS already refuses the write. It has
-- been added anyway (same commit) so the client and the database agree, and so
-- a future policy regression is not silently load-bearing.
--
-- Asserted here so that if any of those policies is ever loosened, this
-- migration fails rather than the claim quietly becoming false.
do $$
declare unscoped text;
begin
  select string_agg(tablename || '.' || policyname, ', ' order by tablename)
    into unscoped
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'crm_projects', 'crm_leads', 'crm_profiles', 'crm_cost_entries',
      'crm_payments_received', 'attendance_records', 'purchase_orders',
      'purchase_material_requests', 'quotations', 'payment_schedules'
    )
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and roles && array['authenticated','anon','public']::name[]
    and coalesce(qual, '')       !~ 'current_firm_id'
    and coalesce(with_check, '') !~ 'current_firm_id';

  if unscoped is not null then
    raise exception
      'H2: these write policies no longer carry a firm predicate: %', unscoped;
  end if;
  raise notice 'H2 verified: every audited write path is firm-scoped at the database';
end $$;
