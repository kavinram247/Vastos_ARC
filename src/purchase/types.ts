// ─────────────────────────────────────────────────────────────
// Purchase Management — domain types + option/label/status catalogs.
// Reuses the existing commercial layer (vendors / catalog_products /
// purchase_orders) and adds the net-new procurement entities. See
// supabase/migrations/28_purchase_management.sql for the schema of record.
// ─────────────────────────────────────────────────────────────
import type { Badge } from '../components/ui/Badge';

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

// ── UOM (constrained by the DB `uom` enum for PO lines; free text elsewhere) ──
export const UOMS = [
  'nos', 'sqft', 'sqm', 'rft', 'rmt', 'sheet', 'set', 'pair',
  'litre', 'kg', 'box', 'bag', 'point', 'day', 'hour', 'lumpsum', 'cum',
] as const;
export type Uom = (typeof UOMS)[number];
export const UOM_LABEL: Record<string, string> = {
  nos: 'Nos', sqft: 'Sqft', sqm: 'Sqm', rft: 'Rft', rmt: 'Rmt', sheet: 'Sheet',
  set: 'Set', pair: 'Pair', litre: 'Litre', kg: 'Kg', box: 'Box', bag: 'Bag',
  point: 'Point', day: 'Day', hour: 'Hour', lumpsum: 'Lumpsum', cum: 'Cum',
};

// ── Material categories (aligned with the Frappe reference) ──
export const MATERIAL_CATEGORIES = [
  'Plumbing', 'Electrical', 'Civil', 'Sanitary', 'Woodwork',
  'Painting', 'Flooring', 'Roofing', 'Hardware', 'Miscellaneous',
] as const;

// ── Vendors (supplier master — reuses `vendors`) ──
export type VendorStatus = 'active' | 'preferred' | 'probation' | 'blacklisted' | 'inactive';

export interface PurchaseVendor {
  id: string;
  company_name: string;
  vendor_code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  category: string | null;
  credit_days: number | null;
  payment_terms: string | null;
  status: VendorStatus;
  notes: string | null;
  overall_score: number | null;
}

// ── Materials (material master — reuses `catalog_products`) ──
export interface PurchaseMaterial {
  id: string;
  name: string;
  category: string | null;   // resolved catalog category name
  category_id: string | null;
  base_uom: string;
  hsn_code: string | null;
  gst_rate: number;
  last_price: number | null; // most recent rate_card rate
  is_active: boolean;
}

// ── Editable line item shared by Requests / RFQ / PO forms ──
export interface LineItem {
  key: string;             // client-side row key
  material_id: string | null;
  material_name: string;
  description?: string;
  quantity: number;
  uom: string;
  rate: number;            // unit price / rate
  required_by?: string;    // requests only
}

// ── Material Requests (the CMR intake) ──
export type MaterialRequestStatus = 'open' | 'in_rfq' | 'in_po' | 'fulfilled' | 'cancelled';
export interface ClientRequirement { requirement: string; before: string }

export interface MaterialRequest {
  id: string;
  request_number: string;
  request_date: string;
  project_id: string | null;
  plant_description: string | null;
  total_days: number | null;
  engineer_id: string | null;
  status: MaterialRequestStatus;
  client_requirements: ClientRequirement[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items: MaterialRequestItem[];
}
export interface MaterialRequestItem {
  id: string;
  material_id: string | null;
  material_name: string;
  description: string | null;
  quantity: number;
  uom: string | null;
  required_by: string | null;
  order_index: number;
}

// ── RFQ ──
export type RfqStatus = 'draft' | 'sent' | 'quotes_received' | 'closed';
export type RfqVendorStatus = 'pending' | 'sent' | 'responded' | 'declined';

export interface Rfq {
  id: string;
  rfq_number: string;
  rfq_date: string;
  project_id: string | null;
  material_type: string | null;
  status: RfqStatus;
  quote_valid_until: string | null;
  material_request_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items: RfqItem[];
  vendors: RfqVendor[];
}
export interface RfqItem {
  id: string;
  material_id: string | null;
  material_name: string;
  quantity: number;
  uom: string | null;
  unit_price: number | null;
  order_index: number;
}
export interface RfqVendor {
  id: string;
  vendor_id: string | null;
  vendor_name: string;
  mobile: string | null;
  sent_date: string | null;
  status: RfqVendorStatus;
  quoted_amount: number | null;
  order_index: number;
}

// ── Purchase Orders (unified ledger — reuses `purchase_orders`) ──
export type PoStatus = 'draft' | 'issued' | 'partially_received' | 'received' | 'closed' | 'cancelled';
export type PoPaymentStatus = 'outstanding' | 'partial' | 'paid';
export type PoApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type GstType = 'inclusive' | 'exclusive';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  project_id: string | null;
  vendor_id: string | null;
  boq_id: string | null;
  rfq_id: string | null;
  material_request_id: string | null;
  material_type: string | null;
  status: PoStatus;
  payment_status: PoPaymentStatus;
  approval_status: PoApprovalStatus;
  po_date: string;          // created_at (display)
  required_by: string | null;
  delivery_date: string | null;
  delivery_address: string | null;
  credit_days: number | null;
  supplier_quotation_ref: string | null;
  gst_rate: number;
  gst_type: GstType;
  freight_charges: number;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  order_contact_id: string | null;
  order_contact_phone: string | null;
  delivery_contact_id: string | null;
  delivery_contact_phone: string | null;
  additional_terms: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_by: string | null;
  created_at: string;
  items: PoItem[];
  payments: PoPayment[];
}
export interface PoItem {
  id: string;
  material_id: string | null;   // sku_id
  description: string;
  quantity: number;
  uom: string;
  rate: number;
  amount: number;
  qty_received: number;
}
export interface PoPayment {
  id: string;
  payment_date: string;
  amount: number;
  payment_mode: string | null;
  reference_no: string | null;
}

// ── Project Stock ──
export interface ProjectStock {
  id: string;
  project_id: string | null;
  material_id: string | null;
  material_name: string;
  uom: string | null;
  current_stock: number;
  reorder_level: number;
  last_updated: string | null;
  last_po_id: string | null;
}

// ── Work Orders ──
export type WorkOrderStatus = 'draft' | 'issued' | 'in_progress' | 'completed' | 'cancelled';
export interface WorkOrder {
  id: string;
  wo_number: string;
  title: string;
  project_id: string | null;
  contractor_vendor_id: string | null;
  wo_date: string;
  amount: number | null;
  status: WorkOrderStatus;
  work_description: string | null;
  terms_of_payment: string | null;
  terms_conditions: string | null;
  additional_work: string | null;
  bank_details: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Status → badge variant + label (single source for chips) ──
interface StatusConfig { label: string; variant: BadgeVariant }

export const VENDOR_STATUS: Record<string, StatusConfig> = {
  active:      { label: 'Active', variant: 'default' },
  preferred:   { label: 'Preferred', variant: 'success' },
  probation:   { label: 'Probation', variant: 'warning' },
  blacklisted: { label: 'Blacklisted', variant: 'error' },
  inactive:    { label: 'Inactive', variant: 'default' },
};

export const REQUEST_STATUS: Record<string, StatusConfig> = {
  open:      { label: 'Open', variant: 'info' },
  in_rfq:    { label: 'In RFQ', variant: 'warning' },
  in_po:     { label: 'In PO', variant: 'warning' },
  fulfilled: { label: 'Fulfilled', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

export const RFQ_STATUS: Record<string, StatusConfig> = {
  draft:           { label: 'Draft', variant: 'default' },
  sent:            { label: 'Sent', variant: 'info' },
  quotes_received: { label: 'Quotes in', variant: 'warning' },
  closed:          { label: 'Closed', variant: 'success' },
};

export const PO_STATUS: Record<string, StatusConfig> = {
  draft:              { label: 'Draft', variant: 'default' },
  issued:             { label: 'Issued', variant: 'info' },
  partially_received: { label: 'Partial', variant: 'warning' },
  received:           { label: 'Received', variant: 'success' },
  closed:             { label: 'Closed', variant: 'success' },
  cancelled:          { label: 'Cancelled', variant: 'error' },
};

export const PO_PAYMENT_STATUS: Record<string, StatusConfig> = {
  outstanding: { label: 'Outstanding', variant: 'error' },
  partial:     { label: 'Part-paid', variant: 'warning' },
  paid:        { label: 'Paid', variant: 'success' },
};

export const PO_APPROVAL_STATUS: Record<string, StatusConfig> = {
  draft:    { label: 'Draft', variant: 'default' },
  pending:  { label: 'Pending approval', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
};

export const WORK_ORDER_STATUS: Record<string, StatusConfig> = {
  draft:       { label: 'Draft', variant: 'default' },
  issued:      { label: 'Issued', variant: 'info' },
  in_progress: { label: 'In progress', variant: 'warning' },
  completed:   { label: 'Completed', variant: 'success' },
  cancelled:   { label: 'Cancelled', variant: 'error' },
};
