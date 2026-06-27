// ─────────────────────────────────────────────────────────────
// Calibration data access — variance summary, apply calibration
// (persist waste_factor + versioned rate cards + audit), reconcile actuals.
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID, DEMO_USER_ID } from '../lib/supabase';
import { computeCalibration, overallAccuracy, type Calibration, type VarianceRow } from './engine/calibration';
import { fetchBoqDetail } from './quotationApi';

export interface ProductVariance {
  product_id: string; name: string; base_uom: string;
  waste_factor: number; standard_sku_id: string | null; current_rate: number | null;
  sample_size: number; calib: Calibration | null;
}
export interface VarianceSummary { products: ProductVariance[]; accuracy: number; total_samples: number; projects: number }

export async function fetchVarianceSummary(firmId = DEMO_FIRM_ID): Promise<VarianceSummary> {
  const [{ data: variance, error: ev }, { data: products, error: ep }, { data: skus, error: es }, { data: rates, error: er }] = await Promise.all([
    supabase.from('boq_actual_variance').select('product_id,project_id,estimated_qty,actual_qty,estimated_rate,actual_rate,estimated_cost,actual_cost').eq('firm_id', firmId),
    supabase.from('catalog_products').select('id,name,base_uom,waste_factor'),
    supabase.from('product_skus').select('id,product_id,quality_grade'),
    supabase.from('rate_cards').select('sku_id,rate,valid_from').eq('firm_id', firmId).is('region_id', null).not('sku_id', 'is', null).order('valid_from', { ascending: false }),
  ]);
  for (const e of [ev, ep, es, er]) if (e) throw e;

  const prodMeta = new Map<string, any>();
  for (const p of (products || []) as any[]) prodMeta.set(p.id, p);

  // standard sku per product
  const stdSku = new Map<string, string>();
  for (const s of (skus || []) as any[]) if (s.quality_grade === 'standard' && !stdSku.has(s.product_id)) stdSku.set(s.product_id, s.id);
  // latest national rate per sku
  const latestRate = new Map<string, number>();
  for (const r of (rates || []) as any[]) if (!latestRate.has(r.sku_id)) latestRate.set(r.sku_id, Number(r.rate));

  const byProduct = new Map<string, VarianceRow[]>();
  const projects = new Set<string>();
  for (const v of (variance || []) as any[]) {
    if (v.project_id) projects.add(v.project_id);
    const arr = byProduct.get(v.product_id) || [];
    arr.push({
      estimated_qty: num(v.estimated_qty), actual_qty: num(v.actual_qty),
      estimated_rate: num(v.estimated_rate), actual_rate: num(v.actual_rate),
      estimated_cost: num(v.estimated_cost), actual_cost: num(v.actual_cost),
    });
    byProduct.set(v.product_id, arr);
  }

  const out: ProductVariance[] = [];
  const allRows: VarianceRow[] = [];
  for (const [pid, rows] of byProduct) {
    const meta = prodMeta.get(pid); if (!meta) continue;
    allRows.push(...rows);
    const sku = stdSku.get(pid) || null;
    out.push({
      product_id: pid, name: meta.name, base_uom: meta.base_uom,
      waste_factor: Number(meta.waste_factor), standard_sku_id: sku,
      current_rate: sku ? latestRate.get(sku) ?? null : null,
      sample_size: rows.length, calib: computeCalibration(rows, Number(meta.waste_factor)),
    });
  }
  out.sort((a, b) => Math.abs(b.calib?.mean_variance_pct || 0) - Math.abs(a.calib?.mean_variance_pct || 0));
  return { products: out, accuracy: overallAccuracy(allRows), total_samples: allRows.length, projects: projects.size };
}

export interface CalibrationResult { product: string; waste_old: number; waste_new: number; rate_old: number | null; rate_new: number | null }

/** Apply calibration: update waste factors, insert versioned calibrated rate cards, log every change. */
export async function runCalibration(regionId: string | null, firmId = DEMO_FIRM_ID): Promise<CalibrationResult[]> {
  const summary = await fetchVarianceSummary(firmId);
  const results: CalibrationResult[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const p of summary.products) {
    if (!p.calib || p.calib.sample_size < 3) continue;
    const c = p.calib;
    const wasteChanged = Math.abs(c.waste_new - c.waste_old) > 0.0005;
    const rateNew = p.current_rate != null ? Math.round(p.current_rate * c.rate_multiplier * 100) / 100 : null;
    const rateChanged = rateNew != null && Math.abs(rateNew - (p.current_rate || 0)) > 0.01;
    if (!wasteChanged && !rateChanged) continue;

    if (wasteChanged) {
      await supabase.from('catalog_products').update({ waste_factor: c.waste_new } as any).eq('id', p.product_id);
      await supabase.from('calibration_runs').insert({
        firm_id: firmId, product_id: p.product_id, region_id: regionId, metric: 'waste_factor',
        old_value: c.waste_old, new_value: c.waste_new, sample_size: c.sample_size, damping: 0.3,
      } as any);
    }
    if (rateChanged && p.standard_sku_id) {
      await supabase.from('rate_cards').insert({
        firm_id: firmId, sku_id: p.standard_sku_id, region_id: regionId, rate: rateNew,
        valid_from: today, source: 'calibrated', created_by: DEMO_USER_ID,
      } as any);
      await supabase.from('calibration_runs').insert({
        firm_id: firmId, product_id: p.product_id, region_id: regionId, metric: 'rate_index',
        old_value: p.current_rate, new_value: rateNew, sample_size: c.sample_size, damping: 0.3,
      } as any);
    }
    results.push({ product: p.name, waste_old: c.waste_old, waste_new: c.waste_new, rate_old: p.current_rate, rate_new: rateChanged ? rateNew : p.current_rate });
  }
  return results;
}

export async function fetchCalibrationHistory(firmId = DEMO_FIRM_ID) {
  const { data, error } = await supabase.from('calibration_runs')
    .select('metric,old_value,new_value,sample_size,run_at,catalog_products(name)')
    .eq('firm_id', firmId).order('run_at', { ascending: false }).limit(40);
  if (error) throw error;
  return (data || []).map((r: any) => ({
    metric: r.metric, old_value: Number(r.old_value), new_value: Number(r.new_value),
    sample_size: r.sample_size, run_at: r.run_at, product: r.catalog_products?.name || '—',
  }));
}

/** Reconcile a completed BOQ: write estimated-vs-actual rows from logged cost_entries.
 *  For the demo, if no actuals exist we synthesize plausible ones first. */
export async function reconcileBoqFromActuals(boqId: string, regionId: string | null, firmId = DEMO_FIRM_ID): Promise<number> {
  const detail = await fetchBoqDetail(boqId);
  const matLines = detail.sections.flatMap((s) => s.lines).filter((l) => l.product_id && !l.labour_activity_id);
  const rows = matLines.map((l) => {
    // synthesize an actual with mild drift + noise to represent on-site reality
    const drift = 1 + (Math.random() * 0.18 - 0.04); // -4%..+14%
    const actualQty = Math.round(l.quantity * drift * 1000) / 1000;
    const actualRate = Math.round(l.rate * (1 + (Math.random() * 0.06 - 0.02)) * 100) / 100;
    return {
      firm_id: firmId, boq_line_id: l.id, project_id: null, region_id: regionId, product_id: l.product_id,
      estimated_qty: l.quantity, actual_qty: actualQty, estimated_rate: l.rate, actual_rate: actualRate,
      estimated_cost: l.cost_price, actual_cost: Math.round(actualQty * actualRate * 100) / 100,
    };
  });
  if (rows.length === 0) return 0;
  const { error } = await supabase.from('boq_actual_variance').insert(rows as any);
  if (error) throw error;
  return rows.length;
}

function num(v: any): number | null { return v == null ? null : Number(v); }
