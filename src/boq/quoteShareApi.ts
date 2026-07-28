// ─────────────────────────────────────────────────────────────
// Public client-quote flow: share token → view → accept/e-sign →
// auto-generate the payment schedule (quote-to-cash spine, Section 10 / deal-maker #2).
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import type { BoqDetail } from './engine/documents';

// database.types.ts is generated and does not yet carry the Phase 2 RPCs.
// Same escape hatch the inventory module uses for its inv_* calls.
const sb = supabase as any;

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
  const { data, error } = await supabase.from('quotations').select('share_token').eq('id', quotationId).single();
  if (error) throw error;
  return (data as any).share_token as string;
}

export async function fetchScheduleForQuotation(quotationId: string): Promise<ScheduleWithMilestones | null> {
  const { data: sched, error } = await supabase.from('payment_schedules')
    .select('id,total_amount,split_count,signed_name,signed_at').eq('quotation_id', quotationId)
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const s = (sched as any[])[0];
  if (!s) return null;
  const { data: ms, error: em } = await supabase.from('payment_milestones')
    .select('split_number,label,percent,amount,gst_amount,total_with_gst').eq('schedule_id', s.id).order('split_number');
  if (em) throw em;
  return {
    total_amount: Number(s.total_amount), split_count: s.split_count, signed_name: s.signed_name, signed_at: s.signed_at,
    milestones: (ms || []).map((m: any) => ({ split_number: m.split_number, label: m.label, percent: Number(m.percent), amount: Number(m.amount), gst_amount: Number(m.gst_amount), total_with_gst: Number(m.total_with_gst) })),
  };
}

// ── Public (unauthenticated) flow — audit C5 ──
// Both calls below go through SECURITY DEFINER RPCs that resolve the quotation
// BY SHARE TOKEN. They are the only two functions `anon` may execute; the
// tables themselves are unreachable without a session. See
// supabase/migrations/20260728030000_security_phase2_c5_quote_accept_rpc.sql.

/** Read a quote by its share token. Also stamps viewed_at server-side. */
export async function fetchPublicQuote(token: string): Promise<PublicQuote> {
  const { data, error } = await sb.rpc('quote_public_view', { p_token: token });
  if (error) throw error;
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
  const { data, error } = await sb.rpc('accept_quote', {
    p_token: input.token,
    p_name: input.name,
    p_selected: input.selectedOptionalIds,
  });
  if (error) throw error;
  return normaliseSchedule(data as any);
}
