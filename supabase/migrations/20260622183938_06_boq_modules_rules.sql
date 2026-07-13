-- ─────────────────────────────────────────────────────────────
-- Migration 06: Parametric module templates + rules (formulas-as-data) + instances
-- ─────────────────────────────────────────────────────────────
create table module_templates (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid references firms(id) on delete cascade,   -- null = global master
  code          text not null,            -- 'KITCHEN_MODULAR','WARDROBE','TV_UNIT','FALSE_CEILING'...
  name          text not null,
  category      text not null,            -- maps to the 13 interior categories
  description   text,
  param_schema  jsonb not null default '{}',  -- JSON-schema-ish: {width_mm:{type,min,max,default}}
  derived_vars  jsonb not null default '{}',  -- formulas computing base_rft, shutter_count, etc.
  version       int not null default 1,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table module_rules (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references module_templates(id) on delete cascade,
  seq           int not null,
  output_kind   module_output_kind not null,
  product_id    uuid references catalog_products(id),
  labour_activity_id uuid references labour_activities(id),
  label         text not null,            -- human description of the emitted line
  condition     text,                     -- DSL boolean (null = always)
  qty_formula   text not null,            -- DSL numeric expression
  uom           uom not null,
  notes         text,
  created_at    timestamptz not null default now()
);

-- A placed module on a room (parameter values bound to a template)
create table module_instances (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references firms(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  room_id         uuid references rooms(id) on delete cascade,
  template_id     uuid not null references module_templates(id),
  template_version int not null,           -- reproducibility: which version generated lines
  label           text not null,           -- 'L-shaped base + wall units'
  grade           quality_grade not null default 'standard',
  params          jsonb not null default '{}',  -- bound parameter values
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on module_templates (firm_id, category);
create index on module_rules (template_id, seq);
create index on module_instances (firm_id, project_id);
