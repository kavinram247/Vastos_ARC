-- ─────────────────────────────────────────────────────────────
-- 29_leads_dashboard.sql
--
-- Customizable Leads dashboard — per-user (and per-firm org-template) saved
-- dashboard layouts. One row per named layout; the whole widget/theme config
-- lives in a single jsonb blob so new widget types / options never need a
-- schema change (the app is the source of truth for the config shape).
--
--   • crm_dashboard_layouts — { firm_id, user_id, module, name, is_default,
--                               scope('personal'|'org'), config(jsonb) }
--
-- Same permissive *_anon_dev RLS as the rest of the app (drop in the Phase F
-- auth-hardening pass alongside 17/20/…/28). Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

begin;

create table if not exists crm_dashboard_layouts (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null,
  user_id     text not null,                       -- layout owner (crm_profiles.id — legacy TEXT PK, e.g. "u-admin2")
  module      text not null default 'leads',       -- which dashboard this layout belongs to
  name        text not null,
  is_default  boolean not null default false,      -- the layout to open on login
  scope       text not null default 'personal',    -- 'personal' | 'org' (admin template)
  config      jsonb not null default '{}'::jsonb,  -- { widgets: [...], theme: {...} }
  created_by  text,                                -- crm_profiles.id (TEXT)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists crm_dashboard_layouts_firm_idx on crm_dashboard_layouts(firm_id);
create index if not exists crm_dashboard_layouts_user_idx on crm_dashboard_layouts(firm_id, user_id, module);

-- ── RLS + permissive dev policy + grants (Phase F: drop these) ──
do $$
declare t text := 'crm_dashboard_layouts';
begin
  execute format('alter table %I enable row level security', t);
  execute format('drop policy if exists %I on %I', t || '_anon_dev', t);
  execute format(
    'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
    t || '_anon_dev', t);
  execute format('grant all on table %I to anon, authenticated', t);
end $$;

commit;
