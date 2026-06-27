import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { formatINR } from '../utils/format';
import { PLAN_PRESETS, buildSplits, buildStarterMilestones, STARTER_MILESTONES } from '../lib/paymentPlan';
import { emitEvent, linkTo } from '../lib/events';
import { Loader2, Check, UserPlus, FolderPlus, CreditCard, ArrowRight } from 'lucide-react';

interface Props {
  leadId: string;
  firmId: string;
  userId: string;
  onClose: () => void;
  onConverted: (projectId: string) => void;
}

const todayStr = () => new Date().toISOString().split('T')[0];

export function ConvertLeadModal({ leadId, firmId, userId, onClose, onConverted }: Props) {
  const store = useStore();
  const d = store.forFirm(firmId);
  const lead = d.leads.find(l => l.id === leadId);
  const existingClients = d.profiles.filter(p => p.role === 'client');
  const team = d.profiles.filter(p => p.role === 'architect' || p.role === 'engineer');
  const latestQuoteTotal = useMemo(() => {
    const qs = d.leadQuotations.filter(q => q.lead_id === leadId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return qs[0]?.total_amount;
  }, [d.leadQuotations, leadId]);

  const defaultEnd = () => {
    const s = lead?.expected_start_date ? new Date(lead.expected_start_date) : new Date();
    return new Date(s.getTime() + 120 * 864e5).toISOString().split('T')[0];
  };

  const [linkExisting, setLinkExisting] = useState(false);
  const [existingClientId, setExistingClientId] = useState(existingClients[0]?.id || '');
  const [clientName, setClientName] = useState(lead?.client_name || '');
  const [clientEmail, setClientEmail] = useState(lead?.client_email || '');
  const [clientPhone, setClientPhone] = useState(lead?.client_phone || '');

  const [projectName, setProjectName] = useState(lead ? `${lead.client_name} — ${lead.project_type}` : '');
  const [projectValue, setProjectValue] = useState(String(latestQuoteTotal ?? lead?.estimated_budget ?? ''));
  const [startDate, setStartDate] = useState(lead?.expected_start_date || todayStr());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [address, setAddress] = useState(lead?.project_location || '');
  const [description, setDescription] = useState(lead?.project_requirements || '');
  const [assignedTo, setAssignedTo] = useState(lead?.assigned_to || '');

  const [presetIdx, setPresetIdx] = useState(0);
  const [gstRate, setGstRate] = useState('18');
  const [createMilestones, setCreateMilestones] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!lead) return null;

  const value = parseFloat(projectValue) || 0;
  const preview = useMemo(() => buildSplits({
    firmId, projectId: 'preview', paymentPlanId: 'preview', totalValue: value,
    percents: PLAN_PRESETS[presetIdx].percents, gstRate: parseFloat(gstRate) || 18, startDate, endDate,
  }), [firmId, value, presetIdx, gstRate, startDate, endDate]);

  const submit = async () => {
    setSaving(true);
    try {
      // 1) client
      const clientId = linkExisting
        ? existingClientId
        : store.addProfile({ firm_id: firmId, email: clientEmail || `${clientName.toLowerCase().replace(/\s+/g, '.')}@client.local`, full_name: clientName, role: 'client', phone: clientPhone || undefined }).id;

      // 2) project
      const project = store.addProject({
        firm_id: firmId, name: projectName, client_id: clientId, project_value: value,
        start_date: startDate, estimated_end_date: endDate, status: 'planning',
        description: description || undefined, address: address || undefined,
      });

      // 3) team
      if (assignedTo) {
        const role = team.find(t => t.id === assignedTo)?.role === 'engineer' ? 'engineer' : 'lead_architect';
        store.addAssignment({ firm_id: firmId, project_id: project.id, user_id: assignedTo, role: role as any });
      }

      // 4) starter milestones
      let milestoneIds: string[] | undefined;
      if (createMilestones) {
        const ms = buildStarterMilestones({ firmId, projectId: project.id, startDate, endDate });
        milestoneIds = ms.map(m => store.addMilestone(m).id);
      }

      // 5) payment plan + splits
      const percents = PLAN_PRESETS[presetIdx].percents;
      const plan = store.addPaymentPlan({ firm_id: firmId, project_id: project.id, total_amount: value, split_count: percents.length, client_signed_off: false });
      const splits = buildSplits({ firmId, projectId: project.id, paymentPlanId: plan.id, totalValue: value, percents, gstRate: parseFloat(gstRate) || 18, startDate, endDate, milestoneIds });
      splits.forEach(s => store.addPaymentSplit(s));

      // 6) convert lead + emit events
      store.convertLeadToProject(leadId, project.id);
      emitEvent({ type: 'lead_won', firmId, actorId: userId, projectId: project.id, title: `Lead won — ${lead.client_name}`, message: `${lead.project_type} converted to a project`, module: 'lead', action: 'status_changed', entityType: 'lead', entityId: leadId, entityName: lead.client_name, link: linkTo('project-detail', project.id) });
      emitEvent({ type: 'project_created', firmId, actorId: userId, projectId: project.id, title: `New project — ${projectName}`, message: `Created from lead ${lead.client_name} · ${formatINR(value)}`, module: 'project', action: 'created', entityType: 'project', entityId: project.id, entityName: projectName, link: linkTo('project-detail', project.id) });

      onConverted(project.id);
    } catch (e) {
      alert('Conversion failed: ' + (e as any).message);
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">{icon} {title}</div>
      {children}
    </div>
  );

  return (
    <Modal open onClose={onClose} title="Convert to Project" size="lg">
      <div className="space-y-6">
        <p className="text-sm text-slate-500">
          Everything below is pre-filled from <b>{lead.client_name}</b>’s lead. Review, then confirm — this creates the client, the project, the team, starter milestones and a payment plan in one step.
        </p>

        {/* 1. Client */}
        <Section icon={<UserPlus className="w-4 h-4 text-indigo-500" />} title="Client">
          <div className="flex gap-2 text-xs">
            <button onClick={() => setLinkExisting(false)} className={`px-3 py-1.5 rounded-lg border ${!linkExisting ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Create new client</button>
            <button onClick={() => setLinkExisting(true)} disabled={existingClients.length === 0} className={`px-3 py-1.5 rounded-lg border disabled:opacity-40 ${linkExisting ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Link existing</button>
          </div>
          {linkExisting ? (
            <Select label="Existing client" value={existingClientId} onChange={e => setExistingClientId(e.target.value)} options={existingClients.map(c => ({ value: c.id, label: c.full_name }))} />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Input label="Name" value={clientName} onChange={e => setClientName(e.target.value)} />
              <Input label="Email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
              <Input label="Phone" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
            </div>
          )}
        </Section>

        {/* 2. Project */}
        <Section icon={<FolderPlus className="w-4 h-4 text-indigo-500" />} title="Project">
          <Input label="Project name" value={projectName} onChange={e => setProjectName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Project value (₹)" type="number" value={projectValue} onChange={e => setProjectValue(e.target.value)} />
            <Select label="Lead architect / engineer" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} options={[{ value: '', label: 'Unassigned' }, ...team.map(t => ({ value: t.id, label: `${t.full_name} · ${t.role}` }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input label="Estimated end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <Input label="Site address" value={address} onChange={e => setAddress(e.target.value)} />
          <Textarea label="Description" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </Section>

        {/* 3. Payment plan */}
        <Section icon={<CreditCard className="w-4 h-4 text-indigo-500" />} title="Payment plan">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Split template" value={String(presetIdx)} onChange={e => setPresetIdx(parseInt(e.target.value))} options={PLAN_PRESETS.map((p, i) => ({ value: String(i), label: p.label }))} />
            <Input label="GST %" type="number" value={gstRate} onChange={e => setGstRate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={createMilestones} onChange={e => setCreateMilestones(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            Create starter milestones ({STARTER_MILESTONES.join(', ')}) and trigger payments off them
          </label>
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-xs text-slate-500 border-b border-slate-100"><th className="text-left px-3 py-2 font-medium">Split</th><th className="text-left px-2 py-2 font-medium">Trigger</th><th className="text-right px-2 py-2 font-medium">Amount</th><th className="text-right px-3 py-2 font-medium">Incl. GST</th></tr></thead>
              <tbody>
                {preview.map((s, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2">#{s.split_number} <span className="text-slate-400">({PLAN_PRESETS[presetIdx].percents[i]}%)</span></td>
                    <td className="px-2 py-2 text-slate-500">{i === 0 ? 'On booking' : createMilestones ? `Milestone ${i}` : 'On date'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatINR(s.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatINR(s.total_with_gst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <Badge variant="info" size="sm">Booking advance due immediately on accept</Badge>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !projectName.trim() || value <= 0 || (!linkExisting && !clientName.trim())}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create project <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
