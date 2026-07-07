import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { formatINRCompact, timeAgo } from '../utils/format';
import type { LeadSource, LeadPriority } from '../types';
import { activeStages, matchReturningCustomer, ensureContact, stageByKey } from './logic';
import { emitLeadEvent } from '../lib/events';
import { History, Plus } from 'lucide-react';

interface Props {
  firmId: string;
  userId: string;
  onClose: () => void;
  onCreated: (leadId: string) => void;
}

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'referral', label: 'Referral' }, { value: 'website', label: 'Website' },
  { value: 'social_media', label: 'Social Media' }, { value: 'walk_in', label: 'Walk-in' },
  { value: 'advertisement', label: 'Advertisement' }, { value: 'other', label: 'Other' },
];
const PRIORITIES: { value: LeadPriority; label: string }[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
];

export function AddLeadModal({ firmId, userId, onClose, onCreated }: Props) {
  const store = useStore();
  const team = store.profiles.filter(p => p.firm_id === firmId && p.role !== 'client');
  const stages = activeStages(firmId);
  const [f, setF] = useState({
    client_name: '', client_company: '', client_email: '', client_phone: '',
    project_type: '', project_location: '', estimated_budget: '', estimated_area: '',
    project_requirements: '', source: 'referral' as LeadSource, priority: 'medium' as LeadPriority,
    assigned_to: '', status: stages[0]?.key || 'new', tags: '',
  });
  const set = (patch: Partial<typeof f>) => setF(s => ({ ...s, ...patch }));

  // returning-customer recognition — live as email/phone are entered
  const match = useMemo(
    () => (f.client_email || f.client_phone) ? matchReturningCustomer(firmId, f.client_email, f.client_phone) : null,
    [firmId, f.client_email, f.client_phone, store.contacts, store.leads],
  );

  const submit = () => {
    if (!f.client_name.trim() || !f.client_phone.trim() || !f.project_type.trim()) return;
    const contactId = ensureContact(firmId, f.client_name.trim(), f.client_email, f.client_phone, f.client_company);
    const lead = store.addLead({
      firm_id: firmId,
      client_name: f.client_name.trim(), client_company: f.client_company || undefined,
      client_email: f.client_email || undefined, client_phone: f.client_phone.trim(), client_whatsapp: f.client_phone.trim(),
      project_type: f.project_type.trim(), project_location: f.project_location || undefined,
      estimated_budget: f.estimated_budget ? parseFloat(f.estimated_budget) : undefined,
      estimated_area: f.estimated_area ? parseFloat(f.estimated_area) : undefined,
      project_requirements: f.project_requirements || undefined,
      status: f.status as any, source: f.source, priority: f.priority,
      assigned_to: f.assigned_to || undefined,
      inquiry_date: new Date().toISOString().split('T')[0],
      tags: f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      contact_id: contactId, created_by: userId,
    } as any);
    emitLeadEvent({
      type: 'lead_created', firmId, actorId: userId, leadId: lead.id, leadName: lead.client_name,
      title: `New lead — ${lead.client_name}`,
      message: `${lead.project_type}${f.assigned_to ? '' : ' · unassigned (Fresh Enquiries)'}`,
    });
    if (f.assigned_to) {
      emitLeadEvent({ type: 'lead_assigned', firmId, actorId: userId, leadId: lead.id, leadName: lead.client_name, title: `Lead assigned — ${lead.client_name}`, newOwnerId: f.assigned_to });
    }
    onCreated(lead.id);
  };

  return (
    <Modal open onClose={onClose} title="Add lead" size="lg">
      <div className="space-y-4">
        {/* returning-customer banner */}
        {match && (
          <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
            <History className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
            <div className="text-sm">
              <div className="font-semibold text-sky-800">Returning customer — {match.contact.full_name}</div>
              <div className="text-xs text-sky-700">
                {match.priorLeads.length} prior {match.priorLeads.length === 1 ? 'lead' : 'leads'}
                {match.contact.company ? ` · ${match.contact.company}` : ''}. We'll link this enquiry to their record.
              </div>
              {match.priorLeads.slice(0, 2).map(l => (
                <div key={l.id} className="mt-1 flex items-center gap-2 text-[11px] text-sky-600">
                  <Badge variant="info" size="sm">{stageByKey(firmId, l.status)?.label || l.status}</Badge>
                  <span>{l.project_type}{l.estimated_budget ? ` · ${formatINRCompact(l.estimated_budget)}` : ''}</span>
                  <span className="text-sky-400">{timeAgo(l.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Client name *" value={f.client_name} onChange={e => set({ client_name: e.target.value })} placeholder="Rajesh Malhotra" />
          <Input label="Company" value={f.client_company} onChange={e => set({ client_company: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone *" value={f.client_phone} onChange={e => set({ client_phone: e.target.value })} placeholder="+91 …" />
          <Input label="Email" type="email" value={f.client_email} onChange={e => set({ client_email: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Project type *" value={f.project_type} onChange={e => set({ project_type: e.target.value })} placeholder="Residential Villa…" />
          <Input label="Location" value={f.project_location} onChange={e => set({ project_location: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Estimated value (₹)" type="number" value={f.estimated_budget} onChange={e => set({ estimated_budget: e.target.value })} />
          <Input label="Area (ft²)" type="number" value={f.estimated_area} onChange={e => set({ estimated_area: e.target.value })} />
        </div>
        <Textarea label="Scope / requirements" rows={2} value={f.project_requirements} onChange={e => set({ project_requirements: e.target.value })} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select label="Source" value={f.source} onChange={e => set({ source: e.target.value as LeadSource })} options={SOURCES} />
          <Select label="Priority" value={f.priority} onChange={e => set({ priority: e.target.value as LeadPriority })} options={PRIORITIES} />
          <Select label="Owner" value={f.assigned_to} onChange={e => set({ assigned_to: e.target.value })} options={[{ value: '', label: 'Unassigned' }, ...team.map(m => ({ value: m.id, label: m.full_name }))]} />
          <Select label="Stage" value={f.status} onChange={e => set({ status: e.target.value })} options={stages.map(s => ({ value: s.key, label: s.label }))} />
        </div>
        <Input label="Tags (comma-separated)" value={f.tags} onChange={e => set({ tags: e.target.value })} placeholder="VIP, urgent, repeat" />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!f.client_name.trim() || !f.client_phone.trim() || !f.project_type.trim()}>
            <Plus className="w-4 h-4" /> Add lead
          </Button>
        </div>
      </div>
    </Modal>
  );
}
