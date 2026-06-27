// ─────────────────────────────────────────────────────────────
// Admin data access — edit the firm's real prices. Rate changes are
// VERSIONED (new rate_cards row, valid_from today) to preserve audit history;
// resolve_rate() / the latest-by-valid_from query always returns the current rate.
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID } from '../lib/supabase';

export interface SkuRow { sku_id: string; brand: string | null; grade: string; current_rate: number | null }
export interface MaterialRow {
  product_id: string; name: string; category: string; base_uom: string;
  waste_factor: number; gst_rate: number; skus: SkuRow[];
}

export async function fetchMaterialRows(firmId = DEMO_FIRM_ID): Promise<MaterialRow[]> {
  const [{ data: cats, error: ec }, { data: products, error: ep }, { data: skus, error: es }, { data: rates, error: er }] = await Promise.all([
    supabase.from('catalog_categories').select('id,name,path'),
    supabase.from('catalog_products').select('id,name,category_id,base_uom,waste_factor,gst_rate').order('name'),
    supabase.from('product_skus').select('id,product_id,brand,quality_grade'),
    supabase.from('rate_cards').select('sku_id,rate,valid_from').eq('firm_id', firmId).is('region_id', null).not('sku_id', 'is', null).order('valid_from', { ascending: false }),
  ]);
  for (const e of [ec, ep, es, er]) if (e) throw e;

  const catName = new Map<string, string>();
  for (const c of (cats || []) as any[]) catName.set(c.id, c.name);

  // latest rate per sku
  const latest = new Map<string, number>();
  for (const r of (rates || []) as any[]) if (!latest.has(r.sku_id)) latest.set(r.sku_id, Number(r.rate));

  const byProduct = new Map<string, SkuRow[]>();
  for (const s of (skus || []) as any[]) {
    const arr = byProduct.get(s.product_id) || [];
    arr.push({ sku_id: s.id, brand: s.brand, grade: s.quality_grade, current_rate: latest.has(s.id) ? latest.get(s.id)! : null });
    byProduct.set(s.product_id, arr);
  }

  return (products || []).map((p: any) => ({
    product_id: p.id, name: p.name, category: catName.get(p.category_id) || '—',
    base_uom: p.base_uom, waste_factor: Number(p.waste_factor), gst_rate: Number(p.gst_rate),
    skus: byProduct.get(p.id) || [],
  }));
}

export async function saveMaterialRate(skuId: string, rate: number, firmId = DEMO_FIRM_ID) {
  const { error } = await supabase.from('rate_cards').insert({
    firm_id: firmId, sku_id: skuId, region_id: null, rate, valid_from: new Date().toISOString().slice(0, 10), source: 'manual',
  } as any);
  if (error) throw error;
}

export async function saveProductWaste(productId: string, waste: number) {
  const { error } = await supabase.from('catalog_products').update({ waste_factor: waste } as any).eq('id', productId);
  if (error) throw error;
}

export interface LabourRow { activity_id: string; code: string; name: string; base_uom: string; trade: string | null; current_rate: number | null }

export async function fetchLabourRows(firmId = DEMO_FIRM_ID): Promise<LabourRow[]> {
  const [{ data: acts, error: ea }, { data: rates, error: er }] = await Promise.all([
    supabase.from('labour_activities').select('id,code,name,base_uom,trade').order('trade'),
    supabase.from('rate_cards').select('labour_activity_id,rate,valid_from').eq('firm_id', firmId).is('region_id', null).not('labour_activity_id', 'is', null).order('valid_from', { ascending: false }),
  ]);
  for (const e of [ea, er]) if (e) throw e;
  const latest = new Map<string, number>();
  for (const r of (rates || []) as any[]) if (!latest.has(r.labour_activity_id)) latest.set(r.labour_activity_id, Number(r.rate));
  return (acts || []).map((a: any) => ({
    activity_id: a.id, code: a.code, name: a.name, base_uom: a.base_uom, trade: a.trade,
    current_rate: latest.has(a.id) ? latest.get(a.id)! : null,
  }));
}

export async function saveLabourRate(activityId: string, rate: number, firmId = DEMO_FIRM_ID) {
  const { error } = await supabase.from('rate_cards').insert({
    firm_id: firmId, labour_activity_id: activityId, region_id: null, rate, valid_from: new Date().toISOString().slice(0, 10), source: 'manual',
  } as any);
  if (error) throw error;
}

export interface MarginRow { id: string; target_margin_pct: number; margin_floor_pct: number; overhead_pct: number }
export async function fetchMargin(firmId = DEMO_FIRM_ID): Promise<MarginRow | null> {
  const { data, error } = await supabase.from('margin_policies').select('id,target_margin_pct,margin_floor_pct,overhead_pct')
    .eq('firm_id', firmId).is('category_id', null).is('grade', null).limit(1);
  if (error) throw error;
  const m = (data as any[])[0];
  return m ? { id: m.id, target_margin_pct: Number(m.target_margin_pct), margin_floor_pct: Number(m.margin_floor_pct), overhead_pct: Number(m.overhead_pct) } : null;
}
export async function saveMargin(id: string, m: { target_margin_pct: number; margin_floor_pct: number; overhead_pct: number }) {
  const { error } = await supabase.from('margin_policies').update(m as any).eq('id', id);
  if (error) throw error;
}

export interface RegionAdminRow { id: string; name: string; material_index: number; labour_index: number; logistics_index: number; availability_risk: number }
export async function fetchRegionAdmin(firmId = DEMO_FIRM_ID): Promise<RegionAdminRow[]> {
  const { data, error } = await supabase.from('regions').select('id,name,material_index,labour_index,logistics_index,availability_risk').eq('firm_id', firmId).order('name');
  if (error) throw error;
  return (data as any[]).map((r) => ({
    id: r.id, name: r.name, material_index: Number(r.material_index), labour_index: Number(r.labour_index),
    logistics_index: Number(r.logistics_index), availability_risk: Number(r.availability_risk),
  }));
}
export async function saveRegion(id: string, r: { material_index: number; labour_index: number; logistics_index: number; availability_risk: number }) {
  const { error } = await supabase.from('regions').update(r as any).eq('id', id);
  if (error) throw error;
}
