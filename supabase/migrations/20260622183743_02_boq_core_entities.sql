-- ─────────────────────────────────────────────────────────────
-- Migration 02: Core entities (backbone for BOQ FKs)
-- Mirrors existing src/types/index.ts conventions exactly.
-- ─────────────────────────────────────────────────────────────
create table firms (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  gstin                 text,
  address               text,
  logo_url              text,
  payment_split_default int not null default 3,
  created_at            timestamptz not null default now()
);

create table profiles (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  auth_uid    uuid,                       -- maps to Supabase auth.users when wired
  email       text not null,
  full_name   text not null,
  role        user_role not null default 'engineer',
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  unique (firm_id, email)
);

create table projects (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references firms(id) on delete cascade,
  name               text not null,
  client_id          uuid references profiles(id),
  region_id          uuid,                -- FK added after regions table exists
  project_type       text,               -- 'residential','commercial','custom'
  priority           project_priority not null default 'balanced',
  project_value      numeric(14,2) not null default 0,
  start_date         date,
  estimated_end_date date,
  actual_end_date    date,
  status             text not null default 'planning',
  description        text,
  address            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table leads (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references firms(id) on delete cascade,
  client_name        text not null,
  client_email       text,
  client_phone       text not null,
  project_type       text,
  project_location   text,
  region_id          uuid,
  estimated_budget   numeric(14,2),
  estimated_area     numeric(10,2),       -- sq ft
  status             text not null default 'new',
  source             text,
  priority           text default 'medium',
  assigned_to        uuid references profiles(id),
  converted_project_id uuid references projects(id),
  inquiry_date       date not null default current_date,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Rooms: the spatial unit BOQ modules attach to
create table rooms (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,            -- 'Master Bedroom', 'Modular Kitchen'
  room_type     room_type not null default 'other',
  length_mm     numeric(10,2),            -- internal clear dimensions
  width_mm      numeric(10,2),
  height_mm     numeric(10,2) default 3000,
  floor_area_sqft numeric(12,3) generated always as
                  (round((coalesce(length_mm,0) * coalesce(width_mm,0)) / 92903.04, 3)) stored, -- mm² → sqft
  notes         text,
  order_index   int not null default 0,
  created_at    timestamptz not null default now()
);

create index on profiles (firm_id);
create index on projects (firm_id);
create index on leads (firm_id, status);
create index on rooms (firm_id, project_id);
