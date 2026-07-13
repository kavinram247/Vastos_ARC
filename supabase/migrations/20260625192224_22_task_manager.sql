
-- ─────────────────────────────────────────────────────────────
-- Task Manager — team tasks for internal staff (architect/engineer).
-- Owner & privileged staff can assign; assignees are non-owner staff only.
-- References legacy in-memory profile/project ids as TEXT (mock auth, no
-- Supabase profiles for non-owner users yet), firm-scoped by the real firm UUID.
-- ─────────────────────────────────────────────────────────────

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  title text not null,
  description text,
  assignee_id text not null,
  assignee_name text not null,
  created_by_id text not null,
  created_by_name text not null,
  project_id text,
  project_name text,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_firm_idx on tasks (firm_id);
create index if not exists tasks_assignee_idx on tasks (firm_id, assignee_id);

-- Which non-owner staff the owner has granted "can assign to others" rights.
create table if not exists task_assign_privileges (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  user_id text not null,
  user_name text not null,
  granted_by text,
  granted_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

alter table tasks enable row level security;
alter table task_assign_privileges enable row level security;

-- authenticated firm-scoped (real policies, active once Supabase Auth is wired)
create policy tasks_sel on tasks for select to authenticated using (firm_id = current_firm_id());
create policy tasks_mod on tasks for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());
create policy tap_sel on task_assign_privileges for select to authenticated using (firm_id = current_firm_id());
create policy tap_mod on task_assign_privileges for all to authenticated using (firm_id = current_firm_id()) with check (firm_id = current_firm_id());

-- DEV anon policies (app currently uses the publishable/anon key, mock auth).
-- Drop these in Phase F alongside migrations 17/20/21.
create policy tasks_anon_dev on tasks for all to anon using (true) with check (true);
create policy tap_anon_dev on task_assign_privileges for all to anon using (true) with check (true);
