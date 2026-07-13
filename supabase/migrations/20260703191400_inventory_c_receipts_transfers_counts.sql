-- ════════════════════════════════════════════════════════════════════════
-- Migration C: extend PO for the inventory flow; add Goods Receipts, Transfers,
-- Adjustments, Physical Counts, Consumption; add the projected-position view.
-- ════════════════════════════════════════════════════════════════════════

-- ── Extend purchase_orders / po_line_items ─────────────────────────────────
alter table purchase_orders
  add column if not exists crm_project_id text references crm_projects(id) on delete set null, -- inventory anchor
  add column if not exists milestone_id text,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists closed_at timestamptz,
  add column if not exists version integer not null default 1;

-- Re-point the loose uuid links onto the rebuilt tables.
do $$ begin
  alter table purchase_orders
    add constraint purchase_orders_mr_fk foreign key (material_request_id)
    references material_requests(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table purchase_orders
    add constraint purchase_orders_rfq_fk foreign key (rfq_id)
    references rfqs(id) on delete set null;
exception when duplicate_object then null; end $$;

-- base-uom quantities let the position view compute on_order without per-row
-- uom conversion (kept null for legacy BOQ-world generatePO rows).
alter table po_line_items
  add column if not exists qty_base numeric,
  add column if not exists qty_received_base numeric not null default 0,
  add column if not exists mr_item_id uuid references material_request_items(id) on delete set null;

-- ── Goods Receipts (GRN) ───────────────────────────────────────────────────
create table goods_receipts (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  grn_number     text not null,
  po_id          uuid references purchase_orders(id) on delete set null,
  crm_project_id text references crm_projects(id) on delete set null,
  vendor_id      uuid references vendors(id),
  location       text,
  delivery_date  date not null default current_date,
  challan_no     text,
  received_by    text,
  received_by_name text,
  status         grn_status not null default 'draft',
  notes          text,
  created_by     text,
  created_by_name text,
  posted_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, grn_number)
);
create table goods_receipt_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  grn_id        uuid not null references goods_receipts(id) on delete cascade,
  po_line_id    uuid references po_line_items(id) on delete set null,
  sku_id        uuid references product_skus(id),
  material_name text not null default '',
  uom           uom,
  ordered_qty       numeric not null default 0,
  prev_received_qty numeric not null default 0,
  delivered_qty     numeric not null default 0,
  accepted_qty      numeric not null default 0 check (accepted_qty >= 0),
  rejected_qty      numeric not null default 0,
  damaged_qty       numeric not null default 0,
  rejection_reason  text,
  quality_notes     text,
  batch_ref         text,
  unit_cost         numeric,
  order_index       integer not null default 0
);
create index goods_receipt_items_grn_idx on goods_receipt_items (grn_id);
create index goods_receipts_po_idx on goods_receipts (po_id);

-- ── Stock Transfers (project↔project / location↔location) ──────────────────
create table stock_transfers (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  transfer_number text not null,
  from_project   text not null references crm_projects(id) on delete cascade,
  to_project     text not null references crm_projects(id) on delete cascade,
  from_location  text,
  to_location    text,
  status         transfer_status not null default 'draft',
  dispatched_at  timestamptz,
  received_at    timestamptz,
  note           text,
  created_by     text,
  created_by_name text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, transfer_number)
);
create table stock_transfer_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  transfer_id   uuid not null references stock_transfers(id) on delete cascade,
  sku_id        uuid not null references product_skus(id),
  uom           uom not null,
  quantity      numeric not null default 0 check (quantity > 0),
  dispatched_qty numeric not null default 0,
  received_qty   numeric not null default 0,
  order_index    integer not null default 0
);
create index stock_transfer_items_idx on stock_transfer_items (transfer_id);

-- ── Stock Adjustments (write-off, supplier return, corrections) ────────────
create table stock_adjustments (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  adjustment_number text not null,
  crm_project_id text not null references crm_projects(id) on delete cascade,
  location       text,
  kind           text not null default 'negative', -- positive|negative|write_off|supplier_return
  reason         text,
  status         adjustment_status not null default 'draft',
  evidence_url   text,
  requested_by   text,
  requested_by_name text,
  approved_by    text,
  approved_by_name text,
  approved_at    timestamptz,
  posted_at      timestamptz,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, adjustment_number)
);
create table stock_adjustment_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  adjustment_id uuid not null references stock_adjustments(id) on delete cascade,
  sku_id        uuid not null references product_skus(id),
  uom           uom not null,
  quantity      numeric not null default 0 check (quantity > 0),
  unit_cost     numeric,
  note          text,
  order_index   integer not null default 0
);

-- ── Physical Counts (variance reconciliation) ──────────────────────────────
create table physical_counts (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  count_number   text not null,
  crm_project_id text not null references crm_projects(id) on delete cascade,
  location       text,
  status         count_status not null default 'draft',
  counted_at     date not null default current_date,
  note           text,
  created_by     text,
  created_by_name text,
  posted_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, count_number)
);
create table physical_count_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  count_id      uuid not null references physical_counts(id) on delete cascade,
  sku_id        uuid not null references product_skus(id),
  uom           uom not null,
  system_qty    numeric not null default 0,   -- snapshot at post
  counted_qty   numeric not null default 0,
  variance_qty  numeric not null default 0,
  note          text,
  order_index   integer not null default 0
);

-- ── Site Consumption ───────────────────────────────────────────────────────
create table stock_consumptions (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  consumption_number text not null,
  crm_project_id text not null references crm_projects(id) on delete cascade,
  location       text,
  milestone_id   text,
  task_id        text,
  consumed_at    date not null default current_date,
  entered_by     text,
  entered_by_name text,
  note           text,
  photo_url      text,
  status         consumption_status not null default 'draft',
  posted_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, consumption_number)
);
create table stock_consumption_items (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  consumption_id uuid not null references stock_consumptions(id) on delete cascade,
  sku_id         uuid not null references product_skus(id),
  uom            uom not null,
  quantity       numeric not null default 0 check (quantity > 0),
  boq_line_id    uuid references boq_line_items(id) on delete set null,
  unit_cost      numeric,
  order_index    integer not null default 0
);
create index stock_consumption_items_idx on stock_consumption_items (consumption_id);

-- ── Projected position = ledger balances + on_order − approved demand ──────
create or replace view stock_position as
with onord as (
  select po.firm_id, po.crm_project_id as project_id, li.sku_id,
         sum(coalesce(li.qty_base, 0) - coalesce(li.qty_received_base, 0)) as on_order
  from purchase_orders po
  join po_line_items li on li.po_id = po.id
  where li.sku_id is not null and po.crm_project_id is not null
    and po.status in ('approved','issued','partially_received')
  group by po.firm_id, po.crm_project_id, li.sku_id
),
demand as (
  select mr.firm_id, mr.project_id, it.sku_id,
         sum(greatest(coalesce(it.approved_qty, it.required_qty) - it.ordered_qty, 0)) as approved_demand
  from material_requests mr
  join material_request_items it on it.request_id = mr.id
  where it.sku_id is not null and mr.status in ('approved','in_procurement','partially_ordered')
  group by mr.firm_id, mr.project_id, it.sku_id
)
select
  coalesce(b.firm_id, o.firm_id, d.firm_id)       as firm_id,
  coalesce(b.project_id, o.project_id, d.project_id) as project_id,
  coalesce(b.sku_id, o.sku_id, d.sku_id)          as sku_id,
  coalesce(b.on_hand, 0)   as on_hand,
  coalesce(b.reserved, 0)  as reserved,
  coalesce(b.available, 0) as available,
  coalesce(o.on_order, 0)  as on_order,
  coalesce(d.approved_demand, 0) as approved_demand,
  coalesce(b.available, 0) + coalesce(o.on_order, 0) - coalesce(d.approved_demand, 0) as projected,
  b.last_movement_at
from stock_balances b
full join onord o  on o.firm_id = b.firm_id and o.project_id = b.project_id and o.sku_id = b.sku_id
full join demand d on d.firm_id = coalesce(b.firm_id,o.firm_id) and d.project_id = coalesce(b.project_id,o.project_id) and d.sku_id = coalesce(b.sku_id,o.sku_id);

-- ── RLS + grants ───────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'goods_receipts','goods_receipt_items','stock_transfers','stock_transfer_items',
    'stock_adjustments','stock_adjustment_items','physical_counts','physical_count_items',
    'stock_consumptions','stock_consumption_items'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'drop policy if exists %I on %I; create policy %I on %I for select using (firm_id = current_firm_id() or current_firm_id() is null);',
      t||'_sel', t, t||'_sel', t);
    execute format('grant select on %I to anon, authenticated;', t);
  end loop;
end $$;
grant select on stock_position to anon, authenticated;