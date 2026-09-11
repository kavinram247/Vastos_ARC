// ─────────────────────────────────────────────────────────────
// BOQ data access — fetches catalog/rules and assembles the deterministic
// engine's PricingContext, and persists BOQ documents.
//
// Phase 5, item 2.7: this file now calls vastos-api's /api/boq/* endpoints
// instead of Supabase directly (see vastos-api's src/boq/boq.service.ts,
// which assembles the exact same shapes server-side and does saveBoq as one
// real transaction — documents/sections/line-items/revision either all land
// or none do, unlike the old sequential inserts here). Every function keeps
// its original signature (including the now-unused firmId params) so no
// caller — BoqEstimatorPage, CalibrationPage, QuotationsPage, VendorsPage —
// needs to change; the caller's own firm was always redundant with what RLS
// (now current_firm_id() server-side) already enforced.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from '../lib/vastosApi';
import type {
  PricingContext, TemplateDef, RuleDef, ProductInfo, MaterialRate, Grade, RegionIndices, MarginPolicy,
} from './engine/estimator';

export interface RegionRow { id: string; name: string; material_index: number; labour_index: number; logistics_index: number; availability_risk: number }

export async function fetchRegions(_firmId: string): Promise<RegionRow[]> {
  return vastosApiFetch('/api/boq/regions');
}

export interface TemplateRow extends TemplateDef { rules: RuleDef[] }

export async function fetchTemplates(): Promise<TemplateRow[]> {
  return vastosApiFetch('/api/boq/templates');
}

interface PricingContextPayload {
  region: RegionIndices;
  margin: MarginPolicy;
  products: ProductInfo[];
  materialRates: Array<{ product_id: string } & MaterialRate>;
  labourRates: Array<{ labour_activity_id: string; rate: number }>;
  labourNames: Array<{ id: string; name: string }>;
}

/** Build the full pricing context (rates, products, region, margin) for a firm/region. */
export async function fetchPricingContext(regionId: string | null, _firmId: string): Promise<PricingContext> {
  const qs = regionId ? `?regionId=${encodeURIComponent(regionId)}` : '';
  const payload: PricingContextPayload = await vastosApiFetch(`/api/boq/pricing-context${qs}`);

  const products = new Map<string, ProductInfo>();
  for (const p of payload.products) products.set(p.id, p);

  const materialRates = new Map<string, MaterialRate[]>();
  for (const r of payload.materialRates) {
    const arr = materialRates.get(r.product_id) || [];
    arr.push({ sku_id: r.sku_id, brand: r.brand, grade: r.grade as Grade, rate: r.rate });
    materialRates.set(r.product_id, arr);
  }

  const labourRates = new Map<string, number>();
  for (const r of payload.labourRates) labourRates.set(r.labour_activity_id, r.rate);

  const labourNames = new Map<string, string>();
  for (const l of payload.labourNames) labourNames.set(l.id, l.name);

  return { region: payload.region, margin: payload.margin, materialRates, labourRates, products, labourNames };
}

// ── Persistence ──────────────────────────────────────────────
export interface SaveBoqInput {
  firmId: string;
  title: string;
  regionId: string | null;
  sections: { name: string; lines: any[] }[];
  totals: { cost_price: number; selling_price: number; gst: number; grand_total: number; margin_pct: number };
}

export async function saveBoq(input: SaveBoqInput): Promise<string> {
  const { firmId: _firmId, ...body } = input;
  const { id } = await vastosApiFetch<{ id: string }>('/api/boq/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return id;
}

export async function listBoqs(_firmId: string) {
  return vastosApiFetch('/api/boq/documents');
}
