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
/** Fetch the firm-wide default margin policy, creating a sensible default if none exists (self-heals after a data reset). */
export async function ensureMargin(firmId = DEMO_FIRM_ID): Promise<MarginRow | null> {
  const existing = await fetchMargin(firmId);
  if (existing) return existing;
  const row: any = {
    id: (globalThis.crypto as any)?.randomUUID?.() ?? undefined,
    firm_id: firmId, category_id: null, grade: null,
    target_margin_pct: 35, margin_floor_pct: 18, overhead_pct: 8,
  };
  const { data, error } = await supabase.from('margin_policies').insert(row)
    .select('id,target_margin_pct,margin_floor_pct,overhead_pct').single();
  if (error) { console.error('ensureMargin: could not create default policy', error.message); return null; }
  const m = data as any;
  return { id: m.id, target_margin_pct: Number(m.target_margin_pct), margin_floor_pct: Number(m.margin_floor_pct), overhead_pct: Number(m.overhead_pct) };
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

// ── Templates & Rules admin ────────────────────────────────────

export interface RuleAdminRow {
  id: string; template_id: string; seq: number; label: string;
  output_kind: 'material' | 'labour' | 'hardware' | 'service';
  product_id: string | null; labour_activity_id: string | null;
  qty_formula: string; condition: string | null; uom: string;
}

export interface TemplateAdminRow {
  id: string; code: string; name: string; category: string;
  description: string | null; param_schema: Record<string, any>;
  derived_vars: Array<{ name: string; formula: string }>;
  is_active: boolean; rules: RuleAdminRow[];
}

export async function fetchTemplatesAdmin(): Promise<TemplateAdminRow[]> {
  const [{ data: tpls, error: e1 }, { data: rules, error: e2 }] = await Promise.all([
    supabase.from('module_templates').select('id,code,name,category,description,param_schema,derived_vars,is_active').order('name'),
    supabase.from('module_rules').select('id,template_id,seq,output_kind,product_id,labour_activity_id,label,condition,qty_formula,uom').order('seq'),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  const byTpl = new Map<string, RuleAdminRow[]>();
  for (const r of (rules || []) as any[]) {
    const arr = byTpl.get(r.template_id) || [];
    arr.push(r as RuleAdminRow);
    byTpl.set(r.template_id, arr);
  }
  return (tpls || []).map((t: any) => ({
    id: t.id, code: t.code, name: t.name, category: t.category,
    description: t.description, param_schema: t.param_schema || {},
    derived_vars: Array.isArray(t.derived_vars) ? t.derived_vars : [],
    is_active: t.is_active, rules: byTpl.get(t.id) || [],
  }));
}

export async function updateTemplateActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from('module_templates').update({ is_active, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw error;
}

export async function saveTemplateMeta(id: string, data: { name: string; description: string; category: string; derived_vars: any[]; param_schema: any }): Promise<void> {
  const { error } = await supabase.from('module_templates').update({ ...data, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw error;
}

export async function createTemplateFull(data: { code: string; name: string; category: string; description: string; param_schema: any; derived_vars: any[] }, firmId = DEMO_FIRM_ID): Promise<string> {
  const { data: row, error } = await supabase.from('module_templates')
    .insert({ ...data, firm_id: firmId, is_active: true } as any).select('id').single();
  if (error) throw error;
  return (row as any).id;
}

export async function saveRule(rule: Omit<RuleAdminRow, 'id'>): Promise<RuleAdminRow> {
  const { data, error } = await supabase.from('module_rules').insert(rule as any).select('id,template_id,seq,output_kind,product_id,labour_activity_id,label,condition,qty_formula,uom').single();
  if (error) throw error;
  return data as RuleAdminRow;
}

export async function updateRule(id: string, data: Partial<Omit<RuleAdminRow, 'id'>>): Promise<void> {
  const { error } = await supabase.from('module_rules').update(data as any).eq('id', id);
  if (error) throw error;
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('module_rules').delete().eq('id', id);
  if (error) throw error;
}

export interface ProductSimple { id: string; name: string; base_uom: string; category: string }
export interface LabourSimple { id: string; name: string; code: string; base_uom: string; trade: string | null }

export async function fetchProductsSimple(): Promise<ProductSimple[]> {
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from('catalog_categories').select('id,name'),
    supabase.from('catalog_products').select('id,name,base_uom,category_id').eq('is_active', true).order('name'),
  ]);
  const catName = new Map(((cats || []) as any[]).map((c: any) => [c.id, c.name]));
  return ((prods || []) as any[]).map((p: any) => ({ id: p.id, name: p.name, base_uom: p.base_uom, category: catName.get(p.category_id) || '' }));
}

export async function fetchLabourSimple(): Promise<LabourSimple[]> {
  const { data, error } = await supabase.from('labour_activities').select('id,name,code,base_uom,trade').order('name');
  if (error) throw error;
  return ((data || []) as any[]).map((a: any) => ({ id: a.id, name: a.name, code: a.code, base_uom: a.base_uom, trade: a.trade }));
}
