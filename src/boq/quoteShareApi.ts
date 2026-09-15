// ─────────────────────────────────────────────────────────────
// Public client-quote flow: share token → view → accept/e-sign →
// auto-generate the payment schedule (quote-to-cash spine, Section 10 / deal-maker #2).
// ─────────────────────────────────────────────────────────────
import { getBoqSchedule, getBoqShareToken, publicVastosApiFetch } from '../lib/vastosApi';
import type { BoqDetail } from './engine/documents';

// Standard Indian interior 4-stage plan (firm-configurable later).
// DISPLAY ONLY. The authoritative copy lives in accept_quote() —
// supabase/migrations/20260728030000_security_phase2_c5_quote_accept_rpc.sql.
// Keep the two in step; the server's version is what gets billed.
export const PAYMENT_STAGES = [
  { label: 'Booking advance', percent: 10 },
  { label: 'Design sign-off', percent: 40 },
  { label: 'Production & material procurement', percent: 40 },
  { label: 'Installation & handover', percent: 10 },
];

export interface PublicQuote {
  quotation: {
    id: string; firm_id: string; boq_id: string | null; quotation_number: string;
    design_fees: number; supervision_fees: number; other_charges: number; discount_pct: number;
    status: string; accepted_at: string | null; accepted_by_name: string | null; selected_options: string[];
  };
  firm: { name: string; address: string | null; gstin: string | null; logo_url: string | null };
  boq: BoqDetail;
  schedule: ScheduleWithMilestones | null;
}
export interface ScheduleWithMilestones {
  total_amount: number; split_count: number; signed_name: string | null; signed_at: string | null;
  milestones: { split_number: number; label: string; percent: number; amount: number; gst_amount: number; total_with_gst: number }[];
}

export async function getShareToken(quotationId: string): Promise<string> {
  const token = await getBoqShareToken(quotationId);
  if (!token) throw new Error('Quotation not found');
  return token;
}

export async function fetchScheduleForQuotation(quotationId: string): Promise<ScheduleWithMilestones | null> {
  const s = await getBoqSchedule(quotationId);
  return s ? normaliseSchedule(s) : null;
}

// ── Public (unauthenticated) flow — audit C5 ──
// Both calls below hit public, unauthenticated vastos-api routes (Phase 5,
// item 3) that proxy the same quote_public_view/accept_quote SECURITY
// DEFINER RPCs, resolving the quotation entirely by its share token — no
// session, no Supabase involved. See boq-quote-share.service.ts.

/** Read a quote by its share token. Also stamps viewed_at server-side. */
export async function fetchPublicQuote(token: string): Promise<PublicQuote> {
  const data = await publicVastosApiFetch<any>(`/api/boq/quotes/${token}`);
  if (!data) throw new Error('Quote not found');
  const p = data as any;

  // The payload carries no cost_price / rate / margin_pct — the firm's internal
  // costing is deliberately not sent to a public page. clientQuoteView() reads
  // only the selling-side fields, so zeroes here are inert.
  const boq: BoqDetail = {
    id: '', title: '', status: '', region_id: null,
    sections: (p.sections || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      lines: (s.lines || []).map((l: any) => ({
        id: l.id, description: l.description, uom: l.uom,
        quantity: Number(l.quantity), selling_price: Number(l.selling_price),
        gst_rate: Number(l.gst_rate), is_optional: !!l.is_optional,
        rate: 0, cost_price: 0, margin_pct: null,
        product_id: null, sku_id: null, labour_activity_id: null,
      })),
    })),
  };

  return {
    quotation: {
      id: p.quotation.id,
      firm_id: '',                    // never sent to the client; the server owns it
      boq_id: null,
      quotation_number: p.quotation.quotation_number,
      design_fees: Number(p.quotation.design_fees),
      supervision_fees: Number(p.quotation.supervision_fees),
      other_charges: Number(p.quotation.other_charges),
      discount_pct: Number(p.quotation.discount_pct),
      status: p.quotation.status,
      accepted_at: p.quotation.accepted_at,
      accepted_by_name: p.quotation.accepted_by_name,
      selected_options: Array.isArray(p.quotation.selected_options) ? p.quotation.selected_options : [],
    },
    firm: p.firm,
    boq,
    schedule: p.schedule ? normaliseSchedule(p.schedule) : null,
  };
}

function normaliseSchedule(s: any): ScheduleWithMilestones {
  return {
    total_amount: Number(s.total_amount),
    split_count: Number(s.split_count),
    signed_name: s.signed_name,
    signed_at: s.signed_at,
    milestones: (s.milestones || []).map((m: any) => ({
      split_number: m.split_number, label: m.label, percent: Number(m.percent),
      amount: Number(m.amount), gst_amount: Number(m.gst_amount), total_with_gst: Number(m.total_with_gst),
    })),
  };
}

/**
 * Accept a quotation.
 *
 * The client sends the token, a signatory name, and which optional lines were
 * ticked — and nothing else. Every figure (taxable, GST, grand total, and each
 * milestone) is recomputed from boq_line_items inside accept_quote(), so a
 * tampered request cannot change what the client is billed. It previously took
 * `taxable`, `gst` and `grandTotal` straight from the browser.
 */
export interface AcceptInput {
  token: string;
  name: string;
  selectedOptionalIds: string[];
}

export async function acceptQuote(input: AcceptInput): Promise<ScheduleWithMilestones> {
  const data = await publicVastosApiFetch<any>(`/api/boq/quotes/${input.token}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, selectedOptionalIds: input.selectedOptionalIds }),
  });
  return normaliseSchedule(data);
}
