// Work Orders tab — contractor work orders (labour / sub-contract scope).
import { useMemo, useState } from 'react';
import { Hammer, Loader2, Check } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { formatDate, formatINR } from '../utils/format';
import { usePurchase } from './PurchaseManagementPage';
import { Toolbar, TableCard, Th, Td, RowActions, StatusChip, EmptyState, ProjectSelect, VendorSelect, exportCsv } from './shared';
import { WORK_ORDER_STATUS } from './types';
import { projectName, todayStr } from './logic';
import type { WorkOrder } from './types';
import { saveWorkOrder, deleteWorkOrder, type WorkOrderInput } from './docsApi';

const STATUS_OPTS = Object.entries(WORK_ORDER_STATUS).map(([value, c]) => ({ value, label: c.label }));

export function WorkOrdersTab() {
  const { workOrders, vendors, can, firmId, userId, reload } = usePurchase();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [adding, setAdding] = useState(false);
  const vendorName = (id: string | null) => (id && vendors.find(v => v.id === id)?.company_name) || '—';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workOrders.filter(w => !q || `${w.wo_number} ${w.title} ${projectName(w.project_id) ?? ''}`.toLowerCase().includes(q));
  }, [workOrders, query]);

  const onDelete = async (w: WorkOrder) => {
    if (!confirm(`Delete work order ${w.wo_number}?`)) return;
    try { await deleteWorkOrder(w.id); await reload(); } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const doExport = () => exportCsv('work-orders', [
    { key: 'wo_number', label: 'WO No.' }, { key: 'title', label: 'Title' }, { key: 'wo_date', label: 'Date' },
    { key: 'project', label: 'Project' }, { key: 'contractor', label: 'Contractor' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' },
  ], rows.map(w => ({ ...w, project: projectName(w.project_id) ?? '', contractor: vendorName(w.contractor_vendor_id) })));

  return (
    <div className="space-y-4">
      <Toolbar query={query} onQuery={setQuery} onExport={can.export ? doExport : undefined}
        onAdd={can.create ? () => setAdding(true) : undefined} addLabel="New work order" />

      {rows.length === 0 ? (
        <EmptyState icon={Hammer} title="No work orders yet" hint="Issue scope-of-work orders to contractors and track them by project."
          action={can.create ? <Button size="sm" onClick={() => setAdding(true)}>New work order</Button> : undefined} />
      ) : (
        <TableCard>
          <thead>
            <tr className="border-b border-slate-200">
              <Th>Work order</Th><Th>Date</Th><Th>Project</Th><Th>Contractor</Th>
              <Th className="text-right">Amount</Th><Th>Status</Th><Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(w => (
              <tr key={w.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <Td><div className="font-medium text-slate-900">{w.title || '—'}</div><div className="text-xs text-slate-400">{w.wo_number}</div></Td>
                <Td className="text-slate-500">{formatDate(w.wo_date)}</Td>
                <Td className="text-slate-600">{projectName(w.project_id) || '—'}</Td>
                <Td className="text-slate-600">{vendorName(w.contractor_vendor_id)}</Td>
                <Td className="text-right tabular-nums text-slate-700">{w.amount != null ? formatINR(w.amount) : '—'}</Td>
                <Td><StatusChip map={WORK_ORDER_STATUS} value={w.status} /></Td>
                <Td><RowActions onEdit={can.edit ? () => setEditing(w) : undefined} onDelete={can.delete ? () => onDelete(w) : undefined} /></Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {(adding || editing) && (
        <WorkOrderForm wo={editing} firmId={firmId} userId={userId}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={async () => { setAdding(false); setEditing(null); await reload(); }} />
      )}
    </div>
  );
}

function WorkOrderForm({ wo, firmId, userId, onClose, onSaved }: {
  wo: WorkOrder | null; firmId: string; userId: string; onClose: () => void; onSaved: () => void;
}) {
  const { vendors } = usePurchase();
  const [f, setF] = useState<WorkOrderInput>({
    id: wo?.id, title: wo?.title ?? '', project_id: wo?.project_id ?? null, contractor_vendor_id: wo?.contractor_vendor_id ?? null,
    wo_date: wo?.wo_date ?? todayStr(), amount: wo?.amount ?? null, status: wo?.status ?? 'draft',
    work_description: wo?.work_description ?? '', terms_of_payment: wo?.terms_of_payment ?? '',
    terms_conditions: wo?.terms_conditions ?? '', additional_work: wo?.additional_work ?? '',
    bank_details: wo?.bank_details ?? '', notes: wo?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<WorkOrderInput>) => setF(prev => ({ ...prev, ...p }));

  const submit = async () => {
    if (!f.title.trim()) return;
    setSaving(true);
    try { await saveWorkOrder(f, firmId, userId); onSaved(); }
    catch (e: any) { alert('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={wo ? `Edit ${wo.wo_number}` : 'New work order'} size="lg">
      <div className="space-y-4">
        <Input label="Title *" value={f.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. False ceiling — Level 2" />
        <div className="grid grid-cols-2 gap-3">
          <ProjectSelect value={f.project_id} onChange={v => set({ project_id: v })} />
          <VendorSelect label="Contractor" value={f.contractor_vendor_id} onChange={v => set({ contractor_vendor_id: v })} vendors={vendors} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Date" type="date" value={f.wo_date} onChange={e => set({ wo_date: e.target.value })} />
          <Input label="Amount (₹)" type="number" value={f.amount ?? ''} onChange={e => set({ amount: e.target.value === '' ? null : parseFloat(e.target.value) })} />
          <Select label="Status" value={f.status} onChange={e => set({ status: e.target.value as WorkOrder['status'] })} options={STATUS_OPTS} />
        </div>
        <Textarea label="Work description" rows={3} value={f.work_description ?? ''} onChange={e => set({ work_description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Textarea label="Terms of payment" rows={2} value={f.terms_of_payment ?? ''} onChange={e => set({ terms_of_payment: e.target.value })} />
          <Textarea label="Terms & conditions" rows={2} value={f.terms_conditions ?? ''} onChange={e => set({ terms_conditions: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Textarea label="Additional work" rows={2} value={f.additional_work ?? ''} onChange={e => set({ additional_work: e.target.value })} />
          <Textarea label="Bank details" rows={2} value={f.bank_details ?? ''} onChange={e => set({ bank_details: e.target.value })} />
        </div>
        <Textarea label="Notes" rows={2} value={f.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !f.title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {wo ? 'Save changes' : 'Create work order'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
