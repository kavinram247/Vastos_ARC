import { useState, useMemo, useDeferredValue } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { formatINRCompact } from '../utils/format';
import type { Page, Lead } from '../types';
import {
  getStages, leadKpis, stageByKey, stageColor,
  isOverdue, isDueToday,
} from './logic';
import { AddLeadModal } from './AddLeadModal';
import { LeadDetailModal } from './LeadDetailModal';
import {
  TrendingUp, Search, UserPlus, Settings, AlertTriangle, Clock, Sparkles,
  IndianRupee, Ruler, Lock, ArrowUpDown,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props { onNavigate?: (page: Page, projectId?: string) => void; }
type Tab = 'actions' | 'pipeline' | 'all';

export function LeadsPage({ onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can, canAccess } = usePermissions();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [tab, setTab] = useState<Tab>('actions');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<'recent' | 'value' | 'name'>('recent');

  if (!user || !firm) return null;
  if (!canAccess('leads')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><Lock className="w-6 h-6 text-slate-400" /></div>
        <p className="mt-4 text-lg font-semibold text-slate-700">Leads are restricted</p>
        <p className="mt-1 text-sm text-slate-400">Only owners and architects can view commercial pipeline data.</p>
      </div>
    );
  }

  const firmId = firm.id;
  const allLeads = store.leads.filter(l => l.firm_id === firmId);
  const kpis = leadKpis(firmId);
  const stages = getStages(firmId);
  const profile = (id?: string) => id ? store.profiles.find(p => p.id === id) : null;

  // search across name / project / contact / tags
  const q = deferredSearch.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return allLeads;
    return allLeads.filter(l =>
      `${l.client_name} ${l.client_company || ''} ${l.project_type || ''} ${l.project_location || ''} ${l.client_email || ''} ${l.client_phone || ''} ${(l.tags || []).join(' ')}`
        .toLowerCase().includes(q));
  }, [allLeads, q]);

  // priority segments
  const missed = filtered.filter(l => isOverdue(l, firmId));
  const dueToday = filtered.filter(l => isDueToday(l) && !isOverdue(l, firmId) && stageByKey(firmId, l.status)?.category !== 'terminal');
  const fresh = filtered.filter(l => l.status === 'new');

  const sortLeads = (list: Lead[]) => [...list].sort((a, b) => {
    if (sort === 'value') return (b.estimated_budget || 0) - (a.estimated_budget || 0);
    if (sort === 'name') return a.client_name.localeCompare(b.client_name);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10"><TrendingUp className="h-5 w-5 text-indigo-600" /></span>
            Leads
          </h1>
          <p className="mt-1 text-sm text-slate-500">Capture every inquiry, act on the right ones, and convert deals into live projects.</p>
        </div>
        <div className="flex items-center gap-2">
          {can('leads', 'edit') && (
            <Button variant="secondary" size="sm" onClick={() => onNavigate?.('leads-admin')}><Settings className="w-4 h-4" /> Admin</Button>
          )}
          {can('leads', 'create') && <Button size="sm" onClick={() => setShowAdd(true)}><UserPlus className="w-4 h-4" /> Add lead</Button>}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total leads" value={String(kpis.total)} />
        <Kpi label="Active pipeline" value={String(kpis.active)} accent="indigo" />
        <Kpi label="Value at stake" value={formatINRCompact(kpis.value)} accent="emerald" />
        <Kpi label="Conversion rate" value={`${kpis.conversionRate}%`} accent="indigo" sub={`${kpis.won} won`} />
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, project, contact, tags…"
            className="h-10 w-full rounded-[10px] border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12" />
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
          {([
            { key: 'actions' as const, label: 'Priority Actions', badge: missed.length + dueToday.length + fresh.length },
            { key: 'pipeline' as const, label: 'Pipeline' },
            { key: 'all' as const, label: 'All Leads', badge: filtered.length },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all', tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t.label}{t.badge !== undefined && <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* TAB: Priority Actions */}
      {tab === 'actions' && (
        <div className="space-y-6">
          <ActionGroup title="Overdue follow-ups" sub="Reach out now" tone="red" icon={<AlertTriangle className="w-4 h-4" />} leads={sortLeads(missed)} empty="All caught up — no overdue follow-ups." firmId={firmId} profile={profile} onOpen={setSelected} />
          <ActionGroup title="Due today" sub="Scheduled touchpoints" tone="amber" icon={<Clock className="w-4 h-4" />} leads={sortLeads(dueToday)} empty="Nothing scheduled for today." firmId={firmId} profile={profile} onOpen={setSelected} />
          <ActionGroup title="Fresh inquiries" sub="Uncontacted" tone="sky" icon={<Sparkles className="w-4 h-4" />} leads={sortLeads(fresh)} empty="No new inquiries." firmId={firmId} profile={profile} onOpen={setSelected} />
        </div>
      )}

      {/* TAB: Pipeline */}
      {tab === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {stages.map(stage => {
            const col = filtered.filter(l => l.status === stage.key);
            const val = col.reduce((s, l) => s + (l.estimated_budget || 0), 0);
            const c = stageColor(stage.color);
            return (
              <div key={stage.id} className="w-72 shrink-0">
                <div className={cn('flex items-center justify-between rounded-t-xl border-x border-t px-3 py-2.5', c.chip)}>
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                    <span className={cn('text-sm font-semibold', c.text)}>{stage.label}</span>
                    <span className="rounded-full bg-white/70 px-1.5 text-[10px] font-medium text-slate-600">{col.length}</span>
                  </div>
                  {val > 0 && <span className="text-[11px] font-medium text-slate-500">{formatINRCompact(val)}</span>}
                </div>
                <div className="min-h-[120px] space-y-2 rounded-b-xl border border-slate-100 bg-slate-50/60 p-2">
                  {col.length === 0 && <p className="py-6 text-center text-xs text-slate-300">Empty</p>}
                  {sortLeads(col).map(l => <LeadCard key={l.id} lead={l} firmId={firmId} owner={profile(l.assigned_to)} compact onClick={() => setSelected(l.id)} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: All Leads */}
      {tab === 'all' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{filtered.length} lead{filtered.length === 1 ? '' : 's'}</p>
            <button onClick={() => setSort(s => s === 'recent' ? 'value' : s === 'value' ? 'name' : 'recent')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort: {sort === 'recent' ? 'Most recent' : sort === 'value' ? 'Deal value' : 'Name'}
            </button>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">No leads match.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortLeads(filtered).map(l => <LeadCard key={l.id} lead={l} firmId={firmId} owner={profile(l.assigned_to)} onClick={() => setSelected(l.id)} />)}
            </div>
          )}
        </div>
      )}

      {showAdd && <AddLeadModal firmId={firmId} userId={user.id} onClose={() => setShowAdd(false)} onCreated={(id) => { setShowAdd(false); setSelected(id); }} />}
      {selected && <LeadDetailModal leadId={selected} firmId={firmId} userId={user.id} onClose={() => setSelected(null)} onNavigate={onNavigate} />}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'indigo' | 'emerald' }) {
  const color = accent === 'emerald' ? 'text-emerald-600' : accent === 'indigo' ? 'text-indigo-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(16,32,26,0.04)]">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold tabular-nums', color)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ActionGroup({ title, sub, tone, icon, leads, empty, firmId, profile, onOpen }: {
  title: string; sub: string; tone: 'red' | 'amber' | 'sky'; icon: React.ReactNode; leads: Lead[]; empty: string;
  firmId: string; profile: (id?: string) => any; onOpen: (id: string) => void;
}) {
  const tones = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', sky: 'bg-sky-100 text-sky-700' };
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>{icon}</div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          <p className="text-[11px] text-slate-400">{leads.length} · {sub}</p>
        </div>
      </div>
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-7 text-center text-sm text-slate-400">{empty}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map(l => <LeadCard key={l.id} lead={l} firmId={firmId} owner={profile(l.assigned_to)} onClick={() => onOpen(l.id)} />)}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, firmId, owner, onClick, compact }: { lead: Lead; firmId: string; owner: any; onClick: () => void; compact?: boolean }) {
  const stage = stageByKey(firmId, lead.status);
  const c = stageColor(stage?.color);
  const overdue = isOverdue(lead, firmId);
  const dueToday = isDueToday(lead);
  return (
    <button onClick={onClick}
      className={cn('w-full rounded-xl border bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(16,32,26,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(16,32,26,0.09)]',
        overdue ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-100')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dot)} />
            <h3 className="truncate text-sm font-semibold text-slate-900">{lead.client_name}</h3>
          </div>
          {lead.client_company && <p className="ml-3.5 truncate text-[11px] text-slate-400">{lead.client_company}</p>}
        </div>
        {owner && <Avatar name={owner.full_name} size="sm" />}
      </div>
      <p className="mt-2 truncate text-xs text-slate-500">{lead.project_type}{lead.project_location ? ` · ${lead.project_location}` : ''}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium', c.chip, c.text)}>{stage?.label || lead.status}</span>
        {lead.estimated_budget ? <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-700"><IndianRupee className="w-3 h-3" />{formatINRCompact(lead.estimated_budget)}</span> : (!compact && lead.estimated_area ? <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400"><Ruler className="w-3 h-3" />{lead.estimated_area} ft²</span> : null)}
      </div>
      {(overdue || dueToday) && (
        <div className={cn('mt-2.5 flex items-center gap-1.5 border-t pt-2 text-[11px] font-semibold', overdue ? 'border-red-100 text-red-600' : 'border-amber-100 text-amber-600')}>
          {overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {overdue ? 'Follow-up overdue' : 'Follow-up due today'}
        </div>
      )}
    </button>
  );
}
