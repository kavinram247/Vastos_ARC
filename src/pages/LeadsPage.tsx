import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { formatINR, formatINRCompact, formatDate, timeAgo } from '../utils/format';
import type { Lead, LeadStatus, LeadSource, LeadPriority, InteractionType, Page } from '../types';
import {
  Users, Plus, Search, Phone, Mail, MapPin, IndianRupee,
  CheckCircle2, PhoneCall, FileText, Building2, TrendingUp, UserPlus,
  ChevronDown, ChevronRight, Clock, AlertTriangle,
  Sparkles, Calendar, Ruler, FolderPlus, ArrowRight,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { ConvertLeadModal } from './ConvertLeadModal';

interface LeadsPageProps {
  onNavigate?: (page: Page, projectId?: string) => void;
}

// ─── Config ───
const STATUS: Record<LeadStatus, { label: string; color: string; bg: string; dot: string }> = {
  new:             { label: 'New',            color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200',       dot: 'bg-sky-500' },
  contacted:       { label: 'Contacted',      color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' },
  site_visit:      { label: 'Site Visit',     color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-500' },
  quotation_sent:  { label: 'Quotation Sent', color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  negotiation:     { label: 'Negotiation',    color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  on_hold:         { label: 'On Hold',        color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  won:             { label: 'Won',            color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  lost:            { label: 'Lost',           color: 'text-red-700',     bg: 'bg-red-50 border-red-200',       dot: 'bg-red-500' },
  junk:            { label: 'Junk',           color: 'text-slate-500',   bg: 'bg-slate-100 border-slate-300',  dot: 'bg-slate-400' },
};
const PRIORITY: Record<LeadPriority, { label: string; color: string; ring: string }> = {
  low:    { label: 'Low',    color: 'text-slate-500', ring: 'ring-slate-300' },
  medium: { label: 'Medium', color: 'text-blue-600',  ring: 'ring-blue-300' },
  high:   { label: 'High',   color: 'text-amber-600', ring: 'ring-amber-300' },
  urgent: { label: 'Urgent', color: 'text-red-600',   ring: 'ring-red-300' },
};
const SOURCE: Record<LeadSource, string> = {
  referral: 'Referral', website: 'Website', social_media: 'Social Media',
  walk_in: 'Walk-in', advertisement: 'Advertisement', other: 'Other',
};
const PIPELINE: LeadStatus[] = ['new','contacted','site_visit','quotation_sent','negotiation','on_hold','won','lost','junk'];
const ACTIVE_PIPELINE: LeadStatus[] = ['new','contacted','site_visit','quotation_sent','negotiation','on_hold'];

// ─── Main Component ───
export function LeadsPage({ onNavigate }: LeadsPageProps) {
  const { user, firm } = useAuth();
  const store = useStore();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'actions' | 'pipeline' | 'all'>('actions');
  const [expanded, setExpanded] = useState<Set<LeadStatus>>(new Set(ACTIVE_PIPELINE));
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [interactionFor, setInteractionFor] = useState<string | null>(null);
  const [quotationFor, setQuotationFor] = useState<string | null>(null);
  const [convertFor, setConvertFor] = useState<string | null>(null);

  if (!user || !firm) return null;
  if (user.role !== 'owner' && user.role !== 'architect') {
    return <div className="text-center py-20"><Users className="w-16 h-16 text-slate-200 mx-auto mb-4" /><p className="text-slate-400 text-lg">Leads are only accessible to owners and architects.</p></div>;
  }

  const data = store.forFirm(firm.id);
  const all = data.leads;
  const today = new Date().toISOString().split('T')[0];
  const profile = (id?: string) => id ? data.profiles.find(p => p.id === id) : null;

  // Segments
  const missed = all.filter(l => l.next_follow_up && l.next_follow_up < today && !['won','lost','junk'].includes(l.status));
  const dueToday = all.filter(l => l.next_follow_up === today && !['won','lost','junk'].includes(l.status));
  const newLeads = all.filter(l => l.status === 'new');
  const active = all.filter(l => !['won','lost','junk'].includes(l.status));
  const won = all.filter(l => l.status === 'won');
  const pipelineVal = active.reduce((s, l) => s + (l.estimated_budget || 0), 0);
  const winRate = all.length > 0 ? Math.round((won.length / all.length) * 100) : 0;

  const filtered = all.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.client_name.toLowerCase().includes(q) || l.project_type.toLowerCase().includes(q) || l.project_location?.toLowerCase().includes(q);
  });

  const toggle = (s: LeadStatus) => setExpanded(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  // ─── Lead Card ───
  const LeadCard = ({ lead }: { lead: Lead }) => {
    const a = profile(lead.assigned_to);
    const s = STATUS[lead.status];
    const isOverdue = lead.next_follow_up && lead.next_follow_up < today && !['won','lost','junk'].includes(lead.status);
    const isDueToday = lead.next_follow_up === today;
    return (
      <button onClick={() => setSelected(lead.id)}
        className="w-full text-left group">
        <div className={cn(
          'rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(16,32,26,0.06)] transition-all',
          'hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(16,32,26,0.08)]',
          isOverdue && 'bg-red-50/50 ring-1 ring-red-200'
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
                <h3 className="font-semibold text-slate-900 text-sm truncate">{lead.client_name}</h3>
                <Badge className={cn('border text-[10px] shrink-0', s.bg, s.color)}>{s.label}</Badge>
              </div>
              <p className="text-xs text-slate-500 mb-2">{lead.project_type}{lead.project_location ? ` · ${lead.project_location}` : ''}</p>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                {lead.estimated_budget && <span className="flex items-center gap-0.5 font-medium text-slate-600"><IndianRupee className="w-3 h-3" />{formatINRCompact(lead.estimated_budget)}</span>}
                {lead.estimated_area && <span className="flex items-center gap-0.5"><Ruler className="w-3 h-3" />{lead.estimated_area.toLocaleString()} ft²</span>}
                <span>{SOURCE[lead.source]}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {a && <Avatar name={a.full_name} size="sm" />}
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md', PRIORITY[lead.priority].color, `bg-${lead.priority === 'urgent' ? 'red' : lead.priority === 'high' ? 'amber' : lead.priority === 'medium' ? 'blue' : 'slate'}-50`)}>
                {PRIORITY[lead.priority].label}
              </span>
            </div>
          </div>
          {(isOverdue || isDueToday) && (
            <div className={cn('mt-3 pt-2.5 border-t flex items-center gap-1.5 text-[11px] font-semibold', isOverdue ? 'border-red-100 text-red-600' : 'border-amber-100 text-amber-600')}>
              {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {isOverdue ? `Follow-up overdue since ${formatDate(lead.next_follow_up!)}` : 'Follow-up due today'}
            </div>
          )}
        </div>
      </button>
    );
  };

  // ─── Action tiles data ───
  const actionTiles = [
    { key: 'missed', label: 'Overdue Follow-ups', leads: missed, icon: <AlertTriangle className="w-4 h-4" />, accent: 'bg-red-100 text-red-700', textColor: 'text-red-700', emptyIcon: '✅', emptyText: 'All caught up!' },
    { key: 'today', label: 'Due Today', leads: dueToday, icon: <Clock className="w-4 h-4" />, accent: 'bg-amber-100 text-amber-700', textColor: 'text-amber-700', emptyIcon: '📅', emptyText: 'Nothing scheduled today' },
    { key: 'new', label: 'New Inquiries', leads: newLeads, icon: <Sparkles className="w-4 h-4" />, accent: 'bg-sky-100 text-sky-700', textColor: 'text-sky-700', emptyIcon: '📭', emptyText: 'No new inquiries' },
  ];

  return (
    <div className="space-y-7">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-[28px] font-semibold leading-tight text-slate-900">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            Lead Management
          </h1>
          <p className="text-slate-500 text-sm mt-1.5">Track inquiries, nurture prospects, and close deals</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)}
              className="h-10 w-60 rounded-[9px] border border-slate-200 bg-white pl-10 pr-4 text-sm focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12" />
          </div>
          <Button onClick={() => setShowAdd(true)} className="shadow-sm"><UserPlus className="w-4 h-4" /> Add Lead</Button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="metric-strip metric-strip--five">
        {[
          { label: 'Total Leads', value: all.length, color: 'text-slate-900' },
          { label: 'Active Pipeline', value: active.length, color: 'text-indigo-600' },
          { label: 'Pipeline Value', value: formatINRCompact(pipelineVal), color: 'text-emerald-600' },
          { label: 'Won', value: won.length, color: 'text-emerald-600' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'text-indigo-700' },
        ].map(kpi => (
          <div key={kpi.label} className="metric-cell">
            <div className="metric-label">{kpi.label}</div>
            <div className={cn('metric-value', kpi.color)}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── View Tabs ── */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: 'actions' as const, label: 'Priority Actions', count: missed.length + dueToday.length + newLeads.length },
          { key: 'pipeline' as const, label: 'Pipeline View' },
          { key: 'all' as const, label: 'All Leads', count: filtered.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── TAB: Priority Actions ── */}
      {tab === 'actions' && (
        <div className="space-y-6">
          {actionTiles.map(tile => (
            <div key={tile.key}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tile.accent)}>
                  {tile.icon}
                </div>
                <div>
                  <h2 className={cn('font-bold text-sm', tile.textColor)}>{tile.label}</h2>
                  <p className="text-[11px] text-slate-400">{tile.leads.length} lead{tile.leads.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {tile.leads.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tile.leads.map(l => <LeadCard key={l.id} lead={l} />)}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 py-8 text-center">
                  <span className="text-2xl">{tile.emptyIcon}</span>
                  <p className="text-sm text-slate-400 mt-2">{tile.emptyText}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Pipeline View ── */}
      {tab === 'pipeline' && (
        <div className="space-y-3">
          {PIPELINE.map(stage => {
            const leads = filtered.filter(l => l.status === stage);
            const isOpen = expanded.has(stage);
            const s = STATUS[stage];
            const val = leads.reduce((sum, l) => sum + (l.estimated_budget || 0), 0);
            return (
              <div key={stage} className={cn('rounded-xl border overflow-hidden transition-all', leads.length > 0 ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-40')}>
                <button onClick={() => toggle(stage)} className={cn('w-full flex items-center justify-between px-5 py-3.5', s.bg, 'transition-colors')}>
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <span className={cn('w-2.5 h-2.5 rounded-full', s.dot)} />
                    <span className={cn('font-semibold text-sm', s.color)}>{s.label}</span>
                    <span className="text-xs bg-white/70 text-slate-600 px-2 py-0.5 rounded-full font-medium">{leads.length}</span>
                  </div>
                  {val > 0 && <span className="text-xs font-medium text-slate-500">{formatINRCompact(val)}</span>}
                </button>
                {isOpen && (
                  <div className="bg-white p-3">
                    {leads.length > 0 ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {leads.map(l => <LeadCard key={l.id} lead={l} />)}
                      </div>
                    ) : (
                      <p className="py-6 text-center text-xs text-slate-400">No leads in this stage</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: All Leads ── */}
      {tab === 'all' && (
        <div>
          {filtered.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(l => <LeadCard key={l.id} lead={l} />)}
            </div>
          ) : (
            <div className="text-center py-16"><Users className="w-14 h-14 text-slate-200 mx-auto mb-3" /><p className="text-slate-400">No leads match your search.</p></div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} firmId={firm.id} userId={user.id} teamMembers={data.profiles.filter(p => p.role !== 'client')} />
      {selected && <LeadDetailModal open={!!selected} onClose={() => setSelected(null)} leadId={selected} firmId={firm.id}
        onLogInteraction={() => setInteractionFor(selected)} onCreateQuotation={() => setQuotationFor(selected)}
        onConvert={() => setConvertFor(selected)}
        onViewProject={() => { const l = store.forFirm(firm.id).leads.find(x => x.id === selected); if (l?.converted_project_id) { setSelected(null); onNavigate?.('project-detail', l.converted_project_id); } }} />}
      {interactionFor && <LogInteractionModal open onClose={() => setInteractionFor(null)} leadId={interactionFor} firmId={firm.id} userId={user.id} />}
      {quotationFor && <CreateQuotationModal open onClose={() => setQuotationFor(null)} leadId={quotationFor} firmId={firm.id} userId={user.id} />}
      {convertFor && <ConvertLeadModal leadId={convertFor} firmId={firm.id} userId={user.id}
        onClose={() => setConvertFor(null)}
        onConverted={(projectId) => { setConvertFor(null); setSelected(null); onNavigate?.('project-detail', projectId); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADD LEAD MODAL
// ═══════════════════════════════════════════════════════════════
function AddLeadModal({ open, onClose, firmId, userId, teamMembers }: {
  open: boolean; onClose: () => void; firmId: string; userId: string; teamMembers: { id: string; full_name: string }[];
}) {
  const store = useStore();
  const [form, setForm] = useState({ client_name: '', client_email: '', client_phone: '', client_company: '', project_type: '', project_location: '', estimated_budget: '', estimated_area: '', project_requirements: '', source: 'referral' as LeadSource, priority: 'medium' as LeadPriority, assigned_to: userId, expected_start_date: '' });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name || !form.client_phone || !form.project_type) return;
    store.addLead({ firm_id: firmId, client_name: form.client_name, client_email: form.client_email || undefined, client_phone: form.client_phone, client_whatsapp: form.client_phone, client_company: form.client_company || undefined, project_type: form.project_type, project_location: form.project_location || undefined, estimated_budget: form.estimated_budget ? parseFloat(form.estimated_budget) : undefined, estimated_area: form.estimated_area ? parseFloat(form.estimated_area) : undefined, project_requirements: form.project_requirements || undefined, status: 'new', source: form.source, priority: form.priority, assigned_to: form.assigned_to || undefined, inquiry_date: new Date().toISOString().split('T')[0], expected_start_date: form.expected_start_date || undefined, created_by: userId });
    setForm({ client_name: '', client_email: '', client_phone: '', client_company: '', project_type: '', project_location: '', estimated_budget: '', estimated_area: '', project_requirements: '', source: 'referral', priority: 'medium', assigned_to: userId, expected_start_date: '' });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add New Lead" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4"><Input label="Client Name *" required value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Rajesh Malhotra" /><Input label="Company" value={form.client_company} onChange={e => setForm(f => ({ ...f, client_company: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4"><Input label="Phone *" required value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} placeholder="+91 98765 43210" /><Input label="Email" type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4"><Input label="Project Type *" required value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))} placeholder="Residential Villa, Commercial..." /><Input label="Location" value={form.project_location} onChange={e => setForm(f => ({ ...f, project_location: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4"><Input label="Budget (₹)" type="number" value={form.estimated_budget} onChange={e => setForm(f => ({ ...f, estimated_budget: e.target.value }))} /><Input label="Area (sq.ft)" type="number" value={form.estimated_area} onChange={e => setForm(f => ({ ...f, estimated_area: e.target.value }))} /></div>
        <Textarea label="Requirements" value={form.project_requirements} onChange={e => setForm(f => ({ ...f, project_requirements: e.target.value }))} rows={3} />
        <div className="grid grid-cols-3 gap-4">
          <Select label="Source" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as LeadSource }))} options={[{ value: 'referral', label: 'Referral' },{ value: 'website', label: 'Website' },{ value: 'social_media', label: 'Social Media' },{ value: 'walk_in', label: 'Walk-in' },{ value: 'advertisement', label: 'Advertisement' },{ value: 'other', label: 'Other' }]} />
          <Select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as LeadPriority }))} options={[{ value: 'low', label: 'Low' },{ value: 'medium', label: 'Medium' },{ value: 'high', label: 'High' },{ value: 'urgent', label: 'Urgent' }]} />
          <Select label="Assign To" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} options={[{ value: '', label: 'Unassigned' },...teamMembers.map(m => ({ value: m.id, label: m.full_name }))]} />
        </div>
        <div className="flex justify-end gap-3 pt-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit"><Plus className="w-4 h-4" /> Add Lead</Button></div>
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// LEAD DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function LeadDetailModal({ open, onClose, leadId, firmId, onLogInteraction, onCreateQuotation, onConvert, onViewProject }: {
  open: boolean; onClose: () => void; leadId: string; firmId: string;
  onLogInteraction: () => void; onCreateQuotation: () => void; onConvert: () => void; onViewProject: () => void;
}) {
  const store = useStore();
  const d = store.forFirm(firmId);
  const lead = d.leads.find(l => l.id === leadId);
  const interactions = d.leadInteractions.filter(i => i.lead_id === leadId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const quotations = d.leadQuotations.filter(q => q.lead_id === leadId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const [activeTab, setActiveTab] = useState<'overview' | 'interactions' | 'quotations'>('overview');
  const [schedType, setSchedType] = useState<InteractionType>('site_visit');
  const [schedDate, setSchedDate] = useState('');
  const [schedSubject, setSchedSubject] = useState('');
  const [schedFeedback, setSchedFeedback] = useState('');

  if (!lead) return null;
  const assignee = d.profiles.find(p => p.id === lead.assigned_to);
  const s = STATUS[lead.status];
  const intIcons: Record<InteractionType, React.ReactNode> = { call: <Phone className="w-4 h-4" />, email: <Mail className="w-4 h-4" />, meeting: <Users className="w-4 h-4" />, site_visit: <MapPin className="w-4 h-4" />, whatsapp: <Phone className="w-4 h-4" />, other: <FileText className="w-4 h-4" /> };

  const setStatus = (ns: LeadStatus) => store.updateLead(leadId, { status: ns });
  const schedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedDate || !schedSubject.trim()) return;
    store.addLeadInteraction({ firm_id: firmId, lead_id: leadId, type: schedType, subject: `[Scheduled] ${schedSubject.trim()}`, description: `Scheduled ${schedType.replace('_', ' ')}`, scheduled_at: schedDate, logged_by: d.profiles[0]?.id || 'system' });
    store.updateLead(leadId, { next_follow_up: schedDate });
    setSchedFeedback(`Scheduled for ${formatDate(schedDate)}`);
    setSchedSubject(''); setSchedDate('');
    setTimeout(() => setSchedFeedback(''), 3000);
  };

  // Pipeline stepper — main 5 stages
  const mainStages: LeadStatus[] = ['new', 'contacted', 'site_visit', 'quotation_sent', 'negotiation'];
  const curIdx = mainStages.indexOf(lead.status);
  const isTerminal = ['won', 'lost', 'on_hold', 'junk'].includes(lead.status);

  return (
    <Modal open={open} onClose={onClose} title="" size="xl">
      <div className="-mx-6 -mt-4">
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900">{lead.client_name}</h2>
                <Badge className={cn('border', s.bg, s.color)}>{s.label}</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">{lead.project_type}{lead.project_location ? ` · ${lead.project_location}` : ''}</p>
              {lead.estimated_budget && <p className="text-sm font-semibold text-slate-700 mt-1">{formatINR(lead.estimated_budget)}{lead.estimated_area ? <span className="font-normal text-slate-400"> · {lead.estimated_area.toLocaleString()} sq.ft</span> : ''}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="secondary" onClick={onLogInteraction}><PhoneCall className="w-3.5 h-3.5" /> Log</Button>
              <Button size="sm" variant="secondary" onClick={onCreateQuotation}><FileText className="w-3.5 h-3.5" /> Quote</Button>
              {lead.converted_project_id ? (
                <Button size="sm" variant="secondary" onClick={onViewProject}><FolderPlus className="w-3.5 h-3.5" /> View project <ArrowRight className="w-3.5 h-3.5" /></Button>
              ) : (
                <Button size="sm" variant="success" onClick={onConvert}><FolderPlus className="w-3.5 h-3.5" /> Convert <ArrowRight className="w-3.5 h-3.5" /></Button>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div className="px-6 py-4 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opportunity Pipeline</span>
            {isTerminal && <Badge className={cn('border', s.bg, s.color)}>{s.label}</Badge>}
          </div>
          <div className="flex items-center">
            {mainStages.map((stage, idx) => {
              const isCur = lead.status === stage;
              const isPast = curIdx > idx && !isTerminal;
              const sc = STATUS[stage];
              return (
                <div key={stage} className="flex items-center flex-1 last:flex-none">
                  <button onClick={() => setStatus(stage)} className="flex flex-col items-center gap-1.5 group relative" title={`Set to ${sc.label}`}>
                    <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all text-xs font-bold',
                      isCur ? cn('border-current text-white', sc.dot) : isPast ? 'border-indigo-400 bg-indigo-100 text-indigo-600' : 'border-slate-200 bg-white text-slate-400 group-hover:border-indigo-300')}>
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={cn('text-[10px] font-medium whitespace-nowrap', isCur ? sc.color : isPast ? 'text-indigo-600' : 'text-slate-400')}>{sc.label}</span>
                  </button>
                  {idx < mainStages.length - 1 && <div className={cn('flex-1 h-0.5 mx-1 rounded', isPast || (curIdx > idx && !isTerminal) ? 'bg-indigo-400' : 'bg-slate-200')} />}
                </div>
              );
            })}
          </div>
          {/* Terminal actions */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            {(['won', 'lost', 'on_hold', 'junk'] as LeadStatus[]).map(st => {
              const sc = STATUS[st];
              return (
                <button key={st} onClick={() => setStatus(st)}
                  className={cn('px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all',
                    lead.status === st ? cn('text-white', sc.dot, 'border-transparent') : cn(sc.bg, sc.color, 'hover:opacity-80'))}>
                  {sc.label}
                </button>
              );
            })}
            {lead.status === 'junk' && <button onClick={() => setStatus('new')} className="px-3 py-1 rounded-lg text-[11px] font-semibold border border-sky-200 bg-sky-50 text-sky-700">↩ Restore</button>}
          </div>
        </div>

        {/* Quick Scheduler */}
        <div className="px-6 py-3 bg-indigo-50/50 border-b border-indigo-100/50">
          <form onSubmit={schedule} className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-semibold text-slate-700">Schedule</span>
            </div>
            <select value={schedType} onChange={e => setSchedType(e.target.value as InteractionType)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="site_visit">Site Visit</option><option value="meeting">Meeting</option><option value="call">Call</option>
            </select>
            <input type="text" required value={schedSubject} onChange={e => setSchedSubject(e.target.value)} placeholder="Subject..." className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white" />
            <input type="date" required value={schedDate} onChange={e => setSchedDate(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
            <Button type="submit" size="sm">Schedule</Button>
            {schedFeedback && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{schedFeedback}</span>}
          </form>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {(['overview','interactions','quotations'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={cn('px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600')}>
              {t === 'overview' ? 'Overview' : t === 'interactions' ? 'Interactions' : 'Quotations'}
              {t === 'interactions' && interactions.length > 0 && <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 rounded-full">{interactions.length}</span>}
              {t === 'quotations' && quotations.length > 0 && <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 rounded-full">{quotations.length}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[40vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Contact Information</h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Phone className="w-4 h-4 text-slate-500" /></div><span>{lead.client_phone}</span></div>
                    {lead.client_email && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Mail className="w-4 h-4 text-slate-500" /></div><span>{lead.client_email}</span></div>}
                    {lead.client_company && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Building2 className="w-4 h-4 text-slate-500" /></div><span>{lead.client_company}</span></div>}
                  </div>
                </div>
                {lead.project_requirements && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Requirements</h4>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">{lead.project_requirements}</p>
                  </div>
                )}
              </div>
              <div className="space-y-5">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Lead Details</h4>
                  <div className="bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100">
                    {[
                      ['Source', SOURCE[lead.source]],
                      ['Priority', PRIORITY[lead.priority].label],
                      ['Assigned To', assignee?.full_name || 'Unassigned'],
                      ['Inquiry Date', formatDate(lead.inquiry_date)],
                      lead.expected_start_date ? ['Expected Start', formatDate(lead.expected_start_date)] : null,
                      lead.last_contact_date ? ['Last Contact', formatDate(lead.last_contact_date)] : null,
                      lead.next_follow_up ? ['Follow-up', formatDate(lead.next_follow_up)] : null,
                    ].filter((r): r is [string, string] => r !== null).map(([label, val]) => (
                      <div key={label} className="flex justify-between px-3 py-2.5 text-sm">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-medium text-slate-800">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {lead.tags && lead.tags.length > 0 && <div><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tags</h4><div className="flex flex-wrap gap-1.5">{lead.tags.map(t => <span key={t} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium">{t}</span>)}</div></div>}
                {lead.notes && <div><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</h4><p className="text-sm text-slate-600 whitespace-pre-wrap">{lead.notes}</p></div>}
                {lead.lost_reason && <div className="p-3 bg-red-50 rounded-lg border border-red-200"><h4 className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Lost Reason</h4><p className="text-sm text-red-700">{lead.lost_reason}</p></div>}
              </div>
            </div>
          )}
          {activeTab === 'interactions' && (
            <div className="space-y-3">
              {interactions.length === 0 ? <div className="text-center py-12 text-slate-400"><PhoneCall className="w-10 h-10 mx-auto mb-2 text-slate-200" /><p>No interactions logged yet.</p></div> : interactions.map(int => (
                <div key={int.id} className="flex gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-200 shrink-0 text-slate-500">{intIcons[int.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm text-slate-900">{int.subject}</span><span className="text-[10px] text-slate-400 shrink-0">{timeAgo(int.created_at)}</span></div>
                    <p className="text-sm text-slate-600 mt-1">{int.description}</p>
                    <div className="flex gap-4 mt-2 text-xs">
                      {int.outcome && <span className="text-slate-500"><b>Outcome:</b> {int.outcome}</span>}
                      {int.next_steps && <span className="text-indigo-600"><b>Next:</b> {int.next_steps}</span>}
                    </div>
                    {int.scheduled_at && <div className="mt-2 text-xs font-semibold text-indigo-600 flex items-center gap-1"><Calendar className="w-3 h-3" /> Scheduled: {formatDate(int.scheduled_at)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'quotations' && (
            <div className="space-y-3">
              {quotations.length === 0 ? <div className="text-center py-12 text-slate-400"><FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" /><p>No quotations created yet.</p></div> : quotations.map(q => (
                <div key={q.id} className="p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between"><div><span className="font-bold text-slate-900">{q.quotation_number}</span><span className="text-xs text-slate-400 ml-2">v{q.version}</span></div><Badge variant={q.status === 'accepted' ? 'success' : q.status === 'rejected' ? 'error' : q.status === 'sent' ? 'info' : 'default'}>{q.status}</Badge></div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">{formatINR(q.total_amount)}</div>
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{q.scope_of_work}</p>
                  <div className="text-[10px] text-slate-400 mt-2">{formatDate(q.created_at)}{q.sent_at ? ` · Sent ${formatDate(q.sent_at)}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOG INTERACTION MODAL
// ═══════════════════════════════════════════════════════════════
function LogInteractionModal({ open, onClose, leadId, firmId, userId }: { open: boolean; onClose: () => void; leadId: string; firmId: string; userId: string }) {
  const store = useStore();
  const [form, setForm] = useState({ type: 'call' as InteractionType, subject: '', description: '', outcome: '', next_steps: '', next_follow_up: '' });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.description) return;
    store.addLeadInteraction({ firm_id: firmId, lead_id: leadId, type: form.type, subject: form.subject, description: form.description, outcome: form.outcome || undefined, next_steps: form.next_steps || undefined, logged_by: userId });
    if (form.next_follow_up) store.updateLead(leadId, { next_follow_up: form.next_follow_up });
    setForm({ type: 'call', subject: '', description: '', outcome: '', next_steps: '', next_follow_up: '' });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Log Interaction" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as InteractionType }))} options={[{ value: 'call', label: '📞 Phone Call' },{ value: 'email', label: '📧 Email' },{ value: 'meeting', label: '🤝 Meeting' },{ value: 'site_visit', label: '📍 Site Visit' },{ value: 'other', label: '📋 Other' }]} />
        <Input label="Subject *" required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
        <Textarea label="Description *" required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
        <Input label="Outcome" value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} />
        <Input label="Next Steps" value={form.next_steps} onChange={e => setForm(f => ({ ...f, next_steps: e.target.value }))} />
        <Input label="Schedule Follow-up" type="date" value={form.next_follow_up} onChange={e => setForm(f => ({ ...f, next_follow_up: e.target.value }))} />
        <div className="flex justify-end gap-3 pt-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit"><PhoneCall className="w-4 h-4" /> Log</Button></div>
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATE QUOTATION MODAL
// ═══════════════════════════════════════════════════════════════
function CreateQuotationModal({ open, onClose, leadId, firmId, userId }: { open: boolean; onClose: () => void; leadId: string; firmId: string; userId: string }) {
  const store = useStore();
  const d = store.forFirm(firmId);
  const lead = d.leads.find(l => l.id === leadId);
  const existing = d.leadQuotations.filter(q => q.lead_id === leadId);
  const [form, setForm] = useState({ estimated_cost: lead?.estimated_budget?.toString() || '', design_fees: '', supervision_fees: '', other_charges: '', scope_of_work: '', inclusions: '', exclusions: '', validity_days: '30' });
  const total = (parseFloat(form.estimated_cost) || 0) + (parseFloat(form.design_fees) || 0) + (parseFloat(form.supervision_fees) || 0) + (parseFloat(form.other_charges) || 0);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.scope_of_work) return;
    const num = `QT-${new Date().getFullYear()}-${String(existing.length + d.leadQuotations.length + 1).padStart(3, '0')}`;
    store.addLeadQuotation({ firm_id: firmId, lead_id: leadId, quotation_number: num, version: existing.length + 1, estimated_cost: parseFloat(form.estimated_cost) || 0, design_fees: parseFloat(form.design_fees) || 0, supervision_fees: parseFloat(form.supervision_fees) || 0, other_charges: parseFloat(form.other_charges) || 0, total_amount: total, scope_of_work: form.scope_of_work, inclusions: form.inclusions || undefined, exclusions: form.exclusions || undefined, validity_days: parseInt(form.validity_days) || 30, status: 'draft', created_by: userId });
    store.updateLead(leadId, { status: 'quotation_sent' });
    setForm({ estimated_cost: '', design_fees: '', supervision_fees: '', other_charges: '', scope_of_work: '', inclusions: '', exclusions: '', validity_days: '30' });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Create Quotation" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-50 p-3 rounded-lg text-sm"><b>{lead?.client_name}</b> — {lead?.project_type}</div>
        <div className="grid grid-cols-2 gap-4"><Input label="Estimated Cost (₹)" type="number" value={form.estimated_cost} onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))} /><Input label="Design Fees (₹)" type="number" value={form.design_fees} onChange={e => setForm(f => ({ ...f, design_fees: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4"><Input label="Supervision Fees (₹)" type="number" value={form.supervision_fees} onChange={e => setForm(f => ({ ...f, supervision_fees: e.target.value }))} /><Input label="Other Charges (₹)" type="number" value={form.other_charges} onChange={e => setForm(f => ({ ...f, other_charges: e.target.value }))} /></div>
        <div className="rounded-xl bg-indigo-50 p-4 text-center"><div className="text-xs font-medium text-indigo-600">Total Amount</div><div className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-indigo-800">{formatINR(total)}</div></div>
        <Textarea label="Scope of Work *" required value={form.scope_of_work} onChange={e => setForm(f => ({ ...f, scope_of_work: e.target.value }))} rows={4} />
        <div className="grid grid-cols-2 gap-4"><Textarea label="Inclusions" value={form.inclusions} onChange={e => setForm(f => ({ ...f, inclusions: e.target.value }))} rows={2} /><Textarea label="Exclusions" value={form.exclusions} onChange={e => setForm(f => ({ ...f, exclusions: e.target.value }))} rows={2} /></div>
        <Input label="Validity (days)" type="number" value={form.validity_days} onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))} />
        <div className="flex justify-end gap-3 pt-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit"><FileText className="w-4 h-4" /> Create</Button></div>
      </form>
    </Modal>
  );
}
