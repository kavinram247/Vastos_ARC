-- ─────────────────────────────────────────────────────────────
-- Migration 04: Regions, Labour activities, Rate cards, Discounts, Margin policy
-- ─────────────────────────────────────────────────────────────
create table regions (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid references firms(id) on delete cascade,
  name              text not null,
  state             text,
  material_index    numeric(6,4) not null default 1.0,
  labour_index      numeric(6,4) not null default 1.0,
  logistics_index   numeric(6,4) not null default 1.0,
  availability_risk numeric(5,4) not null default 0.0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

alter table projects add constraint projects_region_fk foreign key (region_id) references regions(id);
alter table leads    add constraint leads_region_fk    foreign key (region_id) references regions(id);
alter table rooms    add column region_id uuid references regions(id);

create table labour_activities (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid references firms(id) on delete cascade,
  code        text not null,
  name        text not null,
  base_uom    uom not null,
  trade       text,
  created_at  timestamptz not null default now()
);
create unique index labour_activities_firm_code_uniq
  on labour_activities (coalesce(firm_id,'00000000-0000-0000-0000-000000000000'::uuid), code);

create table rate_cards (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references firms(id) on delete cascade,
  region_id          uuid references regions(id),
  sku_id             uuid references product_skus(id),
  labour_activity_id uuid references labour_activities(id),
  rate               numeric(14,4) not null,
  currency           text not null default 'INR',
  valid_from         date not null default current_date,
  valid_to           date,
  source             rate_source not null default 'manual',
  notes              text,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  check ( (sku_id is not null) <> (labour_activity_id is not null) )
);

create table discount_tiers (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references firms(id) on delete cascade,
  sku_id       uuid references product_skus(id),
  category_id  uuid references catalog_categories(id),
  min_qty      numeric(14,3) not null,
  discount_pct numeric(5,2) not null,
  created_at   timestamptz not null default now()
);

create table margin_policies (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references firms(id) on delete cascade,
  category_id       uuid references catalog_categories(id),
  grade             quality_grade,
  target_margin_pct numeric(5,2) not null,
  margin_floor_pct  numeric(5,2) not null default 0,
  overhead_pct      numeric(5,2) not null default 0,
  created_at        timestamptz not null default now()
);

create index on rate_cards (firm_id, sku_id, region_id, valid_from desc);
create index on rate_cards (firm_id, labour_activity_id, region_id, valid_from desc);
create index on discount_tiers (firm_id, sku_id);
create index on regions (firm_id);
