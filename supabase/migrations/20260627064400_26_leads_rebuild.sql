
-- ─────────────────────────────────────────────────────────────
-- Leads module rebuild: configurable pipeline, feature flags, comm channels,
-- canonical contacts (returning-customer recognition), and unified-timeline
-- columns on interactions. All additive — existing crm_leads untouched.
-- ─────────────────────────────────────────────────────────────
create table if not exists crm_pipeline_stages (
  id text primary key default gen_random_uuid()::text,
  firm_id uuid not null references firms(id) on delete cascade,
  key text not null,
  label text not null,
  order_index integer not null default 0,
  category text not null default 'active' check (category in ('active','terminal')),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  color text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (firm_id, key)
);

create table if not exists crm_feature_flags (
  id text primary key default gen_random_uuid()::text,
  firm_id uuid not null references firms(id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (firm_id, key)
);

create table if not exists crm_comm_channels (
  id text primary key default gen_random_uuid()::text,
  firm_id uuid not null references firms(id) on delete cascade,
  provider text not null,
  category text not null,
  display_name text,
  status text not null default 'disconnected' check (status in ('disconnected','connected')),
  config jsonb not null default '{}'::jsonb,
  connected_by text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (firm_id, provider)
);

create table if not exists crm_contacts (
  id text primary key default gen_random_uuid()::text,
  firm_id uuid not null references firms(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  company text,
  tags text[] not null default '{}',
  notes text,
  first_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists crm_contacts_firm_email on crm_contacts (firm_id, lower(email));
create index if not exists crm_contacts_firm_phone on crm_contacts (firm_id, phone);

alter table crm_leads
  add column if not exists contact_id text,
  add column if not exists prev_status text,
  add column if not exists lost_reason_category text;

alter table crm_lead_interactions
  add column if not exists channel text,
  add column if not exists direction text,
  add column if not exists contact_id text,
  add column if not exists external_id text;

-- RLS for the 4 new tables (authenticated firm-scoped + dev anon; drop anon in Phase F)
do $$
declare t text;
begin
  foreach t in array array['crm_pipeline_stages','crm_feature_flags','crm_comm_channels','crm_contacts']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (firm_id = current_firm_id())', t||'_sel', t);
    execute format('create policy %I on %I for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id())', t||'_mod', t);
    execute format('create policy %I on %I for all to anon using (true) with check (true)', t||'_anon_dev', t);
  end loop;
end $$;

-- Seed default pipeline stages, feature flags, and channel slots for the demo firm.
insert into crm_pipeline_stages (firm_id, key, label, order_index, category, is_won, is_lost, color) values
  ('11111111-1111-4111-8111-111111111111','new','New',0,'active',false,false,'sky'),
  ('11111111-1111-4111-8111-111111111111','contacted','Contacted',1,'active',false,false,'violet'),
  ('11111111-1111-4111-8111-111111111111','site_visit','Site Visit',2,'active',false,false,'amber'),
  ('11111111-1111-4111-8111-111111111111','quotation_sent','Quotation Sent',3,'active',false,false,'indigo'),
  ('11111111-1111-4111-8111-111111111111','negotiation','Negotiation',4,'active',false,false,'orange'),
  ('11111111-1111-4111-8111-111111111111','on_hold','On Hold',5,'terminal',false,false,'yellow'),
  ('11111111-1111-4111-8111-111111111111','won','Won',6,'terminal',true,false,'emerald'),
  ('11111111-1111-4111-8111-111111111111','lost','Lost',7,'terminal',false,true,'red'),
  ('11111111-1111-4111-8111-111111111111','junk','Junk',8,'terminal',false,false,'slate')
on conflict (firm_id, key) do nothing;

insert into crm_feature_flags (firm_id, key, enabled) values
  ('11111111-1111-4111-8111-111111111111','quotations',true),
  ('11111111-1111-4111-8111-111111111111','website_capture',true),
  ('11111111-1111-4111-8111-111111111111','comm_email',false),
  ('11111111-1111-4111-8111-111111111111','comm_telephony',false),
  ('11111111-1111-4111-8111-111111111111','comm_sms',false),
  ('11111111-1111-4111-8111-111111111111','comm_meta',false)
on conflict (firm_id, key) do nothing;

insert into crm_comm_channels (firm_id, provider, category, display_name) values
  ('11111111-1111-4111-8111-111111111111','email_gmail','email','Gmail / Google Workspace'),
  ('11111111-1111-4111-8111-111111111111','email_outlook','email','Outlook / Microsoft 365'),
  ('11111111-1111-4111-8111-111111111111','telephony_twilio','telephony','Twilio Voice'),
  ('11111111-1111-4111-8111-111111111111','sms_twilio','sms','Twilio SMS'),
  ('11111111-1111-4111-8111-111111111111','meta_business','meta','Meta Business (WhatsApp/Messenger)')
on conflict (firm_id, provider) do nothing;
