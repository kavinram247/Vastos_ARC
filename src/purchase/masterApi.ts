// ─────────────────────────────────────────────────────────────
// Purchase masters — vendors (supplier) + materials (catalog). Cut over to
// vastos-api (Phase 5, item 2.12): vastos-api/src/purchase/purchase-masters
// .service.ts is the server-side source of truth now. Every exported
// function keeps its exact original signature (including now-unused
// firmId params, resolved server-side from the verified session) — callers
// need zero changes.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from '../lib/vastosApi';
import type { PurchaseVendor, PurchaseMaterial } from './types';

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

export async function listVendors(_firmId: string): Promise<PurchaseVendor[]> {
  return vastosApiFetch<PurchaseVendor[]>('/api/purchase/vendors');
}

// created_by (a profiles.id uuid) is resolved server-side from the session —
// not the same id space as firmId/userId here — so vendors are a bespoke
// endpoint, not the generic /api/data/:table layer. See
// purchase-masters.service.ts's big comment.
export async function saveVendor(input: VendorInput, _firmId: string, _userId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>('/api/purchase/vendors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return id;
}

export async function deleteVendor(id: string): Promise<void> {
  await vastosApiFetch(`/api/purchase/vendors/${id}`, { method: 'DELETE' });
}

// ── Materials (catalog_products) ─────────────────────────────
export interface CatalogCategory { id: string; name: string; path: string }

export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  return vastosApiFetch<CatalogCategory[]>('/api/purchase/catalog-categories');
}

export async function listMaterials(_firmId: string): Promise<PurchaseMaterial[]> {
  return vastosApiFetch<PurchaseMaterial[]>('/api/purchase/materials');
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

export async function saveMaterial(input: MaterialInput, _firmId: string): Promise<string> {
  const { id } = await vastosApiFetch<{ id: string }>('/api/purchase/materials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return id;
}

/** Soft-delete a material (kept referenced by history; hidden from pickers). */
export async function deactivateMaterial(id: string): Promise<void> {
  await vastosApiFetch(`/api/purchase/materials/${id}/deactivate`, { method: 'POST' });
}
