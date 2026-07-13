-- ===== Marketing Analytics: provider-agnostic ad schema =====
create table if not exists public.crm_ad_accounts (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id),
  provider      text not null default 'meta',
  external_account_id text,
  name          text not null,
  currency      text not null default 'INR',
  status        text not null default 'mock' check (status in ('connected','mock','disconnected','error')),
  sync_interval_minutes integer not null default 360,
  last_synced_at timestamptz,
  connected_by  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (firm_id, provider, external_account_id)
);

create table if not exists public.crm_ad_campaigns (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id),
  ad_account_id uuid not null references public.crm_ad_accounts(id) on delete cascade,
  provider      text not null default 'meta',
  external_id   text,
  name          text not null,
  objective     text,
  status        text not null default 'active',
  daily_budget  numeric,
  lifetime_budget numeric,
  start_date    date,
  stop_date     date,
  created_at    timestamptz not null default now()
);

create table if not exists public.crm_ad_sets (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id),
  campaign_id   uuid not null references public.crm_ad_campaigns(id) on delete cascade,
  external_id   text,
  name          text not null,
  status        text not null default 'active',
  optimization_goal text,
  targeting     jsonb not null default '{}'::jsonb,
  daily_budget  numeric,
  created_at    timestamptz not null default now()
);

create table if not exists public.crm_ads (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id),
  ad_set_id     uuid not null references public.crm_ad_sets(id) on delete cascade,
  campaign_id   uuid not null references public.crm_ad_campaigns(id) on delete cascade,
  external_id   text,
  name          text not null,
  status        text not null default 'active',
  creative      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.crm_ad_insights (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id),
  provider      text not null default 'meta',
  ad_account_id uuid references public.crm_ad_accounts(id) on delete cascade,
  campaign_id   uuid references public.crm_ad_campaigns(id) on delete cascade,
  ad_set_id     uuid references public.crm_ad_sets(id) on delete cascade,
  ad_id         uuid references public.crm_ads(id) on delete cascade,
  level         text not null check (level in ('account','campaign','adset','ad')),
  date          date not null,
  platform      text,
  region        text,
  impressions   bigint not null default 0,
  reach         bigint not null default 0,
  frequency     numeric not null default 0,
  clicks        bigint not null default 0,
  link_clicks   bigint not null default 0,
  video_views   bigint not null default 0,
  leads         bigint not null default 0,
  spend         numeric not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.crm_ad_leads (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firms(id),
  provider        text not null default 'meta',
  external_lead_id text,
  ad_account_id   uuid references public.crm_ad_accounts(id) on delete set null,
  campaign_id     uuid references public.crm_ad_campaigns(id) on delete set null,
  ad_set_id       uuid references public.crm_ad_sets(id) on delete set null,
  ad_id           uuid references public.crm_ads(id) on delete set null,
  form_id         text,
  full_name       text,
  email           text,
  phone           text,
  raw_fields      jsonb not null default '{}'::jsonb,
  crm_lead_id     text references public.crm_leads(id) on delete set null,
  contact_id      text references public.crm_contacts(id) on delete set null,
  status          text not null default 'unmapped' check (status in ('mapped','duplicate','unmapped')),
  received_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table if not exists public.crm_marketing_attribution (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id),
  lead_id       text references public.crm_leads(id) on delete cascade,
  ad_lead_id    uuid references public.crm_ad_leads(id) on delete set null,
  provider      text not null default 'meta',
  ad_account_id uuid references public.crm_ad_accounts(id) on delete set null,
  campaign_id   uuid references public.crm_ad_campaigns(id) on delete set null,
  ad_set_id     uuid references public.crm_ad_sets(id) on delete set null,
  ad_id         uuid references public.crm_ads(id) on delete set null,
  stage         text not null default 'lead' check (stage in ('lead','qualified','quoted','won','lost')),
  converted_project_id text references public.crm_projects(id) on delete set null,
  quotation_id  text,
  salesperson_id text references public.crm_profiles(id) on delete set null,
  region        text,
  revenue       numeric not null default 0,
  first_touch_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.crm_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id),
  ad_account_id uuid references public.crm_ad_accounts(id) on delete cascade,
  provider      text not null default 'meta',
  status        text not null default 'success' check (status in ('success','error','running')),
  trigger       text not null default 'mock' check (trigger in ('manual','scheduled','mock')),
  rows_upserted integer not null default 0,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- indexes
create index if not exists idx_ad_insights_firm_date on public.crm_ad_insights(firm_id, date);
create index if not exists idx_ad_insights_campaign on public.crm_ad_insights(campaign_id);
create index if not exists idx_ad_insights_level on public.crm_ad_insights(level);
create index if not exists idx_ad_campaigns_account on public.crm_ad_campaigns(ad_account_id);
create index if not exists idx_attribution_firm on public.crm_marketing_attribution(firm_id);
create index if not exists idx_attribution_campaign on public.crm_marketing_attribution(campaign_id);
create index if not exists idx_ad_leads_firm on public.crm_ad_leads(firm_id);

-- ===== RLS: anon_dev (demo) + marketing permission policies =====
do $$
declare t text;
begin
  foreach t in array array[
    'crm_ad_accounts','crm_ad_campaigns','crm_ad_sets','crm_ads',
    'crm_ad_insights','crm_ad_leads','crm_marketing_attribution','crm_sync_runs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_dev', t);
    execute format('create policy %I on public.%I for all to anon using (true) with check (true)', t||'_anon_dev', t);
    execute format('drop policy if exists %I on public.%I', t||'_perm_sel', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (public.crm_has_permission('marketing','view'))$f$, t||'_perm_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_perm_mod', t);
    execute format($f$create policy %I on public.%I for all to authenticated using (public.crm_has_permission('marketing','edit')) with check (public.crm_has_permission('marketing','edit'))$f$, t||'_perm_mod', t);
  end loop;
end $$;