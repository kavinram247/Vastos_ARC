-- ─────────────────────────────────────────────────────────────
-- 28_purchase_management.sql
--
-- Purchase Management module. Reuses the existing commercial layer as the
-- single source of truth (no duplicate vendor / material / PO records):
--   • vendors          → supplier master (extended with code / credit terms)
--   • catalog_products → material master (reused as-is)
--   • purchase_orders  → unified PO ledger (extended with delivery / payment /
--                        approval / totals + links back to RFQ / request)
--
-- and adds the net-new procurement entities that had no home:
--   • material_requests (+ items)  — site-engineer intake (the CMR)
--   • rfqs (+ items + vendors)     — request for quotation
--   • po_payments                  — PO payment records
--   • project_stock                — per-project inventory
--   • work_orders                  — contractor work orders
--
-- Cross-family link columns (project_id / engineer_id) are stored as TEXT to
-- match the crm_* legacy string PKs; intra-module children use uuid FKs with
-- ON DELETE CASCADE. New tables get the same permissive *_anon_dev RLS as the
-- rest of the app (drop in the Phase F auth-hardening pass, with 17/20/…/24).
--
-- Safe to run more than once (IF NOT EXISTS / idempotent guards throughout).
-- ─────────────────────────────────────────────────────────────

begin;

-- ── 1. vendors → supplier master ─────────────────────────────
alter table vendors add column if not exists vendor_code   text;
alter table vendors add column if not exists credit_days   integer default 0;
alter table vendors add column if not exists payment_terms text;

-- ── 2. purchase_orders → unified PO ledger ───────────────────
--    (already has firm_id, project_id, vendor_id, boq_id, po_number,
--     status[po_status], total_amount, gst_amount, required_by, …)
alter table purchase_orders add column if not exists material_type          text;
alter table purchase_orders add column if not exists payment_status         text    not null default 'outstanding';
alter table purchase_orders add column if not exists delivery_date          date;
alter table purchase_orders add column if not exists delivery_address       text;
alter table purchase_orders add column if not exists credit_days            integer;
alter table purchase_orders add column if not exists gst_rate               numeric not null default 18;
alter table purchase_orders add column if not exists gst_type               text    not null default 'inclusive';
alter table purchase_orders add column if not exists freight_charges        numeric not null default 0;
alter table purchase_orders add column if not exists subtotal               numeric not null default 0;
alter table purchase_orders add column if not exists supplier_quotation_ref text;
alter table purchase_orders add column if not exists order_contact_id       text;
alter table purchase_orders add column if not exists order_contact_phone    text;
alter table purchase_orders add column if not exists delivery_contact_id    text;
alter table purchase_orders add column if not exists delivery_contact_phone text;
alter table purchase_orders add column if not exists additional_terms       text;
alter table purchase_orders add column if not exists approval_status        text    not null default 'draft';
alter table purchase_orders add column if not exists admin_notes            text;
alter table purchase_orders add column if not exists rfq_id                 uuid;
alter table purchase_orders add column if not exists material_request_id    uuid;

-- ── 3. po_payments — PO payment records ──────────────────────
create table if not exists po_payments (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null,
  po_id        uuid not null references purchase_orders(id) on delete cascade,
  payment_date date not null default current_date,
  amount       numeric not null default 0,
  payment_mode text,
  reference_no text,
  created_at   timestamptz not null default now()
);
create index if not exists po_payments_po_idx   on po_payments(po_id);
create index if not exists po_payments_firm_idx on po_payments(firm_id);

-- ── 4. material_requests (+ items) — site-engineer intake ────
create table if not exists material_requests (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null,
  request_number      text not null,
  request_date        date not null default current_date,
  project_id          text,
  plant_description   text,
  total_days          integer,
  engineer_id         text,
  status              text not null default 'open',   -- open | in_rfq | in_po | fulfilled | cancelled
  client_requirements jsonb not null default '[]'::jsonb,  -- [{requirement, before}]
  notes               text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists material_requests_firm_idx    on material_requests(firm_id);
create index if not exists material_requests_project_idx on material_requests(project_id);

create table if not exists material_request_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null,
  request_id    uuid not null references material_requests(id) on delete cascade,
  material_id   uuid,
  material_name text not null default '',
  description   text,
  quantity      numeric not null default 0,
  uom           text,
  required_by   date,
  order_index   integer not null default 0
);
create index if not exists material_request_items_req_idx on material_request_items(request_id);

-- ── 5. rfqs (+ items + vendors contacted) ────────────────────
create table if not exists rfqs (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null,
  rfq_number          text not null,
  rfq_date            date not null default current_date,
  project_id          text,
  material_type       text,
  status              text not null default 'draft',  -- draft | sent | quotes_received | closed
  quote_valid_until   date,
  material_request_id uuid,
  notes               text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists rfqs_firm_idx    on rfqs(firm_id);
create index if not exists rfqs_project_idx on rfqs(project_id);

create table if not exists rfq_items (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null,
  rfq_id        uuid not null references rfqs(id) on delete cascade,
  material_id   uuid,
  material_name text not null default '',
  quantity      numeric not null default 0,
  uom           text,
  unit_price    numeric,
  order_index   integer not null default 0
);
create index if not exists rfq_items_rfq_idx on rfq_items(rfq_id);

create table if not exists rfq_vendors (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null,
  rfq_id        uuid not null references rfqs(id) on delete cascade,
  vendor_id     uuid,
  vendor_name   text not null default '',
  mobile        text,
  sent_date     date,
  status        text not null default 'pending',  -- pending | sent | responded | declined
  quoted_amount numeric,
  order_index   integer not null default 0
);
create index if not exists rfq_vendors_rfq_idx on rfq_vendors(rfq_id);

-- ── 6. project_stock — per-project inventory ─────────────────
create table if not exists project_stock (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null,
  project_id    text,
  material_id   uuid,
  material_name text not null default '',
  uom           text,
  current_stock numeric not null default 0,
  reorder_level numeric not null default 0,
  last_updated  date,
  last_po_id    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists project_stock_firm_idx on project_stock(firm_id);
create index if not exists project_stock_pm_idx   on project_stock(project_id, material_id);

-- ── 7. work_orders — contractor work orders ──────────────────
create table if not exists work_orders (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null,
  wo_number            text not null,
  title                text not null default '',
  project_id           text,
  contractor_vendor_id uuid,
  wo_date              date not null default current_date,
  amount               numeric,
  status               text not null default 'draft',  -- draft | issued | in_progress | completed | cancelled
  work_description     text,
  terms_of_payment     text,
  terms_conditions     text,
  additional_work      text,
  bank_details         text,
  notes                text,
  created_by           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists work_orders_firm_idx    on work_orders(firm_id);
create index if not exists work_orders_project_idx on work_orders(project_id);

-- ── 8. RLS + permissive dev policies + grants (Phase F: drop these) ──
do $$
declare t text;
begin
  foreach t in array array[
    'po_payments','material_requests','material_request_items',
    'rfqs','rfq_items','rfq_vendors','project_stock','work_orders'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_anon_dev', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
      t || '_anon_dev', t);
    execute format('grant all on table %I to anon, authenticated', t);
  end loop;
end $$;

-- ── 9. Plan entitlement — surface the module on every plan ───
update subscription_plans
   set module_keys = coalesce(module_keys, '[]'::jsonb) || '["purchase"]'::jsonb
 where not (coalesce(module_keys, '[]'::jsonb) ? 'purchase');

commit;
