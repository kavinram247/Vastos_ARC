// ─────────────────────────────────────────────────────────────
// Public client-quote flow: share token → view → accept/e-sign →
// auto-generate the payment schedule (quote-to-cash spine, Section 10 / deal-maker #2).
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { fetchBoqDetail } from './quotationApi';
import type { BoqDetail } from './engine/documents';

// Standard Indian interior 4-stage plan (firm-configurable later).
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

export async function fetchPublicQuote(token: string): Promise<PublicQuote> {
  const { data: q, error: eq } = await supabase.from('quotations')
    .select('id,firm_id,boq_id,quotation_number,design_fees,supervision_fees,other_charges,discount_pct,status,accepted_at,accepted_by_name,selected_options')
    .eq('share_token', token).single();
  if (eq) throw eq;
  const quotation = q as any;
  const [{ data: firm, error: ef }, boq] = await Promise.all([
    supabase.from('firms').select('name,address,gstin,logo_url').eq('id', quotation.firm_id).single(),
    quotation.boq_id ? fetchBoqDetail(quotation.boq_id) : Promise.resolve({ id: '', title: '', status: '', region_id: null, sections: [] } as BoqDetail),
  ]);
  if (ef) throw ef;
  const schedule = quotation.status === 'accepted' ? await fetchScheduleForQuotation(quotation.id) : null;
  return {
    quotation: {
      id: quotation.id, firm_id: quotation.firm_id, boq_id: quotation.boq_id, quotation_number: quotation.quotation_number,
      design_fees: Number(quotation.design_fees), supervision_fees: Number(quotation.supervision_fees),
      other_charges: Number(quotation.other_charges), discount_pct: Number(quotation.discount_pct),
      status: quotation.status, accepted_at: quotation.accepted_at, accepted_by_name: quotation.accepted_by_name,
      selected_options: Array.isArray(quotation.selected_options) ? quotation.selected_options : [],
    },
    firm: firm as any, boq, schedule,
  };
}

export async function markViewed(token: string): Promise<void> {
  await supabase.from('quotations').update({ viewed_at: new Date().toISOString() } as any)
    .eq('share_token', token).is('viewed_at', null);
  await supabase.from('quotations').update({ status: 'viewed' } as any)
    .eq('share_token', token).in('status', ['draft', 'sent']);
}

export interface AcceptInput {
  quotationId: string; firmId: string; boqId: string | null; name: string;
  selectedOptionalIds: string[]; taxable: number; gst: number; grandTotal: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function acceptQuote(input: AcceptInput): Promise<ScheduleWithMilestones> {
  const now = new Date().toISOString();
  const { error: eu } = await supabase.from('quotations').update({
    status: 'accepted', accepted_at: now, accepted_by_name: input.name,
    selected_options: input.selectedOptionalIds, viewed_at: now,
  } as any).eq('id', input.quotationId);
  if (eu) throw eu;

  const { data: sched, error: es } = await supabase.from('payment_schedules').insert({
    firm_id: input.firmId, quotation_id: input.quotationId, boq_id: input.boqId,
    total_amount: input.grandTotal, split_count: PAYMENT_STAGES.length, signed_name: input.name, signed_at: now,
  } as any).select('id').single();
  if (es) throw es;
  const scheduleId = (sched as any).id;

  const milestones = PAYMENT_STAGES.map((stage, i) => {
    const amount = r2((stage.percent / 100) * input.taxable);
    const gst_amount = r2((stage.percent / 100) * input.gst);
    return {
      firm_id: input.firmId, schedule_id: scheduleId, split_number: i + 1, label: stage.label,
      percent: stage.percent, amount, gst_amount, total_with_gst: r2(amount + gst_amount), trigger_type: 'milestone',
    };
  });
  const { error: em } = await supabase.from('payment_milestones').insert(milestones as any);
  if (em) throw em;

  return {
    total_amount: input.grandTotal, split_count: PAYMENT_STAGES.length, signed_name: input.name, signed_at: now,
    milestones: milestones.map((m) => ({ split_number: m.split_number, label: m.label, percent: m.percent, amount: m.amount, gst_amount: m.gst_amount, total_with_gst: m.total_with_gst })),
  };
}
