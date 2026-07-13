-- ════════════════════════════════════════════════════════════════════════
-- Migration B: drop the empty Frappe-clone scaffolding; rebuild Material
-- Requests + RFQ/Quotes as VastoArch-native, state-machine tables anchored on
-- crm_projects (text id). All 0-row, UI-less; safe to replace.
-- ════════════════════════════════════════════════════════════════════════
drop table if exists material_request_items cascade;
drop table if exists material_requests cascade;
drop table if exists rfq_items cascade;
drop table if exists rfq_vendors cascade;
drop table if exists rfqs cascade;
drop table if exists project_stock cascade;   -- editable current_stock anti-pattern → replaced by ledger
drop table if exists work_orders cascade;      -- labour work-orders: out of inventory scope

-- ── Material Requests ──────────────────────────────────────────────────────
create table material_requests (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  request_number text not null,
  project_id     text not null references crm_projects(id) on delete cascade,
  location       text,
  milestone_id   text,                      -- soft link → crm_milestones
  boq_id         uuid references boq_documents(id) on delete set null,
  requester_id   text,                      -- crm_profiles.id
  requester_name text,
  status         mr_status not null default 'draft',
  priority       text not null default 'medium',   -- low|medium|high|urgent
  source         text not null default 'manual',   -- boq|milestone|site|low_stock|scope_change|replacement|manual
  required_by    date,
  notes          text,
  submitted_at   timestamptz,
  approved_at    timestamptz,
  approver_id    text,
  approver_name  text,
  rejected_reason text,
  version        integer not null default 1,        -- optimistic lock
  created_by     text,
  created_by_name text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, request_number)
);

create table material_request_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  request_id    uuid not null references material_requests(id) on delete cascade,
  sku_id        uuid references product_skus(id),
  material_name text not null default '',
  specification text,
  uom           uom,
  required_qty  numeric not null default 0 check (required_qty >= 0),
  available_qty numeric not null default 0,   -- snapshot at submit
  on_order_qty  numeric not null default 0,   -- snapshot at submit
  suggested_qty numeric not null default 0,   -- required - available - on_order
  approved_qty  numeric,
  ordered_qty   numeric not null default 0,   -- rolled up from POs
  required_by   date,
  boq_line_id   uuid references boq_line_items(id) on delete set null,
  order_index   integer not null default 0
);
create index material_request_items_req_idx on material_request_items (request_id);
create index material_requests_project_idx on material_requests (firm_id, project_id, status);

-- ── RFQ + vendor quotes ────────────────────────────────────────────────────
create table rfqs (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  rfq_number     text not null,
  status         rfq_status not null default 'draft',
  project_id     text references crm_projects(id) on delete cascade,
  material_request_id uuid references material_requests(id) on delete set null,
  priority       text not null default 'balanced',  -- balanced|speed|margin|quality (drives ranking)
  required_by    date,
  notes          text,
  awarded_at     timestamptz,
  created_by     text,
  created_by_name text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, rfq_number)
);

create table rfq_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  rfq_id        uuid not null references rfqs(id) on delete cascade,
  sku_id        uuid references product_skus(id),
  material_name text not null default '',
  uom           uom,
  quantity      numeric not null default 0,
  required_by   date,
  boq_line_id   uuid references boq_line_items(id) on delete set null,
  order_index   integer not null default 0
);

create table rfq_vendors (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references firms(id) on delete cascade,
  rfq_id           uuid not null references rfqs(id) on delete cascade,
  vendor_id        uuid references vendors(id),
  vendor_name      text not null default '',
  status           text not null default 'pending',  -- pending|sent|quoted|declined|awarded
  sent_at          date,
  quote_valid_until date,
  lead_time_days   integer,
  promised_date    date,
  freight          numeric not null default 0,
  credit_terms     text,
  notes            text,
  order_index      integer not null default 0
);

-- Vendor-specific price per RFQ line → drives landed-cost comparison + partial award.
create table rfq_quote_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  rfq_id        uuid not null references rfqs(id) on delete cascade,
  rfq_vendor_id uuid not null references rfq_vendors(id) on delete cascade,
  rfq_item_id   uuid not null references rfq_items(id) on delete cascade,
  unit_price    numeric,
  tax_pct       numeric not null default 0,
  moq           numeric,
  awarded_qty   numeric not null default 0,
  is_awarded    boolean not null default false,
  note          text,
  unique (rfq_vendor_id, rfq_item_id)
);
create index rfq_items_rfq_idx on rfq_items (rfq_id);
create index rfq_vendors_rfq_idx on rfq_vendors (rfq_id);
create index rfq_quote_items_rfq_idx on rfq_quote_items (rfq_id);

-- ── RLS: firm-scoped reads; mutations only via inv_* RPCs ──────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'material_requests','material_request_items','rfqs','rfq_items','rfq_vendors','rfq_quote_items'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'drop policy if exists %I on %I; create policy %I on %I for select using (firm_id = current_firm_id() or current_firm_id() is null);',
      t||'_sel', t, t||'_sel', t);
    execute format('grant select on %I to anon, authenticated;', t);
  end loop;
end $$;