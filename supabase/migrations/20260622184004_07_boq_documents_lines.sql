-- ─────────────────────────────────────────────────────────────
-- Migration 07: BOQ documents, sections, line items, revisions, approvals
-- ─────────────────────────────────────────────────────────────
create table boq_documents (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references firms(id) on delete cascade,
  project_id      uuid references projects(id) on delete cascade,
  lead_id         uuid references leads(id) on delete set null,
  title           text not null,
  status          boq_status not null default 'draft',
  current_version int not null default 1,
  region_id       uuid references regions(id),
  -- rollups (recomputed on save)
  total_cost_price    numeric(16,2) not null default 0,
  total_selling_price numeric(16,2) not null default 0,
  total_gst           numeric(16,2) not null default 0,
  grand_total         numeric(16,2) not null default 0,
  margin_pct          numeric(6,3),
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table boq_sections (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  boq_id      uuid not null references boq_documents(id) on delete cascade,
  room_id     uuid references rooms(id) on delete set null,
  name        text not null,             -- 'Modular Kitchen', 'Master Bedroom Wardrobe'
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

create table boq_line_items (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references firms(id) on delete cascade,
  boq_id             uuid not null references boq_documents(id) on delete cascade,
  section_id         uuid references boq_sections(id) on delete cascade,
  module_instance_id uuid references module_instances(id) on delete set null,
  product_id         uuid references catalog_products(id),
  sku_id             uuid references product_skus(id),
  labour_activity_id uuid references labour_activities(id),
  description        text not null,
  uom                uom not null,
  quantity           numeric(16,4) not null,
  rate               numeric(14,4) not null,         -- resolved cost rate
  rate_card_id       uuid references rate_cards(id),
  cost_price         numeric(16,2) not null,         -- qty × rate (+losses)
  selling_price      numeric(16,2) not null,
  margin_pct         numeric(6,3),
  discount_pct       numeric(5,2) not null default 0,
  gst_rate           numeric(5,2) not null default 18,
  derivation         jsonb,            -- {rule_id, inputs, formula, base_qty, waste, packaging, install}
  source             boq_line_source not null default 'engine',
  ai_confidence      numeric(4,3),     -- null unless ai_suggested
  is_optional        boolean not null default false,
  order_index        int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Immutable version snapshots (enterprise audit)
create table boq_revisions (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  boq_id      uuid not null references boq_documents(id) on delete cascade,
  version     int not null,
  snapshot    jsonb not null,          -- frozen full line items + rates + template versions
  diff        jsonb,                   -- structured delta vs previous version
  reason      text,
  totals      jsonb,                   -- {cp, sp, margin, gst, total}
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  unique (boq_id, version)
);

create table boq_approvals (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references firms(id) on delete cascade,
  boq_id             uuid not null references boq_documents(id) on delete cascade,
  version            int not null,
  approver_id        uuid references profiles(id),
  decision           approval_decision not null,
  margin_at_approval numeric(6,3),
  comment            text,
  created_at         timestamptz not null default now()
);

create index on boq_documents (firm_id, project_id);
create index on boq_documents (firm_id, status);
create index on boq_sections (boq_id, order_index);
create index on boq_line_items (firm_id, boq_id);
create index on boq_line_items (firm_id, product_id);
create index on boq_revisions (boq_id, version desc);
