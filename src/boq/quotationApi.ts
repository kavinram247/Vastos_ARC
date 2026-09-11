// ─────────────────────────────────────────────────────────────
// Quotation data access — load a saved BOQ in full, persist quotation projections.
//
// Phase 5, item 2.7b: calls vastos-api's /api/boq/* instead of Supabase — see
// vastos-api's src/boq/boq.service.ts (fetchBoqDetail/saveQuotation/
// listQuotations). Signatures unchanged (including the now-unused firmId
// param on saveQuotation) so calibrationApi.ts, vendorApi.ts and
// QuotationsPage.tsx need no changes.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from '../lib/vastosApi';
import type { BoqDetail } from './engine/documents';

export async function fetchBoqDetail(boqId: string): Promise<BoqDetail> {
  return vastosApiFetch(`/api/boq/documents/${boqId}/detail`);
}

export interface SaveQuotationInput {
  boqId: string;
  boqVersion?: number;
  docType: 'customer' | 'internal_costing' | 'procurement' | 'vendor_rfq';
  design_fees?: number;
  supervision_fees?: number;
  other_charges?: number;
  discount_pct?: number;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  snapshot: any;
}

export interface SavedQuotation { id: string; quotation_number: string; share_token: string }

export async function saveQuotation(input: SaveQuotationInput, _firmId: string): Promise<SavedQuotation> {
  return vastosApiFetch('/api/boq/quotations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function listQuotations(_firmId: string) {
  return vastosApiFetch('/api/boq/quotations');
}
