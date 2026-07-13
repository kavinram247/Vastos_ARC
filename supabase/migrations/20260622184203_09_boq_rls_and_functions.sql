-- ─────────────────────────────────────────────────────────────
-- Migration 09: RLS + tenant helper + rate resolution function
-- ─────────────────────────────────────────────────────────────

-- Resolve the logged-in user's firm from profiles (no custom JWT hook needed)
create or replace function current_firm_id() returns uuid
language sql stable security definer set search_path = public as $$
  select firm_id from profiles where auth_uid = auth.uid() limit 1
$$;

-- ── Firm-scoped tables: standardized policies via loop ──
do $$
declare t text;
  firm_tables text[] := array[
    'profiles','projects','leads','rooms',
    'rate_cards','discount_tiers','margin_policies',
    'vendors','vendor_skus','vendor_performance',
    'module_instances',
    'boq_documents','boq_sections','boq_line_items','boq_revisions','boq_approvals',
    'quotations','purchase_orders','po_line_items','cost_entries',
    'boq_actual_variance','calibration_runs','ai_extraction_jobs'
  ];
begin
  foreach t in array firm_tables loop
    execute 'alter table '||quote_ident(t)||' enable row level security';
    execute 'create policy '||quote_ident(t||'_sel')||' on '||quote_ident(t)||
            ' for select to authenticated using (firm_id = current_firm_id() or firm_id is null)';
    execute 'create policy '||quote_ident(t||'_mod')||' on '||quote_ident(t)||
            ' for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id())';
  end loop;
end $$;

-- ── firms: a user sees only their own firm ──
alter table firms enable row level security;
create policy firms_sel on firms for select to authenticated using (id = current_firm_id());
create policy firms_mod on firms for all   to authenticated using (id = current_firm_id()) with check (id = current_firm_id());

-- ── Shared catalog tables (global master, nullable/absent firm_id) ──
-- Readable by everyone; firm-scoped writes governed at app layer (hardening: per-product check)
do $$
declare t text;
  shared_tables text[] := array[
    'catalog_categories','catalog_products','product_skus','product_alternates',
    'catalog_embeddings','module_templates','module_rules','regions','labour_activities'
  ];
begin
  foreach t in array shared_tables loop
    execute 'alter table '||quote_ident(t)||' enable row level security';
    execute 'create policy '||quote_ident(t||'_sel')||' on '||quote_ident(t)||
            ' for select to authenticated, anon using (true)';
    execute 'create policy '||quote_ident(t||'_mod')||' on '||quote_ident(t)||
            ' for all to authenticated using (true) with check (true)';
  end loop;
end $$;

-- ── Rate resolution (Section 6 precedence): most specific + currently-valid wins ──
-- region-specific beats national; latest valid_from wins.
create or replace function resolve_rate(
  p_firm uuid, p_sku uuid, p_labour uuid, p_region uuid, p_on date default current_date
) returns numeric
language sql stable as $$
  select rate from rate_cards
   where firm_id = p_firm
     and ( (p_sku is not null and sku_id = p_sku)
        or (p_labour is not null and labour_activity_id = p_labour) )
     and (region_id = p_region or region_id is null)
     and valid_from <= p_on
     and (valid_to is null or valid_to >= p_on)
   order by (region_id = p_region) desc nulls last, valid_from desc
   limit 1
$$;

grant execute on function current_firm_id() to authenticated, anon;
grant execute on function resolve_rate(uuid,uuid,uuid,uuid,date) to authenticated, anon;
