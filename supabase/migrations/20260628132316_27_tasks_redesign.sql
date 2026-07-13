-- ─────────────────────────────────────────────────────────────
-- 27_tasks_redesign
-- Rebuild the Tasks data model into a CRM operations center:
--  • widen status/priority taxonomies (clean remap of existing rows)
--  • rich task columns (dates, reminder, repeat, tags, notes, attachments,
--    list, polymorphic CRM link, follow-up flag, progress, ordering, archive)
--  • new tables: task_lists, task_subtasks, task_activity
-- Anon dev policies match the existing pattern (drop in Phase F with auth).
-- ─────────────────────────────────────────────────────────────

-- 1) user-created lists (must exist before tasks.list_id FK) ----------------
create table if not exists public.task_lists (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  name        text not null,
  color       text not null default 'slate',
  icon        text,
  order_index int  not null default 0,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- 2) widen status + priority, remap existing rows ---------------------------
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks drop constraint if exists tasks_priority_check;

update public.tasks set status =
  case status when 'todo' then 'not_started' when 'done' then 'completed' else status end;
update public.tasks set priority =
  case priority when 'urgent' then 'critical' else priority end;

alter table public.tasks alter column status set default 'not_started';
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('not_started','in_progress','waiting','completed','cancelled'));
alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('low','medium','high','critical'));

-- 3) rich task columns ------------------------------------------------------
alter table public.tasks
  add column if not exists start_date   date,
  add column if not exists reminder_at  timestamptz,
  add column if not exists repeat       text not null default 'none',
  add column if not exists tags         text[] not null default '{}',
  add column if not exists notes        text,
  add column if not exists attachments  jsonb not null default '[]'::jsonb,
  add column if not exists list_id      uuid references public.task_lists(id) on delete set null,
  add column if not exists link_type    text,
  add column if not exists link_id      text,
  add column if not exists link_label   text,
  add column if not exists is_followup  boolean not null default false,
  add column if not exists progress     int not null default 0,
  add column if not exists archived_at  timestamptz,
  add column if not exists order_index  double precision not null default 0;

alter table public.tasks drop constraint if exists tasks_repeat_check;
alter table public.tasks
  add constraint tasks_repeat_check
  check (repeat in ('none','daily','weekdays','weekly','monthly'));

-- 4) subtasks / checklist ---------------------------------------------------
create table if not exists public.task_subtasks (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

-- 5) activity timeline (+ comments as kind='comment') -----------------------
create table if not exists public.task_activity (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references firms(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  actor_id   text,
  actor_name text,
  kind       text not null,
  detail     text,
  created_at timestamptz not null default now()
);

-- 6) indexes ----------------------------------------------------------------
create index if not exists idx_tasks_firm        on public.tasks(firm_id);
create index if not exists idx_tasks_list        on public.tasks(list_id);
create index if not exists idx_tasks_link        on public.tasks(link_type, link_id);
create index if not exists idx_task_lists_firm   on public.task_lists(firm_id);
create index if not exists idx_subtasks_task     on public.task_subtasks(task_id);
create index if not exists idx_task_activity_task on public.task_activity(task_id);

-- 7) RLS + anon dev policies + grants (mirror existing tables) ---------------
alter table public.task_lists    enable row level security;
alter table public.task_subtasks enable row level security;
alter table public.task_activity enable row level security;

drop policy if exists task_lists_anon_dev    on public.task_lists;
drop policy if exists task_subtasks_anon_dev on public.task_subtasks;
drop policy if exists task_activity_anon_dev on public.task_activity;
create policy task_lists_anon_dev    on public.task_lists    for all to anon using (true) with check (true);
create policy task_subtasks_anon_dev on public.task_subtasks for all to anon using (true) with check (true);
create policy task_activity_anon_dev on public.task_activity for all to anon using (true) with check (true);

grant all on public.task_lists    to anon, authenticated, service_role;
grant all on public.task_subtasks to anon, authenticated, service_role;
grant all on public.task_activity to anon, authenticated, service_role;

-- 8) seed default operational lists for the demo firm -----------------------
insert into public.task_lists (firm_id, name, color, icon, order_index, created_by)
select '11111111-1111-4111-8111-111111111111', x.name, x.color, x.icon, x.ord, 'system'
from (values
  ('Sales',       'emerald', 'trending-up', 1),
  ('Site Visits', 'amber',   'map-pin',     2),
  ('Procurement', 'sky',     'truck',       3),
  ('Office',      'violet',  'building',    4),
  ('Marketing',   'rose',    'megaphone',   5),
  ('Admin',       'slate',   'shield',      6)
) as x(name, color, icon, ord)
where not exists (
  select 1 from public.task_lists
  where firm_id = '11111111-1111-4111-8111-111111111111'
);