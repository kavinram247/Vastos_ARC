-- ─────────────────────────────────────────────────────────────
-- Migration 08: Quotations, Procurement, Cost actuals, Calibration, AI jobs
-- ─────────────────────────────────────────────────────────────

-- Quotation = a frozen projection of a BOQ version (customer / internal / procurement / rfq)
create table quotations (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references firms(id) on delete cascade,
  boq_id          uuid references boq_documents(id) on delete set null,
  boq_version     int,
  lead_id         uuid references leads(id) on delete set null,
  project_id      uuid references projects(id) on delete set null,
  doc_type        quotation_doc_type not null default 'customer',
  quotation_number text not null,
  version         int not null default 1,
  design_fees     numeric(14,2) not null default 0,
  supervision_fees numeric(14,2) not null default 0,
  other_charges   numeric(14,2) not null default 0,
  discount_pct    numeric(5,2) not null default 0,
  subtotal        numeric(16,2) not null default 0,
  gst_amount      numeric(16,2) not null default 0,
  total_amount    numeric(16,2) not null default 0,
  scope_of_work   text,
  inclusions      text,
  exclusions      text,
  terms_conditions text,
  validity_days   int not null default 15,
  status          text not null default 'draft',
  snapshot        jsonb,             -- frozen rendered lines
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (firm_id, quotation_number, version)
);

create table purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  project_id    uuid references projects(id) on delete set null,
  boq_id        uuid references boq_documents(id) on delete set null,
  vendor_id     uuid references vendors(id),
  po_number     text not null,
  status        po_status not null default 'draft',
  required_by   date,
  issued_at     timestamptz,
  received_at   timestamptz,
  total_amount  numeric(16,2) not null default 0,
  gst_amount    numeric(16,2) not null default 0,
  notes         text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (firm_id, po_number)
);

create table po_line_items (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  po_id          uuid not null references purchase_orders(id) on delete cascade,
  boq_line_id    uuid references boq_line_items(id) on delete set null,
  sku_id         uuid references product_skus(id),
  description    text not null,
  uom            uom not null,
  quantity       numeric(16,4) not null,
  rate           numeric(14,4) not null,
  amount         numeric(16,2) not null,
  qty_received   numeric(16,4) not null default 0,
  created_at     timestamptz not null default now()
);

-- close the vendor_performance → PO loop
alter table vendor_performance
  add constraint vendor_perf_po_fk foreign key (po_id) references purchase_orders(id) on delete set null;

-- Cost actuals (mirrors existing CostEntry; the calibration signal source)
create table cost_entries (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  boq_line_id uuid references boq_line_items(id) on delete set null,
  po_id       uuid references purchase_orders(id) on delete set null,
  category    text not null,             -- 'materials','labour','vendor'
  description text not null,
  quantity    numeric(16,4),
  uom         uom,
  amount      numeric(16,2) not null,
  entry_date  date not null default current_date,
  vendor_name text,
  receipt_url text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

-- Estimate vs actual variance (Section 9 accuracy framework)
create table boq_actual_variance (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  boq_line_id    uuid references boq_line_items(id) on delete set null,
  project_id     uuid not null references projects(id) on delete cascade,
  region_id      uuid references regions(id),
  product_id     uuid references catalog_products(id),
  estimated_qty  numeric(16,4),
  actual_qty     numeric(16,4),
  estimated_rate numeric(14,4),
  actual_rate    numeric(14,4),
  estimated_cost numeric(16,2),
  actual_cost    numeric(16,2),
  variance_pct   numeric(8,4) generated always as
       (case when coalesce(estimated_cost,0) = 0 then null
             else round(((actual_cost - estimated_cost) / estimated_cost)::numeric, 4) end) stored,
  captured_at    timestamptz not null default now()
);

-- Calibration audit (Section 9 feedback loop)
create table calibration_runs (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  product_id  uuid references catalog_products(id),
  region_id   uuid references regions(id),
  metric      text not null,             -- 'waste_factor','rate_index'
  old_value   numeric(14,6),
  new_value   numeric(14,6),
  sample_size int,
  damping     numeric(5,4),
  run_at      timestamptz not null default now()
);

-- AI floor-plan / measurement extraction jobs (Section 5, human-gated)
create table ai_extraction_jobs (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  project_id     uuid references projects(id) on delete cascade,
  source_type    text not null,          -- 'floor_plan','photo','brief'
  source_url     text,
  status         extraction_status not null default 'pending',
  model          text,                   -- 'claude-opus-4-8'
  raw_output     jsonb,                  -- structured extraction with per-field confidence
  confidence     numeric(4,3),
  reviewed_by    uuid references profiles(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index on quotations (firm_id, boq_id);
create index on purchase_orders (firm_id, project_id, status);
create index on po_line_items (po_id);
create index on cost_entries (firm_id, project_id);
create index on boq_actual_variance (firm_id, product_id, region_id);
create index on ai_extraction_jobs (firm_id, project_id, status);
