// ─────────────────────────────────────────────────────────────
// Vendor intelligence data access — scores, comparison, PO generation.
//
// Phase 5, item 2.8: calls vastos-api's /api/boq/vendors/* instead of
// Supabase — see vastos-api's src/boq/boq-vendor.service.ts (scores,
// directory, vendor CRUD) and boq-vendor-sku.service.ts (SKU linking,
// candidates, PO generation). computeVendorScore now runs server-side (a
// verbatim port, same precedent as calibration-engine.ts) — this file no
// longer imports it. rankVendors() in ./engine/vendorScore stays client-side
// unchanged: it's pure ranking over an already-scored candidate list, no DB
// access. fetchCandidateMap's Map is reconstructed here from the plain
// object the API returns, same convention as every other Map-shaped type
// from this migration. Signatures unchanged (including now-unused
// firmId/createdBy params) so VendorsPage.tsx and the PO flow need no changes.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from '../lib/vastosApi';
import type { VendorScore, VendorCandidate } from './engine/vendorScore';
import { fetchBoqDetail } from './quotationApi';
import { procurementView } from './engine/documents';

export interface VendorWithScore {
  id: string; company_name: string; contact_person: string | null; phone: string | null;
  category: string | null; status: string; score: VendorScore | null;
}

export async function fetchVendorsWithScores(_firmId: string): Promise<VendorWithScore[]> {
  return vastosApiFetch('/api/boq/vendors/scores');
}

/** Recompute scores from performance and persist to the vendors denormalized columns. */
export async function recomputeAndPersistScores(_firmId: string): Promise<number> {
  const { count } = await vastosApiFetch<{ count: number }>('/api/boq/vendors/scores/recompute', { method: 'POST' });
  return count;
}

/** Vendors that sell a given SKU, with price/lead/MOQ + their score → candidates for ranking. */
export async function fetchCandidatesForSku(skuId: string, _firmId: string): Promise<VendorCandidate[]> {
  return vastosApiFetch(`/api/boq/vendors/candidates?skuId=${encodeURIComponent(skuId)}`);
}

/** All vendor offers keyed by sku_id, with scores attached — for the PO recommendation flow. */
export async function fetchCandidateMap(_firmId: string): Promise<Map<string, VendorCandidate[]>> {
  const record = await vastosApiFetch<Record<string, VendorCandidate[]>>('/api/boq/vendors/candidates-map');
  return new Map(Object.entries(record));
}

export async function listVendorSkus(_firmId: string) {
  return vastosApiFetch<Array<{ sku_id: string; label: string }>>('/api/boq/vendors/skus');
}

export interface POLineInput { sku_id: string | null; description: string; uom: string; quantity: number; rate: number; amount: number }

export async function generatePO(
  boqId: string, vendorId: string, lines: POLineInput[], _firmId: string,
): Promise<string> {
  const { poNumber } = await vastosApiFetch<{ poNumber: string }>('/api/boq/vendors/po', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boqId, vendorId, lines }),
  });
  return poNumber;
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

export async function fetchVendorDirectory(_firmId: string): Promise<VendorDirectoryEntry[]> {
  return vastosApiFetch('/api/boq/vendors/directory');
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
export async function fetchVendorSkuLinks(vendorId: string, _firmId: string): Promise<VendorSkuLink[]> {
  return vastosApiFetch(`/api/boq/vendors/${vendorId}/skus`);
}

/** Every SKU in the catalog — for the "add material" picker. */
export async function fetchAllSkus(): Promise<SkuOption[]> {
  return vastosApiFetch('/api/boq/vendors/all-skus');
}

/** Link a SKU to a vendor (or update today's offer). valid_from defaults to today; unique on (vendor,sku,valid_from). */
export async function addVendorSku(vendorId: string, skuId: string, input: VendorSkuInput, _firmId: string): Promise<void> {
  await vastosApiFetch(`/api/boq/vendors/${vendorId}/skus/${skuId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}

/** Update an existing offer row by id. */
export async function updateVendorSku(id: string, input: VendorSkuInput): Promise<void> {
  await vastosApiFetch(`/api/boq/vendors/sku-links/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}

/** Unlink a SKU from a vendor entirely (removes all dated offers). */
export async function removeVendorSku(vendorId: string, skuId: string, _firmId: string): Promise<void> {
  await vastosApiFetch(`/api/boq/vendors/${vendorId}/skus/${skuId}`, { method: 'DELETE' });
}

/** Insert a new vendor or update an existing one. Returns the vendor id. */
export async function saveVendor(input: VendorInput, _firmId: string, _createdBy: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>('/api/boq/vendors', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return id;
}
