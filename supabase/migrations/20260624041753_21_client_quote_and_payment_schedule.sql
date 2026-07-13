-- ─────────────────────────────────────────────────────────────
-- Deal-maker #2: shareable client quote + quote-to-cash payment schedule
-- ─────────────────────────────────────────────────────────────
alter table quotations
  add column if not exists share_token uuid unique default gen_random_uuid(),
  add column if not exists viewed_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by_name text,
  add column if not exists selected_options jsonb not null default '[]';

update quotations set share_token = gen_random_uuid() where share_token is null;

create table payment_schedules (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references firms(id) on delete cascade,
  quotation_id      uuid references quotations(id) on delete cascade,
  boq_id            uuid references boq_documents(id) on delete set null,
  project_id        uuid references projects(id) on delete set null,
  total_amount      numeric(16,2) not null,
  split_count       int not null,
  client_signed_off boolean not null default true,
  signed_name       text,
  signed_at         timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create table payment_milestones (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  schedule_id    uuid not null references payment_schedules(id) on delete cascade,
  split_number   int not null,
  label          text not null,
  percent        numeric(5,2) not null,
  amount         numeric(16,2) not null,
  gst_rate       numeric(5,2) not null default 18,
  gst_amount     numeric(16,2) not null default 0,
  total_with_gst numeric(16,2) not null,
  trigger_type   text not null default 'milestone',
  status         text not null default 'scheduled',
  created_at     timestamptz not null default now()
);

create index on payment_schedules (firm_id, quotation_id);
create index on payment_milestones (schedule_id, split_number);

-- RLS: firm-scoped (authenticated) + anon dev (matches the rest of the build)
do $$
declare t text;
begin
  foreach t in array array['payment_schedules','payment_milestones'] loop
    execute 'alter table '||quote_ident(t)||' enable row level security';
    execute 'create policy '||quote_ident(t||'_sel')||' on '||quote_ident(t)||' for select to authenticated using (firm_id = current_firm_id())';
    execute 'create policy '||quote_ident(t||'_mod')||' on '||quote_ident(t)||' for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id())';
    execute 'create policy '||quote_ident(t||'_anon_dev')||' on '||quote_ident(t)||' for all to anon using (true) with check (true)';
  end loop;
end $$;
