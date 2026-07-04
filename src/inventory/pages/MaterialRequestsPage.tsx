import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useStore } from '../../hooks/useStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { formatDate } from '../../utils/format';
import type { Page } from '../../types';
import { Plus, Trash2, Send, Check, X, ShoppingCart, FileQuestion } from 'lucide-react';
import { InvHeader, StatusBadge, AsyncState, EmptyState, AccessNotice, ActionBanner, fmtQty } from '../ui';
import { setPendingOpen } from '../nav';
import {
  listMaterialRequests, getMaterialRequestItems, listMaterials, listStockPositions,
  saveMaterialRequest, submitMaterialRequest, decideMaterialRequest, cancelMaterialRequest,
  savePurchaseOrder, saveRfq,
} from '../inventoryApi';
import type { MaterialRequest, MaterialRequestItem, Material, StockPosition } from '../types';

type Row = { sku_id: string; material_name: string; uom: string; required_qty: string; required_by: string; specification: string };
const blankRow = (): Row => ({ sku_id: '', material_name: '', uom: '', required_qty: '', required_by: '', specification: '' });

const SOURCES = [
  { value: 'manual', label: 'Manual' }, { value: 'boq', label: 'BOQ plan' },
  { value: 'milestone', label: 'Milestone' }, { value: 'site', label: 'Site request' },
  { value: 'low_stock', label: 'Low stock' }, { value: 'scope_change', label: 'Scope change' },
  { value: 'replacement', label: 'Damage replacement' },
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

export function MaterialRequestsPage({ onNavigate }: { onNavigate: (p: Page, projectId?: string) => void }) {
  const { firm } = useAuth();
  const { can, canAccess } = usePermissions();
  const store = useStore();
  const firmId = firm?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const [editor, setEditor] = useState<{ open: boolean; id?: string; project: string; location: string; source: string; priority: string; required_by: string; notes: string; rows: Row[] } | null>(null);
  const [detail, setDetail] = useState<{ mr: MaterialRequest; items: MaterialRequestItem[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const matBySku = useMemo(() => new Map(materials.map(m => [m.sku_id, m])), [materials]);
  const posKey = (proj: string, sku: string) => `${proj}::${sku}`;
  const posMap = useMemo(() => new Map(positions.map(p => [posKey(p.project_id, p.sku_id), p])), [positions]);

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      const [r, m, p] = await Promise.all([listMaterialRequests(firmId), listMaterials(firmId), listStockPositions(firmId)]);
      setRequests(r); setMaterials(m); setPositions(p);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const projectName = (id?: string | null) => store.projects.find(p => p.id === id)?.name ?? id ?? '—';
  const materialOptions = [{ value: '', label: 'Select material…' }, ...materials.map(m => ({ value: m.sku_id, label: `${m.name}${m.brand ? ' · ' + m.brand : ''} (${m.base_uom})` }))];
  const projectOptions = [{ value: '', label: 'Select project…' }, ...store.projects.map(p => ({ value: p.id, label: p.name }))];

  const openNew = () => setEditor({ open: true, project: '', location: '', source: 'manual', priority: 'medium', required_by: '', notes: '', rows: [blankRow()] });

  const openEdit = async (mr: MaterialRequest) => {
    const items = await getMaterialRequestItems(mr.id);
    setEditor({
      open: true, id: mr.id, project: mr.project_id, location: mr.location ?? '', source: mr.source,
      priority: mr.priority, required_by: mr.required_by ?? '', notes: mr.notes ?? '',
      rows: items.map(it => ({ sku_id: it.sku_id ?? '', material_name: it.material_name, uom: it.uom ?? '', required_qty: String(it.required_qty), required_by: it.required_by ?? '', specification: it.specification ?? '' })),
    });
  };

  const setRow = (i: number, patch: Partial<Row>) => setEditor(e => e && ({ ...e, rows: e.rows.map((r, idx) => idx === i ? { ...r, ...patch } : r) }));
  const onPickMaterial = (i: number, sku: string) => {
    const m = matBySku.get(sku);
    setRow(i, { sku_id: sku, material_name: m?.name ?? '', uom: m?.base_uom ?? '' });
  };

  const saveDraft = async (submitAfter: boolean) => {
    if (!editor) return;
    if (!editor.project) { setBanner({ kind: 'error', message: 'Choose a project.' }); return; }
    const rows = editor.rows.filter(r => r.sku_id || r.material_name.trim());
    if (rows.length === 0) { setBanner({ kind: 'error', message: 'Add at least one material.' }); return; }
    setBusy(true);
    try {
      const id = await saveMaterialRequest(
        { id: editor.id, project_id: editor.project, location: editor.location || null, source: editor.source, priority: editor.priority, required_by: editor.required_by || null, notes: editor.notes || null },
        rows.map(r => ({ sku_id: r.sku_id || null, material_name: r.material_name, uom: r.uom || null, required_qty: Number(r.required_qty || 0), required_by: r.required_by || null, specification: r.specification || null })),
      );
      if (submitAfter) await submitMaterialRequest(id, 1);
      setEditor(null);
      setBanner({ kind: 'success', message: submitAfter ? 'Request submitted for approval.' : 'Draft saved.' });
      await load();
    } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  const openDetail = async (mr: MaterialRequest) => setDetail({ mr, items: await getMaterialRequestItems(mr.id) });

  const doAction = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { await fn(); setDetail(null); setBanner({ kind: 'success', message: ok }); await load(); }
    catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  // Approved MR → draft PO / RFQ (real workflow handoff, then open the target)
  const convertToPo = (mr: MaterialRequest, items: MaterialRequestItem[]) => doAction(async () => {
    const id = await savePurchaseOrder(
      { crm_project_id: mr.project_id, material_request_id: mr.id, required_by: mr.required_by },
      items.filter(i => i.sku_id).map(i => ({ sku_id: i.sku_id, description: i.material_name, uom: i.uom, quantity: i.approved_qty ?? i.required_qty, rate: 0, mr_item_id: i.id, boq_line_id: i.boq_line_id })),
    );
    setPendingOpen('purchase-orders', id); onNavigate('purchase-orders');
  }, 'Draft PO created from request.');

  const convertToRfq = (mr: MaterialRequest, items: MaterialRequestItem[]) => doAction(async () => {
    const id = await saveRfq(
      { project_id: mr.project_id, material_request_id: mr.id, priority: 'balanced', required_by: mr.required_by },
      items.filter(i => i.sku_id).map(i => ({ sku_id: i.sku_id, material_name: i.material_name, uom: i.uom, quantity: i.approved_qty ?? i.required_qty, required_by: i.required_by, boq_line_id: i.boq_line_id })),
      [],
    );
    setPendingOpen('rfqs', id); onNavigate('rfqs');
  }, 'RFQ drafted from request.');

  if (!canAccess('material_requests')) return (<div className="space-y-6"><InvHeader title="Material Requests" /><AccessNotice label="Material Requests" /></div>);

  return (
    <div className="space-y-5">
      <InvHeader title="Material Requests" subtitle="Site demand from BOQ, milestones and the field — routed to approval and procurement."
        actions={can('material_requests', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New request</Button>} />
      {banner && <ActionBanner kind={banner.kind} message={banner.message} onClose={() => setBanner(null)} />}

      <AsyncState loading={loading} error={error}>
        {requests.length === 0 ? (
          <EmptyState title="No material requests yet"
            message="Raise a request to pull material demand from a project, milestone or BOQ into procurement."
            action={can('material_requests', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New request</Button>} />
        ) : (
          <div className="surface-panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.04em] text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Request</th>
                  <th className="px-4 py-2.5 font-semibold">Project</th>
                  <th className="px-4 py-2.5 font-semibold">Priority</th>
                  <th className="px-4 py-2.5 font-semibold">Required by</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {requests.map(mr => (
                  <tr key={mr.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => openDetail(mr)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{mr.request_number}</td>
                    <td className="px-4 py-3 text-slate-600">{projectName(mr.project_id)}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{mr.priority}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{mr.required_by ? formatDate(mr.required_by) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={mr.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncState>

      {/* Create / edit */}
      {editor?.open && (
        <Modal open onClose={() => setEditor(null)} title={editor.id ? 'Edit material request' : 'New material request'} size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Project" value={editor.project} onChange={e => setEditor({ ...editor, project: e.target.value })} options={projectOptions} />
              <Input label="Site / location" value={editor.location} onChange={e => setEditor({ ...editor, location: e.target.value })} placeholder="e.g. Tower B, L3" />
              <Select label="Source" value={editor.source} onChange={e => setEditor({ ...editor, source: e.target.value })} options={SOURCES} />
              <Select label="Priority" value={editor.priority} onChange={e => setEditor({ ...editor, priority: e.target.value })} options={PRIORITIES} />
            </div>
            <Input label="Required by" type="date" value={editor.required_by} onChange={e => setEditor({ ...editor, required_by: e.target.value })} className="max-w-xs" />

            <div className="rounded-[10px] border border-slate-200">
              <div className="grid grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.03em] text-slate-500">
                <div className="col-span-4">Material</div><div className="col-span-2">Required</div>
                <div className="col-span-2">Available</div><div className="col-span-3">Specification</div><div className="col-span-1" />
              </div>
              {editor.rows.map((r, i) => {
                const p = editor.project && r.sku_id ? posMap.get(posKey(editor.project, r.sku_id)) : undefined;
                const suggested = Math.max(Number(r.required_qty || 0) - (p?.available ?? 0) - (p?.on_order ?? 0), 0);
                return (
                  <div key={i} className="grid grid-cols-12 items-center gap-2 border-b border-slate-50 px-3 py-2">
                    <div className="col-span-4"><Select value={r.sku_id} onChange={e => onPickMaterial(i, e.target.value)} options={materialOptions} /></div>
                    <div className="col-span-2 flex items-center gap-1">
                      <Input type="number" min="0" value={r.required_qty} onChange={e => setRow(i, { required_qty: e.target.value })} placeholder="0" />
                      <span className="text-xs text-slate-400">{r.uom}</span>
                    </div>
                    <div className="col-span-2 text-xs">
                      <span className="tabular-nums text-slate-700">{p ? fmtQty(p.available, r.uom) : '—'}</span>
                      {r.sku_id && <span className="block text-indigo-700">to buy ≈ {fmtQty(suggested)}</span>}
                    </div>
                    <div className="col-span-3"><Input value={r.specification} onChange={e => setRow(i, { specification: e.target.value })} placeholder="brand / grade / notes" /></div>
                    <div className="col-span-1 text-right">
                      <button aria-label="Remove row" onClick={() => setEditor({ ...editor, rows: editor.rows.filter((_, idx) => idx !== i) })}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setEditor({ ...editor, rows: [...editor.rows, blankRow()] })}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50/50">
                <Plus className="h-4 w-4" /> Add material
              </button>
            </div>

            <Textarea label="Notes" value={editor.notes} onChange={e => setEditor({ ...editor, notes: e.target.value })} rows={2} />

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>Cancel</Button>
              <Button variant="secondary" onClick={() => saveDraft(false)} disabled={busy}>Save draft</Button>
              <Button onClick={() => saveDraft(true)} disabled={busy}><Send className="h-4 w-4" /> Save &amp; submit</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail + workflow */}
      {detail && (
        <RequestDetail
          detail={detail} busy={busy} projectName={projectName} can={can}
          onClose={() => setDetail(null)}
          onEdit={() => { const mr = detail.mr; setDetail(null); openEdit(mr); }}
          onSubmit={() => doAction(() => submitMaterialRequest(detail.mr.id, detail.mr.version), 'Request submitted.')}
          onCancel={() => doAction(() => cancelMaterialRequest(detail.mr.id, 'Cancelled by user'), 'Request cancelled.')}
          onApprove={(approvals) => doAction(() => decideMaterialRequest(detail.mr.id, 'approve', null, approvals), 'Request approved.')}
          onReject={(reason) => doAction(() => decideMaterialRequest(detail.mr.id, 'reject', reason, {}), 'Request rejected.')}
          onToPo={() => convertToPo(detail.mr, detail.items)}
          onToRfq={() => convertToRfq(detail.mr, detail.items)}
        />
      )}
    </div>
  );
}

function RequestDetail({ detail, busy, projectName, can, onClose, onEdit, onSubmit, onCancel, onApprove, onReject, onToPo, onToRfq }: {
  detail: { mr: MaterialRequest; items: MaterialRequestItem[] }; busy: boolean;
  projectName: (id?: string | null) => string; can: (m: string, a: any) => boolean;
  onClose: () => void; onEdit: () => void; onSubmit: () => void; onCancel: () => void;
  onApprove: (a: Record<string, number>) => void; onReject: (reason: string) => void; onToPo: () => void; onToRfq: () => void;
}) {
  const { mr, items } = detail;
  const [approvals, setApprovals] = useState<Record<string, number>>(Object.fromEntries(items.map(i => [i.id, i.approved_qty ?? i.required_qty])));
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <Modal open onClose={onClose} title={`${mr.request_number} · ${projectName(mr.project_id)}`} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <StatusBadge status={mr.status} />
          <span className="capitalize">{mr.priority} priority</span>
          {mr.required_by && <span>· required {formatDate(mr.required_by)}</span>}
          {mr.requester_name && <span>· by {mr.requester_name}</span>}
        </div>
        {mr.rejected_reason && mr.status === 'rejected' && (
          <div className="rounded-[9px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Rejected: {mr.rejected_reason}</div>
        )}

        <div className="overflow-hidden rounded-[10px] border border-slate-200">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-[0.03em] text-slate-500">
              <th className="px-3 py-2 font-semibold">Material</th><th className="px-3 py-2 font-semibold">Required</th>
              <th className="px-3 py-2 font-semibold">Available</th><th className="px-3 py-2 font-semibold">On order</th>
              <th className="px-3 py-2 font-semibold">Suggested</th>
              {mr.status === 'submitted' && <th className="px-3 py-2 font-semibold">Approve</th>}
              {['approved', 'in_procurement', 'partially_ordered', 'ordered', 'fulfilled'].includes(mr.status) && <th className="px-3 py-2 font-semibold">Approved · Ordered</th>}
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(it => (
                <tr key={it.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{it.material_name}</div>
                    {it.specification && <div className="text-xs text-slate-500">{it.specification}</div>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{fmtQty(it.required_qty, it.uom)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{fmtQty(it.available_qty)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{fmtQty(it.on_order_qty)}</td>
                  <td className="px-3 py-2 tabular-nums font-medium text-indigo-700">{fmtQty(it.suggested_qty)}</td>
                  {mr.status === 'submitted' && (
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={approvals[it.id] ?? 0}
                        onChange={e => setApprovals({ ...approvals, [it.id]: Number(e.target.value) })}
                        className="h-8 w-20 rounded-md border border-slate-200 px-2 text-sm tabular-nums" />
                    </td>
                  )}
                  {['approved', 'in_procurement', 'partially_ordered', 'ordered', 'fulfilled'].includes(mr.status) && (
                    <td className="px-3 py-2 tabular-nums text-slate-700">{fmtQty(it.approved_qty ?? 0)} · {fmtQty(it.ordered_qty)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rejecting ? (
          <div className="space-y-2">
            <Textarea label="Rejection reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejecting(false)}>Back</Button>
              <Button variant="danger" onClick={() => onReject(reason)} disabled={busy || !reason.trim()}>Confirm reject</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            {mr.status === 'draft' && can('material_requests', 'edit') && <Button variant="secondary" onClick={onEdit} disabled={busy}>Edit</Button>}
            {mr.status === 'draft' && <Button onClick={onSubmit} disabled={busy}><Send className="h-4 w-4" /> Submit</Button>}
            {['draft', 'submitted', 'approved'].includes(mr.status) && can('material_requests', 'edit') && <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel request</Button>}
            {mr.status === 'submitted' && can('material_requests', 'approve') && (
              <>
                <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy}><X className="h-4 w-4" /> Reject</Button>
                <Button variant="success" onClick={() => onApprove(approvals)} disabled={busy}><Check className="h-4 w-4" /> Approve</Button>
              </>
            )}
            {['approved', 'in_procurement', 'partially_ordered'].includes(mr.status) && (
              <>
                {can('rfqs', 'create') && <Button variant="secondary" onClick={onToRfq} disabled={busy}><FileQuestion className="h-4 w-4" /> Create RFQ</Button>}
                {can('purchasing', 'create') && <Button onClick={onToPo} disabled={busy}><ShoppingCart className="h-4 w-4" /> Create PO</Button>}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
