-- ===== RBAC: roles, role_permissions, profile link =====
create table if not exists public.crm_roles (
  id          text primary key,
  firm_id     uuid not null references public.firms(id),
  key         text not null,
  name        text not null,
  description text,
  scope       text not null default 'all' check (scope in ('all','assigned','own')),
  is_system   boolean not null default false,
  is_admin    boolean not null default false,
  enabled     boolean not null default true,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (firm_id, key)
);

create table if not exists public.crm_role_permissions (
  id         text primary key,
  firm_id    uuid not null references public.firms(id),
  role_id    text not null references public.crm_roles(id) on delete cascade,
  module     text not null,
  actions    text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (role_id, module)
);

alter table public.crm_profiles
  add column if not exists role_id text references public.crm_roles(id);

create index if not exists idx_crm_role_permissions_role on public.crm_role_permissions(role_id);
create index if not exists idx_crm_profiles_role on public.crm_profiles(role_id);

-- ===== RLS =====
alter table public.crm_roles enable row level security;
alter table public.crm_role_permissions enable row level security;

-- demo-parity open policy (kept for the shared anon-key demo; drop in production)
drop policy if exists crm_roles_anon_dev on public.crm_roles;
create policy crm_roles_anon_dev on public.crm_roles for all to anon using (true) with check (true);
drop policy if exists crm_role_permissions_anon_dev on public.crm_role_permissions;
create policy crm_role_permissions_anon_dev on public.crm_role_permissions for all to anon using (true) with check (true);

-- ===== permission-aware backend context (defense-in-depth) =====
-- Reads the role id the app stamps on each PostgREST request via the
-- 'x-crm-role-id' header. Spoofable under the shared anon key, but gives a real
-- backend chokepoint; production should switch to auth.uid()-driven lookup.
create or replace function public.crm_current_role_id()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.headers', true)::json ->> 'x-crm-role-id',
    ''
  );
$$;

create or replace function public.crm_has_permission(p_module text, p_action text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.crm_roles r
    where r.id = public.crm_current_role_id()
      and r.enabled
      and (
        r.is_admin
        or exists (
          select 1 from public.crm_role_permissions rp
          where rp.role_id = r.id
            and rp.module = p_module
            and p_action = any(rp.actions)
        )
      )
  );
$$;

grant execute on function public.crm_current_role_id() to anon, authenticated;
grant execute on function public.crm_has_permission(text, text) to anon, authenticated;