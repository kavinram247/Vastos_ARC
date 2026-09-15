// ─────────────────────────────────────────────────────────────
// Purchase docs — material_requests (+items), rfqs (+items+vendors),
// project_stock, work_orders, and the request → RFQ conversion. Cut over to
// vastos-api (Phase 5, item 2.12): vastos-api/src/purchase/purchase-docs
// .service.ts + purchase-stock.service.ts are the server-side source of
// truth now. Header+child-row replace-on-save happens server-side in one
// transaction (stronger than the original's 2-3 separate Supabase round
// trips). setRequestStatus/setRfqStatus/receiveIntoStock had no callers
// outside this file and poApi.ts — the conversions that used them
// (createRfqFromRequest, createPoFromRfq/Request, receivePurchaseOrder) are
// now single backend calls that apply those side effects atomically, so
// they're gone from the frontend surface entirely.
//
// project_stock's own manual CRUD (StockTab) goes through the generic
// /api/data/project_stock layer (see vastos-api/src/db/table-registry.ts) —
// unlike vendors, it has no server-generated field and no uuid-FK
// created_by footgun, so it's a clean fit. Every exported function keeps
// its exact original signature — callers need zero changes.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch, insertRow, updateRow, deleteRow } from '../lib/vastosApi';
import type {
  MaterialRequest, Rfq, RfqVendor, ProjectStock, WorkOrder, LineItem, ClientRequirement,
} from './types';
import { todayStr } from './logic';

// ═══ MATERIAL REQUESTS ═══════════════════════════════════════
export async function listRequests(_firmId: string): Promise<MaterialRequest[]> {
  return vastosApiFetch<MaterialRequest[]>('/api/purchase/requests');
}

export interface RequestInput {
  id?: string;
  request_number?: string;
  request_date: string;
  project_id: string | null;
  plant_description?: string | null;
  total_days?: number | null;
  engineer_id?: string | null;
  status?: MaterialRequest['status'];
  client_requirements: ClientRequirement[];
  notes?: string | null;
  items: LineItem[];
}

export async function saveRequest(input: RequestInput, _firmId: string, userId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>('/api/purchase/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, userId }),
  });
  return id;
}

export async function deleteRequest(id: string, _firmId: string): Promise<void> {
  await vastosApiFetch(`/api/purchase/requests/${id}`, { method: 'DELETE' });
}

// ═══ RFQs ════════════════════════════════════════════════════
export async function listRfqs(_firmId: string): Promise<Rfq[]> {
  return vastosApiFetch<Rfq[]>('/api/purchase/rfqs');
}

export interface RfqInput {
  id?: string;
  rfq_date: string;
  project_id: string | null;
  material_type?: string | null;
  status: Rfq['status'];
  quote_valid_until?: string | null;
  material_request_id?: string | null;
  notes?: string | null;
  items: LineItem[];
  vendors: { vendor_id: string | null; vendor_name: string; mobile: string | null; sent_date: string | null; status: RfqVendor['status']; quoted_amount: number | null }[];
}

export async function saveRfq(input: RfqInput, _firmId: string, userId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>('/api/purchase/rfqs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, userId }),
  });
  return id;
}

export async function deleteRfq(id: string): Promise<void> {
  await vastosApiFetch(`/api/purchase/rfqs/${id}`, { method: 'DELETE' });
}

/** Convert a material request into a draft RFQ (pre-filled items), mark request in_rfq.
 * Fully server-side now (re-fetches the request + items itself) — firmId/req
 * beyond its id are unused, kept so callers (RequestsTab) need no changes. */
export async function createRfqFromRequest(req: MaterialRequest, _firmId: string, userId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>(`/api/purchase/requests/${req.id}/to-rfq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return id;
}

// ═══ PROJECT STOCK ═══════════════════════════════════════════
export async function listStock(_firmId: string): Promise<ProjectStock[]> {
  return vastosApiFetch<ProjectStock[]>('/api/purchase/stock');
}

export interface StockInput {
  id?: string;
  project_id: string | null;
  material_id: string | null;
  material_name: string;
  uom: string | null;
  current_stock: number;
  reorder_level: number;
}

export async function saveStock(input: StockInput, firmId: string): Promise<string> {
  const fields = {
    project_id: input.project_id, material_id: input.material_id, material_name: input.material_name.trim(),
    uom: input.uom, current_stock: input.current_stock, reorder_level: input.reorder_level,
    last_updated: todayStr(), updated_at: new Date().toISOString(),
  };
  if (input.id) {
    await updateRow('project_stock', input.id, fields);
    return input.id;
  }
  const row = await insertRow<{ id: string }>('project_stock', { firm_id: firmId, ...fields });
  return row.id;
}

export async function deleteStock(id: string): Promise<void> {
  await deleteRow('project_stock', id);
}

// ═══ WORK ORDERS ═════════════════════════════════════════════
export async function listWorkOrders(_firmId: string): Promise<WorkOrder[]> {
  return vastosApiFetch<WorkOrder[]>('/api/purchase/work-orders');
}

export interface WorkOrderInput {
  id?: string;
  title: string;
  project_id: string | null;
  contractor_vendor_id: string | null;
  wo_date: string;
  amount: number | null;
  status: WorkOrder['status'];
  work_description?: string | null;
  terms_of_payment?: string | null;
  terms_conditions?: string | null;
  additional_work?: string | null;
  bank_details?: string | null;
  notes?: string | null;
}

export async function saveWorkOrder(input: WorkOrderInput, _firmId: string, userId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>('/api/purchase/work-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, userId }),
  });
  return id;
}

export async function deleteWorkOrder(id: string): Promise<void> {
  await vastosApiFetch(`/api/purchase/work-orders/${id}`, { method: 'DELETE' });
}

