-- ─────────────────────────────────────────────────────────────
-- DEV ONLY: anon WRITE access to shared catalog tables (was SELECT-only).
-- Fixes silently-dropped waste_factor / region-index / catalog edits under
-- the publishable key. HARDENING: drop with the other dev anon policies
-- once Supabase Auth is wired.
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
  shared_tables text[] := array[
    'catalog_categories','catalog_products','product_skus','product_alternates',
    'catalog_embeddings','module_templates','module_rules','regions','labour_activities'
  ];
begin
  foreach t in array shared_tables loop
    execute 'create policy '||quote_ident(t||'_anon_dev')||' on '||quote_ident(t)||
            ' for all to anon using (true) with check (true)';
  end loop;
end $$;
