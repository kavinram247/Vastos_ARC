// ─────────────────────────────────────────────────────────────
// Inventory & Procurement — domain types (mirror the Supabase schema built in
// migrations inventory_a … inventory_e2). Stock is never a stored number: it is
// derived from the immutable stock_movements ledger (stock_balances /
// stock_position views). All mutations go through the inv_* SECURITY DEFINER
// RPCs — see inventoryApi.ts.
// ─────────────────────────────────────────────────────────────

export type MrStatus =
  | 'draft' | 'submitted' | 'approved' | 'in_procurement'
  | 'partially_ordered' | 'ordered' | 'fulfilled' | 'rejected' | 'cancelled';

export type PoStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'needs_changes'
  | 'issued' | 'partially_received' | 'received' | 'closed' | 'cancelled';

export type GrnStatus = 'draft' | 'posted' | 'cancelled';
export type TransferStatus = 'draft' | 'dispatched' | 'received' | 'cancelled';
export type AdjustmentStatus = 'draft' | 'pending_approval' | 'approved' | 'posted' | 'rejected' | 'cancelled';
export type CountStatus = 'draft' | 'counting' | 'posted' | 'cancelled';
export type ConsumptionStatus = 'draft' | 'posted' | 'cancelled';
export type RfqStatus = 'draft' | 'sent' | 'quotes_received' | 'evaluated' | 'awarded' | 'closed' | 'cancelled';

export type MovementType =
  | 'opening_balance' | 'purchase_receipt' | 'site_consumption' | 'reservation'
  | 'reservation_release' | 'transfer_out' | 'transfer_in' | 'supplier_return'
  | 'write_off' | 'positive_adjustment' | 'negative_adjustment' | 'reversal';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ProcurementPriority = 'balanced' | 'speed' | 'margin' | 'quality';

/** A stock-keeping material (product_skus joined to its catalog product). */
export interface Material {
  sku_id: string;
  sku_code: string;
  product_id: string;
  name: string;
  brand: string | null;
  category: string;
  base_uom: string;
  secondary_uom: string | null;
  uom_conversion: number | null;
  gst_rate: number;
  hsn_code: string | null;
  quality_grade: string;
}

/** Firm-/project-level reorder policy for a material. */
export interface ItemSetting {
  id: string;
  sku_id: string;
  project_id: string | null;
  reorder_level: number;
  safety_stock: number;
  max_level: number | null;
  lead_time_days: number | null;
  preferred_vendor_id: string | null;
}

/** Derived balance (from stock_position view). */
export interface StockPosition {
  firm_id: string;
  project_id: string;
  sku_id: string;
  on_hand: number;
  reserved: number;
  available: number;
  on_order: number;
  approved_demand: number;
  projected: number;
  last_movement_at: string | null;
}

export interface StockMovement {
  id: string;
  project_id: string;
  location: string | null;
  sku_id: string;
  movement_type: MovementType;
  movement_class: 'physical' | 'reserved';
  qty: number;
  uom: string;
  qty_base: number;
  unit_cost: number | null;
  ref_type: string | null;
  ref_id: string | null;
  batch_ref: string | null;
  note: string | null;
  posted_by_name: string | null;
  created_at: string;
}

export interface MaterialRequest {
  id: string;
  request_number: string;
  project_id: string;
  location: string | null;
  milestone_id: string | null;
  requester_id: string | null;
  requester_name: string | null;
  status: MrStatus;
  priority: Priority;
  source: string;
  required_by: string | null;
  notes: string | null;
  approver_name: string | null;
  rejected_reason: string | null;
  version: number;
  created_at: string;
}

export interface MaterialRequestItem {
  id: string;
  request_id: string;
  sku_id: string | null;
  material_name: string;
  specification: string | null;
  uom: string | null;
  required_qty: number;
  available_qty: number;
  on_order_qty: number;
  suggested_qty: number;
  approved_qty: number | null;
  ordered_qty: number;
  required_by: string | null;
  boq_line_id: string | null;
  order_index: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  crm_project_id: string | null;
  vendor_id: string | null;
  material_request_id: string | null;
  rfq_id: string | null;
  status: PoStatus;
  approval_status: string;
  required_by: string | null;
  delivery_date: string | null;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  gst_rate: number;
  gst_type: string;
  freight_charges: number;
  payment_status: string;
  notes: string | null;
  admin_notes: string | null;
  issued_at: string | null;
  received_at: string | null;
  version: number;
  created_at: string;
}

export interface PoLineItem {
  id: string;
  po_id: string;
  sku_id: string | null;
  description: string;
  uom: string;
  quantity: number;
  rate: number;
  amount: number;
  qty_received: number;
  mr_item_id: string | null;
  boq_line_id: string | null;
}

export interface GoodsReceipt {
  id: string;
  grn_number: string;
  po_id: string | null;
  crm_project_id: string | null;
  vendor_id: string | null;
  location: string | null;
  delivery_date: string;
  challan_no: string | null;
  received_by_name: string | null;
  status: GrnStatus;
  notes: string | null;
  posted_at: string | null;
  created_at: string;
}

export interface GoodsReceiptItem {
  id: string;
  grn_id: string;
  po_line_id: string | null;
  sku_id: string | null;
  material_name: string;
  uom: string | null;
  ordered_qty: number;
  prev_received_qty: number;
  delivered_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  damaged_qty: number;
  rejection_reason: string | null;
  quality_notes: string | null;
  batch_ref: string | null;
  unit_cost: number | null;
  order_index: number;
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  from_project: string;
  to_project: string;
  from_location: string | null;
  to_location: string | null;
  status: TransferStatus;
  dispatched_at: string | null;
  received_at: string | null;
  note: string | null;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  crm_project_id: string;
  kind: string;
  reason: string | null;
  status: AdjustmentStatus;
  requested_by_name: string | null;
  approved_by_name: string | null;
  created_at: string;
}

export interface PhysicalCount {
  id: string;
  count_number: string;
  crm_project_id: string;
  location: string | null;
  status: CountStatus;
  counted_at: string;
  note: string | null;
  created_at: string;
}

export interface Consumption {
  id: string;
  consumption_number: string;
  crm_project_id: string;
  location: string | null;
  milestone_id: string | null;
  consumed_at: string;
  entered_by_name: string | null;
  status: ConsumptionStatus;
  note: string | null;
  created_at: string;
}

export interface Rfq {
  id: string;
  rfq_number: string;
  status: RfqStatus;
  project_id: string | null;
  material_request_id: string | null;
  priority: ProcurementPriority;
  required_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface InventoryAlert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string | null;
  project_id: string | null;
  sku_id: string | null;
  ref_type: string | null;
  ref_id: string | null;
  link: string | null;
  status: string;
  created_at: string;
}
