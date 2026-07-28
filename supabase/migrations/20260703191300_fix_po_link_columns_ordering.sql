-- ═══════════════════════════════════════════════════════════════════════════
-- DRIFT REPAIR (audit W2) — migration ordering, not a schema change.
--
-- inventory_c (20260703191400) adds foreign keys on purchase_orders.
-- material_request_id and purchase_orders.rfq_id, but those columns are not
-- created until 28_purchase_management_renamed (20260704053216) — a day later
-- in migration order. A fresh `supabase db reset` therefore fails with:
--
--   ERROR: column "material_request_id" referenced in foreign key constraint
--          does not exist (SQLSTATE 42703)
--
-- The remote databases only work because these columns were already present
-- out-of-band. This migration creates them just before inventory_c needs them.
--
-- Safe to apply anywhere: `add column if not exists` is a no-op where they
-- already exist, and 28_purchase_management_renamed is likewise idempotent, so
-- it remains correct when it runs later.
-- ═══════════════════════════════════════════════════════════════════════════

alter table purchase_orders add column if not exists material_request_id uuid;
alter table purchase_orders add column if not exists rfq_id              uuid;
