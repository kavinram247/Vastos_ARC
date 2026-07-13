begin;

-- ── 1. New, correctly-scoped link columns on purchase_orders ─
alter table purchase_orders add column if not exists purchase_rfq_id uuid
  references purchase_rfqs(id) on delete set null;
alter table purchase_orders add column if not exists purchase_material_request_id uuid
  references purchase_material_requests(id) on delete set null;

create index if not exists purchase_orders_purchase_rfq_idx on purchase_orders(purchase_rfq_id);
create index if not exists purchase_orders_purchase_mr_idx  on purchase_orders(purchase_material_request_id);

-- ── 2. Firm-scoped RLS for Purchase Management's own tables ──
do $$
declare t text;
begin
  foreach t in array array[
    'po_payments','purchase_material_requests','purchase_material_request_items',
    'purchase_rfqs','purchase_rfq_items','purchase_rfq_vendors','project_stock','work_orders'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_anon_dev', t);
    execute format(
      'create policy %I on %I for all to anon using (true) with check (true)',
      t || '_anon_dev', t);

    execute format('drop policy if exists %I on %I', t || '_mod', t);
    execute format(
      'create policy %I on %I for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id())',
      t || '_mod', t);

    execute format('drop policy if exists %I on %I', t || '_sel', t);
    execute format(
      'create policy %I on %I for select to authenticated using (firm_id = current_firm_id() or firm_id is null)',
      t || '_sel', t);
  end loop;
end $$;

commit;