// ─────────────────────────────────────────────────────────────
// Inventory & Procurement — data access layer.
//
// READS are firm-scoped selects against the ledger-derived views + document
// tables. WRITES go exclusively through the inv_* SECURITY DEFINER RPCs, which
// resolve the firm/user/role from the auth session and validate every
// transition server-side (client ids/totals/status are never trusted). This
// file therefore contains NO stock math and NO status transitions — those live
// in Postgres. See migrations inventory_a … inventory_e2.
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import type {
  Material, ItemSetting, StockPosition, StockMovement, MaterialRequest, MaterialRequestItem,
  PurchaseOrder, PoLineItem, GoodsReceipt, GoodsReceiptItem, StockTransfer, StockAdjustment,
  PhysicalCount, Consumption, Rfq, InventoryAlert,
} from './types';

const sb = supabase as any;

async function rpc<T = any>(fn: string, args: Record<string, any>): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const num = (v: any) => (v == null ? 0 : Number(v));

// ══════════════════════════════ READS ══════════════════════════════

/** Every stock-keeping material (SKU) with its canonical UOM + catalog meta. */
export async function listMaterials(firmId: string): Promise<Material[]> {
  const [{ data: skus, error: es }, { data: cats, error: ec }] = await Promise.all([
    sb.from('product_skus')
      .select('id, sku_code, brand, quality_grade, product_id, catalog_products(name, category_id, base_uom, secondary_uom, uom_conversion, gst_rate, hsn_code, firm_id, is_active)')
      .eq('is_active', true),
    sb.from('catalog_categories').select('id,name'),
  ]);
  if (es) throw es; if (ec) throw ec;
  const catName = new Map<string, string>((cats || []).map((c: any) => [c.id, c.name]));
  return ((skus || []) as any[])
    .filter((s) => { const f = s.catalog_products?.firm_id; return !f || f === firmId; })
    .map((s) => ({
      sku_id: s.id, sku_code: s.sku_code, product_id: s.product_id,
      name: s.catalog_products?.name ?? s.sku_code, brand: s.brand,
      category: catName.get(s.catalog_products?.category_id) ?? '—',
      base_uom: s.catalog_products?.base_uom ?? 'nos',
      secondary_uom: s.catalog_products?.secondary_uom ?? null,
      uom_conversion: s.catalog_products?.uom_conversion == null ? null : Number(s.catalog_products.uom_conversion),
      gst_rate: num(s.catalog_products?.gst_rate), hsn_code: s.catalog_products?.hsn_code ?? null,
      quality_grade: s.quality_grade,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listItemSettings(firmId: string): Promise<ItemSetting[]> {
  const { data, error } = await sb.from('inventory_item_settings').select('*').eq('firm_id', firmId);
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({
    id: r.id, sku_id: r.sku_id, project_id: r.project_id,
    reorder_level: num(r.reorder_level), safety_stock: num(r.safety_stock),
    max_level: r.max_level == null ? null : num(r.max_level),
    lead_time_days: r.lead_time_days, preferred_vendor_id: r.preferred_vendor_id,
  }));
}

/** Ledger-derived balances (on-hand / reserved / available / on-order / projected). */
export async function listStockPositions(firmId: string, projectId?: string): Promise<StockPosition[]> {
  let q = sb.from('stock_position').select('*').eq('firm_id', firmId);
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({
    firm_id: r.firm_id, project_id: r.project_id, sku_id: r.sku_id,
    on_hand: num(r.on_hand), reserved: num(r.reserved), available: num(r.available),
    on_order: num(r.on_order), approved_demand: num(r.approved_demand), projected: num(r.projected),
    last_movement_at: r.last_movement_at,
  }));
}

export async function listMovements(firmId: string, opts: { projectId?: string; skuId?: string; limit?: number } = {}): Promise<StockMovement[]> {
  let q = sb.from('stock_movements').select('*').eq('firm_id', firmId).order('created_at', { ascending: false }).limit(opts.limit ?? 300);
  if (opts.projectId) q = q.eq('project_id', opts.projectId);
  if (opts.skuId) q = q.eq('sku_id', opts.skuId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({
    id: r.id, project_id: r.project_id, location: r.location, sku_id: r.sku_id,
    movement_type: r.movement_type, movement_class: r.movement_class,
    qty: num(r.qty), uom: r.uom, qty_base: num(r.qty_base),
    unit_cost: r.unit_cost == null ? null : num(r.unit_cost),
    ref_type: r.ref_type, ref_id: r.ref_id, batch_ref: r.batch_ref, note: r.note,
    posted_by_name: r.posted_by_name, created_at: r.created_at,
  }));
}

export async function listMaterialRequests(firmId: string): Promise<MaterialRequest[]> {
  const { data, error } = await sb.from('material_requests').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as MaterialRequest[];
}

export async function getMaterialRequestItems(requestId: string): Promise<MaterialRequestItem[]> {
  const { data, error } = await sb.from('material_request_items').select('*').eq('request_id', requestId).order('order_index');
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({
    ...r, required_qty: num(r.required_qty), available_qty: num(r.available_qty),
    on_order_qty: num(r.on_order_qty), suggested_qty: num(r.suggested_qty),
    approved_qty: r.approved_qty == null ? null : num(r.approved_qty), ordered_qty: num(r.ordered_qty),
  })) as MaterialRequestItem[];
}

export async function listPurchaseOrders(firmId: string): Promise<PurchaseOrder[]> {
  const { data, error } = await sb.from('purchase_orders').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({
    ...r, subtotal: num(r.subtotal), gst_amount: num(r.gst_amount), total_amount: num(r.total_amount),
    gst_rate: num(r.gst_rate), freight_charges: num(r.freight_charges), version: num(r.version),
  })) as PurchaseOrder[];
}

export async function getPoLineItems(poId: string): Promise<PoLineItem[]> {
  const { data, error } = await sb.from('po_line_items').select('*').eq('po_id', poId).order('created_at');
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({
    ...r, quantity: num(r.quantity), rate: num(r.rate), amount: num(r.amount), qty_received: num(r.qty_received),
  })) as PoLineItem[];
}

export async function listGoodsReceipts(firmId: string): Promise<GoodsReceipt[]> {
  const { data, error } = await sb.from('goods_receipts').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as GoodsReceipt[];
}

export async function getGoodsReceiptItems(grnId: string): Promise<GoodsReceiptItem[]> {
  const { data, error } = await sb.from('goods_receipt_items').select('*').eq('grn_id', grnId).order('order_index');
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({
    ...r, ordered_qty: num(r.ordered_qty), prev_received_qty: num(r.prev_received_qty),
    delivered_qty: num(r.delivered_qty), accepted_qty: num(r.accepted_qty),
    rejected_qty: num(r.rejected_qty), damaged_qty: num(r.damaged_qty),
    unit_cost: r.unit_cost == null ? null : num(r.unit_cost),
  })) as GoodsReceiptItem[];
}

export async function listTransfers(firmId: string): Promise<StockTransfer[]> {
  const { data, error } = await sb.from('stock_transfers').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as StockTransfer[];
}
export async function getTransferItems(transferId: string) {
  const { data, error } = await sb.from('stock_transfer_items').select('*').eq('transfer_id', transferId).order('order_index');
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({ ...r, quantity: num(r.quantity), dispatched_qty: num(r.dispatched_qty), received_qty: num(r.received_qty) }));
}

export async function listAdjustments(firmId: string): Promise<StockAdjustment[]> {
  const { data, error } = await sb.from('stock_adjustments').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as StockAdjustment[];
}
export async function listCounts(firmId: string): Promise<PhysicalCount[]> {
  const { data, error } = await sb.from('physical_counts').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PhysicalCount[];
}
export async function listConsumptions(firmId: string): Promise<Consumption[]> {
  const { data, error } = await sb.from('stock_consumptions').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Consumption[];
}

export async function listRfqs(firmId: string): Promise<Rfq[]> {
  const { data, error } = await sb.from('rfqs').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Rfq[];
}
export async function getRfqDetail(rfqId: string) {
  const [items, vendors, quotes] = await Promise.all([
    sb.from('rfq_items').select('*').eq('rfq_id', rfqId).order('order_index'),
    sb.from('rfq_vendors').select('*').eq('rfq_id', rfqId).order('order_index'),
    sb.from('rfq_quote_items').select('*').eq('rfq_id', rfqId),
  ]);
  for (const r of [items, vendors, quotes]) if (r.error) throw r.error;
  return { items: items.data || [], vendors: vendors.data || [], quotes: quotes.data || [] };
}

export async function listAlerts(firmId: string): Promise<InventoryAlert[]> {
  const { data, error } = await sb.from('inventory_alerts').select('*').eq('firm_id', firmId)
    .eq('status', 'open').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as InventoryAlert[];
}

// ══════════════════════════════ WRITES (RPC) ══════════════════════════════
// Material requests
export const saveMaterialRequest = (payload: any, items: any[]) => rpc<string>('inv_save_material_request', { p_payload: payload, p_items: items });
export const submitMaterialRequest = (id: string, version: number) => rpc('inv_submit_material_request', { p_id: id, p_expected_version: version });
export const decideMaterialRequest = (id: string, decision: 'approve' | 'reject', notes: string | null, itemApprovals: Record<string, number> = {}) =>
  rpc('inv_decide_material_request', { p_id: id, p_decision: decision, p_notes: notes, p_item_approvals: itemApprovals });
export const cancelMaterialRequest = (id: string, reason: string | null) => rpc('inv_cancel_material_request', { p_id: id, p_reason: reason });

// Purchase orders
export const savePurchaseOrder = (payload: any, items: any[]) => rpc<string>('inv_save_purchase_order', { p_payload: payload, p_items: items });
export const submitPo = (id: string, version: number) => rpc('inv_submit_po', { p_id: id, p_expected_version: version });
export const decidePo = (id: string, decision: 'approve' | 'needs_changes' | 'reject', notes: string | null) =>
  rpc('inv_decide_po', { p_id: id, p_decision: decision, p_notes: notes });
export const issuePo = (id: string) => rpc('inv_issue_po', { p_id: id });

// Goods receipts
export const saveGoodsReceipt = (payload: any, items: any[]) => rpc<string>('inv_save_goods_receipt', { p_payload: payload, p_items: items });
export const postGoodsReceipt = (id: string) => rpc('inv_post_goods_receipt', { p_id: id });

// Consumption
export const saveConsumption = (payload: any, items: any[]) => rpc<string>('inv_save_consumption', { p_payload: payload, p_items: items });
export const postConsumption = (id: string) => rpc('inv_post_consumption', { p_id: id });

// Transfers
export const saveTransfer = (payload: any, items: any[]) => rpc<string>('inv_save_transfer', { p_payload: payload, p_items: items });
export const dispatchTransfer = (id: string) => rpc('inv_dispatch_transfer', { p_id: id });
export const receiveTransfer = (id: string, received: Record<string, number>) => rpc('inv_receive_transfer', { p_id: id, p_received: received });

// Adjustments + counts
export const saveAdjustment = (payload: any, items: any[]) => rpc<string>('inv_save_adjustment', { p_payload: payload, p_items: items });
export const submitAdjustment = (id: string) => rpc('inv_submit_adjustment', { p_id: id });
export const decideAdjustment = (id: string, decision: 'approve' | 'reject', notes: string | null) => rpc('inv_decide_adjustment', { p_id: id, p_decision: decision, p_notes: notes });
export const saveCount = (payload: any, items: any[]) => rpc<string>('inv_save_count', { p_payload: payload, p_items: items });
export const postCount = (id: string) => rpc('inv_post_count', { p_id: id });

// RFQ
export const saveRfq = (payload: any, items: any[], vendors: any[]) => rpc<string>('inv_save_rfq', { p_payload: payload, p_items: items, p_vendors: vendors });
export const sendRfq = (id: string) => rpc('inv_send_rfq', { p_id: id });
export const recordQuote = (rfqVendorId: string, terms: any, quoteItems: any[]) => rpc('inv_record_quote', { p_rfq_vendor_id: rfqVendorId, p_terms: terms, p_quote_items: quoteItems });
export const awardRfq = (id: string, awards: any[]) => rpc('inv_award_rfq', { p_id: id, p_awards: awards });

// Ledger corrections + policy + automation
export const reverseMovement = (movementId: string, note: string | null) => rpc('inv_reverse_movement', { p_movement_id: movementId, p_note: note });
export const reserveStock = (project: string, sku: string, qty: number, uom: string, refType: string, refId: string | null, note: string | null) =>
  rpc('inv_reserve_stock', { p_project: project, p_sku: sku, p_qty: qty, p_uom: uom, p_ref_type: refType, p_ref_id: refId, p_note: note });
export const releaseReservation = (project: string, sku: string, qty: number, uom: string, refType: string, refId: string | null, note: string | null) =>
  rpc('inv_release_reservation', { p_project: project, p_sku: sku, p_qty: qty, p_uom: uom, p_ref_type: refType, p_ref_id: refId, p_note: note });
export const saveItemSetting = (sku: string, project: string | null, reorder: number, safety: number, max: number | null, lead: number | null, vendor: string | null, notes: string | null) =>
  rpc<string>('inv_save_item_setting', { p_sku: sku, p_project: project, p_reorder: reorder, p_safety: safety, p_max: max, p_lead: lead, p_vendor: vendor, p_notes: notes });
export const refreshAlerts = () => rpc<number>('inv_refresh_alerts', {});
export const processOutbox = (limit = 100) => rpc<number>('inv_process_outbox', { p_limit: limit });
