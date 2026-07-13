-- ─────────────────────────────────────────────────────────────
-- Migration 05: Vendor Intelligence (global master + rate card + performance)
-- ─────────────────────────────────────────────────────────────
create table vendors (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  company_name  text not null,
  contact_person text,
  phone         text,
  email         text,
  gstin         text,
  category      text,                       -- 'materials','labour','mep','interior','civil'
  region_ids    uuid[] not null default '{}',
  status        vendor_status not null default 'active',
  -- denormalized rolling scores (recomputed from vendor_performance)
  cost_score        numeric(5,2),
  delivery_score    numeric(5,2),
  quality_score     numeric(5,2),
  reliability_score numeric(5,2),
  overall_score     numeric(5,2),
  notes         text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table vendor_skus (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  vendor_id     uuid not null references vendors(id) on delete cascade,
  sku_id        uuid not null references product_skus(id) on delete cascade,
  price         numeric(14,2) not null,
  moq           numeric(14,3),
  lead_time_days int not null default 7,
  valid_from    date not null default current_date,
  valid_to      date,
  created_at    timestamptz not null default now(),
  unique (vendor_id, sku_id, valid_from)
);

-- One row per closed PO line — the raw signal behind vendor scores
create table vendor_performance (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  vendor_id      uuid not null references vendors(id) on delete cascade,
  po_id          uuid,                       -- FK added in procurement migration
  promised_days  int,
  actual_days    int,
  qty_ordered    numeric(14,3),
  qty_defective  numeric(14,3) not null default 0,
  price_at_order numeric(14,2),
  market_price   numeric(14,2),
  recorded_at    timestamptz not null default now()
);

create index on vendors (firm_id, status);
create index on vendor_skus (firm_id, sku_id);
create index on vendor_skus (vendor_id);
create index on vendor_performance (firm_id, vendor_id, recorded_at desc);
