// ─────────────────────────────────────────────────────────────
// Purchase Orders — the unified PO ledger (reuses `purchase_orders` +
// `po_line_items`, so BOQ-generated and manually-raised POs live together).
// Handles create/update, the approval workflow (notifies admins), payment
// records, and receipt (which flows quantities into project_stock).
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import type { PurchaseOrder, PoItem, PoPayment, Rfq, MaterialRequest, LineItem } from './types';
import {
  formatDocNumber, computePoTotals, uomToEnum, paymentStatusFor,
  logPurchaseActivity, notifyAdmins, todayStr,
} from './logic';
import { receiveIntoStock, setRequestStatus, setRfqStatus } from './docsApi';

const sb = supabase as any;

async function nextSeq(firmId: string): Promise<number> {
  const { count } = await sb.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('firm_id', firmId);
  return (count || 0) + 1;
}

export async function listPurchaseOrders(firmId: string): Promise<PurchaseOrder[]> {
  const [{ data: pos, error: e1 }, { data: items, error: e2 }, { data: pays, error: e3 }] = await Promise.all([
    sb.from('purchase_orders').select('*').eq('firm_id', firmId).order('created_at', { ascending: false }),
    sb.from('po_line_items').select('*').eq('firm_id', firmId),
    sb.from('po_payments').select('*').eq('firm_id', firmId).order('payment_date'),
  ]);
  if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;
  const itemsBy = new Map<string, PoItem[]>();
  for (const it of (items || []) as any[]) {
    const arr = itemsBy.get(it.po_id) || [];
    arr.push({
      id: it.id, material_id: it.sku_id ?? null, description: it.description ?? '',
      quantity: Number(it.quantity ?? 0), uom: it.uom ?? 'nos', rate: Number(it.rate ?? 0),
      amount: Number(it.amount ?? 0), qty_received: Number(it.qty_received ?? 0),
    });
    itemsBy.set(it.po_id, arr);
  }
  const paysBy = new Map<string, PoPayment[]>();
  for (const p of (pays || []) as any[]) {
    const arr = paysBy.get(p.po_id) || [];
    arr.push({ id: p.id, payment_date: p.payment_date, amount: Number(p.amount ?? 0), payment_mode: p.payment_mode ?? null, reference_no: p.reference_no ?? null });
    paysBy.set(p.po_id, arr);
  }
  return (pos || []).map((p: any) => ({
    id: p.id, po_number: p.po_number, project_id: p.project_id ?? null, vendor_id: p.vendor_id ?? null,
    boq_id: p.boq_id ?? null, rfq_id: p.rfq_id ?? null, material_request_id: p.material_request_id ?? null,
    material_type: p.material_type ?? null, status: p.status, payment_status: p.payment_status ?? 'outstanding',
    approval_status: p.approval_status ?? 'draft', po_date: p.created_at, required_by: p.required_by ?? null,
    delivery_date: p.delivery_date ?? null, delivery_address: p.delivery_address ?? null, credit_days: p.credit_days ?? null,
    supplier_quotation_ref: p.supplier_quotation_ref ?? null,
    gst_rate: Number(p.gst_rate ?? 18), gst_type: p.gst_type ?? 'inclusive',
    freight_charges: Number(p.freight_charges ?? 0), subtotal: Number(p.subtotal ?? 0),
    gst_amount: Number(p.gst_amount ?? 0), total_amount: Number(p.total_amount ?? 0),
    order_contact_id: p.order_contact_id ?? null, order_contact_phone: p.order_contact_phone ?? null,
    delivery_contact_id: p.delivery_contact_id ?? null, delivery_contact_phone: p.delivery_contact_phone ?? null,
    additional_terms: p.additional_terms ?? null, notes: p.notes ?? null, admin_notes: p.admin_notes ?? null,
    created_by: p.created_by ?? null, created_at: p.created_at,
    items: itemsBy.get(p.id) || [], payments: paysBy.get(p.id) || [],
  }));
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
  const totals = computePoTotals(input.items, input.gst_rate, input.gst_type, input.freight_charges);
  const approval_status = input.submitForApproval ? 'pending' : 'draft';
  const header = {
    project_id: input.project_id, vendor_id: input.vendor_id,
    rfq_id: input.rfq_id || null, material_request_id: input.material_request_id || null,
    material_type: input.material_type?.trim() || null, required_by: input.required_by || null,
    delivery_date: input.delivery_date || null, delivery_address: input.delivery_address?.trim() || null,
    credit_days: input.credit_days ?? null, supplier_quotation_ref: input.supplier_quotation_ref?.trim() || null,
    gst_rate: input.gst_rate, gst_type: input.gst_type, freight_charges: input.freight_charges,
    subtotal: totals.subtotal, gst_amount: totals.gst, total_amount: totals.total,
    order_contact_id: input.order_contact_id || null, order_contact_phone: input.order_contact_phone?.trim() || null,
    delivery_contact_id: input.delivery_contact_id || null, delivery_contact_phone: input.delivery_contact_phone?.trim() || null,
    additional_terms: input.additional_terms?.trim() || null, notes: input.notes?.trim() || null,
    approval_status, updated_at: new Date().toISOString(),
  };
  let id = input.id;
  let poNumber = '';
  if (id) {
    const { error } = await sb.from('purchase_orders').update(header).eq('id', id);
    if (error) throw error;
    await sb.from('po_line_items').delete().eq('po_id', id);
  } else {
    const po_number = formatDocNumber('PO', await nextSeq(firmId));
    poNumber = po_number;
    const { data, error } = await sb.from('purchase_orders')
      .insert({ firm_id: firmId, created_by: userId, po_number, status: 'draft', ...header })
      .select('id,po_number').single();
    if (error) throw error;
    id = data.id;
    logPurchaseActivity({ firmId, actorId: userId, action: 'created', label: `Purchase order ${data.po_number} created`, entityId: id, entityName: data.po_number });
  }
  const rows = input.items.filter(i => i.material_name.trim() || i.description?.trim() || i.material_id).map(i => ({
    firm_id: firmId, po_id: id, sku_id: i.material_id, description: (i.description?.trim() || i.material_name.trim()),
    uom: uomToEnum(i.uom), quantity: i.quantity || 0, rate: i.rate || 0,
    amount: Math.round((i.quantity || 0) * (i.rate || 0) * 100) / 100, qty_received: 0,
  }));
  if (rows.length) { const { error } = await sb.from('po_line_items').insert(rows); if (error) throw error; }

  if (input.submitForApproval && !input.id) {
    notifyAdmins({ firmId, actorId: userId, title: 'Purchase order needs approval', message: `${poNumber} was submitted for approval`, type: 'warning' });
  }
  return id!;
}

export async function submitForApproval(po: PurchaseOrder, firmId: string, userId: string): Promise<void> {
  const { error } = await sb.from('purchase_orders').update({ approval_status: 'pending' }).eq('id', po.id);
  if (error) throw error;
  logPurchaseActivity({ firmId, actorId: userId, action: 'status_changed', label: `${po.po_number} submitted for approval`, entityId: po.id, entityName: po.po_number });
  notifyAdmins({ firmId, actorId: userId, title: 'Purchase order needs approval', message: `${po.po_number} was submitted for approval`, type: 'warning' });
}

/** Approve or reject a PO. Approval also marks it issued (ready to send). */
export async function decidePoApproval(
  po: PurchaseOrder, decision: 'approved' | 'rejected', adminNotes: string | null, firmId: string, userId: string,
): Promise<void> {
  const patch: any = { approval_status: decision, admin_notes: adminNotes || null };
  if (decision === 'approved') patch.status = 'issued', patch.issued_at = new Date().toISOString();
  if (decision === 'rejected') patch.status = 'cancelled';
  const { error } = await sb.from('purchase_orders').update(patch).eq('id', po.id);
  if (error) throw error;
  logPurchaseActivity({ firmId, actorId: userId, action: decision === 'approved' ? 'approved' : 'status_changed', label: `${po.po_number} ${decision}`, entityId: po.id, entityName: po.po_number });
}

export async function addPayment(
  po: PurchaseOrder, payment: { payment_date: string; amount: number; payment_mode: string | null; reference_no: string | null },
  firmId: string, userId: string,
): Promise<void> {
  const { error } = await sb.from('po_payments').insert({ firm_id: firmId, po_id: po.id, ...payment });
  if (error) throw error;
  const paid = po.payments.reduce((a, p) => a + p.amount, 0) + payment.amount;
  const payment_status = paymentStatusFor(po.total_amount, paid);
  await sb.from('purchase_orders').update({ payment_status }).eq('id', po.id);
  logPurchaseActivity({ firmId, actorId: userId, action: 'payment_received', label: `Payment recorded on ${po.po_number}`, entityId: po.id, entityName: po.po_number, details: `₹${payment.amount}` });
}

/** Mark a PO fully received and flow its line quantities into project stock. */
export async function receivePurchaseOrder(po: PurchaseOrder, firmId: string, userId: string): Promise<void> {
  for (const it of po.items) {
    await sb.from('po_line_items').update({ qty_received: it.quantity }).eq('id', it.id);
    await receiveIntoStock(firmId, po.project_id, it.material_id, it.description, it.uom, it.quantity, po.id);
  }
  const { error } = await sb.from('purchase_orders').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', po.id);
  if (error) throw error;
  logPurchaseActivity({ firmId, actorId: userId, action: 'status_changed', label: `${po.po_number} received into stock`, entityId: po.id, entityName: po.po_number });
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await sb.from('po_line_items').delete().eq('po_id', id);
  await sb.from('po_payments').delete().eq('po_id', id);
  const { error } = await sb.from('purchase_orders').delete().eq('id', id);
  if (error) throw error;
}

// ── conversions (Material Requests / RFQ → PO) ──
export async function createPoFromRfq(rfq: Rfq, firmId: string, userId: string): Promise<string> {
  const items: LineItem[] = rfq.items.map(i => ({
    key: Math.random().toString(36).slice(2), material_id: i.material_id, material_name: i.material_name,
    description: i.material_name, quantity: i.quantity, uom: i.uom || 'nos', rate: i.unit_price || 0,
  }));
  const bestVendor = rfq.vendors.find(v => v.status === 'responded') || rfq.vendors[0];
  const id = await savePurchaseOrder({
    project_id: rfq.project_id, vendor_id: bestVendor?.vendor_id || null, rfq_id: rfq.id,
    material_request_id: rfq.material_request_id, material_type: rfq.material_type,
    gst_rate: 18, gst_type: 'inclusive', freight_charges: 0,
    notes: `From RFQ ${rfq.rfq_number}`, items,
  }, firmId, userId);
  await setRfqStatus(rfq.id, 'closed');
  if (rfq.material_request_id) await setRequestStatus(rfq.material_request_id, 'in_po');
  return id;
}

export async function createPoFromRequest(req: MaterialRequest, firmId: string, userId: string): Promise<string> {
  const items: LineItem[] = req.items.map(i => ({
    key: Math.random().toString(36).slice(2), material_id: i.material_id, material_name: i.material_name,
    description: i.material_name, quantity: i.quantity, uom: i.uom || 'nos', rate: 0,
  }));
  const id = await savePurchaseOrder({
    project_id: req.project_id, vendor_id: null, material_request_id: req.id,
    gst_rate: 18, gst_type: 'inclusive', freight_charges: 0,
    required_by: req.items.find(i => i.required_by)?.required_by || null,
    notes: `From request ${req.request_number}`, items,
  }, firmId, userId);
  await setRequestStatus(req.id, 'in_po');
  return id;
}

export { todayStr };
