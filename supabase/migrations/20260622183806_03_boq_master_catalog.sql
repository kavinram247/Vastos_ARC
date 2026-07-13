-- ─────────────────────────────────────────────────────────────
-- Migration 03: Master Catalog (4-layer: category > product > sku > alternates)
-- ─────────────────────────────────────────────────────────────
create table catalog_categories (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid references firms(id) on delete cascade,   -- null = global/system catalog
  parent_id   uuid references catalog_categories(id),
  path        ltree not null,                                -- 'material.boards.plywood'
  name        text not null,
  kind        catalog_kind not null,
  icon        text,
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

create table catalog_products (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid references firms(id) on delete cascade,  -- null = shared master
  category_id    uuid not null references catalog_categories(id),
  name           text not null,                  -- "18mm BWP Plywood"
  base_uom       uom not null,
  secondary_uom  uom,
  uom_conversion numeric(12,4),                  -- 1 sheet = 32 sqft  → secondary→base
  waste_factor   numeric(5,4) not null default 0.08,
  packaging_loss numeric(5,4) not null default 0.00,
  install_loss   numeric(5,4) not null default 0.00,
  attributes     jsonb not null default '{}',    -- {thickness_mm:18, core:'hardwood', grade:'BWP'}
  hsn_code       text,
  gst_rate       numeric(5,2) not null default 18,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table product_skus (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references catalog_products(id) on delete cascade,
  sku_code      text not null,                   -- VAS-BRD-PLY-CEN-BWP18-2440x1220
  brand         text,
  quality_grade quality_grade not null default 'standard',
  size_spec     text,                            -- '2440x1220x18'
  attributes    jsonb not null default '{}',
  barcode       text,
  list_price    numeric(14,2),                   -- MRP / reference list price
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (product_id, sku_code)
);

create table product_alternates (
  id            uuid primary key default gen_random_uuid(),
  sku_id        uuid not null references product_skus(id) on delete cascade,
  alternate_sku uuid not null references product_skus(id) on delete cascade,
  relation      alternate_relation not null,
  swap_ratio    numeric(8,4) not null default 1.0,   -- qty multiplier when swapping
  notes         text,
  check (sku_id <> alternate_sku),
  unique (sku_id, alternate_sku)
);

-- AI/RAG: embeddings of catalog products for material recommendation (Section 5)
create table catalog_embeddings (
  product_id  uuid primary key references catalog_products(id) on delete cascade,
  embedding   vector(1536),
  updated_at  timestamptz not null default now()
);

create index on catalog_categories using gist (path);
create index on catalog_categories (firm_id);
create index on catalog_products (firm_id, category_id);
create index on catalog_products using gin (attributes);
create index on catalog_products using gin (name gin_trgm_ops);
create index on product_skus (product_id);
create index on product_skus using gin (sku_code gin_trgm_ops);
