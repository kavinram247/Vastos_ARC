// ─────────────────────────────────────────────────────────────
// Leads dashboard metrics — single-pass O(n) reducers over the in-memory
// store (reactive via useStore). Pipeline-config agnostic: won/lost derive
// from stage flags (is_won / is_lost), "qualified" = progressed past the first
// active stage, "contacted" = has a recorded contact. For very large tenants
// these move to server-side aggregation RPCs; the registry keeps that swap local.
// ─────────────────────────────────────────────────────────────
import { store } from '../../data/store';
import type { Lead } from '../../types';
import {
  getStages, activeStages, stageByKey, stageColor, isClosedKey, isOverdue, isDueToday,
} from '../logic';
import type { KpiMetric } from './types';

export interface LeadStats {
  total: number; new: number; fresh: number; unassigned: number; assigned: number;
  contacted: number; qualified: number; won: number; lost: number;
  followups_due: number; followups_overdue: number; conversion_rate: number;
  pipeline_value: number; converted: number;
}

const firmLeads = (firmId: string) => store.leads.filter(l => l.firm_id === firmId);

export function computeStats(firmId: string): LeadStats {
  const leads = firmLeads(firmId);
  const firstActive = activeStages(firmId)[0]?.key;
  const s: LeadStats = {
    total: 0, new: 0, fresh: 0, unassigned: 0, assigned: 0, contacted: 0, qualified: 0,
    won: 0, lost: 0, followups_due: 0, followups_overdue: 0, conversion_rate: 0,
    pipeline_value: 0, converted: 0,
  };
  for (const l of leads) {
    s.total++;
    const st = stageByKey(firmId, l.status);
    const closed = isClosedKey(firmId, l.status);
    if (l.assigned_to) s.assigned++; else s.unassigned++;
    if (l.status === 'new') s.new++;
    if (!l.assigned_to && !closed) s.fresh++;
    if (l.last_contact_date) s.contacted++;
    if (!closed && l.status !== firstActive && l.status !== 'new') s.qualified++;
    if (st?.is_won) s.won++;
    if (st?.is_lost) s.lost++;
    if (l.converted_project_id) s.converted++;
    if (!closed) s.pipeline_value += l.estimated_budget || 0;
    if (isOverdue(l, firmId)) s.followups_overdue++;
    else if (isDueToday(l)) s.followups_due++;
  }
  s.conversion_rate = s.total ? Math.round((s.converted / s.total) * 100) : 0;
  return s;
}

// ── KPI metadata (label / accent / formatting) ──
export const KPI_META: Record<KpiMetric, { label: string; accent: 'indigo' | 'emerald' | 'amber' | 'sky' | 'red' | 'slate'; kind: 'count' | 'percent' | 'money' }> = {
  total:              { label: 'Total Leads',        accent: 'slate',   kind: 'count' },
  new:                { label: 'New Leads',          accent: 'sky',     kind: 'count' },
  fresh:              { label: 'Fresh Enquiries',    accent: 'indigo',  kind: 'count' },
  unassigned:         { label: 'Unassigned',         accent: 'amber',   kind: 'count' },
  assigned:           { label: 'Assigned',           accent: 'indigo',  kind: 'count' },
  contacted:          { label: 'Contacted',          accent: 'sky',     kind: 'count' },
  qualified:          { label: 'Qualified',          accent: 'indigo',  kind: 'count' },
  won:                { label: 'Won',                accent: 'emerald', kind: 'count' },
  lost:               { label: 'Lost',               accent: 'red',     kind: 'count' },
  followups_due:      { label: 'Follow-ups Due',     accent: 'amber',   kind: 'count' },
  followups_overdue:  { label: 'Overdue Follow-ups', accent: 'red',     kind: 'count' },
  conversion_rate:    { label: 'Conversion Rate',    accent: 'emerald', kind: 'percent' },
  pipeline_value:     { label: 'Pipeline Value',     accent: 'emerald', kind: 'money' },
};

export const ALL_KPI_METRICS = Object.keys(KPI_META) as KpiMetric[];

// ── Lead distribution (assigned vs unassigned) ──
export function distribution(firmId: string) {
  const s = computeStats(firmId);
  return [
    { label: 'Assigned', value: s.assigned },
    { label: 'Unassigned', value: s.unassigned },
  ];
}

// ── Status breakdown (drives funnel / kanban / pie / bar) ──
export function statusBreakdown(firmId: string) {
  const leads = firmLeads(firmId);
  const counts = new Map<string, number>();
  for (const l of leads) counts.set(l.status, (counts.get(l.status) || 0) + 1);
  return getStages(firmId).map(st => ({
    key: st.key, label: st.label, color: stageColor(st.color).dot,
    count: counts.get(st.key) || 0,
  }));
}

// ── Agent performance ──
export interface AgentRow {
  id: string; name: string; assigned: number; contacted: number;
  qualified: number; won: number; lost: number; conversion: number;
}
export function agentPerformance(firmId: string): AgentRow[] {
  const firstActive = activeStages(firmId)[0]?.key;
  const team = store.profiles.filter(p => p.firm_id === firmId && p.role !== 'client');
  const rows = new Map<string, AgentRow>();
  for (const p of team) rows.set(p.id, { id: p.id, name: p.full_name, assigned: 0, contacted: 0, qualified: 0, won: 0, lost: 0, conversion: 0 });
  for (const l of firmLeads(firmId)) {
    if (!l.assigned_to) continue;
    const r = rows.get(l.assigned_to);
    if (!r) continue;
    r.assigned++;
    const st = stageByKey(firmId, l.status);
    const closed = isClosedKey(firmId, l.status);
    if (l.last_contact_date) r.contacted++;
    if (!closed && l.status !== firstActive && l.status !== 'new') r.qualified++;
    if (st?.is_won) r.won++;
    if (st?.is_lost) r.lost++;
  }
  const out = [...rows.values()].filter(r => r.assigned > 0);
  out.forEach(r => { r.conversion = r.assigned ? Math.round((r.won / r.assigned) * 100) : 0; });
  return out.sort((a, b) => b.won - a.won || b.assigned - a.assigned);
}

// ── Recent activity (lead events from the audit timeline) ──
export interface ActivityRow { id: string; label: string; detail?: string; when: string; action: string; }
export function recentActivity(firmId: string, limit = 12): ActivityRow[] {
  return store.activityLog
    .filter(a => a.firm_id === firmId && a.module === 'lead')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map(a => ({ id: a.id, label: a.action_label, detail: a.details, when: a.created_at, action: a.action }));
}

/** For "My leads" scoping on the dashboard — reuse the same stats over a filtered set. */
export function computeStatsFor(firmId: string, predicate: (l: Lead) => boolean): LeadStats {
  const original = store.leads;
  // cheap, non-mutating: build a temporary firm-scoped filter via closure
  const leads = original.filter(l => l.firm_id === firmId && predicate(l));
  const firstActive = activeStages(firmId)[0]?.key;
  const s: LeadStats = { total: 0, new: 0, fresh: 0, unassigned: 0, assigned: 0, contacted: 0, qualified: 0, won: 0, lost: 0, followups_due: 0, followups_overdue: 0, conversion_rate: 0, pipeline_value: 0, converted: 0 };
  for (const l of leads) {
    s.total++;
    const st = stageByKey(firmId, l.status);
    const closed = isClosedKey(firmId, l.status);
    if (l.assigned_to) s.assigned++; else s.unassigned++;
    if (l.status === 'new') s.new++;
    if (!l.assigned_to && !closed) s.fresh++;
    if (l.last_contact_date) s.contacted++;
    if (!closed && l.status !== firstActive && l.status !== 'new') s.qualified++;
    if (st?.is_won) s.won++;
    if (st?.is_lost) s.lost++;
    if (l.converted_project_id) s.converted++;
    if (!closed) s.pipeline_value += l.estimated_budget || 0;
    if (isOverdue(l, firmId)) s.followups_overdue++;
    else if (isDueToday(l)) s.followups_due++;
  }
  s.conversion_rate = s.total ? Math.round((s.converted / s.total) * 100) : 0;
  return s;
}
