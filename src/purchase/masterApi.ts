// ─────────────────────────────────────────────────────────────
// Purchase masters — vendors (supplier) + materials (catalog). These REUSE the
// existing `vendors` and `catalog_products` tables so Purchase Management, the
// BOQ engine and Vendor Intelligence all read one source of truth.
// The generated database.types.ts predates the migration-28 columns, so this
// module talks to an untyped client handle (same pattern used elsewhere).
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import type { PurchaseVendor, PurchaseMaterial } from './types';

const sb = supabase as any;

// ── Vendors ──────────────────────────────────────────────────
export interface VendorInput {
  id?: string;
  company_name: string;
  vendor_code?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  category?: string | null;
  credit_days?: number | null;
  payment_terms?: string | null;
  status: string;
  notes?: string | null;
}

export async function listVendors(firmId: string): Promise<PurchaseVendor[]> {
  const { data, error } = await sb.from('vendors')
    .select('id,company_name,vendor_code,contact_person,phone,email,gstin,category,credit_days,payment_terms,status,notes,overall_score')
    .eq('firm_id', firmId).order('company_name');
  if (error) throw error;
  return (data || []).map((v: any) => ({
    id: v.id, company_name: v.company_name, vendor_code: v.vendor_code ?? null,
    contact_person: v.contact_person ?? null, phone: v.phone ?? null, email: v.email ?? null,
    gstin: v.gstin ?? null, category: v.category ?? null,
    credit_days: v.credit_days ?? null, payment_terms: v.payment_terms ?? null,
    status: v.status, notes: v.notes ?? null,
    overall_score: v.overall_score == null ? null : Number(v.overall_score),
  }));
}

export async function saveVendor(input: VendorInput, firmId: string, userId: string): Promise<string> {
  const fields = {
    company_name: input.company_name.trim(),
    vendor_code: input.vendor_code?.trim() || null,
    contact_person: input.contact_person?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    gstin: input.gstin?.trim() || null,
    category: input.category?.trim() || null,
    credit_days: input.credit_days ?? null,
    payment_terms: input.payment_terms?.trim() || null,
    status: input.status,
    notes: input.notes?.trim() || null,
  };
  if (input.id) {
    const { error } = await sb.from('vendors').update(fields).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await sb.from('vendors')
    .insert({ firm_id: firmId, created_by: userId, ...fields }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function deleteVendor(id: string): Promise<void> {
  const { error } = await sb.from('vendors').delete().eq('id', id);
  if (error) throw error;
}

// ── Materials (catalog_products) ─────────────────────────────
export interface CatalogCategory { id: string; name: string; path: string }

export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  const { data, error } = await sb.from('catalog_categories').select('id,name,path').order('path');
  if (error) throw error;
  return (data || []).map((c: any) => ({ id: c.id, name: c.name, path: c.path }));
}

export async function listMaterials(firmId: string): Promise<PurchaseMaterial[]> {
  const [{ data: products, error: ep }, { data: cats, error: ec }, { data: skus, error: es }, { data: rates, error: er }] =
    await Promise.all([
      sb.from('catalog_products').select('id,name,category_id,base_uom,hsn_code,gst_rate,is_active').order('name'),
      sb.from('catalog_categories').select('id,name'),
      sb.from('product_skus').select('id,product_id'),
      sb.from('rate_cards').select('sku_id,rate,region_id,valid_from').eq('firm_id', firmId).not('sku_id', 'is', null),
    ]);
  for (const e of [ep, ec, es, er]) if (e) throw e;

  const catName = new Map<string, string>((cats || []).map((c: any) => [c.id, c.name]));
  const productOfSku = new Map<string, string>((skus || []).map((s: any) => [s.id, s.product_id]));

  // latest national rate per product → "last price"
  const lastPrice = new Map<string, { rate: number; when: string }>();
  for (const r of (rates || []) as any[]) {
    if (r.region_id) continue; // national base only
    const pid = productOfSku.get(r.sku_id);
    if (!pid) continue;
    const when = r.valid_from || '';
    const cur = lastPrice.get(pid);
    if (!cur || when >= cur.when) lastPrice.set(pid, { rate: Number(r.rate), when });
  }

  return (products || []).map((p: any) => ({
    id: p.id, name: p.name,
    category_id: p.category_id ?? null,
    category: p.category_id ? (catName.get(p.category_id) ?? null) : null,
    base_uom: p.base_uom, hsn_code: p.hsn_code ?? null,
    gst_rate: Number(p.gst_rate ?? 18),
    last_price: lastPrice.get(p.id)?.rate ?? null,
    is_active: p.is_active !== false,
  }));
}

export interface MaterialInput {
  id?: string;
  name: string;
  category_id: string;
  base_uom: string;
  hsn_code?: string | null;
  gst_rate: number;
  description?: string | null;
}

export async function saveMaterial(input: MaterialInput, firmId: string): Promise<string> {
  const fields: any = {
    name: input.name.trim(),
    category_id: input.category_id,
    base_uom: input.base_uom,
    hsn_code: input.hsn_code?.trim() || null,
    gst_rate: input.gst_rate,
  };
  if (input.description?.trim()) fields.attributes = { description: input.description.trim() };
  if (input.id) {
    const { error } = await sb.from('catalog_products').update(fields).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await sb.from('catalog_products')
    .insert({ firm_id: firmId, is_active: true, ...fields }).select('id').single();
  if (error) throw error;
  return data.id;
}

/** Soft-delete a material (kept referenced by history; hidden from pickers). */
export async function deactivateMaterial(id: string): Promise<void> {
  const { error } = await sb.from('catalog_products').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}
