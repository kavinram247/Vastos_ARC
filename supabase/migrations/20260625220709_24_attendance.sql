
-- ─────────────────────────────────────────────────────────────
-- Attendance register — one record per employee per day, with check-in /
-- check-out timestamps + device GPS. Employees self check-in/out; the owner
-- can also create/correct any record. user_id references the legacy in-memory
-- profile id as TEXT (mock auth), firm-scoped by the real firm UUID.
-- ─────────────────────────────────────────────────────────────
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  work_date date not null,
  status text not null default 'present' check (status in ('present','absent','leave','half_day')),
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_accuracy double precision,
  check_in_label text,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_accuracy double precision,
  check_out_label text,
  notes text,
  marked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, user_id, work_date)
);
create index if not exists attendance_firm_date_idx on attendance_records (firm_id, work_date);

alter table attendance_records enable row level security;

create policy att_sel on attendance_records for select to authenticated using (firm_id = current_firm_id());
create policy att_mod on attendance_records for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());

-- DEV anon policy (publishable/anon key, mock auth). Drop in Phase F with 17/20/21/22/23.
create policy att_anon_dev on attendance_records for all to anon using (true) with check (true);
