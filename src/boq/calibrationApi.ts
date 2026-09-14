// ─────────────────────────────────────────────────────────────
// Calibration data access — variance summary, apply calibration
// (persist waste_factor + versioned rate cards + audit), reconcile actuals.
//
// Phase 5, item 2.7c: calls vastos-api's /api/boq/calibration/* instead of
// Supabase — see vastos-api's src/boq/boq.service.ts + calibration-engine.ts
// (a verbatim port of ./engine/calibration.ts; the server now does the
// calibration math itself so it can decide what to write, but the numbers
// are computed the same way). Signatures unchanged (including the now-
// unused firmId/createdBy params — createdBy is resolved server-side from
// the verified session instead) so CalibrationPage.tsx needs no changes.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from '../lib/vastosApi';
import type { Calibration } from './engine/calibration';

export interface ProductVariance {
  product_id: string; name: string; base_uom: string;
  waste_factor: number; standard_sku_id: string | null; current_rate: number | null;
  sample_size: number; calib: Calibration | null;
}
export interface VarianceSummary { products: ProductVariance[]; accuracy: number; total_samples: number; projects: number }

export async function fetchVarianceSummary(_firmId: string): Promise<VarianceSummary> {
  return vastosApiFetch('/api/boq/calibration/variance-summary');
}

export interface CalibrationResult { product: string; waste_old: number; waste_new: number; rate_old: number | null; rate_new: number | null }

/** Apply calibration: update waste factors, insert versioned calibrated rate cards, log every change. */
export async function runCalibration(regionId: string | null, _firmId: string, _createdBy: string): Promise<CalibrationResult[]> {
  return vastosApiFetch('/api/boq/calibration/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regionId }),
  });
}

export async function fetchCalibrationHistory(_firmId: string) {
  return vastosApiFetch('/api/boq/calibration/history');
}

/** Reconcile a completed BOQ: write estimated-vs-actual rows from logged cost_entries.
 *  For the demo, if no actuals exist we synthesize plausible ones first. */
export async function reconcileBoqFromActuals(boqId: string, regionId: string | null, _firmId: string): Promise<number> {
  const { count } = await vastosApiFetch<{ count: number }>(`/api/boq/documents/${boqId}/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regionId }),
  });
  return count;
}
