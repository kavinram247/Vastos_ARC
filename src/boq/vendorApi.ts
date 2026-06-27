// ─────────────────────────────────────────────────────────────
// Vendor intelligence data access — scores, comparison, PO generation.
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID, DEMO_USER_ID } from '../lib/supabase';
import { computeVendorScore, type VendorScore, type VendorCandidate, type PerfRow } from './engine/vendorScore';
import { procurementView } from './engine/documents';
import { fetchBoqDetail } from './quotationApi';

export interface VendorWithScore {
  id: string; company_name: string; contact_person: string | null; phone: string | null;
  category: string | null; status: string; score: VendorScore | null;
}

export async function fetchVendorsWithScores(firmId = DEMO_FIRM_ID): Promise<VendorWithScore[]> {
  const [{ data: vendors, error: ev }, { data: perf, error: ep }] = await Promise.all([
    supabase.from('vendors').select('id,company_name,contact_person,phone,category,status').eq('firm_id', firmId).order('company_name'),
    supabase.from('vendor_performance').select('vendor_id,promised_days,actual_days,qty_ordered,qty_defective,price_at_order,market_price,recorded_at').eq('firm_id', firmId),
  ]);
  for (const e of [ev, ep]) if (e) throw e;
  const byVendor = new Map<string, PerfRow[]>();
  for (const r of (perf || []) as any[]) {
    const arr = byVendor.get(r.vendor_id) || [];
    arr.push(r as PerfRow);
    byVendor.set(r.vendor_id, arr);
  }
  return (vendors || []).map((v: any) => ({
    id: v.id, company_name: v.company_name, contact_person: v.contact_person, phone: v.phone,
    category: v.category, status: v.status, score: computeVendorScore(byVendor.get(v.id) || []),
  }));
}

/** Recompute scores from performance and persist to the vendors denormalized columns. */
export async function recomputeAndPersistScores(firmId = DEMO_FIRM_ID): Promise<number> {
  const vendors = await fetchVendorsWithScores(firmId);
  let n = 0;
  for (const v of vendors) {
    if (!v.score) continue;
    const { error } = await supabase.from('vendors').update({
      cost_score: v.score.cost, delivery_score: v.score.delivery, quality_score: v.score.quality,
      reliability_score: v.score.reliability, overall_score: v.score.overall,
    } as any).eq('id', v.id);
    if (error) throw error;
    n++;
  }
  return n;
}

/** Vendors that sell a given SKU, with price/lead/MOQ + their score → candidates for ranking. */
export async function fetchCandidatesForSku(skuId: string, firmId = DEMO_FIRM_ID): Promise<VendorCandidate[]> {
  const { data: vs, error } = await supabase.from('vendor_skus')
    .select('vendor_id,price,moq,lead_time_days,vendors(company_name)').eq('firm_id', firmId).eq('sku_id', skuId);
  if (error) throw error;
  const scored = await fetchVendorsWithScores(firmId);
  const scoreById = new Map(scored.map((s) => [s.id, s.score]));
  return (vs || []).map((r: any) => ({
    vendor_id: r.vendor_id, company_name: r.vendors?.company_name || '—',
    price: Number(r.price), lead_time_days: r.lead_time_days, moq: r.moq == null ? null : Number(r.moq),
    score: scoreById.get(r.vendor_id) || null,
  }));
}

/** All vendor offers keyed by sku_id, with scores attached — for the PO recommendation flow. */
export async function fetchCandidateMap(firmId = DEMO_FIRM_ID): Promise<Map<string, VendorCandidate[]>> {
  const [{ data: vs, error }, scored] = await Promise.all([
    supabase.from('vendor_skus').select('vendor_id,sku_id,price,moq,lead_time_days,vendors(company_name)').eq('firm_id', firmId),
    fetchVendorsWithScores(firmId),
  ]);
  if (error) throw error;
  const scoreById = new Map(scored.map((s) => [s.id, s.score]));
  const map = new Map<string, VendorCandidate[]>();
  for (const r of (vs || []) as any[]) {
    const arr = map.get(r.sku_id) || [];
    arr.push({
      vendor_id: r.vendor_id, company_name: r.vendors?.company_name || '—',
      price: Number(r.price), lead_time_days: r.lead_time_days, moq: r.moq == null ? null : Number(r.moq),
      score: scoreById.get(r.vendor_id) || null,
    });
    map.set(r.sku_id, arr);
  }
  return map;
}

export async function listVendorSkus(firmId = DEMO_FIRM_ID) {
  const { data, error } = await supabase.from('vendor_skus')
    .select('sku_id, product_skus(sku_code, brand, products:catalog_products(name))').eq('firm_id', firmId);
  if (error) throw error;
  // distinct skus
  const seen = new Map<string, { sku_id: string; label: string }>();
  for (const r of (data || []) as any[]) {
    if (seen.has(r.sku_id)) continue;
    const name = r.product_skus?.products?.name || r.product_skus?.sku_code || 'SKU';
    seen.set(r.sku_id, { sku_id: r.sku_id, label: `${name} — ${r.product_skus?.brand ?? ''}`.trim() });
  }
  return [...seen.values()];
}

export interface POLineInput { sku_id: string | null; description: string; uom: string; quantity: number; rate: number; amount: number }

export async function generatePO(
  boqId: string, vendorId: string, lines: POLineInput[], firmId = DEMO_FIRM_ID,
): Promise<string> {
  const { count } = await supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('firm_id', firmId);
  const poNumber = `PO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;
  const total = Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;
  const { data: po, error: e1 } = await supabase.from('purchase_orders').insert({
    firm_id: firmId, boq_id: boqId, vendor_id: vendorId, po_number: poNumber,
    status: 'draft', total_amount: total, gst_amount: Math.round(total * 0.18 * 100) / 100,
  } as any).select('id,po_number').single();
  if (e1) throw e1;
  const poId = (po as any).id;
  const rows = lines.map((l) => ({
    firm_id: firmId, po_id: poId, sku_id: l.sku_id, description: l.description,
    uom: l.uom, quantity: l.quantity, rate: l.rate, amount: l.amount,
  }));
  const { error: e2 } = await supabase.from('po_line_items').insert(rows as any);
  if (e2) throw e2;
  return (po as any).po_number;
}

/** Procurement lines for a BOQ (reuses the document projection). */
export async function fetchProcurementForBoq(boqId: string) {
  const detail = await fetchBoqDetail(boqId);
  return procurementView(detail).rows;
}

// ─────────────────────────────────────────────────────────────
// Vendor Directory — vendors categorized by the service they provide,
// derived from the catalog categories of the SKUs they actually supply.
// ─────────────────────────────────────────────────────────────
export interface VendorDirectoryEntry {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  category: string | null;        // free-text "vendor type" tag (fallback grouping)
  status: string;
  score: VendorScore | null;
  services: string[];             // leaf catalog categories supplied, e.g. ["Plywood","Laminate"]
  groups: string[];               // rolled-up service headings, e.g. ["Boards","Surfacing"]
  sku_count: number;
}

/** Group heading = the catalog category at depth 2 of its ltree path (e.g. material.boards.plywood → "Boards"). */
function deriveGroup(path: string, pathToName: Map<string, string>, leafName: string): string {
  const groupPath = path.split('.').slice(0, 2).join('.');
  return pathToName.get(groupPath) ?? pathToName.get(path) ?? leafName;
}

export async function fetchVendorDirectory(firmId = DEMO_FIRM_ID): Promise<VendorDirectoryEntry[]> {
  const [{ data: vendors, error: ev }, { data: perf, error: ep }, { data: vskus, error: evs }, { data: cats, error: ec }] =
    await Promise.all([
      supabase.from('vendors').select('id,company_name,contact_person,phone,email,gstin,category,status').eq('firm_id', firmId).order('company_name'),
      supabase.from('vendor_performance').select('vendor_id,promised_days,actual_days,qty_ordered,qty_defective,price_at_order,market_price,recorded_at').eq('firm_id', firmId),
      supabase.from('vendor_skus').select('vendor_id, product_skus(catalog_products(category_id))').eq('firm_id', firmId),
      supabase.from('catalog_categories').select('id,name,path'),
    ]);
  for (const e of [ev, ep, evs, ec]) if (e) throw e;

  // category lookups
  const catById = new Map<string, { name: string; path: string }>();
  const pathToName = new Map<string, string>();
  for (const c of (cats || []) as any[]) {
    catById.set(c.id, { name: c.name, path: c.path });
    pathToName.set(c.path, c.name);
  }

  // scores by vendor
  const perfByVendor = new Map<string, PerfRow[]>();
  for (const r of (perf || []) as any[]) {
    const arr = perfByVendor.get(r.vendor_id) || [];
    arr.push(r as PerfRow);
    perfByVendor.set(r.vendor_id, arr);
  }

  // supplied catalog categories per vendor
  const services = new Map<string, Set<string>>();
  const groups = new Map<string, Set<string>>();
  const skuCount = new Map<string, number>();
  for (const r of (vskus || []) as any[]) {
    const vid = r.vendor_id;
    skuCount.set(vid, (skuCount.get(vid) || 0) + 1);
    const catId = r.product_skus?.catalog_products?.category_id;
    const cat = catId ? catById.get(catId) : undefined;
    if (!cat) continue;
    if (!services.has(vid)) services.set(vid, new Set());
    if (!groups.has(vid)) groups.set(vid, new Set());
    services.get(vid)!.add(cat.name);
    groups.get(vid)!.add(deriveGroup(cat.path, pathToName, cat.name));
  }

  return (vendors || []).map((v: any) => ({
    id: v.id, company_name: v.company_name, contact_person: v.contact_person, phone: v.phone,
    email: v.email, gstin: v.gstin, category: v.category, status: v.status,
    score: computeVendorScore(perfByVendor.get(v.id) || []),
    services: [...(services.get(v.id) || [])].sort(),
    groups: [...(groups.get(v.id) || [])].sort(),
    sku_count: skuCount.get(v.id) || 0,
  }));
}

export interface VendorInput {
  id?: string;
  company_name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  category?: string | null;
  status: string;
}

// ── SKU linking — which materials a vendor supplies (drives directory grouping, compare & PO) ──
export interface VendorSkuLink {
  id: string;
  sku_id: string;
  sku_code: string;
  product: string;
  brand: string | null;
  category: string;
  price: number;
  moq: number | null;
  lead_time_days: number;
}

export interface SkuOption {
  sku_id: string;
  sku_code: string;
  brand: string | null;
  product: string;
  category: string;
  cat_path: string;
}

export interface VendorSkuInput { price: number; moq: number | null; lead_time_days: number }

/** The materials a vendor currently supplies (latest offer per SKU). */
export async function fetchVendorSkuLinks(vendorId: string, firmId = DEMO_FIRM_ID): Promise<VendorSkuLink[]> {
  const [{ data, error }, { data: cats, error: ec }] = await Promise.all([
    supabase.from('vendor_skus')
      .select('id, sku_id, price, moq, lead_time_days, valid_from, product_skus(sku_code, brand, catalog_products(name, category_id))')
      .eq('firm_id', firmId).eq('vendor_id', vendorId).order('valid_from', { ascending: false }),
    supabase.from('catalog_categories').select('id,name'),
  ]);
  if (error) throw error;
  if (ec) throw ec;
  const catName = new Map<string, string>((cats || []).map((c: any) => [c.id, c.name]));
  const seen = new Set<string>();
  const out: VendorSkuLink[] = [];
  for (const r of (data || []) as any[]) {
    if (seen.has(r.sku_id)) continue; // ordered by valid_from desc → first seen is current
    seen.add(r.sku_id);
    const ps = r.product_skus;
    const catId = ps?.catalog_products?.category_id;
    out.push({
      id: r.id, sku_id: r.sku_id, sku_code: ps?.sku_code ?? '',
      product: ps?.catalog_products?.name ?? ps?.sku_code ?? 'SKU', brand: ps?.brand ?? null,
      category: catId ? (catName.get(catId) ?? '—') : '—',
      price: Number(r.price), moq: r.moq == null ? null : Number(r.moq), lead_time_days: r.lead_time_days,
    });
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.product.localeCompare(b.product));
}

/** Every SKU in the catalog — for the "add material" picker. */
export async function fetchAllSkus(): Promise<SkuOption[]> {
  const [{ data: skus, error: es }, { data: cats, error: ec }] = await Promise.all([
    supabase.from('product_skus').select('id, sku_code, brand, catalog_products(name, category_id)'),
    supabase.from('catalog_categories').select('id,name,path'),
  ]);
  if (es) throw es;
  if (ec) throw ec;
  const catById = new Map<string, { name: string; path: string }>((cats || []).map((c: any) => [c.id, { name: c.name, path: c.path }]));
  return ((skus || []) as any[]).map((s) => {
    const catId = s.catalog_products?.category_id;
    const cat = catId ? catById.get(catId) : undefined;
    return {
      sku_id: s.id, sku_code: s.sku_code, brand: s.brand,
      product: s.catalog_products?.name ?? s.sku_code,
      category: cat?.name ?? '—', cat_path: cat?.path ?? 'zzz',
    };
  }).sort((a, b) => a.cat_path.localeCompare(b.cat_path) || a.product.localeCompare(b.product));
}

/** Link a SKU to a vendor (or update today's offer). valid_from defaults to today; unique on (vendor,sku,valid_from). */
export async function addVendorSku(vendorId: string, skuId: string, input: VendorSkuInput, firmId = DEMO_FIRM_ID): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing, error: eq } = await supabase.from('vendor_skus')
    .select('id').eq('firm_id', firmId).eq('vendor_id', vendorId).eq('sku_id', skuId).eq('valid_from', today).maybeSingle();
  if (eq) throw eq;
  const fields = { price: input.price, moq: input.moq, lead_time_days: input.lead_time_days };
  if (existing) {
    const { error } = await supabase.from('vendor_skus').update(fields as any).eq('id', (existing as any).id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('vendor_skus')
      .insert({ firm_id: firmId, vendor_id: vendorId, sku_id: skuId, ...fields } as any);
    if (error) throw error;
  }
}

/** Update an existing offer row by id. */
export async function updateVendorSku(id: string, input: VendorSkuInput): Promise<void> {
  const { error } = await supabase.from('vendor_skus')
    .update({ price: input.price, moq: input.moq, lead_time_days: input.lead_time_days } as any).eq('id', id);
  if (error) throw error;
}

/** Unlink a SKU from a vendor entirely (removes all dated offers). */
export async function removeVendorSku(vendorId: string, skuId: string, firmId = DEMO_FIRM_ID): Promise<void> {
  const { error } = await supabase.from('vendor_skus')
    .delete().eq('firm_id', firmId).eq('vendor_id', vendorId).eq('sku_id', skuId);
  if (error) throw error;
}

/** Insert a new vendor or update an existing one. Returns the vendor id. */
export async function saveVendor(input: VendorInput, firmId = DEMO_FIRM_ID): Promise<string> {
  const fields = {
    company_name: input.company_name.trim(),
    contact_person: input.contact_person?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    gstin: input.gstin?.trim() || null,
    category: input.category?.trim() || null,
    status: input.status,
  };
  if (input.id) {
    const { error } = await supabase.from('vendors').update(fields as any).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase.from('vendors')
    .insert({ firm_id: firmId, created_by: DEMO_USER_ID, ...fields } as any)
    .select('id').single();
  if (error) throw error;
  return (data as any).id;
}
