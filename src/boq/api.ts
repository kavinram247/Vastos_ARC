// ─────────────────────────────────────────────────────────────
// BOQ data access — fetches catalog/rules from Supabase and assembles
// the deterministic engine's PricingContext. All Supabase I/O lives here.
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID } from '../lib/supabase';
import type {
  PricingContext, TemplateDef, RuleDef, ProductInfo, MaterialRate, Grade, RegionIndices, MarginPolicy,
} from './engine/estimator';

export interface RegionRow { id: string; name: string; material_index: number; labour_index: number; logistics_index: number; availability_risk: number }

export async function fetchRegions(firmId = DEMO_FIRM_ID): Promise<RegionRow[]> {
  const { data, error } = await supabase
    .from('regions').select('id,name,material_index,labour_index,logistics_index,availability_risk')
    .eq('firm_id', firmId).order('name');
  if (error) throw error;
  return data as RegionRow[];
}

export interface TemplateRow extends TemplateDef { rules: RuleDef[] }

export async function fetchTemplates(): Promise<TemplateRow[]> {
  const [{ data: tpls, error: e1 }, { data: rules, error: e2 }] = await Promise.all([
    supabase.from('module_templates').select('id,code,name,category,param_schema,derived_vars').eq('is_active', true).order('name'),
    supabase.from('module_rules').select('id,template_id,seq,output_kind,product_id,labour_activity_id,label,condition,qty_formula,uom'),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  const byTemplate = new Map<string, RuleDef[]>();
  for (const r of (rules || []) as any[]) {
    const arr = byTemplate.get(r.template_id) || [];
    arr.push(r as RuleDef);
    byTemplate.set(r.template_id, arr);
  }
  return (tpls || []).map((t: any) => ({
    id: t.id, code: t.code, name: t.name, category: t.category,
    param_schema: t.param_schema || {},
    derived_vars: Array.isArray(t.derived_vars) ? t.derived_vars : [],
    rules: byTemplate.get(t.id) || [],
  }));
}

/** Build the full pricing context (rates, products, region, margin) for a firm/region. */
export async function fetchPricingContext(regionId: string | null, firmId = DEMO_FIRM_ID): Promise<PricingContext> {
  const [
    { data: products, error: ep },
    { data: skus, error: es },
    { data: matRates, error: emr },
    { data: labour, error: el },
    { data: labRates, error: elr },
    { data: margin, error: em },
    { data: region, error: er },
  ] = await Promise.all([
    supabase.from('catalog_products').select('id,name,base_uom,waste_factor,packaging_loss,install_loss,gst_rate'),
    supabase.from('product_skus').select('id,product_id,brand,quality_grade'),
    supabase.from('rate_cards').select('sku_id,rate,region_id').eq('firm_id', firmId).not('sku_id', 'is', null),
    supabase.from('labour_activities').select('id,code,name'),
    supabase.from('rate_cards').select('labour_activity_id,rate,region_id').eq('firm_id', firmId).not('labour_activity_id', 'is', null),
    supabase.from('margin_policies').select('target_margin_pct,margin_floor_pct,overhead_pct').eq('firm_id', firmId).is('category_id', null).is('grade', null).limit(1),
    regionId ? supabase.from('regions').select('material_index,labour_index,logistics_index,availability_risk').eq('id', regionId).limit(1) : Promise.resolve({ data: null, error: null } as any),
  ]);
  for (const e of [ep, es, emr, el, elr, em, er]) if (e) throw e;

  // products map
  const productsMap = new Map<string, ProductInfo>();
  for (const p of (products || []) as any[]) {
    productsMap.set(p.id, {
      id: p.id, name: p.name, base_uom: p.base_uom,
      waste_factor: Number(p.waste_factor), packaging_loss: Number(p.packaging_loss),
      install_loss: Number(p.install_loss), gst_rate: Number(p.gst_rate),
    });
  }

  // sku → (product_id, grade, brand)
  const skuMeta = new Map<string, { product_id: string; grade: Grade; brand: string | null }>();
  for (const s of (skus || []) as any[]) skuMeta.set(s.id, { product_id: s.product_id, grade: s.quality_grade as Grade, brand: s.brand });

  // material rates → product_id → MaterialRate[]  (national rate_cards, region_id null)
  const materialRates = new Map<string, MaterialRate[]>();
  for (const r of (matRates || []) as any[]) {
    if (r.region_id) continue; // engine applies region index; use national base
    const meta = skuMeta.get(r.sku_id);
    if (!meta) continue;
    const arr = materialRates.get(meta.product_id) || [];
    arr.push({ sku_id: r.sku_id, brand: meta.brand, grade: meta.grade, rate: Number(r.rate) });
    materialRates.set(meta.product_id, arr);
  }

  // labour rates → activity_id → rate (national)
  const labourRates = new Map<string, number>();
  for (const r of (labRates || []) as any[]) {
    if (r.region_id) continue;
    labourRates.set(r.labour_activity_id, Number(r.rate));
  }
  const labourNames = new Map<string, string>();
  for (const l of (labour || []) as any[]) labourNames.set(l.id, l.name);

  const m = (margin && (margin as any[])[0]) as any;
  const marginPolicy: MarginPolicy = m
    ? { target_margin_pct: Number(m.target_margin_pct), margin_floor_pct: Number(m.margin_floor_pct), overhead_pct: Number(m.overhead_pct) }
    : { target_margin_pct: 35, margin_floor_pct: 18, overhead_pct: 8 };

  const rg = (region && (region as any[])[0]) as any;
  const regionIdx: RegionIndices = rg
    ? { material_index: Number(rg.material_index), labour_index: Number(rg.labour_index), logistics_index: Number(rg.logistics_index), availability_risk: Number(rg.availability_risk) }
    : { material_index: 1, labour_index: 1, logistics_index: 1, availability_risk: 0 };

  return { region: regionIdx, margin: marginPolicy, materialRates, labourRates, products: productsMap, labourNames };
}

// ── Persistence ──────────────────────────────────────────────
export interface SaveBoqInput {
  firmId?: string;
  title: string;
  regionId: string | null;
  sections: { name: string; lines: any[] }[];
  totals: { cost_price: number; selling_price: number; gst: number; grand_total: number; margin_pct: number };
}

export async function saveBoq(input: SaveBoqInput): Promise<string> {
  const firmId = input.firmId || DEMO_FIRM_ID;
  const { data: doc, error: e1 } = await supabase.from('boq_documents').insert({
    firm_id: firmId, title: input.title, status: 'draft', region_id: input.regionId,
    total_cost_price: input.totals.cost_price, total_selling_price: input.totals.selling_price,
    total_gst: input.totals.gst, grand_total: input.totals.grand_total, margin_pct: input.totals.margin_pct,
  } as any).select('id').single();
  if (e1) throw e1;
  const boqId = (doc as any).id as string;

  for (let i = 0; i < input.sections.length; i++) {
    const sec = input.sections[i];
    const { data: sectionRow, error: e2 } = await supabase.from('boq_sections')
      .insert({ firm_id: firmId, boq_id: boqId, name: sec.name, order_index: i } as any).select('id').single();
    if (e2) throw e2;
    const sectionId = (sectionRow as any).id as string;
    const rows = sec.lines.map((l: any, idx: number) => ({
      firm_id: firmId, boq_id: boqId, section_id: sectionId,
      product_id: l.product_id, sku_id: l.sku_id, labour_activity_id: l.labour_activity_id,
      description: l.description, uom: l.uom, quantity: l.quantity, rate: l.rate,
      cost_price: l.cost_price, selling_price: l.selling_price, margin_pct: l.margin_pct,
      gst_rate: l.gst_rate, derivation: l.derivation, source: l.source || 'engine',
      is_optional: l.is_optional || false, order_index: idx,
    }));
    const { error: e3 } = await supabase.from('boq_line_items').insert(rows as any);
    if (e3) throw e3;
  }

  // immutable v1 snapshot
  await supabase.from('boq_revisions').insert({
    firm_id: firmId, boq_id: boqId, version: 1,
    snapshot: input.sections as any, totals: input.totals as any, reason: 'Initial generation',
  } as any);
  return boqId;
}

export async function listBoqs(firmId = DEMO_FIRM_ID) {
  const { data, error } = await supabase.from('boq_documents')
    .select('id,title,status,grand_total,total_cost_price,margin_pct,created_at')
    .eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
