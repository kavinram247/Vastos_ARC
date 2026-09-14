// ─────────────────────────────────────────────────────────────
// Inventory & Procurement — data access layer.
//
// Phase 5, item 2.11: calls vastos-api instead of Supabase. READS are
// dedicated GET endpoints (vastos-api's src/inventory/inventory-reads.
// service.ts) — raw passthrough, every table here is SELECT-only under RLS.
// WRITES go exclusively through vastos-api's src/inventory/inventory-writes.
// service.ts, which are themselves thin proxies to the SAME inv_* SECURITY
// DEFINER RPCs this file always called — the RPCs resolve the firm/user/role
// from the session and validate every transition server-side (client ids/
// totals/status are never trusted). This file therefore still contains NO
// stock math and NO status transitions — those live in Postgres, unchanged.
// Numeric-string coercion (num()) stays client-side, same convention as the
// original — including two spots (getRfqDetail's items/vendors/quotes) that
// never coerced before because PostgREST returned numerics as bare JSON
// numbers; node-postgres returns them as strings, so those are now coerced
// too to keep the exact same shapes callers already expect.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from '../lib/vastosApi';
import type {
  Material, ItemSetting, StockPosition, StockMovement, MaterialRequest, MaterialRequestItem,
  PurchaseOrder, PoLineItem, GoodsReceipt, GoodsReceiptItem, StockTransfer, StockAdjustment,
  PhysicalCount, Consumption, Rfq, InventoryAlert,
} from './types';

const num = (v: any) => (v == null ? 0 : Number(v));

// ══════════════════════════════ READS ══════════════════════════════

/** Every stock-keeping material (SKU) with its canonical UOM + catalog meta. */
export async function listMaterials(_firmId: string): Promise<Material[]> {
  const rows = await vastosApiFetch<any[]>('/api/inventory/materials');
  return rows
    .map((s) => ({
      sku_id: s.sku_id, sku_code: s.sku_code, product_id: s.product_id,
      name: s.name ?? s.sku_code, brand: s.brand,
      category: s.category_name ?? '—',
      base_uom: s.base_uom ?? 'nos',
      secondary_uom: s.secondary_uom ?? null,
      uom_conversion: s.uom_conversion == null ? null : Number(s.uom_conversion),
      gst_rate: num(s.gst_rate), hsn_code: s.hsn_code ?? null,
      quality_grade: s.quality_grade,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listItemSettings(_firmId: string): Promise<ItemSetting[]> {
  const rows = await vastosApiFetch<any[]>('/api/inventory/item-settings');
  return rows.map((r) => ({
    id: r.id, sku_id: r.sku_id, project_id: r.project_id,
    reorder_level: num(r.reorder_level), safety_stock: num(r.safety_stock),
    max_level: r.max_level == null ? null : num(r.max_level),
    lead_time_days: r.lead_time_days, preferred_vendor_id: r.preferred_vendor_id,
  }));
}

/** Ledger-derived balances (on-hand / reserved / available / on-order / projected). */
export async function listStockPositions(_firmId: string, projectId?: string): Promise<StockPosition[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const rows = await vastosApiFetch<any[]>(`/api/inventory/stock-positions${qs}`);
  return rows.map((r) => ({
    firm_id: r.firm_id, project_id: r.project_id, sku_id: r.sku_id,
    on_hand: num(r.on_hand), reserved: num(r.reserved), available: num(r.available),
    on_order: num(r.on_order), approved_demand: num(r.approved_demand), projected: num(r.projected),
    last_movement_at: r.last_movement_at,
  }));
}

export async function listMovements(_firmId: string, opts: { projectId?: string; skuId?: string; limit?: number } = {}): Promise<StockMovement[]> {
  const qs = new URLSearchParams();
  if (opts.projectId) qs.set('projectId', opts.projectId);
  if (opts.skuId) qs.set('skuId', opts.skuId);
  qs.set('limit', String(opts.limit ?? 300));
  const rows = await vastosApiFetch<any[]>(`/api/inventory/movements?${qs.toString()}`);
  return rows.map((r) => ({
    id: r.id, project_id: r.project_id, location: r.location, sku_id: r.sku_id,
    movement_type: r.movement_type, movement_class: r.movement_class,
    qty: num(r.qty), uom: r.uom, qty_base: num(r.qty_base),
    unit_cost: r.unit_cost == null ? null : num(r.unit_cost),
    ref_type: r.ref_type, ref_id: r.ref_id, batch_ref: r.batch_ref, note: r.note,
    posted_by_name: r.posted_by_name, created_at: r.created_at,
  }));
}

export async function listMaterialRequests(_firmId: string): Promise<MaterialRequest[]> {
  return vastosApiFetch('/api/inventory/material-requests');
}

export async function getMaterialRequestItems(requestId: string): Promise<MaterialRequestItem[]> {
  const rows = await vastosApiFetch<any[]>(`/api/inventory/material-requests/${requestId}/items`);
  return rows.map((r) => ({
    ...r, required_qty: num(r.required_qty), available_qty: num(r.available_qty),
    on_order_qty: num(r.on_order_qty), suggested_qty: num(r.suggested_qty),
    approved_qty: r.approved_qty == null ? null : num(r.approved_qty), ordered_qty: num(r.ordered_qty),
  })) as MaterialRequestItem[];
}

export async function listPurchaseOrders(_firmId: string): Promise<PurchaseOrder[]> {
  const rows = await vastosApiFetch<any[]>('/api/inventory/purchase-orders');
  return rows.map((r) => ({
    ...r, subtotal: num(r.subtotal), gst_amount: num(r.gst_amount), total_amount: num(r.total_amount),
    gst_rate: num(r.gst_rate), freight_charges: num(r.freight_charges), version: num(r.version),
  })) as PurchaseOrder[];
}

export async function getPoLineItems(poId: string): Promise<PoLineItem[]> {
  const rows = await vastosApiFetch<any[]>(`/api/inventory/purchase-orders/${poId}/items`);
  return rows.map((r) => ({
    ...r, quantity: num(r.quantity), rate: num(r.rate), amount: num(r.amount), qty_received: num(r.qty_received),
  })) as PoLineItem[];
}

export async function listGoodsReceipts(_firmId: string): Promise<GoodsReceipt[]> {
  return vastosApiFetch('/api/inventory/goods-receipts');
}

export async function getGoodsReceiptItems(grnId: string): Promise<GoodsReceiptItem[]> {
  const rows = await vastosApiFetch<any[]>(`/api/inventory/goods-receipts/${grnId}/items`);
  return rows.map((r) => ({
    ...r, ordered_qty: num(r.ordered_qty), prev_received_qty: num(r.prev_received_qty),
    delivered_qty: num(r.delivered_qty), accepted_qty: num(r.accepted_qty),
    rejected_qty: num(r.rejected_qty), damaged_qty: num(r.damaged_qty),
    unit_cost: r.unit_cost == null ? null : num(r.unit_cost),
  })) as GoodsReceiptItem[];
}

export async function listTransfers(_firmId: string): Promise<StockTransfer[]> {
  return vastosApiFetch('/api/inventory/transfers');
}
export async function getTransferItems(transferId: string) {
  const rows = await vastosApiFetch<any[]>(`/api/inventory/transfers/${transferId}/items`);
  return rows.map((r) => ({ ...r, quantity: num(r.quantity), dispatched_qty: num(r.dispatched_qty), received_qty: num(r.received_qty) }));
}

export async function listAdjustments(_firmId: string): Promise<StockAdjustment[]> {
  return vastosApiFetch('/api/inventory/adjustments');
}
export async function listCounts(_firmId: string): Promise<PhysicalCount[]> {
  return vastosApiFetch('/api/inventory/counts');
}
export async function listConsumptions(_firmId: string): Promise<Consumption[]> {
  return vastosApiFetch('/api/inventory/consumptions');
}

export async function listRfqs(_firmId: string): Promise<Rfq[]> {
  return vastosApiFetch('/api/inventory/rfqs');
}
export async function getRfqDetail(rfqId: string) {
  const { items, vendors, quotes } = await vastosApiFetch<{ items: any[]; vendors: any[]; quotes: any[] }>(
    `/api/inventory/rfqs/${rfqId}/detail`,
  );
  return {
    items: items.map((r) => ({ ...r, quantity: num(r.quantity) })),
    vendors: vendors.map((r) => ({ ...r, freight: num(r.freight) })),
    quotes: quotes.map((r) => ({
      ...r, unit_price: r.unit_price == null ? null : num(r.unit_price), tax_pct: num(r.tax_pct),
      moq: r.moq == null ? null : num(r.moq), awarded_qty: num(r.awarded_qty),
    })),
  };
}

export async function listAlerts(_firmId: string): Promise<InventoryAlert[]> {
  return vastosApiFetch('/api/inventory/alerts');
}

// ══════════════════════════════ WRITES ══════════════════════════════
function post<T = any>(path: string, body?: unknown): Promise<T> {
  return vastosApiFetch<T>(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Material requests
export const saveMaterialRequest = (payload: any, items: any[]) => post<string>('/api/inventory/material-requests', { payload, items });
export const submitMaterialRequest = (id: string, version: number) => post(`/api/inventory/material-requests/${id}/submit`, { version });
export const decideMaterialRequest = (id: string, decision: 'approve' | 'reject', notes: string | null, itemApprovals: Record<string, number> = {}) =>
  post(`/api/inventory/material-requests/${id}/decide`, { decision, notes, itemApprovals });
export const cancelMaterialRequest = (id: string, reason: string | null) => post(`/api/inventory/material-requests/${id}/cancel`, { reason });

// Purchase orders
export const savePurchaseOrder = (payload: any, items: any[]) => post<string>('/api/inventory/purchase-orders', { payload, items });
export const submitPo = (id: string, version: number) => post(`/api/inventory/purchase-orders/${id}/submit`, { version });
export const decidePo = (id: string, decision: 'approve' | 'needs_changes' | 'reject', notes: string | null) =>
  post(`/api/inventory/purchase-orders/${id}/decide`, { decision, notes });
export const issuePo = (id: string) => post(`/api/inventory/purchase-orders/${id}/issue`);

// Goods receipts
export const saveGoodsReceipt = (payload: any, items: any[]) => post<string>('/api/inventory/goods-receipts', { payload, items });
export const postGoodsReceipt = (id: string) => post(`/api/inventory/goods-receipts/${id}/post`);

// Consumption
export const saveConsumption = (payload: any, items: any[]) => post<string>('/api/inventory/consumptions', { payload, items });
export const postConsumption = (id: string) => post(`/api/inventory/consumptions/${id}/post`);

// Transfers
export const saveTransfer = (payload: any, items: any[]) => post<string>('/api/inventory/transfers', { payload, items });
export const dispatchTransfer = (id: string) => post(`/api/inventory/transfers/${id}/dispatch`);
export const receiveTransfer = (id: string, received: Record<string, number>) => post(`/api/inventory/transfers/${id}/receive`, { received });

// Adjustments + counts
export const saveAdjustment = (payload: any, items: any[]) => post<string>('/api/inventory/adjustments', { payload, items });
export const submitAdjustment = (id: string) => post(`/api/inventory/adjustments/${id}/submit`);
export const decideAdjustment = (id: string, decision: 'approve' | 'reject', notes: string | null) =>
  post(`/api/inventory/adjustments/${id}/decide`, { decision, notes });
export const saveCount = (payload: any, items: any[]) => post<string>('/api/inventory/counts', { payload, items });
export const postCount = (id: string) => post(`/api/inventory/counts/${id}/post`);

// RFQ
export const saveRfq = (payload: any, items: any[], vendors: any[]) => post<string>('/api/inventory/rfqs', { payload, items, vendors });
export const sendRfq = (id: string) => post(`/api/inventory/rfqs/${id}/send`);
export const recordQuote = (rfqVendorId: string, terms: any, quoteItems: any[]) =>
  post(`/api/inventory/rfq-vendors/${rfqVendorId}/quote`, { terms, quoteItems });
export const awardRfq = (id: string, awards: any[]) => post(`/api/inventory/rfqs/${id}/award`, { awards });

// Ledger corrections + policy + automation
export const reverseMovement = (movementId: string, note: string | null) => post<string>(`/api/inventory/movements/${movementId}/reverse`, { note });
export const reserveStock = (project: string, sku: string, qty: number, uom: string, refType: string, refId: string | null, note: string | null) =>
  post<string>('/api/inventory/stock/reserve', { project, sku, qty, uom, refType, refId, note });
export const releaseReservation = (project: string, sku: string, qty: number, uom: string, refType: string, refId: string | null, note: string | null) =>
  post<string>('/api/inventory/stock/release', { project, sku, qty, uom, refType, refId, note });
export const saveItemSetting = (sku: string, project: string | null, reorder: number, safety: number, max: number | null, lead: number | null, vendor: string | null, notes: string | null) =>
  post<string>('/api/inventory/item-settings', { sku, project, reorder, safety, max, lead, vendor, notes });
export const refreshAlerts = () => post<number>('/api/inventory/alerts/refresh');
export const processOutbox = (limit = 100) => post<number>('/api/inventory/outbox/process', { limit });
