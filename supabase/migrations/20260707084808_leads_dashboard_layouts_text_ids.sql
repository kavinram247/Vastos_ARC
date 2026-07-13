alter table crm_dashboard_layouts alter column user_id type text using user_id::text;
alter table crm_dashboard_layouts alter column created_by type text using created_by::text;