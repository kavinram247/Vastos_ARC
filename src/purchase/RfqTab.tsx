// RFQ tab — request for quotation (items + vendors contacted). Converts to PO.
import { useMemo, useState } from 'react';
import { FileText, Loader2, Check, Plus, X, ShoppingCart, Send } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { formatDate } from '../utils/format';
import { usePurchase } from './PurchaseManagementPage';
import { Toolbar, TableCard, Th, Td, RowActions, StatusChip, EmptyState, ProjectSelect, LineItemsEditor, exportCsv } from './shared';
import { RFQ_STATUS } from './types';
import { projectName, todayStr, blankLine } from './logic';
import type { Rfq, LineItem, RfqVendorStatus } from './types';
import { saveRfq, deleteRfq, type RfqInput } from './docsApi';
import { createPoFromRfq } from './poApi';

const STATUS_OPTS = Object.entries(RFQ_STATUS).map(([value, c]) => ({ value, label: c.label }));
const VSTATUS_OPTS: { value: RfqVendorStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' }, { value: 'sent', label: 'Sent' }, { value: 'responded', label: 'Responded' }, { value: 'declined', label: 'Declined' },
];

type VendorRow = { vendor_id: string | null; vendor_name: string; mobile: string | null; sent_date: string | null; status: RfqVendorStatus; quoted_amount: number | null };

export function RfqTab() {
  const { rfqs, materials, can, firmId, userId, reload, goTab } = usePurchase();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Rfq | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rfqs.filter(r => !q || `${r.rfq_number} ${projectName(r.project_id) ?? ''} ${r.material_type ?? ''}`.toLowerCase().includes(q));
  }, [rfqs, query]);

  const toPo = async (r: Rfq) => {
    setBusy(r.id);
    try { await createPoFromRfq(r, firmId, userId); await reload(); goTab('orders'); }
    catch (e: any) { alert('Convert failed: ' + e.message); } finally { setBusy(null); }
  };
  const onDelete = async (r: Rfq) => {
    if (!confirm(`Delete ${r.rfq_number}?`)) return;
    try { await deleteRfq(r.id); await reload(); } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const doExport = () => exportCsv('rfqs', [
    { key: 'rfq_number', label: 'RFQ No.' }, { key: 'rfq_date', label: 'Date' }, { key: 'project', label: 'Project' },
    { key: 'material_type', label: 'Material Type' }, { key: 'vendors', label: 'Vendors' }, { key: 'status', label: 'Status' },
  ], rows.map(r => ({ ...r, project: projectName(r.project_id) ?? '', vendors: r.vendors.length })));

  return (
    <div className="space-y-4">
      <Toolbar query={query} onQuery={setQuery} onExport={can.export ? doExport : undefined}
        onAdd={can.create ? () => setAdding(true) : undefined} addLabel="New RFQ" />

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No RFQs yet" hint="Collect quotes from multiple vendors, then convert the winner into a purchase order."
          action={can.create ? <Button size="sm" onClick={() => setAdding(true)}>New RFQ</Button> : undefined} />
      ) : (
        <TableCard>
          <thead>
            <tr className="border-b border-slate-200">
              <Th>RFQ</Th><Th>Date</Th><Th>Project</Th><Th>Material type</Th>
              <Th className="text-right">Vendors</Th><Th>Status</Th><Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <Td className="font-medium text-slate-900">{r.rfq_number}</Td>
                <Td className="text-slate-500">{formatDate(r.rfq_date)}</Td>
                <Td className="text-slate-600">{projectName(r.project_id) || '—'}</Td>
                <Td className="text-slate-600">{r.material_type || '—'}</Td>
                <Td className="text-right tabular-nums text-slate-600">{r.vendors.length}</Td>
                <Td><StatusChip map={RFQ_STATUS} value={r.status} /></Td>
                <Td>
                  <RowActions
                    onEdit={can.edit ? () => setEditing(r) : undefined}
                    onDelete={can.delete ? () => onDelete(r) : undefined}
                    extra={can.create && r.status !== 'closed' ? (
                      <>
                        {busy === r.id ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin text-slate-400" /> : null}
                        <button onClick={() => toPo(r)} title="Create Purchase Order" className="rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"><ShoppingCart className="mr-0.5 inline h-3.5 w-3.5" />PO</button>
                      </>
                    ) : undefined}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {(adding || editing) && (
        <RfqForm rfq={editing} firmId={firmId} userId={userId} materials={materials}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={async () => { setAdding(false); setEditing(null); await reload(); }} />
      )}
    </div>
  );
}

function RfqForm({ rfq, firmId, userId, materials, onClose, onSaved }: {
  rfq: Rfq | null; firmId: string; userId: string; materials: any[]; onClose: () => void; onSaved: () => void;
}) {
  const { vendors } = usePurchase();
  const [projectId, setProjectId] = useState<string | null>(rfq?.project_id ?? null);
  const [date, setDate] = useState(rfq?.rfq_date ?? todayStr());
  const [materialType, setMaterialType] = useState(rfq?.material_type ?? '');
  const [status, setStatus] = useState<Rfq['status']>(rfq?.status ?? 'draft');
  const [validUntil, setValidUntil] = useState(rfq?.quote_valid_until ?? '');
  const [notes, setNotes] = useState(rfq?.notes ?? '');
  const [items, setItems] = useState<LineItem[]>(
    rfq?.items.map(i => ({ key: i.id, material_id: i.material_id, material_name: i.material_name, quantity: i.quantity, uom: i.uom || 'nos', rate: i.unit_price ?? 0 })) ?? [blankLine()]
  );
  const [vrows, setVrows] = useState<VendorRow[]>(
    rfq?.vendors.map(v => ({ vendor_id: v.vendor_id, vendor_name: v.vendor_name, mobile: v.mobile, sent_date: v.sent_date, status: v.status, quoted_amount: v.quoted_amount })) ?? []
  );
  const [saving, setSaving] = useState(false);

  const addVendorRow = () => setVrows([...vrows, { vendor_id: null, vendor_name: '', mobile: '', sent_date: todayStr(), status: 'pending', quoted_amount: null }]);
  const setVendorRow = (idx: number, patch: Partial<VendorRow>) => setVrows(vrows.map((v, i) => i === idx ? { ...v, ...patch } : v));
  const pickVendor = (idx: number, id: string) => {
    const v = vendors.find(x => x.id === id);
    setVendorRow(idx, v ? { vendor_id: v.id, vendor_name: v.company_name, mobile: v.phone } : { vendor_id: null });
  };

  const submit = async () => {
    setSaving(true);
    try {
      const input: RfqInput = {
        id: rfq?.id, rfq_date: date, project_id: projectId, material_type: materialType, status,
        quote_valid_until: validUntil || null, material_request_id: rfq?.material_request_id ?? null,
        notes, items, vendors: vrows,
      };
      await saveRfq(input, firmId, userId);
      onSaved();
    } catch (e: any) { alert('Save failed: ' + e.message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={rfq ? `Edit ${rfq.rfq_number}` : 'New RFQ'} size="xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input label="RFQ date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <ProjectSelect value={projectId} onChange={setProjectId} />
          <Input label="Material type" value={materialType} onChange={e => setMaterialType(e.target.value)} placeholder="Plumbing…" />
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as Rfq['status'])} options={STATUS_OPTS} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-1/2">
          <Input label="Quote valid until" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Items required</label>
          <LineItemsEditor items={items} onChange={setItems} materials={materials} mode="rfq" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">Vendors contacted</label>
            <button onClick={addVendorRow} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"><Plus className="mr-0.5 inline h-3.5 w-3.5" />Add vendor</button>
          </div>
          {vrows.length === 0 ? <p className="text-xs text-slate-400">Add the vendors you're requesting quotes from.</p> : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-2 py-2 text-left font-medium">Vendor</th><th className="px-2 py-2 text-left font-medium w-28">Mobile</th>
                  <th className="px-2 py-2 text-left font-medium w-36">Sent</th><th className="px-2 py-2 text-left font-medium w-32">Status</th>
                  <th className="px-2 py-2 text-right font-medium w-28">Quote (₹)</th><th className="w-9" />
                </tr></thead>
                <tbody>
                  {vrows.map((v, idx) => (
                    <tr key={idx} className="border-b border-slate-50 last:border-0">
                      <td className="px-2 py-1.5">
                        <select value={v.vendor_id ?? ''} onChange={e => pickVendor(idx, e.target.value)}
                          className="w-full min-w-32 rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none">
                          <option value="">— Custom —</option>
                          {vendors.map(vd => <option key={vd.id} value={vd.id}>{vd.company_name}</option>)}
                        </select>
                        {!v.vendor_id && <input value={v.vendor_name} onChange={e => setVendorRow(idx, { vendor_name: e.target.value })} placeholder="Vendor name" className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />}
                      </td>
                      <td className="px-2 py-1.5"><input value={v.mobile ?? ''} onChange={e => setVendorRow(idx, { mobile: e.target.value })} className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" /></td>
                      <td className="px-2 py-1.5"><input type="date" value={v.sent_date ?? ''} onChange={e => setVendorRow(idx, { sent_date: e.target.value })} className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" /></td>
                      <td className="px-2 py-1.5">
                        <select value={v.status} onChange={e => setVendorRow(idx, { status: e.target.value as RfqVendorStatus })} className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none">
                          {VSTATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><input type="number" value={v.quoted_amount ?? ''} onChange={e => setVendorRow(idx, { quoted_amount: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none" /></td>
                      <td className="px-1 py-1.5 text-right"><button onClick={() => setVrows(vrows.filter((_, i) => i !== idx))} className="rounded p-1 text-slate-300 hover:text-red-600"><X className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Textarea label="Notes / delivery instructions" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-400"><Send className="h-3.5 w-3.5" /> Set status to <strong>Sent</strong> once you've shared it with vendors.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {rfq ? 'Save changes' : 'Create RFQ'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
