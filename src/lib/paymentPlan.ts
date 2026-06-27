// ─────────────────────────────────────────────────────────────
// Payment-plan + starter-milestone generators. Shared by the Convert-to-Project
// wizard and the Payments "set up plan" builder so the schedule is never
// re-entered by hand. Split #1 is a date-triggered booking advance (due now);
// the rest are milestone-triggered when starter milestones are created.
// ─────────────────────────────────────────────────────────────
import type { PaymentSplit, Milestone } from '../types';

export const PLAN_PRESETS: { label: string; percents: number[] }[] = [
  { label: '10 / 40 / 40 / 10', percents: [10, 40, 40, 10] },
  { label: '25 / 25 / 25 / 25', percents: [25, 25, 25, 25] },
  { label: '30 / 40 / 30', percents: [30, 40, 30] },
  { label: '50 / 50', percents: [50, 50] },
];

export const STARTER_MILESTONES = ['Design & Drawings', 'Material Procurement', 'Execution', 'Finishing & Handover'];

const r2 = (n: number) => Math.round(n * 100) / 100;
const dateStr = (d: Date) => d.toISOString().split('T')[0];

export interface BuildSplitsOpts {
  firmId: string;
  projectId: string;
  paymentPlanId: string;
  totalValue: number;
  percents: number[];
  gstRate?: number;
  startDate?: string;
  endDate?: string;
  milestoneIds?: string[]; // optional; links splits 2..N to milestones for auto-trigger
}

/** Build split rows (without id/created_at — the store assigns those). */
export function buildSplits(opts: BuildSplitsOpts): Omit<PaymentSplit, 'id' | 'created_at'>[] {
  const gstRate = opts.gstRate ?? 18;
  return opts.percents.map((pct, i) => {
    const amount = r2((opts.totalValue * pct) / 100);
    const gst_amount = r2((amount * gstRate) / 100);
    const milestoneId = i > 0 && opts.milestoneIds ? opts.milestoneIds[i - 1] : undefined;
    return {
      firm_id: opts.firmId,
      payment_plan_id: opts.paymentPlanId,
      project_id: opts.projectId,
      split_number: i + 1,
      amount,
      trigger_type: (milestoneId ? 'milestone' : 'date') as PaymentSplit['trigger_type'],
      trigger_date: milestoneId ? undefined : (i === 0 ? opts.startDate : opts.endDate),
      trigger_milestone_id: milestoneId,
      status: (i === 0 ? 'due' : 'scheduled') as PaymentSplit['status'],
      gst_rate: gstRate,
      gst_amount,
      total_with_gst: r2(amount + gst_amount),
    };
  });
}

/** Build starter milestone rows spread across the project timeline. */
export function buildStarterMilestones(opts: { firmId: string; projectId: string; startDate?: string; endDate?: string }): Omit<Milestone, 'id' | 'created_at'>[] {
  const start = opts.startDate ? new Date(opts.startDate) : new Date();
  const end = opts.endDate ? new Date(opts.endDate) : new Date(start.getTime() + 120 * 864e5);
  const span = Math.max(1, (end.getTime() - start.getTime())) / STARTER_MILESTONES.length;
  return STARTER_MILESTONES.map((name, i) => ({
    firm_id: opts.firmId,
    project_id: opts.projectId,
    name,
    planned_start: dateStr(new Date(start.getTime() + span * i)),
    planned_end: dateStr(new Date(start.getTime() + span * (i + 1))),
    status: 'not_started' as Milestone['status'],
    order_index: i,
  }));
}
