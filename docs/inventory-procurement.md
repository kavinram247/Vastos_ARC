# Inventory & Procurement

A workflow-first, ledger-first Inventory and Procurement module for VastoArch. Every
real-world action (approve a request, issue a PO, receive goods, consume material)
automatically triggers its downstream operational, financial, project, notification and
audit consequences.

Supabase project: `weckowkvqpamnlcqwvfh` (vasto-arch-crm).

---

## 1. Design principles

- **The ledger is the only source of truth.** Stock is *never* a stored, editable number.
  `stock_movements` is an append-only, immutable ledger; on-hand / reserved / available /
  on-order / projected are all *derived* from it via SQL views.
- **All writes go through secure RPCs.** No client-side inserts. Every mutation is a
  `SECURITY DEFINER` `inv_*` function that resolves the firm/user/role from the auth
  session (`auth.uid()`), validates the transition, and never trusts client-supplied
  ids, totals, statuses, firm ids or role ids.
- **Anchored on the operational project.** Inventory ties to `crm_projects` (text id) —
  the project world the app UI actually renders — not the BOQ-world `projects` (uuid).
- **SKU-level with UOM integrity.** Inventory operates on `product_skus`; the canonical
  stocking UOM comes from the parent `catalog_products.base_uom`, with optional
  `secondary_uom` + `uom_conversion` as the purchase UOM. Incompatible units are rejected.

The empty, UI-less Frappe-clone scaffolding (`project_stock` editable current-stock,
text-typed `material_requests`/`rfqs`, `work_orders`) was dropped and rebuilt VastoArch-native.

---

## 2. Core workflow

```
BOQ / Milestone / Site requirement
  → Material Request  → Approval
  → Availability check (stock / reserve / transfer / RFQ / direct PO)
  → RFQ → vendor quotes → landed-cost comparison → award
  → PO → approval → issue            (contributes to on_order, never on_hand)
  → Goods Receipt & inspection       (only accepted qty → stock ledger)
  → Site consumption                 (reduces stock, feeds BOQ actuals)
  → Project cost + BOQ variance
  → Reorder & exception alerts
```

Every transition is a persisted, permission-checked RPC call. There are no isolated CRUD screens.

---

## 3. Schema

Migrations (applied in order): `inventory_a_ledger_foundation`, `inventory_b_requests_and_rfq`,
`inventory_c_receipts_transfers_counts`, `inventory_d_rpc_core_mr_po`,
`inventory_e1_grn_consumption_transfer`, `inventory_e2_adjust_count_rfq_alerts`,
`inventory_f/g/h` (fixes).

### Ledger & balances
| Object | Purpose |
|---|---|
| `stock_movements` | **Immutable** ledger. `qty_base` = signed delta in the SKU's canonical UOM. `BEFORE UPDATE/DELETE` trigger blocks all mutation. Unique `(firm_id, idempotency_key)`. |
| `stock_balances` (view) | `on_hand` / `reserved` / `available` derived per (firm, project, sku). |
| `stock_position` (view) | `stock_balances` + `on_order` (from PO lines) + `approved_demand` (from MRs) + `projected = available + on_order − approved_demand`. |
| `inventory_item_settings` | Per-SKU / per-project reorder level, safety stock, max, lead time, preferred vendor. |
| `inventory_alerts` | Deep-linkable, deduped exception alerts. |
| `inventory_outbox` | Durable event stream for async/external automations. |
| `inventory_number_seq` | Concurrency-safe per-firm document numbering. |

### Documents (each with `_items`)
`material_requests`, `rfqs` (+ `rfq_vendors`, `rfq_quote_items`), `purchase_orders` (extended
in place; `crm_project_id`, `created_by_crm`, `qty_base`/`qty_received_base` on lines),
`goods_receipts`, `stock_transfers`, `stock_adjustments`, `physical_counts`, `stock_consumptions`.

### Movement types
`opening_balance, purchase_receipt, site_consumption, reservation, reservation_release,
transfer_out, transfer_in, supplier_return, write_off, positive_adjustment,
negative_adjustment, reversal`. Class is `physical` or `reserved`.

`On hand = Σ physical` · `Available = on_hand − reserved` · `Projected = available + on_order − approved_demand`.

---

## 4. State machines

- **Material Request** — `draft → submitted → approved → in_procurement → partially_ordered → ordered → fulfilled`, plus `rejected`, `cancelled`.
- **RFQ** — `draft → sent → quotes_received → evaluated → awarded → closed`, plus `cancelled`.
- **Purchase Order** — `draft → pending_approval → approved → issued → partially_received → received → closed`, plus `needs_changes`, `cancelled`. Optimistic-locked via `version`.
- **Goods Receipt** — `draft → posted` (`cancelled`). Posting is idempotent (guarded by status + per-item idempotency key).
- **Transfer** — `draft → dispatched → received` (`cancelled`). Dispatch posts `transfer_out`; receipt posts `transfer_in` — a balanced pair.
- **Adjustment** — `draft → pending_approval → approved/posted` (`rejected`, `cancelled`).
- **Physical Count** — `draft → posted`; variance is booked as positive/negative adjustment movements.

---

## 5. RPC catalog (`src/inventory/inventoryApi.ts` → Postgres)

Material requests: `inv_save_material_request`, `inv_submit_material_request`,
`inv_decide_material_request`, `inv_cancel_material_request`.
Purchasing: `inv_save_purchase_order`, `inv_submit_po`, `inv_decide_po`, `inv_issue_po`.
RFQ: `inv_save_rfq`, `inv_send_rfq`, `inv_record_quote`, `inv_award_rfq`.
Receipts: `inv_save_goods_receipt`, `inv_post_goods_receipt`.
Consumption: `inv_save_consumption`, `inv_post_consumption`.
Transfers: `inv_save_transfer`, `inv_dispatch_transfer`, `inv_receive_transfer`.
Adjustments/counts: `inv_save_adjustment`, `inv_submit_adjustment`, `inv_decide_adjustment`,
`inv_save_count`, `inv_post_count`.
Ledger/automation: `inv_reserve_stock`, `inv_release_reservation`, `inv_reverse_movement`,
`inv_save_item_setting`, `inv_refresh_alerts`, `inv_process_outbox`.

Internal helpers: `inv_current_actor`, `inv_require`, `inv_next_number`, `inv_to_base`,
`inv_post_movement` (the single ledger writer; per-SKU `pg_advisory_xact_lock` prevents
oversell), `inv_log`, `inv_notify`, `inv_notify_team`, `inv_notify_admins`, `inv_alert`, `inv_emit`.

---

## 6. What posting a goods receipt does (example of interconnection)

`inv_post_goods_receipt` atomically:
1. Posts a `purchase_receipt` movement for **accepted qty only** (→ on_hand ↑).
2. Increments `po_line_items.qty_received` / `qty_received_base` (→ on_order ↓).
3. Recomputes PO status (`partially_received` / `received`) and fulfils the linked MR.
4. Writes an actual project material cost to `crm_cost_entries`.
5. Updates last accepted purchase price (`vendor_skus`).
6. Writes vendor delivery + defect performance to `vendor_performance` (feeds `computeVendorScore`).
7. Notifies the requester and project team; raises a rejected-goods alert if any.
8. Writes an immutable audit event (`crm_activity_log`) and an outbox event.

Consumption similarly reduces stock, writes `boq_actual_variance` (estimated-vs-actual for
calibration), and raises a tolerance-breach alert when usage exceeds the BOQ estimate by >10%.

---

## 7. RBAC (`src/lib/rbac.ts`)

Granular modules — the keys match the `inv_require()` checks in the RPCs:
`inventory`, `material_requests`, `rfqs`, `purchasing`, `goods_receipts`, `stock`,
`consumption`, `transfers`, `materials`, `stock_adjustments`.

Actions map to the existing verbs (`view/create/edit/delete/approve/export`). Nav is
generated from the module catalog and filtered by role **and** subscription plan
(`subscription_plans.module_keys`, updated to include the inventory suite). Vendor-price
and cost visibility reuse the existing `vendors` / `costs` view permissions.

Enforcement is layered: the UI gates every page/action, and **the backend independently
re-checks** via `inv_require` (resolving the role from `auth.uid()`, not the spoofable
header). A user without a grant is blocked at the RPC even if the UI is bypassed.

---

## 8. UI (`src/inventory/`)

`inventoryApi.ts` (data layer), `types.ts`, `ui.tsx` (Studio-Ledger primitives), `nav.ts`
(cross-page handoff), and `pages/`: Overview, Material Requests, RFQs & Quotes, Purchase
Orders, Goods Receipts, Stock & Movements (current stock + ledger + counts + adjustments),
Consumption, Transfers, Materials. Project-level quick actions live on the Project detail page.

Design language: mineral-neutral canvas, single spruce action accent, flat surfaces, dense
scannable tables, exception-first dashboards, explicit empty / loading / error / permission /
success states, mobile-friendly consumption entry.

---

## 9. Security & correctness posture

- Firm/tenant isolation via RLS (`firm_id = current_firm_id()`); inventory tables expose
  **reads only** — all writes are RPC-only (no permissive write policies).
- Idempotent posting (idempotency keys + status guards); concurrency-safe numbering and
  per-SKU advisory locks; optimistic version checks on MR/PO.
- No dependence on demo firm/user ids anywhere in the inventory paths.

---

## 10. Verification

End-to-end RPC smoke test (run as an authenticated user, rolled back so no data persisted)
confirmed every Definition-of-Done item:

request→approve, PO approve/issue leaves physical stock **0** while `on_order=100`, posted
GRN adds **only accepted** qty (60 of 65 delivered), partial receipt → `partially_received`,
project cost + vendor performance written, consumption reduces stock, transfer stays balanced
(30 + 20 = 50), write-off adjustment auditable, **stock reconstructs from the ledger = 45**,
**UOM conflict blocked**, **ledger immutable**, audit + notifications emitted. A negative test
confirmed a non-granted user is rejected at the RPC (`permission denied: create on material_requests`).

`npx tsc --noEmit` clean; `npm run build` succeeds (2246 modules).

---

## 11. Notes / future work

- The `inventory_outbox` is drained by `inv_process_outbox`; wire an edge function to it for
  external channels (email / WhatsApp / webhooks). In-app notifications are already emitted inline.
- Adjustment approval thresholds are modelled (submit → approve); a configurable per-firm
  auto-approve threshold can be added to `inv_decide_adjustment`.
- Stale-stock and unmatched-invoice alerts have alert types reserved; add generators to
  `inv_refresh_alerts` when payables reconciliation lands.
