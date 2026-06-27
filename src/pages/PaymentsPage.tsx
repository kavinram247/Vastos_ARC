import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { ProjectSubPageHeader } from '../components/ProjectSubPageHeader';
import type { Page } from '../types';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { formatINR, formatDate, getStatusColor, statusLabel } from '../utils/format';
import { emitEvent, linkTo } from '../lib/events';
import { PLAN_PRESETS, buildSplits } from '../lib/paymentPlan';
import {
  CreditCard, IndianRupee, CheckCircle2, Clock, AlertTriangle,
  FileText, Download, ChevronDown, ChevronUp, Plus, Loader2,
} from 'lucide-react';


interface Props {
  projectId: string;
  onNavigate: (page: Page, projectId?: string) => void;
}

export function PaymentsPage({ projectId, onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [payModalSplitId, setPayModalSplitId] = useState<string | null>(null);
  const [expandedSplit, setExpandedSplit] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState<string | null>(null);
  const [showSetupPlan, setShowSetupPlan] = useState(false);

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const selectedProject = projectId;

  const project = data.projects.find(p => p.id === selectedProject);
  const plan = data.paymentPlans.find(p => p.project_id === selectedProject);
  const splits = data.paymentSplits
    .filter(s => s.project_id === selectedProject)
    .sort((a, b) => a.split_number - b.split_number);

  const totalReceived = data.paymentsReceived
    .filter(p => p.project_id === selectedProject)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalValue = project?.project_value || 0;
  const totalOutstanding = totalValue - totalReceived;
  const nextDue = splits.find(s => s.status === 'due' || s.status === 'upcoming' || s.status === 'overdue');

  const getReceivedForSplit = (splitId: string) =>
    data.paymentsReceived.filter(p => p.payment_split_id === splitId);

  const getMilestone = (id?: string) => id ? data.milestones.find(m => m.id === id) : null;

  const statusIcons: Record<string, React.ReactNode> = {
    paid: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    partially_paid: <Clock className="w-4 h-4 text-amber-500" />,
    due: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    overdue: <AlertTriangle className="w-4 h-4 text-red-500" />,
    scheduled: <Clock className="w-4 h-4 text-slate-400" />,
    upcoming: <Clock className="w-4 h-4 text-blue-500" />,
  };

  return (
    <div className="space-y-6">
      <ProjectSubPageHeader projectId={projectId} title="Payments" subtitle="Payment plans, splits & invoices" onNavigate={onNavigate} />

      {/* Finance Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Value</span>
          <div className="text-xl font-bold text-slate-900">{formatINR(totalValue)}</div>
        </Card>
        <Card className="space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Received</span>
          <div className="text-xl font-bold text-emerald-600">{formatINR(totalReceived)}</div>
        </Card>
        <Card className="space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Outstanding</span>
          <div className="text-xl font-bold text-amber-600">{formatINR(totalOutstanding)}</div>
        </Card>
        <Card className="space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Next Due</span>
          <div className="text-xl font-bold text-slate-900">
            {nextDue ? formatINR(nextDue.total_with_gst) : '—'}
          </div>
          {nextDue && (
            <div className="text-xs text-slate-500">
              Split #{nextDue.split_number}
            </div>
          )}
        </Card>
      </div>

      {/* Payment Plan Status */}
      {plan && (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Plan</CardTitle>
            <div className="flex items-center gap-2">
              {plan.client_signed_off ? (
                <Badge variant="success">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Client Signed Off
                </Badge>
              ) : (
                <Badge variant="warning">Pending Sign-off</Badge>
              )}
            </div>
          </div>
          {plan.signed_off_at && (
            <p className="text-xs text-slate-500 mt-1">
              Locked on {formatDate(plan.signed_off_at)} · {plan.split_count} splits
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{Math.round((totalReceived / totalValue) * 100)}% received</span>
              <span>{formatINR(totalReceived)} / {formatINR(totalValue)}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${Math.min(100, (totalReceived / totalValue) * 100)}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Splits */}
      <div className="space-y-3">
        {splits.map(split => {
          const received = getReceivedForSplit(split.id);
          const totalSplitReceived = received.reduce((s, r) => s + r.amount, 0);
          const milestone = getMilestone(split.trigger_milestone_id);
          const isExpanded = expandedSplit === split.id;

          return (
            <Card key={split.id} padding="none">
              <button
                onClick={() => setExpandedSplit(isExpanded ? null : split.id)}
                className="w-full p-4 flex items-center gap-4 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                  {split.split_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      Split #{split.split_number}
                    </span>
                    {statusIcons[split.status]}
                    <Badge variant={getStatusColor(split.status)} size="sm">
                      {statusLabel(split.status)}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {split.trigger_type === 'date'
                      ? `Due on ${formatDate(split.trigger_date!)}`
                      : `Triggered by: ${milestone?.name || 'Milestone'}`
                    }
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-slate-900">{formatINR(split.total_with_gst)}</div>
                  <div className="text-xs text-slate-500">
                    Base {formatINR(split.amount)} + GST {split.gst_rate}%
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-4 bg-slate-50/50 space-y-4">
                  {/* Amount breakdown */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs">Base Amount</span>
                      <div className="font-medium">{formatINR(split.amount)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">GST ({split.gst_rate}%)</span>
                      <div className="font-medium">{formatINR(split.gst_amount)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Total</span>
                      <div className="font-bold">{formatINR(split.total_with_gst)}</div>
                    </div>
                  </div>

                  {/* Received payments */}
                  {received.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Payments Received</h4>
                      <div className="space-y-2">
                        {received.map(r => (
                          <div key={r.id} className="flex items-center justify-between text-sm bg-white p-2 rounded-lg border border-slate-200">
                            <div>
                              <span className="font-medium text-slate-900">{formatINR(r.amount)}</span>
                              <span className="text-xs text-slate-500 ml-2">via {r.mode.replace('_', ' ')}</span>
                              {r.reference && <span className="text-xs text-slate-400 ml-2">Ref: {r.reference}</span>}
                            </div>
                            <span className="text-xs text-slate-500">{formatDate(r.received_date)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                        <span className="text-xs text-slate-500">Total Received</span>
                        <span className="text-sm font-semibold text-emerald-600">{formatINR(totalSplitReceived)}</span>
                      </div>
                      {totalSplitReceived < split.total_with_gst && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Remaining</span>
                          <span className="text-sm font-semibold text-amber-600">{formatINR(split.total_with_gst - totalSplitReceived)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {can('payments', 'edit') && split.status !== 'paid' && (
                      <Button size="sm" variant="success" onClick={() => setPayModalSplitId(split.id)}>
                        <IndianRupee className="w-3 h-3" /> Mark Payment Received
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setShowInvoice(split.id)}>
                      <FileText className="w-3 h-3" /> View Invoice
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {splits.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No payment plan set up for this project.</p>
          {can('payments', 'create') && (
            <Button className="mt-4" onClick={() => setShowSetupPlan(true)}>
              <Plus className="w-4 h-4" /> Set up payment plan
            </Button>
          )}
        </div>
      )}

      {showSetupPlan && project && (
        <SetupPlanModal
          onClose={() => setShowSetupPlan(false)}
          firmId={firm.id}
          projectId={selectedProject}
          projectValue={project.project_value}
          milestones={data.milestones.filter(m => m.project_id === selectedProject).sort((a, b) => a.order_index - b.order_index)}
        />
      )}

      {/* Mark Payment Modal */}
      <MarkPaymentModal
        open={!!payModalSplitId}
        onClose={() => setPayModalSplitId(null)}
        splitId={payModalSplitId || ''}
        firmId={firm.id}
        projectId={selectedProject}
        userId={user.id}
      />

      {/* Invoice Modal */}
      <InvoiceModal
        open={!!showInvoice}
        onClose={() => setShowInvoice(null)}
        splitId={showInvoice || ''}
        firm={firm}
        projectName={project?.name || ''}
        clientName={data.profiles.find(p => p.id === project?.client_id)?.full_name || ''}
      />
    </div>
  );
}

function MarkPaymentModal({
  open, onClose, splitId, firmId, projectId, userId,
}: {
  open: boolean;
  onClose: () => void;
  splitId: string;
  firmId: string;
  projectId: string;
  userId: string;
}) {
  const store = useStore();
  const split = store.paymentSplits.find(s => s.id === splitId);
  const received = store.paymentsReceived.filter(p => p.payment_split_id === splitId);
  const totalReceived = received.reduce((s, r) => s + r.amount, 0);
  const remaining = split ? split.total_with_gst - totalReceived : 0;

  const [form, setForm] = useState({
    amount: '',
    received_date: new Date().toISOString().split('T')[0],
    mode: 'bank_transfer',
    reference: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0 || amount > remaining) return;
    store.addPaymentReceived({
      firm_id: firmId,
      payment_split_id: splitId,
      project_id: projectId,
      amount,
      received_date: form.received_date,
      mode: form.mode as any,
      reference: form.reference || undefined,
      marked_by: userId,
    });
    const projectName = store.projects.find(p => p.id === projectId)?.name || 'Project';
    emitEvent({
      type: 'payment_received', firmId, actorId: userId, projectId,
      title: `Payment received — ${projectName}`,
      message: `${formatINR(amount)} received via ${form.mode.replace('_', ' ')}${split ? ` for split #${split.split_number}` : ''}`,
      module: 'payment', action: 'payment_received', entityType: 'payment', entityId: splitId,
      link: linkTo('payments', projectId),
    });
    setForm({ amount: '', received_date: new Date().toISOString().split('T')[0], mode: 'bank_transfer', reference: '' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Payment Received">
      <form onSubmit={handleSubmit} className="space-y-4">
        {split && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Split #{split.split_number} Total</span>
              <span className="font-semibold">{formatINR(split.total_with_gst)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Already Received</span>
              <span className="font-semibold text-emerald-600">{formatINR(totalReceived)}</span>
            </div>
            <div className="flex justify-between mt-1 border-t pt-1">
              <span className="text-slate-500">Remaining</span>
              <span className="font-bold text-amber-600">{formatINR(remaining)}</span>
            </div>
          </div>
        )}
        <Input
          label={`Amount (max ${formatINR(remaining)})`}
          type="number"
          required
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          placeholder="Enter amount"
          max={remaining}
        />
        <Input label="Received Date" type="date" required value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
        <Select
          label="Payment Mode"
          value={form.mode}
          onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
          options={[
            { value: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS)' },
            { value: 'cheque', label: 'Cheque' },
            { value: 'upi', label: 'UPI' },
            { value: 'cash', label: 'Cash' },
          ]}
        />
        <Input label="Reference / Transaction ID" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Optional" />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="success" type="submit">
            <CheckCircle2 className="w-4 h-4" /> Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SetupPlanModal({ onClose, firmId, projectId, projectValue, milestones }: {
  onClose: () => void; firmId: string; projectId: string; projectValue: number;
  milestones: { id: string; name: string }[];
}) {
  const store = useStore();
  const [presetIdx, setPresetIdx] = useState(0);
  const [gstRate, setGstRate] = useState('18');
  const [linkMilestones, setLinkMilestones] = useState(milestones.length > 0);
  const [saving, setSaving] = useState(false);
  const percents = PLAN_PRESETS[presetIdx].percents;
  const preview = buildSplits({ firmId, projectId, paymentPlanId: 'preview', totalValue: projectValue, percents, gstRate: parseFloat(gstRate) || 18 });

  const submit = () => {
    setSaving(true);
    try {
      const plan = store.addPaymentPlan({ firm_id: firmId, project_id: projectId, total_amount: projectValue, split_count: percents.length, client_signed_off: false });
      const milestoneIds = linkMilestones ? milestones.map(m => m.id) : undefined;
      const splits = buildSplits({ firmId, projectId, paymentPlanId: plan.id, totalValue: projectValue, percents, gstRate: parseFloat(gstRate) || 18, milestoneIds });
      splits.forEach(s => store.addPaymentSplit(s));
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Set up payment plan">
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between"><span className="text-slate-500">Project value</span><span className="font-semibold">{formatINR(projectValue)}</span></div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Split template" value={String(presetIdx)} onChange={e => setPresetIdx(parseInt(e.target.value))} options={PLAN_PRESETS.map((p, i) => ({ value: String(i), label: p.label }))} />
          <Input label="GST %" type="number" value={gstRate} onChange={e => setGstRate(e.target.value)} />
        </div>
        {milestones.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={linkMilestones} onChange={e => setLinkMilestones(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            Trigger payments off existing milestones
          </label>
        )}
        <div className="border border-slate-100 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-xs text-slate-500 border-b border-slate-100"><th className="text-left px-3 py-2 font-medium">Split</th><th className="text-left px-2 py-2 font-medium">Trigger</th><th className="text-right px-3 py-2 font-medium">Incl. GST</th></tr></thead>
            <tbody>
              {preview.map((s, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2">#{s.split_number} <span className="text-slate-400">({percents[i]}%)</span></td>
                  <td className="px-2 py-2 text-slate-500">{i === 0 ? 'On booking' : linkMilestones && milestones[i - 1] ? milestones[i - 1].name : 'On date'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatINR(s.total_with_gst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || projectValue <= 0}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Create plan</Button>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceModal({
  open, onClose, splitId, firm, projectName, clientName,
}: {
  open: boolean;
  onClose: () => void;
  splitId: string;
  firm: { name: string; gstin: string; address: string };
  projectName: string;
  clientName: string;
}) {
  const store = useStore();
  const split = store.paymentSplits.find(s => s.id === splitId);
  if (!split) return <Modal open={open} onClose={onClose} title="Invoice"><p>Split not found.</p></Modal>;

  const invoiceNo = `INV-${split.project_id.slice(-4).toUpperCase()}-${String(split.split_number).padStart(2, '0')}`;

  return (
    <Modal open={open} onClose={onClose} title="GST Invoice" size="lg">
      <div className="space-y-6 text-sm" id="invoice">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{firm.name}</h2>
            <p className="text-slate-500 text-xs mt-1">{firm.address}</p>
            <p className="text-slate-500 text-xs">GSTIN: {firm.gstin}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-indigo-600">TAX INVOICE</div>
            <div className="text-xs text-slate-500 mt-1">Invoice No: {invoiceNo}</div>
            <div className="text-xs text-slate-500">Date: {formatDate(new Date().toISOString())}</div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bill To</div>
              <div className="font-medium text-slate-900">{clientName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Project</div>
              <div className="font-medium text-slate-900">{projectName}</div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 text-slate-500 font-medium">Description</th>
              <th className="text-right py-2 text-slate-500 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3">
                Payment Split #{split.split_number} — {projectName}
                <div className="text-xs text-slate-500 mt-0.5">
                  {split.trigger_type === 'date'
                    ? `Scheduled for ${formatDate(split.trigger_date!)}`
                    : 'Milestone-based trigger'}
                </div>
              </td>
              <td className="py-3 text-right font-medium">{formatINR(split.amount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-slate-200 pt-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatINR(split.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">CGST ({split.gst_rate / 2}%)</span>
            <span>{formatINR(split.gst_amount / 2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">SGST ({split.gst_rate / 2}%)</span>
            <span>{formatINR(split.gst_amount / 2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
            <span>Total</span>
            <span>{formatINR(split.total_with_gst)}</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
          <p>Amount in words: <b className="text-slate-700">{numberToWords(split.total_with_gst)} Rupees Only</b></p>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" size="sm">
            <Download className="w-3 h-3" /> Download PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertGroup(n: number): string {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '');
    return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertGroup(n % 100) : '');
  }

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;

  let result = '';
  if (crore) result += convertGroup(crore) + ' Crore ';
  if (lakh) result += convertGroup(lakh) + ' Lakh ';
  if (thousand) result += convertGroup(thousand) + ' Thousand ';
  if (rest) result += convertGroup(rest);
  return result.trim();
}
