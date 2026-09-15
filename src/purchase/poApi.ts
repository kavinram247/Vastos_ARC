// ─────────────────────────────────────────────────────────────
// Purchase Orders — the unified PO ledger. Cut over to vastos-api (Phase 5,
// item 2.12): vastos-api/src/purchase/purchase-orders.service.ts is the
// server-side source of truth now — including a real fix along the way (see
// that file's big comment): the original Supabase-js code wrote
// `project_id`/`rfq_id`/`material_request_id`, three columns that turned out
// to point at a different, empty set of tables than the ones this module
// (or crm_projects) actually populates — that path would have thrown on
// every real save with a linked project/RFQ/request. The backend now writes
// `crm_project_id`/`purchase_rfq_id`/`purchase_material_request_id` instead
// (the same columns Inventory's own RPCs use), while keeping these exact
// field names on the wire, so PurchaseOrder's shape is unchanged here.
//
// The conversion helpers (createPoFromRfq/createPoFromRequest) and
// receivePurchaseOrder used to orchestrate several Supabase calls
// client-side (via docsApi.ts's setRequestStatus/setRfqStatus/
// receiveIntoStock) — those are now single backend calls that apply every
// side effect atomically in one transaction, so this file no longer imports
// from docsApi.ts at all. Every exported function keeps its exact original
// signature (including now-unused firmId params and full-object params
// where the backend only needs an id) — callers need zero changes.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from '../lib/vastosApi';
import type { PurchaseOrder, Rfq, MaterialRequest, LineItem } from './types';
import { logPurchaseActivity, notifyAdmins, todayStr } from './logic';

export async function listPurchaseOrders(_firmId: string): Promise<PurchaseOrder[]> {
  return vastosApiFetch<PurchaseOrder[]>('/api/purchase/orders');
}

export interface PoInput {
  id?: string;
  project_id: string | null;
  vendor_id: string | null;
  rfq_id?: string | null;
  material_request_id?: string | null;
  material_type?: string | null;
  required_by?: string | null;
  delivery_date?: string | null;
  delivery_address?: string | null;
  credit_days?: number | null;
  supplier_quotation_ref?: string | null;
  gst_rate: number;
  gst_type: 'inclusive' | 'exclusive';
  freight_charges: number;
  order_contact_id?: string | null;
  order_contact_phone?: string | null;
  delivery_contact_id?: string | null;
  delivery_contact_phone?: string | null;
  additional_terms?: string | null;
  notes?: string | null;
  items: LineItem[];
  submitForApproval?: boolean;   // draft → pending
}

export async function savePurchaseOrder(input: PoInput, firmId: string, userId: string): Promise<string> {
  const { id, po_number } = await vastosApiFetch<{ id: string; po_number: string | null }>('/api/purchase/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (input.submitForApproval && !input.id && po_number) {
    notifyAdmins({ firmId, actorId: userId, title: 'Purchase order needs approval', message: `${po_number} was submitted for approval`, type: 'warning' });
  }
  if (!input.id) {
    logPurchaseActivity({ firmId, actorId: userId, action: 'created', label: `Purchase order ${po_number} created`, entityId: id, entityName: po_number ?? undefined });
  }
  return id;
}

export async function submitForApproval(po: PurchaseOrder, firmId: string, userId: string): Promise<void> {
  await vastosApiFetch(`/api/purchase/orders/${po.id}/submit`, { method: 'POST' });
  logPurchaseActivity({ firmId, actorId: userId, action: 'status_changed', label: `${po.po_number} submitted for approval`, entityId: po.id, entityName: po.po_number });
  notifyAdmins({ firmId, actorId: userId, title: 'Purchase order needs approval', message: `${po.po_number} was submitted for approval`, type: 'warning' });
}

/**
 * Approve or reject a PO. Approval also marks it issued (ready to send).
 *
 * Goes through approve_purchase_order() — audit H4. This was a bare table
 * UPDATE, so anyone with a session could approve any order by id regardless of
 * their permissions or who raised it. The RPC re-derives the actor from
 * auth.uid() and enforces firm binding, purchase:approve, the pending state,
 * and segregation of duties. Those checks are the server's; the UI gating
 * below is convenience only.
 */
export async function decidePoApproval(
  po: PurchaseOrder, decision: 'approved' | 'rejected', adminNotes: string | null, firmId: string, userId: string,
): Promise<void> {
  await vastosApiFetch(`/api/purchase/orders/${po.id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, notes: adminNotes || null }),
  });
  logPurchaseActivity({ firmId, actorId: userId, action: decision === 'approved' ? 'approved' : 'status_changed', label: `${po.po_number} ${decision}`, entityId: po.id, entityName: po.po_number });
}

export async function addPayment(
  po: PurchaseOrder, payment: { payment_date: string; amount: number; payment_mode: string | null; reference_no: string | null },
  firmId: string, userId: string,
): Promise<void> {
  await vastosApiFetch(`/api/purchase/orders/${po.id}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment),
  });
  logPurchaseActivity({ firmId, actorId: userId, action: 'payment_received', label: `Payment recorded on ${po.po_number}`, entityId: po.id, entityName: po.po_number, details: `₹${payment.amount}` });
}

/** Mark a PO fully received and flow its line quantities into project stock. */
export async function receivePurchaseOrder(po: PurchaseOrder, firmId: string, userId: string): Promise<void> {
  await vastosApiFetch(`/api/purchase/orders/${po.id}/receive`, { method: 'POST' });
  logPurchaseActivity({ firmId, actorId: userId, action: 'status_changed', label: `${po.po_number} received into stock`, entityId: po.id, entityName: po.po_number });
}

export async function deletePurchaseOrder(id: string, _firmId: string): Promise<void> {
  await vastosApiFetch(`/api/purchase/orders/${id}`, { method: 'DELETE' });
}

// ── conversions (Material Requests / RFQ → PO) ──
export async function createPoFromRfq(rfq: Rfq, _firmId: string, userId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>(`/api/purchase/orders/from-rfq/${rfq.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return id;
}

export async function createPoFromRequest(req: MaterialRequest, _firmId: string, userId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>(`/api/purchase/orders/from-request/${req.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return id;
}

export { todayStr };
