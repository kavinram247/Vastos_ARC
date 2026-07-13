
-- ─────────────────────────────────────────────────────────────
-- Vendor visibility (allow-list). Project "Vendors & Contractors" is hidden
-- from non-owner staff by default; the owner grants specific users firm-wide
-- access. user_id references the legacy in-memory profile id as TEXT.
-- ─────────────────────────────────────────────────────────────
create table if not exists vendor_visibility_grants (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  granted_by text,
  granted_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

alter table vendor_visibility_grants enable row level security;

create policy vvg_sel on vendor_visibility_grants for select to authenticated using (firm_id = current_firm_id());
create policy vvg_mod on vendor_visibility_grants for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());

-- DEV anon policy (publishable/anon key, mock auth). Drop in Phase F with 17/20/21/22.
create policy vvg_anon_dev on vendor_visibility_grants for all to anon using (true) with check (true);
