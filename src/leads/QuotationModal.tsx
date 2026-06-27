import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { formatINR } from '../utils/format';
import { FileText } from 'lucide-react';

interface Props {
  leadId: string;
  firmId: string;
  userId: string;
  onClose: () => void;
}

export function QuotationModal({ leadId, firmId, userId, onClose }: Props) {
  const store = useStore();
  const lead = store.leads.find(l => l.id === leadId);
  const existing = store.leadQuotations.filter(q => q.lead_id === leadId);
  const [f, setF] = useState({
    estimated_cost: lead?.estimated_budget?.toString() || '', design_fees: '', supervision_fees: '', other_charges: '',
    scope_of_work: lead?.project_requirements || '', inclusions: '', exclusions: '', validity_days: '30',
  });
  const set = (p: Partial<typeof f>) => setF(s => ({ ...s, ...p }));
  const total = (parseFloat(f.estimated_cost) || 0) + (parseFloat(f.design_fees) || 0) + (parseFloat(f.supervision_fees) || 0) + (parseFloat(f.other_charges) || 0);

  const submit = () => {
    if (!f.scope_of_work.trim()) return;
    const year = new Date().getFullYear();
    const number = `QT-${year}-${String(store.leadQuotations.filter(q => q.firm_id === firmId).length + 1).padStart(3, '0')}`;
    store.addLeadQuotation({
      firm_id: firmId, lead_id: leadId, quotation_number: number, version: existing.length + 1,
      estimated_cost: parseFloat(f.estimated_cost) || 0, design_fees: parseFloat(f.design_fees) || 0,
      supervision_fees: parseFloat(f.supervision_fees) || 0, other_charges: parseFloat(f.other_charges) || 0,
      total_amount: total, scope_of_work: f.scope_of_work.trim(), inclusions: f.inclusions || undefined,
      exclusions: f.exclusions || undefined, validity_days: parseInt(f.validity_days) || 30, status: 'draft', created_by: userId,
    } as any);
    // advance the lead to "quotation_sent" if it's still early
    if (lead && ['new', 'contacted', 'site_visit'].includes(lead.status)) store.updateLead(leadId, { status: 'quotation_sent' as any });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Create quotation${existing.length ? ` · v${existing.length + 1}` : ''}`} size="lg">
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm"><b>{lead?.client_name}</b> — {lead?.project_type}</div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Estimated cost (₹)" type="number" value={f.estimated_cost} onChange={e => set({ estimated_cost: e.target.value })} />
          <Input label="Design fees (₹)" type="number" value={f.design_fees} onChange={e => set({ design_fees: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Supervision fees (₹)" type="number" value={f.supervision_fees} onChange={e => set({ supervision_fees: e.target.value })} />
          <Input label="Other charges (₹)" type="number" value={f.other_charges} onChange={e => set({ other_charges: e.target.value })} />
        </div>
        <div className="rounded-xl bg-indigo-50 p-4 text-center">
          <div className="text-xs font-medium text-indigo-600">Total</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-indigo-800">{formatINR(total)}</div>
        </div>
        <Textarea label="Scope of work *" rows={4} value={f.scope_of_work} onChange={e => set({ scope_of_work: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Textarea label="Inclusions" rows={2} value={f.inclusions} onChange={e => set({ inclusions: e.target.value })} />
          <Textarea label="Exclusions" rows={2} value={f.exclusions} onChange={e => set({ exclusions: e.target.value })} />
        </div>
        <Input label="Validity (days)" type="number" value={f.validity_days} onChange={e => set({ validity_days: e.target.value })} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!f.scope_of_work.trim()}><FileText className="w-4 h-4" /> Create v{existing.length + 1}</Button>
        </div>
      </div>
    </Modal>
  );
}
