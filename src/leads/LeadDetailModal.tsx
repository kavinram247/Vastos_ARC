import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select, Textarea } from '../components/ui/Input';
import { formatINR, formatDate, timeAgo } from '../utils/format';
import type { Page, InteractionChannel, LostReasonCategory } from '../types';
import {
  activeStages, terminalStages, stageByKey, stageColor, isClosedStage,
  setLeadStage, restoreLead, unconvertLead, canUnconvert, LOST_REASONS, CHANNELS,
} from './logic';
import { ConvertLeadModal } from '../pages/ConvertLeadModal';
import { QuotationModal } from './QuotationModal';
import { placeCall, getTelephony } from './telephony';
import {
  Phone, Mail, MessageSquare, MessageCircle, Users, Share2, FileText, Building2,
  CheckCircle2, CalendarClock, PhoneCall, FolderPlus, ArrowRight, RotateCcw, History,
  Plus, X, Undo2, AlertTriangle,
} from 'lucide-react';
import { cn } from '../utils/cn';

const CH_ICON: Record<InteractionChannel, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5" />, email: <Mail className="w-3.5 h-3.5" />,
  sms: <MessageSquare className="w-3.5 h-3.5" />, whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
  meeting: <Users className="w-3.5 h-3.5" />, meta: <Share2 className="w-3.5 h-3.5" />, note: <FileText className="w-3.5 h-3.5" />,
};

interface Props { leadId: string; firmId: string; userId: string; onClose: () => void; onNavigate?: (page: Page, projectId?: string) => void; }

export function LeadDetailModal({ leadId, firmId, userId, onClose, onNavigate }: Props) {
  const store = useStore();
  const lead = store.leads.find(l => l.id === leadId);
  const [tab, setTab] = useState<'overview' | 'timeline' | 'quotations'>('overview');
  const [showConvert, setShowConvert] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [sched, setSched] = useState('');
  const quotesEnabled = store.isFeatureEnabled(firmId, 'quotations');

  if (!lead) return null;
  const actives = activeStages(firmId);
  const terminals = terminalStages(firmId);
  const stage = stageByKey(firmId, lead.status);
  const curC = stageColor(stage?.color);
  const owner = store.profiles.find(p => p.id === lead.assigned_to);
  const contact = lead.contact_id ? store.contacts.find(c => c.id === lead.contact_id) : null;
  const priorLeads = contact ? store.leads.filter(l => l.contact_id === contact.id && l.id !== leadId) : [];
  const interactions = store.leadInteractions.filter(i => i.lead_id === leadId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const quotations = store.leadQuotations.filter(q => q.lead_id === leadId).sort((a, b) => b.version - a.version);
  const curIdx = actives.findIndex(s => s.key === lead.status);
  const isJunk = lead.status === 'junk';

  const telephony = getTelephony(firmId);
  const [calling, setCalling] = useState(false);
  const doCall = async () => {
    setCalling(true);
    const r = await placeCall(lead, firmId, userId);
    setCalling(false);
    if (!r.ok) { alert(r.error || 'Could not place the call.'); return; }
    setTab('timeline');
  };

  const goStage = (key: string) => {
    const st = stageByKey(firmId, key);
    if (st?.is_lost) { setLostOpen(true); return; }
    setLeadStage(leadId, firmId, key, userId);
  };

  const schedule = () => {
    if (!sched) return;
    store.addLeadInteraction({ firm_id: firmId, lead_id: leadId, type: 'site_visit', channel: 'meeting', direction: 'outbound', subject: `[Scheduled] follow-up`, description: `Next touchpoint scheduled`, scheduled_at: sched, contact_id: lead.contact_id, logged_by: userId } as any);
    store.updateLead(leadId, { next_follow_up: sched });
    setSched('');
  };

  const doUnconvert = () => {
    const g = canUnconvert(lead.converted_project_id!);
    if (!g.ok) { alert(`Can't reverse — ${g.reason}. The project has real activity and must be closed manually.`); return; }
    if (!confirm('Reverse the conversion? This deletes the auto-created project, milestones and payment plan, and reopens the lead.')) return;
    unconvertLead(leadId, firmId, userId);
  };

  return (
    <Modal open onClose={onClose} title="" size="xl">
      <div className="-mx-6 -mt-4">
        {/* Header */}
        <div className={cn('border-b border-slate-200 px-6 pb-4 pt-5', curC.chip.replace('border-', 'border-b-'))}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{lead.client_name}</h2>
                <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', curC.chip, curC.text)}>{stage?.label || lead.status}</span>
                {lead.converted_project_id && <Badge variant="success" size="sm"><CheckCircle2 className="w-3 h-3 mr-1" />Converted</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{lead.project_type}{lead.project_location ? ` · ${lead.project_location}` : ''}{lead.client_company ? ` · ${lead.client_company}` : ''}</p>
              {lead.estimated_budget ? <p className="mt-1 text-sm font-semibold text-slate-700">{formatINR(lead.estimated_budget)}{lead.estimated_area ? <span className="font-normal text-slate-400"> · {lead.estimated_area} ft²</span> : ''}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {telephony.enabled && lead.client_phone && (
                <Button size="sm" onClick={doCall} disabled={calling}>
                  <Phone className="w-3.5 h-3.5" /> {calling ? 'Calling…' : 'Call'}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setTab('timeline')}><PhoneCall className="w-3.5 h-3.5" /> Log</Button>
              {quotesEnabled && <Button size="sm" variant="secondary" onClick={() => setShowQuote(true)}><FileText className="w-3.5 h-3.5" /> Quote</Button>}
              {lead.converted_project_id ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => onNavigate?.('project-detail', lead.converted_project_id)}><FolderPlus className="w-3.5 h-3.5" /> Project</Button>
                  <Button size="sm" variant="secondary" onClick={doUnconvert}><Undo2 className="w-3.5 h-3.5" /> Reverse</Button>
                </>
              ) : stage?.is_won ? (
                <Button size="sm" variant="success" onClick={() => setShowConvert(true)}><FolderPlus className="w-3.5 h-3.5" /> Convert <ArrowRight className="w-3.5 h-3.5" /></Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Returning customer */}
        {priorLeads.length > 0 && (
          <div className="flex items-center gap-2 border-b border-sky-100 bg-sky-50/60 px-6 py-2 text-xs text-sky-700">
            <History className="w-3.5 h-3.5" /> Returning customer — {priorLeads.length} prior {priorLeads.length === 1 ? 'lead' : 'leads'} on record{contact?.company ? ` · ${contact.company}` : ''}.
          </div>
        )}

        {/* Pipeline stepper */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Pipeline</div>
          <div className="flex items-center overflow-x-auto pb-1">
            {actives.map((s, idx) => {
              const isCur = lead.status === s.key;
              const isPast = curIdx > idx && curIdx >= 0;
              const sc = stageColor(s.color);
              return (
                <div key={s.id} className="flex flex-1 items-center last:flex-none">
                  <button onClick={() => goStage(s.key)} className="group flex flex-col items-center gap-1.5" title={`Set ${s.label}`}>
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                      isCur ? cn('text-white border-transparent', sc.dot) : isPast ? 'border-indigo-400 bg-indigo-100 text-indigo-600' : 'border-slate-200 bg-white text-slate-400 group-hover:border-indigo-300')}>
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={cn('whitespace-nowrap text-[10px] font-medium', isCur ? sc.text : isPast ? 'text-indigo-600' : 'text-slate-400')}>{s.label}</span>
                  </button>
                  {idx < actives.length - 1 && <div className={cn('mx-1 h-0.5 flex-1 rounded', isPast ? 'bg-indigo-400' : 'bg-slate-200')} />}
                </div>
              );
            })}
          </div>
          {/* Terminal buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {terminals.map(s => {
              const sc = stageColor(s.color);
              const on = lead.status === s.key;
              return (
                <button key={s.id} onClick={() => goStage(s.key)}
                  className={cn('rounded-lg border px-3 py-1 text-[11px] font-semibold transition-all', on ? cn('text-white border-transparent', sc.dot) : cn(sc.chip, sc.text, 'hover:opacity-80'))}>
                  {s.label}
                </button>
              );
            })}
            {isJunk && lead.prev_status && (
              <button onClick={() => restoreLead(leadId)} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
                <RotateCcw className="w-3 h-3" /> Restore
              </button>
            )}
          </div>
        </div>

        {/* Quick scheduler */}
        <div className="flex items-center gap-2 border-b border-indigo-100/60 bg-indigo-50/40 px-6 py-2.5">
          <CalendarClock className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700">Next follow-up</span>
          {lead.next_follow_up && <Badge variant={lead.next_follow_up < new Date().toISOString().split('T')[0] ? 'error' : 'info'} size="sm">{formatDate(lead.next_follow_up)}</Badge>}
          <input type="date" value={sched} onChange={e => setSched(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" />
          <Button size="sm" onClick={schedule} disabled={!sched}>Schedule</Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {([['overview', 'Overview'], ['timeline', `Timeline${interactions.length ? ` · ${interactions.length}` : ''}`], ['quotations', `Quotations${quotations.length ? ` · ${quotations.length}` : ''}`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as any)} className={cn('-mb-px border-b-2 px-4 py-3 text-sm font-medium', tab === k ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600')}>{label}</button>
          ))}
        </div>

        <div className="max-h-[42vh] overflow-y-auto px-6 py-5">
          {tab === 'overview' && <Overview lead={lead} owner={owner} firmId={firmId} userId={userId} />}
          {tab === 'timeline' && <Timeline leadId={leadId} firmId={firmId} userId={userId} contactId={lead.contact_id} interactions={interactions} />}
          {tab === 'quotations' && (
            <div className="space-y-3">
              {quotesEnabled ? (
                <Button size="sm" variant="secondary" onClick={() => setShowQuote(true)}><Plus className="w-3.5 h-3.5" /> New version</Button>
              ) : <p className="text-xs text-slate-400">Quotations are disabled for this firm (enable in Leads Admin).</p>}
              {quotations.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No quotations yet.</p> : quotations.map(q => (
                <div key={q.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div><span className="font-bold text-slate-900">{q.quotation_number}</span><span className="ml-2 text-xs text-slate-400">v{q.version}</span></div>
                    <Badge variant={q.status === 'accepted' ? 'success' : q.status === 'rejected' ? 'error' : q.status === 'sent' ? 'info' : 'default'}>{q.status}</Badge>
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{formatINR(q.total_amount)}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{q.scope_of_work}</p>
                  <div className="mt-2 text-[10px] text-slate-400">{formatDate(q.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showConvert && <ConvertLeadModal leadId={leadId} firmId={firmId} userId={userId} onClose={() => setShowConvert(false)} onConverted={(pid) => { setShowConvert(false); onNavigate?.('project-detail', pid); }} />}
      {showQuote && <QuotationModal leadId={leadId} firmId={firmId} userId={userId} onClose={() => setShowQuote(false)} />}
      {lostOpen && <LostModal leadId={leadId} firmId={firmId} onClose={() => setLostOpen(false)} />}
    </Modal>
  );
}

function Overview({ lead, owner, firmId, userId }: { lead: any; owner: any; firmId: string; userId: string }) {
  const store = useStore();
  const [notes, setNotes] = useState(lead.notes || '');
  const [tag, setTag] = useState('');
  const lost = stageByKey(firmId, lead.status)?.is_lost;
  const tele = getTelephony(firmId);
  const callLead = async () => { const r = await placeCall(lead, firmId, userId); if (!r.ok) alert(r.error || 'Could not place the call.'); };
  const addTag = () => { if (!tag.trim()) return; store.updateLead(lead.id, { tags: [...(lead.tags || []), tag.trim()] }); setTag(''); };
  const removeTag = (t: string) => store.updateLead(lead.id, { tags: (lead.tags || []).filter((x: string) => x !== t) });

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-5">
        <Section title="Contact">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Phone className="w-4 h-4" /></span>
            <span className="flex-1">{lead.client_phone || <span className="text-slate-400">No phone</span>}</span>
            {tele.enabled && lead.client_phone && (
              <button onClick={callLead} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100">
                <Phone className="w-3 h-3" /> Call{tele.connected && tele.provider.webhook ? ` · ${tele.provider.label.split(' ')[0]}` : ''}
              </button>
            )}
          </div>
          {lead.client_email && <Row icon={<Mail className="w-4 h-4" />} value={lead.client_email} />}
          {lead.client_company && <Row icon={<Building2 className="w-4 h-4" />} value={lead.client_company} />}
        </Section>
        {lead.project_requirements && <Section title="Requirements"><p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">{lead.project_requirements}</p></Section>}
        {lost && lead.lost_reason && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">Lost — {LOST_REASONS.find(r => r.value === lead.lost_reason_category)?.label || lead.lost_reason_category}</div>
            <p className="mt-1 text-sm text-red-700">{lead.lost_reason}</p>
          </div>
        )}
      </div>
      <div className="space-y-5">
        <Section title="Details">
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50 text-sm">
            {[['Source', lead.source], ['Priority', lead.priority], ['Owner', owner?.full_name || 'Unassigned'], ['Inquiry', formatDate(lead.inquiry_date)], lead.next_follow_up ? ['Follow-up', formatDate(lead.next_follow_up)] : null].filter(Boolean).map((r: any) => (
              <div key={r[0]} className="flex justify-between px-3 py-2"><span className="text-slate-500 capitalize">{r[0]}</span><span className="font-medium capitalize text-slate-800">{r[1]}</span></div>
            ))}
          </div>
        </Section>
        <Section title="Tags">
          <div className="flex flex-wrap items-center gap-1.5">
            {(lead.tags || []).map((t: string) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">{t}<button onClick={() => removeTag(t)}><X className="w-3 h-3" /></button></span>
            ))}
            <input value={tag} onChange={e => setTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="+ tag" className="w-20 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] focus:outline-none" />
          </div>
        </Section>
        <Section title="Notes">
          <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== (lead.notes || '') && store.updateLead(lead.id, { notes })} placeholder="Internal notes…" />
        </Section>
      </div>
    </div>
  );
}

function Timeline({ leadId, firmId, userId, contactId, interactions }: { leadId: string; firmId: string; userId: string; contactId?: string | null; interactions: any[] }) {
  const store = useStore();
  const [f, setF] = useState({ channel: 'call' as InteractionChannel, direction: 'outbound' as 'inbound' | 'outbound', subject: '', description: '', outcome: '', next_steps: '' });
  const set = (p: Partial<typeof f>) => setF(s => ({ ...s, ...p }));
  const log = () => {
    if (!f.subject.trim()) return;
    store.addLeadInteraction({ firm_id: firmId, lead_id: leadId, type: f.channel === 'meeting' ? 'meeting' : f.channel === 'email' ? 'email' : 'call', channel: f.channel, direction: f.direction, subject: f.subject.trim(), description: f.description.trim() || f.subject.trim(), outcome: f.outcome || undefined, next_steps: f.next_steps || undefined, contact_id: contactId, logged_by: userId } as any);
    setF({ channel: 'call', direction: 'outbound', subject: '', description: '', outcome: '', next_steps: '' });
  };
  return (
    <div className="space-y-4">
      {/* log form */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select label="" aria-label="Channel" value={f.channel} onChange={e => set({ channel: e.target.value as InteractionChannel })} options={CHANNELS.map(c => ({ value: c.value, label: c.label }))} />
          <Select label="" aria-label="Direction" value={f.direction} onChange={e => set({ direction: e.target.value as any })} options={[{ value: 'outbound', label: 'Outbound' }, { value: 'inbound', label: 'Inbound' }]} />
          <input value={f.subject} onChange={e => set({ subject: e.target.value })} placeholder="Subject" className="col-span-2 rounded-[9px] border border-slate-200 px-3 text-sm" />
        </div>
        <Textarea rows={2} value={f.description} onChange={e => set({ description: e.target.value })} placeholder="What was discussed / agreed…" />
        <div className="mt-2 flex justify-end"><Button size="sm" onClick={log} disabled={!f.subject.trim()}><Plus className="w-3.5 h-3.5" /> Log interaction</Button></div>
      </div>
      {/* timeline */}
      {interactions.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No interactions yet.</p> : (
        <div className="space-y-2.5">
          {interactions.map(int => {
            const ch = (int.channel || int.type) as InteractionChannel;
            return (
              <div key={int.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">{CH_ICON[ch] || <FileText className="w-3.5 h-3.5" />}</div>
                <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{int.subject}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(int.created_at)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Badge variant="default" size="sm">{CHANNELS.find(c => c.value === ch)?.label || ch}</Badge>
                    {int.direction && <span className="capitalize">{int.direction}</span>}
                  </div>
                  {int.description && <p className="mt-1.5 text-sm text-slate-600">{int.description}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs">
                    {int.outcome && <span className="text-slate-500"><b>Outcome:</b> {int.outcome}</span>}
                    {int.next_steps && <span className="text-indigo-600"><b>Next:</b> {int.next_steps}</span>}
                    {int.scheduled_at && <span className="font-semibold text-indigo-600"><CalendarClock className="mr-1 inline w-3 h-3" />{formatDate(int.scheduled_at)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LostModal({ leadId, firmId, onClose }: { leadId: string; firmId: string; onClose: () => void }) {
  const store = useStore();
  const lead = store.leads.find(l => l.id === leadId)!;
  const [category, setCategory] = useState<LostReasonCategory>('price');
  const [reason, setReason] = useState('');
  const save = () => {
    const patch: any = { status: 'lost', lost_reason: reason.trim() || undefined, lost_reason_category: category };
    if (!isClosedStage(stageByKey(firmId, lead.status))) patch.prev_status = lead.status;
    store.updateLead(leadId, patch);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Mark as Lost">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500"><AlertTriangle className="w-4 h-4 text-amber-500" /> Capture why so the firm can spot patterns.</div>
        <Select label="Reason" value={category} onChange={e => setCategory(e.target.value as LostReasonCategory)} options={LOST_REASONS} />
        <Textarea label="Details (optional)" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. went with a cheaper contractor" />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Mark Lost</Button></div>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>{children}</div>;
}
function Row({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <div className="flex items-center gap-3 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</span><span>{value}</span></div>;
}
