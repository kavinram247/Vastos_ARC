// ─────────────────────────────────────────────────────────────
// Admin data access — edit the firm's real prices. Rate changes are
// VERSIONED (new rate_cards row, valid_from today) to preserve audit history;
// resolve_rate() / the latest-by-valid_from query always returns the current rate.
//
// Phase 5, item 2.8: calls vastos-api's /api/boq/admin/* instead of Supabase
// — see vastos-api's src/boq/boq-admin.service.ts (catalogue rates/margins/
// regions) and boq-admin-templates.service.ts (templates/rules). Every write
// still proxies to the same SECURITY DEFINER RPCs as before (see H2b note
// below); the server just calls them over a pooled pg connection instead of
// supabase-js. Signatures unchanged (including now-unused firmId params) so
// AdminPage.tsx needs no changes. fetchRegionAdmin reuses the existing
// /api/boq/regions endpoint (boq/api.ts's fetchRegions) — identical query,
// no reason for a second one.
//
// Audit H2b: the catalogue is SHARED. Global rows (firm_id IS NULL) are now
// read-only to every tenant — a firm owner used to be able to reprice every
// other firm's estimates through them. Editing one is copy-on-write instead:
//
//   · products  → catalog_product_override_set() writes a sparse per-firm
//                 override, and reads come from catalog_products_effective,
//                 which resolves the override over the global row while
//                 KEEPING the global row's id, so nothing that references a
//                 product has to change;
//   · templates → module_template_fork() clones the global template and its
//                 rules into the firm on first edit, and reads come from
//                 module_templates_effective, which shows the fork in place of
//                 the global it was forked from.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from '../lib/vastosApi';
import type { RegionRow } from './api';

export interface SkuRow { sku_id: string; brand: string | null; grade: string; current_rate: number | null }
export interface MaterialRow {
  product_id: string; name: string; category: string; base_uom: string;
  waste_factor: number; gst_rate: number; skus: SkuRow[];
}

export async function fetchMaterialRows(_firmId: string): Promise<MaterialRow[]> {
  return vastosApiFetch('/api/boq/admin/materials');
}

export async function saveMaterialRate(skuId: string, rate: number, _firmId: string) {
  await vastosApiFetch(`/api/boq/admin/materials/${skuId}/rate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rate }),
  });
}

// Copy-on-write (H2b). The RPC updates in place when the product belongs to
// this firm and writes an override when it is a shared global row; the caller
// does not need to know which.
export async function saveProductWaste(productId: string, waste: number) {
  await vastosApiFetch(`/api/boq/admin/products/${productId}/override`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ waste }),
  });
}

/** Drop this firm's override and follow the shared catalogue again (H2b). */
export async function clearProductOverride(productId: string) {
  await vastosApiFetch(`/api/boq/admin/products/${productId}/override`, { method: 'DELETE' });
}

export interface LabourRow { activity_id: string; code: string; name: string; base_uom: string; trade: string | null; current_rate: number | null }

export async function fetchLabourRows(_firmId: string): Promise<LabourRow[]> {
  return vastosApiFetch('/api/boq/admin/labour');
}

export async function saveLabourRate(activityId: string, rate: number, _firmId: string) {
  await vastosApiFetch(`/api/boq/admin/labour/${activityId}/rate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rate }),
  });
}

export interface MarginRow { id: string; target_margin_pct: number; margin_floor_pct: number; overhead_pct: number }
export async function fetchMargin(_firmId: string): Promise<MarginRow | null> {
  return vastosApiFetch('/api/boq/admin/margin');
}
export async function saveMargin(id: string, m: { target_margin_pct: number; margin_floor_pct: number; overhead_pct: number }) {
  await vastosApiFetch(`/api/boq/admin/margin/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m),
  });
}
/** Fetch the firm-wide default margin policy, creating a sensible default if none exists (self-heals after a data reset). */
export async function ensureMargin(_firmId: string): Promise<MarginRow | null> {
  return vastosApiFetch('/api/boq/admin/margin/ensure', { method: 'POST' });
}

export interface RegionAdminRow { id: string; name: string; material_index: number; labour_index: number; logistics_index: number; availability_risk: number }
export async function fetchRegionAdmin(_firmId: string): Promise<RegionAdminRow[]> {
  return vastosApiFetch<RegionRow[]>('/api/boq/regions');
}
export async function saveRegion(id: string, r: { material_index: number; labour_index: number; logistics_index: number; availability_risk: number }) {
  await vastosApiFetch(`/api/boq/admin/regions/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r),
  });
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
  return vastosApiFetch('/api/boq/admin/templates');
}

// Fork-on-write (H2b). Each of these returns the template id to use from now
// on: editing a shared global template forks it into this firm first, so the
// id changes on that first edit. Callers reload from fetchTemplatesAdmin()
// afterwards, which resolves the fork in place of the global.
export async function updateTemplateActive(id: string, is_active: boolean): Promise<string> {
  const { id: tplId } = await vastosApiFetch<{ id: string }>(`/api/boq/admin/templates/${id}/active`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active }),
  });
  return tplId;
}

export async function saveTemplateMeta(id: string, data: { name: string; description: string; category: string; derived_vars: any[]; param_schema: any }): Promise<string> {
  const { id: tplId } = await vastosApiFetch<{ id: string }>(`/api/boq/admin/templates/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  return tplId;
}

export async function createTemplateFull(data: { code: string; name: string; category: string; description: string; param_schema: any; derived_vars: any[] }, _firmId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>('/api/boq/admin/templates', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  return id;
}

// Rules belong to a template and inherit its tenancy (H2b), so these fork the
// parent first. After a fork the caller's rule id refers to the global rule;
// the RPC locates the counterpart in the fork by `seq` and returns the ids to
// use from now on.
export async function saveRule(rule: Omit<RuleAdminRow, 'id'>): Promise<RuleAdminRow> {
  const { template_id, rule_id } = await vastosApiFetch<{ template_id: string; rule_id: string }>('/api/boq/admin/rules', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule),
  });
  return { ...rule, id: rule_id, template_id } as RuleAdminRow;
}

export async function updateRule(id: string, data: Partial<Omit<RuleAdminRow, 'id'>>): Promise<{ template_id: string; rule_id: string }> {
  return vastosApiFetch(`/api/boq/admin/rules/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}

export async function deleteRule(id: string): Promise<{ template_id: string }> {
  return vastosApiFetch(`/api/boq/admin/rules/${id}`, { method: 'DELETE' });
}

export interface ProductSimple { id: string; name: string; base_uom: string; category: string }
export interface LabourSimple { id: string; name: string; code: string; base_uom: string; trade: string | null }

export async function fetchProductsSimple(): Promise<ProductSimple[]> {
  return vastosApiFetch('/api/boq/admin/products-simple');
}

export async function fetchLabourSimple(): Promise<LabourSimple[]> {
  return vastosApiFetch('/api/boq/admin/labour-simple');
}
