// ─────────────────────────────────────────────────────────────
// Purchase docs data access — material_requests (+items), rfqs (+items+vendors),
// project_stock, work_orders, and the request → RFQ conversion. Header + child
// rows are written together (children replaced on save). Untyped client handle
// because these tables/columns postdate the generated types.
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import type {
  MaterialRequest, MaterialRequestItem, Rfq, RfqItem, RfqVendor,
  ProjectStock, WorkOrder, LineItem, ClientRequirement,
} from './types';
import { formatDocNumber, todayStr, logPurchaseActivity } from './logic';

const sb = supabase as any;

async function nextSeq(table: string, firmId: string): Promise<number> {
  const { count } = await sb.from(table).select('id', { count: 'exact', head: true }).eq('firm_id', firmId);
  return (count || 0) + 1;
}

// ═══ MATERIAL REQUESTS ═══════════════════════════════════════
export async function listRequests(firmId: string): Promise<MaterialRequest[]> {
  const [{ data: reqs, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    sb.from('purchase_material_requests').select('*').eq('firm_id', firmId).order('created_at', { ascending: false }),
    sb.from('purchase_material_request_items').select('*').eq('firm_id', firmId).order('order_index'),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  const byReq = new Map<string, MaterialRequestItem[]>();
  for (const it of (items || []) as any[]) {
    const arr = byReq.get(it.request_id) || [];
    arr.push({
      id: it.id, material_id: it.material_id ?? null, material_name: it.material_name ?? '',
      description: it.description ?? null, quantity: Number(it.quantity ?? 0), uom: it.uom ?? null,
      required_by: it.required_by ?? null, order_index: it.order_index ?? 0,
    });
    byReq.set(it.request_id, arr);
  }
  return (reqs || []).map((r: any) => ({
    id: r.id, request_number: r.request_number, request_date: r.request_date,
    project_id: r.project_id ?? null, plant_description: r.plant_description ?? null,
    total_days: r.total_days ?? null, engineer_id: r.engineer_id ?? null,
    status: r.status, client_requirements: (r.client_requirements as ClientRequirement[]) ?? [],
    notes: r.notes ?? null, created_by: r.created_by ?? null,
    created_at: r.created_at, updated_at: r.updated_at, items: byReq.get(r.id) || [],
  }));
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

export async function saveRequest(input: RequestInput, firmId: string, userId: string): Promise<string> {
  const header = {
    request_date: input.request_date,
    project_id: input.project_id,
    plant_description: input.plant_description?.trim() || null,
    total_days: input.total_days ?? null,
    engineer_id: input.engineer_id || userId,
    client_requirements: input.client_requirements,
    notes: input.notes?.trim() || null,
  };
  let id = input.id;
  if (id) {
    const { error } = await sb.from('purchase_material_requests').update(header).eq('id', id);
    if (error) throw error;
    await sb.from('purchase_material_request_items').delete().eq('request_id', id);
  } else {
    const request_number = formatDocNumber('MR', await nextSeq('purchase_material_requests', firmId));
    const { data, error } = await sb.from('purchase_material_requests')
      .insert({ firm_id: firmId, created_by: userId, request_number, status: 'open', ...header })
      .select('id,request_number').single();
    if (error) throw error;
    id = data.id;
    logPurchaseActivity({ firmId, actorId: userId, action: 'created', label: `Material request ${data.request_number} raised`, entityId: id, entityName: data.request_number });
  }
  await insertItems('purchase_material_request_items', firmId, id!, input.items);
  return id!;
}

export async function setRequestStatus(id: string, status: MaterialRequest['status']): Promise<void> {
  const { error } = await sb.from('purchase_material_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteRequest(id: string): Promise<void> {
  const { error } = await sb.from('purchase_material_requests').delete().eq('id', id);
  if (error) throw error;
}

async function insertItems(table: string, firmId: string, requestId: string, items: LineItem[]) {
  const rows = items
    .filter(i => i.material_name.trim() || i.material_id)
    .map((i, idx) => ({
      firm_id: firmId, request_id: requestId, material_id: i.material_id,
      material_name: i.material_name.trim(), description: i.description?.trim() || null,
      quantity: i.quantity || 0, uom: i.uom || null, required_by: i.required_by || null, order_index: idx,
    }));
  if (rows.length) {
    const { error } = await sb.from(table).insert(rows);
    if (error) throw error;
  }
}

// ═══ RFQs ════════════════════════════════════════════════════
export async function listRfqs(firmId: string): Promise<Rfq[]> {
  const [{ data: rfqs, error: e1 }, { data: items, error: e2 }, { data: vends, error: e3 }] = await Promise.all([
    sb.from('purchase_rfqs').select('*').eq('firm_id', firmId).order('created_at', { ascending: false }),
    sb.from('purchase_rfq_items').select('*').eq('firm_id', firmId).order('order_index'),
    sb.from('purchase_rfq_vendors').select('*').eq('firm_id', firmId).order('order_index'),
  ]);
  if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;
  const itemsBy = new Map<string, RfqItem[]>();
  for (const it of (items || []) as any[]) {
    const arr = itemsBy.get(it.rfq_id) || [];
    arr.push({ id: it.id, material_id: it.material_id ?? null, material_name: it.material_name ?? '', quantity: Number(it.quantity ?? 0), uom: it.uom ?? null, unit_price: it.unit_price == null ? null : Number(it.unit_price), order_index: it.order_index ?? 0 });
    itemsBy.set(it.rfq_id, arr);
  }
  const vendBy = new Map<string, RfqVendor[]>();
  for (const v of (vends || []) as any[]) {
    const arr = vendBy.get(v.rfq_id) || [];
    arr.push({ id: v.id, vendor_id: v.vendor_id ?? null, vendor_name: v.vendor_name ?? '', mobile: v.mobile ?? null, sent_date: v.sent_date ?? null, status: v.status, quoted_amount: v.quoted_amount == null ? null : Number(v.quoted_amount), order_index: v.order_index ?? 0 });
    vendBy.set(v.rfq_id, arr);
  }
  return (rfqs || []).map((r: any) => ({
    id: r.id, rfq_number: r.rfq_number, rfq_date: r.rfq_date, project_id: r.project_id ?? null,
    material_type: r.material_type ?? null, status: r.status, quote_valid_until: r.quote_valid_until ?? null,
    material_request_id: r.material_request_id ?? null, notes: r.notes ?? null, created_by: r.created_by ?? null,
    created_at: r.created_at, updated_at: r.updated_at,
    items: itemsBy.get(r.id) || [], vendors: vendBy.get(r.id) || [],
  }));
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

export async function saveRfq(input: RfqInput, firmId: string, userId: string): Promise<string> {
  const header = {
    rfq_date: input.rfq_date, project_id: input.project_id,
    material_type: input.material_type?.trim() || null, status: input.status,
    quote_valid_until: input.quote_valid_until || null,
    material_request_id: input.material_request_id || null,
    notes: input.notes?.trim() || null, updated_at: new Date().toISOString(),
  };
  let id = input.id;
  if (id) {
    const { error } = await sb.from('purchase_rfqs').update(header).eq('id', id);
    if (error) throw error;
    await Promise.all([
      sb.from('purchase_rfq_items').delete().eq('rfq_id', id),
      sb.from('purchase_rfq_vendors').delete().eq('rfq_id', id),
    ]);
  } else {
    const rfq_number = formatDocNumber('RFQ', await nextSeq('purchase_rfqs', firmId));
    const { data, error } = await sb.from('purchase_rfqs')
      .insert({ firm_id: firmId, created_by: userId, rfq_number, ...header }).select('id,rfq_number').single();
    if (error) throw error;
    id = data.id;
    logPurchaseActivity({ firmId, actorId: userId, action: 'created', label: `RFQ ${data.rfq_number} created`, entityId: id, entityName: data.rfq_number });
  }
  const itemRows = input.items.filter(i => i.material_name.trim() || i.material_id).map((i, idx) => ({
    firm_id: firmId, rfq_id: id, material_id: i.material_id, material_name: i.material_name.trim(),
    quantity: i.quantity || 0, uom: i.uom || null, unit_price: i.rate || null, order_index: idx,
  }));
  if (itemRows.length) { const { error } = await sb.from('purchase_rfq_items').insert(itemRows); if (error) throw error; }
  const vendRows = input.vendors.filter(v => v.vendor_name.trim() || v.vendor_id).map((v, idx) => ({
    firm_id: firmId, rfq_id: id, vendor_id: v.vendor_id, vendor_name: v.vendor_name.trim(),
    mobile: v.mobile || null, sent_date: v.sent_date || null, status: v.status, quoted_amount: v.quoted_amount, order_index: idx,
  }));
  if (vendRows.length) { const { error } = await sb.from('purchase_rfq_vendors').insert(vendRows); if (error) throw error; }
  return id!;
}

export async function setRfqStatus(id: string, status: Rfq['status']): Promise<void> {
  const { error } = await sb.from('purchase_rfqs').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteRfq(id: string): Promise<void> {
  const { error } = await sb.from('purchase_rfqs').delete().eq('id', id);
  if (error) throw error;
}

/** Convert a material request into a draft RFQ (pre-filled items), mark request in_rfq. */
export async function createRfqFromRequest(req: MaterialRequest, firmId: string, userId: string): Promise<string> {
  const items: LineItem[] = req.items.map(i => ({
    key: Math.random().toString(36).slice(2), material_id: i.material_id, material_name: i.material_name,
    quantity: i.quantity, uom: i.uom || 'nos', rate: 0,
  }));
  const id = await saveRfq({
    rfq_date: todayStr(), project_id: req.project_id, material_type: null, status: 'draft',
    material_request_id: req.id, notes: `From request ${req.request_number}`, items,
    vendors: [],
  }, firmId, userId);
  await setRequestStatus(req.id, 'in_rfq');
  return id;
}

// ═══ PROJECT STOCK ═══════════════════════════════════════════
export async function listStock(firmId: string): Promise<ProjectStock[]> {
  const { data, error } = await sb.from('project_stock').select('*').eq('firm_id', firmId).order('material_name');
  if (error) throw error;
  return (data || []).map((s: any) => ({
    id: s.id, project_id: s.project_id ?? null, material_id: s.material_id ?? null,
    material_name: s.material_name ?? '', uom: s.uom ?? null,
    current_stock: Number(s.current_stock ?? 0), reorder_level: Number(s.reorder_level ?? 0),
    last_updated: s.last_updated ?? null, last_po_id: s.last_po_id ?? null,
  }));
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
    const { error } = await sb.from('project_stock').update(fields).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await sb.from('project_stock').insert({ firm_id: firmId, ...fields }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteStock(id: string): Promise<void> {
  const { error } = await sb.from('project_stock').delete().eq('id', id);
  if (error) throw error;
}

/** Add received quantity to a project's material stock (create the row if new). Used by PO receipt. */
export async function receiveIntoStock(
  firmId: string, projectId: string | null, materialId: string | null, materialName: string,
  uom: string | null, qty: number, poId: string,
): Promise<void> {
  let query = sb.from('project_stock').select('id,current_stock').eq('firm_id', firmId);
  query = materialId ? query.eq('material_id', materialId) : query.eq('material_name', materialName);
  query = projectId ? query.eq('project_id', projectId) : query.is('project_id', null);
  const { data: existing } = await query.maybeSingle();
  if (existing) {
    await sb.from('project_stock').update({
      current_stock: Number(existing.current_stock || 0) + qty, last_po_id: poId,
      last_updated: todayStr(), updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await sb.from('project_stock').insert({
      firm_id: firmId, project_id: projectId, material_id: materialId, material_name: materialName,
      uom, current_stock: qty, reorder_level: 0, last_po_id: poId, last_updated: todayStr(),
    });
  }
}

// ═══ WORK ORDERS ═════════════════════════════════════════════
export async function listWorkOrders(firmId: string): Promise<WorkOrder[]> {
  const { data, error } = await sb.from('work_orders').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((w: any) => ({
    id: w.id, wo_number: w.wo_number, title: w.title ?? '', project_id: w.project_id ?? null,
    contractor_vendor_id: w.contractor_vendor_id ?? null, wo_date: w.wo_date,
    amount: w.amount == null ? null : Number(w.amount), status: w.status,
    work_description: w.work_description ?? null, terms_of_payment: w.terms_of_payment ?? null,
    terms_conditions: w.terms_conditions ?? null, additional_work: w.additional_work ?? null,
    bank_details: w.bank_details ?? null, notes: w.notes ?? null,
    created_by: w.created_by ?? null, created_at: w.created_at, updated_at: w.updated_at,
  }));
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

export async function saveWorkOrder(input: WorkOrderInput, firmId: string, userId: string): Promise<string> {
  const fields = {
    title: input.title.trim(), project_id: input.project_id, contractor_vendor_id: input.contractor_vendor_id,
    wo_date: input.wo_date, amount: input.amount, status: input.status,
    work_description: input.work_description?.trim() || null, terms_of_payment: input.terms_of_payment?.trim() || null,
    terms_conditions: input.terms_conditions?.trim() || null, additional_work: input.additional_work?.trim() || null,
    bank_details: input.bank_details?.trim() || null, notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await sb.from('work_orders').update(fields).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const wo_number = formatDocNumber('WO', await nextSeq('work_orders', firmId));
  const { data, error } = await sb.from('work_orders')
    .insert({ firm_id: firmId, created_by: userId, wo_number, ...fields }).select('id,wo_number').single();
  if (error) throw error;
  logPurchaseActivity({ firmId, actorId: userId, action: 'created', label: `Work order ${data.wo_number} created`, entityId: data.id, entityName: data.wo_number });
  return data.id;
}

export async function deleteWorkOrder(id: string): Promise<void> {
  const { error } = await sb.from('work_orders').delete().eq('id', id);
  if (error) throw error;
}
