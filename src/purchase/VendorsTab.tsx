// Vendors tab — supplier master (reuses the shared `vendors` table).
import { useMemo, useState } from 'react';
import { Truck, Loader2, Check } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { usePurchase } from './PurchaseManagementPage';
import { Toolbar, TableCard, Th, Td, RowActions, StatusChip, EmptyState, exportCsv } from './shared';
import { VENDOR_STATUS } from './types';
import type { PurchaseVendor, VendorStatus } from './types';
import { saveVendor, deleteVendor, type VendorInput } from './masterApi';

const STATUS_OPTS = Object.entries(VENDOR_STATUS).map(([value, c]) => ({ value, label: c.label }));

export function VendorsTab() {
  const { vendors, can, firmId, userId, reload } = usePurchase();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<PurchaseVendor | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vendors.filter(v => !q || `${v.company_name} ${v.vendor_code ?? ''} ${v.contact_person ?? ''} ${v.phone ?? ''} ${v.gstin ?? ''}`.toLowerCase().includes(q));
  }, [vendors, query]);

  const onDelete = async (v: PurchaseVendor) => {
    if (!confirm(`Delete vendor "${v.company_name}"? This can't be undone.`)) return;
    try { await deleteVendor(v.id); await reload(); }
    catch (e: any) { alert('Delete failed (vendor may be used by a PO): ' + e.message); }
  };

  const doExport = () => exportCsv('vendors', [
    { key: 'company_name', label: 'Vendor Name' }, { key: 'vendor_code', label: 'Vendor Code' },
    { key: 'contact_person', label: 'Contact Person' }, { key: 'phone', label: 'Mobile' },
    { key: 'email', label: 'Email' }, { key: 'gstin', label: 'GSTIN' }, { key: 'status', label: 'Status' },
  ], rows);

  return (
    <div className="space-y-4">
      <Toolbar query={query} onQuery={setQuery} onExport={can.export ? doExport : undefined}
        onAdd={can.create ? () => setAdding(true) : undefined} addLabel="Add vendor" />

      {rows.length === 0 ? (
        <EmptyState icon={Truck} title="No vendors yet" hint="Add suppliers here — the same list powers BOQ and Vendor Intelligence."
          action={can.create ? <Button size="sm" onClick={() => setAdding(true)}>Add vendor</Button> : undefined} />
      ) : (
        <TableCard>
          <thead>
            <tr className="border-b border-slate-200">
              <Th>Vendor</Th><Th>Code</Th><Th>Contact</Th><Th>Mobile</Th><Th>GSTIN</Th>
              <Th className="text-right">Score</Th><Th>Status</Th><Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(v => (
              <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <Td className="font-medium text-slate-900">{v.company_name}{v.category ? <span className="ml-1.5 text-xs font-normal text-slate-400">{v.category}</span> : null}</Td>
                <Td className="text-slate-500">{v.vendor_code || '—'}</Td>
                <Td className="text-slate-600">{v.contact_person || '—'}</Td>
                <Td className="tabular-nums text-slate-600">{v.phone || '—'}</Td>
                <Td className="text-slate-500">{v.gstin || '—'}</Td>
                <Td className="text-right tabular-nums">{v.overall_score != null ? <span className="font-semibold text-indigo-600">{v.overall_score}</span> : <span className="text-slate-300">—</span>}</Td>
                <Td><StatusChip map={VENDOR_STATUS} value={v.status} /></Td>
                <Td><RowActions onEdit={can.edit ? () => setEditing(v) : undefined} onDelete={can.delete ? () => onDelete(v) : undefined} /></Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {(adding || editing) && (
        <VendorForm vendor={editing} firmId={firmId} userId={userId}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={async () => { setAdding(false); setEditing(null); await reload(); }} />
      )}
    </div>
  );
}

function VendorForm({ vendor, firmId, userId, onClose, onSaved }: {
  vendor: PurchaseVendor | null; firmId: string; userId: string; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<VendorInput>({
    id: vendor?.id, company_name: vendor?.company_name ?? '', vendor_code: vendor?.vendor_code ?? '',
    contact_person: vendor?.contact_person ?? '', phone: vendor?.phone ?? '', email: vendor?.email ?? '',
    gstin: vendor?.gstin ?? '', category: vendor?.category ?? '', credit_days: vendor?.credit_days ?? null,
    payment_terms: vendor?.payment_terms ?? '', status: (vendor?.status as VendorStatus) ?? 'active', notes: vendor?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<VendorInput>) => setF(prev => ({ ...prev, ...p }));

  const submit = async () => {
    if (!f.company_name.trim()) return;
    setSaving(true);
    try { await saveVendor(f, firmId, userId); onSaved(); }
    catch (e: any) { alert('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={vendor ? 'Edit vendor' : 'Add vendor'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Vendor name *" value={f.company_name} onChange={e => set({ company_name: e.target.value })} placeholder="e.g. Sri Balaji Traders" />
          <Input label="Vendor code" value={f.vendor_code ?? ''} onChange={e => set({ vendor_code: e.target.value })} placeholder="e.g. VEN-014" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact person" value={f.contact_person ?? ''} onChange={e => set({ contact_person: e.target.value })} />
          <Input label="Mobile" value={f.phone ?? ''} onChange={e => set({ phone: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={f.email ?? ''} onChange={e => set({ email: e.target.value })} />
          <Input label="GSTIN" value={f.gstin ?? ''} onChange={e => set({ gstin: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Vendor type" value={f.category ?? ''} onChange={e => set({ category: e.target.value })} placeholder="Materials, MEP…" />
          <Input label="Credit days" type="number" value={f.credit_days ?? ''} onChange={e => set({ credit_days: e.target.value === '' ? null : parseInt(e.target.value) })} />
          <Select label="Status" value={f.status} onChange={e => set({ status: e.target.value })} options={STATUS_OPTS} />
        </div>
        <Input label="Payment terms" value={f.payment_terms ?? ''} onChange={e => set({ payment_terms: e.target.value })} placeholder="e.g. 50% advance, balance on delivery" />
        <Textarea label="Notes" rows={2} value={f.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !f.company_name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {vendor ? 'Save changes' : 'Add vendor'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
