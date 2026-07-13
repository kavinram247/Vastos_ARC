create table if not exists crm_dashboard_layouts (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null,
  user_id     uuid not null,
  module      text not null default 'leads',
  name        text not null,
  is_default  boolean not null default false,
  scope       text not null default 'personal',
  config      jsonb not null default '{}'::jsonb,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists crm_dashboard_layouts_firm_idx on crm_dashboard_layouts(firm_id);
create index if not exists crm_dashboard_layouts_user_idx on crm_dashboard_layouts(firm_id, user_id, module);

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