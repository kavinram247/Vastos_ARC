// ─────────────────────────────────────────────────────────────
// Leads module shared logic: access control, configurable-pipeline helpers,
// KPIs, returning-customer matching, lost-reason taxonomy, and the reversible
// convert/un-convert orchestration. Pure-ish helpers over the store.
// ─────────────────────────────────────────────────────────────
import { store } from '../data/store';
import type { Lead, PipelineStage, Contact, LostReasonCategory, InteractionChannel } from '../types';
import { emitEvent, linkTo } from '../lib/events';

// ── access control (§9) — commercial data is owner/architect only ──
export function canViewLeads(role?: string | null): boolean {
  return role === 'owner' || role === 'architect';
}

// ── configurable pipeline (§3.3 / §6.1) ──
export function getStages(firmId: string): PipelineStage[] {
  return store.pipelineStages
    .filter(s => s.firm_id === firmId && s.enabled)
    .sort((a, b) => a.order_index - b.order_index);
}
export const activeStages = (firmId: string) => getStages(firmId).filter(s => s.category === 'active');
export const terminalStages = (firmId: string) => getStages(firmId).filter(s => s.category === 'terminal');
export const stageByKey = (firmId: string, key: string) => store.pipelineStages.find(s => s.firm_id === firmId && s.key === key);
export const wonStage = (firmId: string) => getStages(firmId).find(s => s.is_won);
/** "Closed/dead" = won, lost, or junk — these leave the active pipeline. on_hold stays active (paused deal). */
export function isClosedStage(s?: PipelineStage): boolean {
  return !!s && (s.is_won || s.is_lost || s.key === 'junk');
}
export const isClosedKey = (firmId: string, key: string) => isClosedStage(stageByKey(firmId, key));

const STAGE_COLORS: Record<string, { dot: string; chip: string; text: string }> = {
  sky:     { dot: 'bg-sky-500',     chip: 'bg-sky-50 border-sky-200',         text: 'text-sky-700' },
  violet:  { dot: 'bg-violet-500',  chip: 'bg-violet-50 border-violet-200',   text: 'text-violet-700' },
  amber:   { dot: 'bg-amber-500',   chip: 'bg-amber-50 border-amber-200',     text: 'text-amber-700' },
  indigo:  { dot: 'bg-indigo-500',  chip: 'bg-indigo-50 border-indigo-200',   text: 'text-indigo-700' },
  orange:  { dot: 'bg-orange-500',  chip: 'bg-orange-50 border-orange-200',   text: 'text-orange-700' },
  yellow:  { dot: 'bg-yellow-500',  chip: 'bg-yellow-50 border-yellow-200',   text: 'text-yellow-700' },
  emerald: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  red:     { dot: 'bg-red-500',     chip: 'bg-red-50 border-red-200',         text: 'text-red-700' },
  slate:   { dot: 'bg-slate-400',   chip: 'bg-slate-100 border-slate-300',    text: 'text-slate-600' },
};
export const stageColor = (color?: string | null) => STAGE_COLORS[color || 'slate'] || STAGE_COLORS.slate;

// ── KPIs (§3.1) ──
export interface LeadKpis { total: number; active: number; value: number; conversionRate: number; won: number; }
export function leadKpis(firmId: string): LeadKpis {
  const leads = store.leads.filter(l => l.firm_id === firmId);
  const active = leads.filter(l => !isClosedKey(firmId, l.status));
  const won = leads.filter(l => stageByKey(firmId, l.status)?.is_won);
  const converted = leads.filter(l => l.converted_project_id);
  return {
    total: leads.length,
    active: active.length,
    value: active.reduce((s, l) => s + (l.estimated_budget || 0), 0),
    conversionRate: leads.length ? Math.round((converted.length / leads.length) * 100) : 0,
    won: won.length,
  };
}

// ── overdue / due helpers (§7) ──
export const todayStr = () => new Date().toISOString().split('T')[0];
export function isOverdue(lead: Lead, firmId: string): boolean {
  return !!lead.next_follow_up && lead.next_follow_up < todayStr() && !isClosedKey(firmId, lead.status);
}
export function isDueToday(lead: Lead): boolean {
  return lead.next_follow_up === todayStr();
}

// ── returning-customer recognition (§5.3) ──
export interface ReturningMatch { contact: Contact; priorLeads: Lead[]; }
export function matchReturningCustomer(firmId: string, email?: string | null, phone?: string | null): ReturningMatch | null {
  const contact = store.findContact(firmId, email, phone);
  if (!contact) return null;
  const priorLeads = store.leads.filter(l => l.firm_id === firmId && l.contact_id === contact.id);
  return { contact, priorLeads };
}
/** Ensure a canonical contact exists for these details; returns its id. */
export function ensureContact(firmId: string, full_name: string, email?: string | null, phone?: string | null, company?: string | null): string {
  const existing = store.findContact(firmId, email, phone);
  if (existing) return existing.id;
  return store.addContact({ firm_id: firmId, full_name, email: email || null, phone: phone || null, company: company || null }).id;
}

// ── lost reasons (§6.9) ──
export const LOST_REASONS: { value: LostReasonCategory; label: string }[] = [
  { value: 'price', label: 'Price / budget' },
  { value: 'competition', label: 'Lost to competitor' },
  { value: 'scope', label: 'Scope mismatch' },
  { value: 'timing', label: 'Timing / postponed' },
  { value: 'unresponsive', label: 'Went unresponsive' },
  { value: 'other', label: 'Other' },
];

// ── interaction channels (§8) ──
export const CHANNELS: { value: InteractionChannel; label: string; icon: string }[] = [
  { value: 'call', label: 'Call', icon: 'phone' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'sms', label: 'SMS', icon: 'message-square' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
  { value: 'meeting', label: 'Meeting', icon: 'users' },
  { value: 'meta', label: 'Meta / Social', icon: 'share-2' },
  { value: 'note', label: 'Note', icon: 'file-text' },
];

// ── terminal status (§6.2/§6.3) — saves prev_status for restore/un-convert ──
export function setLeadStage(leadId: string, firmId: string, newKey: string, actorId: string) {
  const lead = store.leads.find(l => l.id === leadId);
  if (!lead || lead.status === newKey) return;
  const patch: Partial<Lead> = { status: newKey as Lead['status'] };
  // entering a terminal stage from an active one → remember where to restore to
  if (isClosedKey(firmId, newKey) && !isClosedKey(firmId, lead.status)) {
    patch.prev_status = lead.status as Lead['status'];
  }
  store.updateLead(leadId, patch);
  const st = stageByKey(firmId, newKey);
  if (st?.is_won) {
    emitEvent({ type: 'lead_won', firmId, actorId, title: `Lead marked Won — ${lead.client_name}`, message: `${lead.project_type || 'Project'} ready to convert`, module: 'lead', action: 'status_changed', entityType: 'lead', entityId: leadId, entityName: lead.client_name, link: linkTo('leads') });
  }
}
export function restoreLead(leadId: string) {
  const lead = store.leads.find(l => l.id === leadId);
  if (!lead) return;
  store.updateLead(leadId, { status: (lead.prev_status || 'new') as Lead['status'], prev_status: null });
}

// ── reversible un-convert (§6.7) ──
export interface UnconvertResult { ok: boolean; reason?: string; }
/** Block if the project already has real money/cost activity, else delete the auto-generated project + children and reopen the lead. */
export function canUnconvert(projectId: string): UnconvertResult {
  const hasPayments = store.paymentsReceived.some(p => p.project_id === projectId);
  const hasCosts = store.costEntries.some(c => c.project_id === projectId);
  const hasSiteUpdates = store.siteUpdates.some(s => s.project_id === projectId);
  if (hasPayments) return { ok: false, reason: 'a payment has already been recorded on the project' };
  if (hasCosts) return { ok: false, reason: 'costs have been logged on the project' };
  if (hasSiteUpdates) return { ok: false, reason: 'site updates exist on the project' };
  return { ok: true };
}
export function unconvertLead(leadId: string, firmId: string, actorId: string): UnconvertResult {
  const lead = store.leads.find(l => l.id === leadId);
  if (!lead || !lead.converted_project_id) return { ok: false, reason: 'lead is not converted' };
  const projectId = lead.converted_project_id;
  const guard = canUnconvert(projectId);
  if (!guard.ok) return guard;

  // delete auto-generated children, then the project
  store.paymentSplits.filter(s => s.project_id === projectId).forEach(s => store.deletePaymentSplit(s.id));
  store.paymentPlans.filter(p => p.project_id === projectId).forEach(p => store.deletePaymentPlan(p.id));
  store.milestones.filter(m => m.project_id === projectId).forEach(m => store.deleteMilestone(m.id));
  store.removeProjectAssignments(firmId, projectId);
  store.deleteProject(projectId);

  store.updateLead(leadId, { status: (lead.prev_status || 'negotiation') as Lead['status'], converted_project_id: undefined, prev_status: null });
  emitEvent({ type: 'project_created', firmId, actorId, title: `Conversion reversed — ${lead.client_name}`, message: `Project deleted; lead reopened`, module: 'lead', action: 'updated', entityType: 'lead', entityId: leadId, entityName: lead.client_name, link: linkTo('leads') });
  return { ok: true };
}
