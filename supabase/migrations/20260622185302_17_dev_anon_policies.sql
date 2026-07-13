-- ─────────────────────────────────────────────────────────────
-- DEV ONLY: anon-role policies so the app works with the publishable key
-- before Supabase Auth is wired. HARDENING: drop these once auth lands;
-- the strict `authenticated` + current_firm_id() policies already exist.
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
  firm_tables text[] := array[
    'firms','profiles','projects','leads','rooms',
    'rate_cards','discount_tiers','margin_policies',
    'vendors','vendor_skus','vendor_performance',
    'module_instances',
    'boq_documents','boq_sections','boq_line_items','boq_revisions','boq_approvals',
    'quotations','purchase_orders','po_line_items','cost_entries',
    'boq_actual_variance','calibration_runs','ai_extraction_jobs'
  ];
begin
  foreach t in array firm_tables loop
    execute 'create policy '||quote_ident(t||'_anon_dev')||' on '||quote_ident(t)||
            ' for all to anon using (true) with check (true)';
  end loop;
end $$;
