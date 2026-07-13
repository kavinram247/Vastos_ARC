-- Pin search_path on the RBAC functions (clears function_search_path_mutable lint).
-- Bodies fully-qualify all objects, so an empty search_path is safe.
create or replace function public.crm_current_role_id()
returns text
language sql
stable
set search_path = ''
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
set search_path = ''
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