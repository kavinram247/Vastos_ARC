// Material Requests tab — site-engineer intake (the CMR). Converts to RFQ / PO.
import { useMemo, useState } from 'react';
import { ClipboardList, Loader2, Check, Plus, X, FileText, ShoppingCart } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { formatDate } from '../utils/format';
import { usePurchase } from './PurchaseManagementPage';
import { Toolbar, TableCard, Th, Td, RowActions, StatusChip, EmptyState, ProjectSelect, StaffSelect, LineItemsEditor, exportCsv } from './shared';
import { REQUEST_STATUS } from './types';
import { projectName, profileName, todayStr, blankLine } from './logic';
import type { MaterialRequest, LineItem, ClientRequirement } from './types';
import { saveRequest, deleteRequest, createRfqFromRequest, type RequestInput } from './docsApi';
import { createPoFromRequest } from './poApi';

export function RequestsTab() {
  const { requests, materials, can, firmId, userId, reload, goTab } = usePurchase();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<MaterialRequest | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter(r => !q || `${r.request_number} ${projectName(r.project_id) ?? ''} ${r.plant_description ?? ''}`.toLowerCase().includes(q));
  }, [requests, query]);

  const toRfq = async (r: MaterialRequest) => {
    setBusy(r.id);
    try { await createRfqFromRequest(r, firmId, userId); await reload(); goTab('rfq'); }
    catch (e: any) { alert('Convert failed: ' + e.message); } finally { setBusy(null); }
  };
  const toPo = async (r: MaterialRequest) => {
    setBusy(r.id);
    try { await createPoFromRequest(r, firmId, userId); await reload(); goTab('orders'); }
    catch (e: any) { alert('Convert failed: ' + e.message); } finally { setBusy(null); }
  };
  const onDelete = async (r: MaterialRequest) => {
    if (!confirm(`Delete request ${r.request_number}?`)) return;
    try { await deleteRequest(r.id); await reload(); } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const doExport = () => exportCsv('material-requests', [
    { key: 'request_number', label: 'Request No.' }, { key: 'request_date', label: 'Date' },
    { key: 'project', label: 'Project' }, { key: 'engineer', label: 'Engineer' }, { key: 'items', label: 'Items' }, { key: 'status', label: 'Status' },
  ], rows.map(r => ({ ...r, project: projectName(r.project_id) ?? '', engineer: profileName(r.engineer_id) ?? '', items: r.items.length })));

  return (
    <div className="space-y-4">
      <Toolbar query={query} onQuery={setQuery} onExport={can.export ? doExport : undefined}
        onAdd={can.create ? () => setAdding(true) : undefined} addLabel="New request" />

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No material requests yet" hint="Site engineers raise requests here; convert them into an RFQ or purchase order in one click."
          action={can.create ? <Button size="sm" onClick={() => setAdding(true)}>New request</Button> : undefined} />
      ) : (
        <TableCard>
          <thead>
            <tr className="border-b border-slate-200">
              <Th>Request</Th><Th>Date</Th><Th>Project</Th><Th>Engineer</Th>
              <Th className="text-right">Items</Th><Th>Status</Th><Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <Td><div className="font-medium text-slate-900">{r.request_number}</div>{r.plant_description && <div className="text-xs text-slate-400">{r.plant_description}</div>}</Td>
                <Td className="text-slate-500">{formatDate(r.request_date)}</Td>
                <Td className="text-slate-600">{projectName(r.project_id) || '—'}</Td>
                <Td className="text-slate-600">{profileName(r.engineer_id) || '—'}</Td>
                <Td className="text-right tabular-nums text-slate-600">{r.items.length}</Td>
                <Td><StatusChip map={REQUEST_STATUS} value={r.status} /></Td>
                <Td>
                  <RowActions
                    onEdit={can.edit ? () => setEditing(r) : undefined}
                    onDelete={can.delete ? () => onDelete(r) : undefined}
                    extra={can.create && (r.status === 'open' || r.status === 'in_rfq') ? (
                      <>
                        {busy === r.id ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin text-slate-400" /> : null}
                        <button onClick={() => toRfq(r)} title="Create RFQ" className="rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"><FileText className="mr-0.5 inline h-3.5 w-3.5" />RFQ</button>
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
        <RequestForm request={editing} firmId={firmId} userId={userId} materials={materials}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={async () => { setAdding(false); setEditing(null); await reload(); }} />
      )}
    </div>
  );
}

function RequestForm({ request, firmId, userId, materials, onClose, onSaved }: {
  request: MaterialRequest | null; firmId: string; userId: string; materials: any[]; onClose: () => void; onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState<string | null>(request?.project_id ?? null);
  const [engineerId, setEngineerId] = useState<string | null>(request?.engineer_id ?? userId);
  const [date, setDate] = useState(request?.request_date ?? todayStr());
  const [plant, setPlant] = useState(request?.plant_description ?? '');
  const [days, setDays] = useState<string>(request?.total_days != null ? String(request.total_days) : '');
  const [notes, setNotes] = useState(request?.notes ?? '');
  const [reqs, setReqs] = useState<ClientRequirement[]>(request?.client_requirements ?? []);
  const [items, setItems] = useState<LineItem[]>(
    request?.items.map(i => ({ key: i.id, material_id: i.material_id, material_name: i.material_name, description: i.description ?? '', quantity: i.quantity, uom: i.uom || 'nos', rate: 0, required_by: i.required_by ?? '' })) ?? [blankLine()]
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const input: RequestInput = {
        id: request?.id, request_date: date, project_id: projectId, plant_description: plant,
        total_days: days === '' ? null : parseInt(days), engineer_id: engineerId,
        client_requirements: reqs.filter(r => r.requirement.trim()), notes, items,
      };
      await saveRequest(input, firmId, userId);
      onSaved();
    } catch (e: any) { alert('Save failed: ' + e.message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={request ? `Edit ${request.request_number}` : 'New material request'} size="xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <div className="col-span-1"><ProjectSelect value={projectId} onChange={setProjectId} /></div>
          <StaffSelect label="Engineer" value={engineerId} onChange={setEngineerId} />
          <Input label="Total days" type="number" value={days} onChange={e => setDays(e.target.value)} />
        </div>
        <Input label="Plant / area description" value={plant} onChange={e => setPlant(e.target.value)} placeholder="e.g. Tower B, 4th floor" />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">Client requirements</label>
            <button onClick={() => setReqs([...reqs, { requirement: '', before: '' }])} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"><Plus className="mr-0.5 inline h-3.5 w-3.5" />Add</button>
          </div>
          {reqs.length === 0 ? <p className="text-xs text-slate-400">Optional — what the client needs and by when.</p> : (
            <div className="space-y-2">
              {reqs.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input value={r.requirement} onChange={e => setReqs(reqs.map((x, i) => i === idx ? { ...x, requirement: e.target.value } : x))}
                    placeholder="Requirement" className="h-9 flex-1 rounded-md border border-slate-200 px-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                  <input type="date" value={r.before} onChange={e => setReqs(reqs.map((x, i) => i === idx ? { ...x, before: e.target.value } : x))}
                    className="h-9 rounded-md border border-slate-200 px-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                  <button onClick={() => setReqs(reqs.filter((_, i) => i !== idx))} className="rounded p-1 text-slate-300 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Material requirements</label>
          <LineItemsEditor items={items} onChange={setItems} materials={materials} mode="request" />
        </div>

        <Textarea label="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {request ? 'Save changes' : 'Create request'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
