
-- CRM core migrated from the in-memory DataStore. All tables prefixed crm_ to
-- avoid collision with BOQ tables (leads/projects/profiles/cost_entries exist).
-- Keyed firm_id uuid (DEMO_FIRM_ID) + legacy string ids preserved as TEXT.
create table if not exists crm_profiles (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  email text not null, full_name text not null, role text not null,
  phone text, avatar_url text, created_at timestamptz not null default now()
);
create table if not exists crm_projects (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null, client_id text, project_value numeric not null default 0,
  start_date date, estimated_end_date date, actual_end_date date,
  status text not null default 'planning', description text, address text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists crm_project_assignments (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  project_id text not null, user_id text not null, role text not null,
  assigned_at timestamptz not null default now()
);
create table if not exists crm_milestones (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  project_id text not null, name text not null, description text,
  planned_start date, planned_end date, actual_start date, actual_end date,
  status text not null default 'not_started', delay_reason text,
  order_index integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists crm_site_updates (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  project_id text not null, posted_by text, date date, note text,
  photo_urls text[] not null default '{}', created_at timestamptz not null default now()
);
create table if not exists crm_payment_plans (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  project_id text not null, total_amount numeric not null default 0,
  split_count integer not null default 0, client_signed_off boolean not null default false,
  signed_off_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists crm_payment_splits (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  payment_plan_id text not null, project_id text not null, split_number integer not null,
  amount numeric not null default 0, trigger_type text not null default 'date',
  trigger_date date, trigger_milestone_id text, status text not null default 'scheduled',
  gst_rate numeric not null default 18, gst_amount numeric not null default 0,
  total_with_gst numeric not null default 0, created_at timestamptz not null default now()
);
create table if not exists crm_payments_received (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  payment_split_id text not null, project_id text not null, amount numeric not null default 0,
  received_date date, mode text not null default 'bank_transfer', reference text,
  marked_by text, created_at timestamptz not null default now()
);
create table if not exists crm_cost_entries (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  project_id text not null, category text not null, description text,
  amount numeric not null default 0, date date, vendor_name text, receipt_url text,
  created_by text, created_at timestamptz not null default now()
);
create table if not exists crm_comments (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  project_id text not null, author_id text, content text not null,
  is_pinned boolean not null default false, parent_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists crm_project_documents (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  project_id text not null, name text not null, file_type text, file_url text,
  file_size numeric, category text, uploaded_by text,
  visible_to_client boolean not null default false, version integer, description text,
  created_at timestamptz not null default now()
);
create table if not exists crm_project_vendors (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  project_id text not null, company_name text not null, contact_person text, phone text,
  email text, gstin text, category text not null, scope_of_work text, contract_value numeric,
  status text not null default 'active', start_date date, end_date date, rating numeric, notes text,
  added_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists crm_leads (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  client_name text not null, client_email text, client_phone text, client_whatsapp text,
  client_company text, project_type text, project_location text, estimated_budget numeric,
  estimated_area numeric, project_requirements text, status text not null default 'new',
  source text, priority text not null default 'medium', assigned_to text, inquiry_date date,
  expected_start_date date, last_contact_date date, next_follow_up date, converted_project_id text,
  lost_reason text, tags text[] not null default '{}', notes text, created_by text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists crm_lead_interactions (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  lead_id text not null, type text not null, subject text, description text, outcome text,
  next_steps text, scheduled_at date, completed_at timestamptz, logged_by text,
  created_at timestamptz not null default now()
);
create table if not exists crm_lead_quotations (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  lead_id text not null, quotation_number text not null, version integer not null default 1,
  estimated_cost numeric not null default 0, design_fees numeric not null default 0,
  supervision_fees numeric not null default 0, other_charges numeric not null default 0,
  total_amount numeric not null default 0, scope_of_work text, inclusions text, exclusions text,
  terms_conditions text, validity_days integer not null default 30, status text not null default 'draft',
  sent_at timestamptz, client_response text, created_by text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists crm_notifications (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  user_id text not null, title text not null, message text, type text not null default 'info',
  read boolean not null default false, link text, created_at timestamptz not null default now()
);
create table if not exists crm_activity_log (
  id text primary key,
  firm_id uuid not null references firms(id) on delete cascade,
  user_id text not null, action text not null, action_label text, module text not null,
  entity_type text, entity_id text, entity_name text, previous_value text, updated_value text,
  details text, remarks text, created_at timestamptz not null default now()
);

create index if not exists crm_projects_firm_idx on crm_projects (firm_id);
create index if not exists crm_milestones_project_idx on crm_milestones (project_id);
create index if not exists crm_payment_splits_project_idx on crm_payment_splits (project_id);
create index if not exists crm_notifications_user_idx on crm_notifications (firm_id, user_id, read);
create index if not exists crm_activity_log_firm_idx on crm_activity_log (firm_id, created_at);

do $$
declare t text;
begin
  foreach t in array array[
    'crm_profiles','crm_projects','crm_project_assignments','crm_milestones','crm_site_updates',
    'crm_payment_plans','crm_payment_splits','crm_payments_received','crm_cost_entries','crm_comments',
    'crm_project_documents','crm_project_vendors','crm_leads','crm_lead_interactions','crm_lead_quotations',
    'crm_notifications','crm_activity_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (firm_id = current_firm_id())', t||'_sel', t);
    execute format('create policy %I on %I for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id())', t||'_mod', t);
    execute format('create policy %I on %I for all to anon using (true) with check (true)', t||'_anon_dev', t);
  end loop;
end $$;
