import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useStore } from '../../hooks/useStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { formatINR, formatDate } from '../../utils/format';
import type { Page } from '../../types';
import { Plus, Trash2, Send, Check, X, PackageCheck, RotateCcw, Download } from 'lucide-react';
import { downloadPoDocx, type PoDocData } from '../../purchase/poDocx';
import { InvHeader, StatusBadge, AsyncState, EmptyState, AccessNotice, ActionBanner } from '../ui';
import { takePendingOpen, setPendingOpen } from '../nav';
import {
  listPurchaseOrders, getPoLineItems, listMaterials, savePurchaseOrder, submitPo, decidePo, issuePo,
} from '../inventoryApi';
import { fetchVendorsWithScores, type VendorWithScore } from '../../boq/vendorApi';
import type { PurchaseOrder, PoLineItem, Material } from '../types';

type Row = { sku_id: string; description: string; uom: string; quantity: string; rate: string; mr_item_id?: string | null; boq_line_id?: string | null };
const blankRow = (): Row => ({ sku_id: '', description: '', uom: '', quantity: '', rate: '' });
const money = (n: number) => Math.round(n * 100) / 100;

export function PurchaseOrdersPage({ onNavigate }: { onNavigate: (p: Page, projectId?: string) => void }) {
  const { firm, user } = useAuth();
  const { can, canAccess } = usePermissions();
  const store = useStore();
  const firmId = firm?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<VendorWithScore[]>([]);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [editor, setEditor] = useState<any | null>(null);
  const [detail, setDetail] = useState<{ po: PurchaseOrder; items: PoLineItem[] } | null>(null);

  const matBySku = useMemo(() => new Map(materials.map(m => [m.sku_id, m])), [materials]);

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      const [p, m, v] = await Promise.all([listPurchaseOrders(firmId), listMaterials(firmId), fetchVendorsWithScores(firmId)]);
      setPos(p); setMaterials(m); setVendors(v);
      const openId = takePendingOpen('purchase-orders');
      if (openId) { const po = p.find(x => x.id === openId); if (po) await openEdit(po); }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const projectName = (id?: string | null) => store.projects.find(p => p.id === id)?.name ?? id ?? '—';
  const vendorName = (id?: string | null) => vendors.find(v => v.id === id)?.company_name ?? '—';
  const projectOptions = [{ value: '', label: 'Select project…' }, ...store.projects.map(p => ({ value: p.id, label: p.name }))];
  const vendorOptions = [{ value: '', label: 'Select vendor…' }, ...vendors.map(v => ({ value: v.id, label: v.company_name }))];
  const materialOptions = [{ value: '', label: 'Material (optional)…' }, ...materials.map(m => ({ value: m.sku_id, label: `${m.name} (${m.base_uom})` }))];

  const openNew = () => setEditor({ project: '', vendor: '', required_by: '', delivery_date: '', gst_rate: '18', gst_type: 'inclusive', freight: '0', credit_days: '', notes: '', material_request_id: null, rows: [blankRow()] });

  const openEdit = async (po: PurchaseOrder) => {
    const items = await getPoLineItems(po.id);
    if (!['draft', 'needs_changes'].includes(po.status)) { setDetail({ po, items }); return; }
    setEditor({
      id: po.id, version: po.version, project: po.crm_project_id ?? '', vendor: po.vendor_id ?? '',
      required_by: po.required_by ?? '', delivery_date: po.delivery_date ?? '', gst_rate: String(po.gst_rate),
      gst_type: po.gst_type, freight: String(po.freight_charges), credit_days: '', notes: po.notes ?? '',
      material_request_id: po.material_request_id, rfq_id: po.rfq_id,
      rows: items.map(i => ({ sku_id: i.sku_id ?? '', description: i.description, uom: i.uom, quantity: String(i.quantity), rate: String(i.rate), mr_item_id: i.mr_item_id, boq_line_id: i.boq_line_id })),
    });
  };

  const setRow = (i: number, patch: Partial<Row>) => setEditor((e: any) => ({ ...e, rows: e.rows.map((r: Row, idx: number) => idx === i ? { ...r, ...patch } : r) }));
  const onPickMaterial = (i: number, sku: string) => { const m = matBySku.get(sku); setRow(i, { sku_id: sku, description: m?.name ?? '', uom: m?.base_uom ?? 'nos' }); };

  const totals = useMemo(() => {
    if (!editor) return { subtotal: 0, gst: 0, total: 0 };
    const sub = money(editor.rows.reduce((s: number, r: Row) => s + Number(r.quantity || 0) * Number(r.rate || 0), 0));
    const rate = Number(editor.gst_rate || 0); const freight = Number(editor.freight || 0);
    let gst: number, total: number;
    if (editor.gst_type === 'inclusive') { total = money(sub + freight); gst = money(total - total / (1 + rate / 100)); }
    else { gst = money(sub * rate / 100); total = money(sub + gst + freight); }
    return { subtotal: sub, gst, total };
  }, [editor]);

  const save = async (submitAfter: boolean) => {
    if (!editor.project) { setBanner({ kind: 'error', message: 'Choose a project.' }); return; }
    const rows = editor.rows.filter((r: Row) => r.description.trim() && Number(r.quantity) > 0);
    if (!rows.length) { setBanner({ kind: 'error', message: 'Add at least one line with a quantity.' }); return; }
    if (rows.some((r: Row) => !r.uom)) { setBanner({ kind: 'error', message: 'Every line needs a UOM.' }); return; }
    setBusy(true);
    try {
      const id = await savePurchaseOrder(
        { id: editor.id, crm_project_id: editor.project, vendor_id: editor.vendor || null, required_by: editor.required_by || null, delivery_date: editor.delivery_date || null, gst_rate: Number(editor.gst_rate || 0), gst_type: editor.gst_type, freight_charges: Number(editor.freight || 0), credit_days: editor.credit_days || null, notes: editor.notes || null, material_request_id: editor.material_request_id, rfq_id: editor.rfq_id },
        rows.map((r: Row) => ({ sku_id: r.sku_id || null, description: r.description, uom: r.uom, quantity: Number(r.quantity), rate: Number(r.rate || 0), mr_item_id: r.mr_item_id, boq_line_id: r.boq_line_id })),
      );
      if (submitAfter) await submitPo(id, editor.version ?? 1);
      setEditor(null); setBanner({ kind: 'success', message: submitAfter ? 'PO submitted for approval.' : 'PO saved.' }); await load();
    } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { await fn(); setDetail(null); setBanner({ kind: 'success', message: ok }); await load(); }
    catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  const downloadPo = (po: PurchaseOrder, items: PoLineItem[]) => {
    const vendor = vendors.find(v => v.id === po.vendor_id);
    const data: PoDocData = {
      poNumber: po.po_number,
      poDate: po.created_at,
      deliveryDate: po.delivery_date,
      projectName: projectName(po.crm_project_id),
      vendorName: vendor?.company_name ?? '—',
      deliveryAddress: po.notes ?? null,
      materialType: null,
      firm: {
        name: firm?.name ?? '',
        address: firm?.address ?? '',
        gstin: firm?.gstin ?? '',
        phone: undefined,
        email: undefined,
      },
      items: items.map(i => ({ description: i.description, quantity: i.quantity, uom: i.uom, rate: i.rate, amount: i.amount })),
      subtotal: po.subtotal,
      gstRate: po.gst_rate,
      gstType: (po.gst_type === 'exclusive' ? 'exclusive' : 'inclusive'),
      gstAmount: po.gst_amount,
      total: po.total_amount,
      creditDays: null,
      orderContactName: user?.full_name ?? null,
      orderContactPhone: user?.phone ?? null,
      deliveryContactName: null,
      deliveryContactPhone: null,
      signatoryName: user?.full_name ?? null,
    };
    try { downloadPoDocx(data); }
    catch (e: any) { setBanner({ kind: 'error', message: e.message || 'Could not generate PO document.' }); }
  };

  if (!canAccess('purchasing')) return (<div className="space-y-6"><InvHeader title="Purchase Orders" /><AccessNotice label="Purchase Orders" /></div>);

  return (
    <div className="space-y-5">
      <InvHeader title="Purchase Orders" subtitle="Approve, issue and receive against POs. Approval and issue never change physical stock — only receipts do."
        actions={can('purchasing', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New PO</Button>} />
      {banner && <ActionBanner kind={banner.kind} message={banner.message} onClose={() => setBanner(null)} />}

      <AsyncState loading={loading} error={error}>
        {pos.length === 0 ? (
          <EmptyState title="No purchase orders" message="Create a PO directly, or generate one from an approved material request or awarded RFQ."
            action={can('purchasing', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New PO</Button>} />
        ) : (
          <div className="surface-panel overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.04em] text-slate-500">
                <th className="px-4 py-2.5 font-semibold">PO</th><th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold">Vendor</th><th className="px-4 py-2.5 font-semibold">Required</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th><th className="px-4 py-2.5 font-semibold">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {pos.map(po => (
                  <tr key={po.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => openEdit(po)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{po.po_number}</td>
                    <td className="px-4 py-3 text-slate-600">{projectName(po.crm_project_id)}</td>
                    <td className="px-4 py-3 text-slate-600">{vendorName(po.vendor_id)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{po.required_by ? formatDate(po.required_by) : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">{formatINR(po.total_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncState>

      {editor && (
        <Modal open onClose={() => setEditor(null)} title={editor.id ? 'Edit purchase order' : 'New purchase order'} size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Select label="Project" value={editor.project} onChange={e => setEditor({ ...editor, project: e.target.value })} options={projectOptions} />
              <Select label="Vendor" value={editor.vendor} onChange={e => setEditor({ ...editor, vendor: e.target.value })} options={vendorOptions} />
              <Input label="Required by" type="date" value={editor.required_by} onChange={e => setEditor({ ...editor, required_by: e.target.value })} />
              <Select label="GST" value={editor.gst_type} onChange={e => setEditor({ ...editor, gst_type: e.target.value })} options={[{ value: 'inclusive', label: 'Inclusive' }, { value: 'exclusive', label: 'Exclusive' }]} />
              <Input label="GST %" type="number" value={editor.gst_rate} onChange={e => setEditor({ ...editor, gst_rate: e.target.value })} />
              <Input label="Freight (₹)" type="number" value={editor.freight} onChange={e => setEditor({ ...editor, freight: e.target.value })} />
            </div>

            <div className="rounded-[10px] border border-slate-200">
              <div className="grid grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.03em] text-slate-500">
                <div className="col-span-4">Item</div><div className="col-span-2">Qty · UOM</div><div className="col-span-2">Rate</div><div className="col-span-3 text-right">Amount</div><div className="col-span-1" />
              </div>
              {editor.rows.map((r: Row, i: number) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 border-b border-slate-50 px-3 py-2">
                  <div className="col-span-4 space-y-1">
                    <Select value={r.sku_id} onChange={e => onPickMaterial(i, e.target.value)} options={materialOptions} />
                    <Input value={r.description} onChange={e => setRow(i, { description: e.target.value })} placeholder="Description" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <Input type="number" value={r.quantity} onChange={e => setRow(i, { quantity: e.target.value })} placeholder="0" />
                    <Input value={r.uom} onChange={e => setRow(i, { uom: e.target.value })} placeholder="uom" className="w-16" />
                  </div>
                  <div className="col-span-2"><Input type="number" value={r.rate} onChange={e => setRow(i, { rate: e.target.value })} placeholder="0" /></div>
                  <div className="col-span-3 text-right tabular-nums text-sm text-slate-700">{formatINR(money(Number(r.quantity || 0) * Number(r.rate || 0)))}</div>
                  <div className="col-span-1 text-right">
                    <button aria-label="Remove" onClick={() => setEditor({ ...editor, rows: editor.rows.filter((_: Row, idx: number) => idx !== i) })} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => setEditor({ ...editor, rows: [...editor.rows, blankRow()] })} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50/50"><Plus className="h-4 w-4" /> Add line</button>
            </div>

            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex w-56 justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums">{formatINR(totals.subtotal)}</span></div>
              <div className="flex w-56 justify-between text-slate-500"><span>GST ({editor.gst_type})</span><span className="tabular-nums">{formatINR(totals.gst)}</span></div>
              <div className="flex w-56 justify-between font-semibold text-slate-900"><span>Total</span><span className="tabular-nums">{formatINR(totals.total)}</span></div>
            </div>
            <Textarea label="Notes / terms" value={editor.notes} onChange={e => setEditor({ ...editor, notes: e.target.value })} rows={2} />

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>Cancel</Button>
              <Button variant="secondary" onClick={() => save(false)} disabled={busy}>Save draft</Button>
              <Button onClick={() => save(true)} disabled={busy}><Send className="h-4 w-4" /> Save &amp; submit</Button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <PoDetail detail={detail} busy={busy} can={can} projectName={projectName} vendorName={vendorName}
          onClose={() => setDetail(null)}
          onDownload={() => downloadPo(detail.po, detail.items)}
          onApprove={() => act(() => decidePo(detail.po.id, 'approve', null), 'PO approved.')}
          onNeedsChanges={(n: string) => act(() => decidePo(detail.po.id, 'needs_changes', n), 'Sent back for changes.')}
          onReject={(n: string) => act(() => decidePo(detail.po.id, 'reject', n), 'PO cancelled.')}
          onIssue={() => act(() => issuePo(detail.po.id), 'PO issued.')}
          onReceive={() => { setPendingOpen('goods-receipts', detail.po.id); setDetail(null); onNavigate('goods-receipts'); }} />
      )}
    </div>
  );
}

function PoDetail({ detail, busy, can, projectName, vendorName, onClose, onDownload, onApprove, onNeedsChanges, onReject, onIssue, onReceive }: any) {
  const { po, items } = detail as { po: PurchaseOrder; items: PoLineItem[] };
  const [note, setNote] = useState('');
  return (
    <Modal open onClose={onClose} title={`${po.po_number} · ${projectName(po.crm_project_id)}`} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <StatusBadge status={po.status} /><span>{vendorName(po.vendor_id)}</span>
          <span>· {formatINR(po.total_amount)}</span>{po.required_by && <span>· required {formatDate(po.required_by)}</span>}
        </div>
        {po.admin_notes && <div className="rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{po.admin_notes}</div>}
        <div className="overflow-hidden rounded-[10px] border border-slate-200">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-[0.03em] text-slate-500">
              <th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Ordered</th>
              <th className="px-3 py-2 font-semibold">Received</th><th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(i => (
                <tr key={i.id}>
                  <td className="px-3 py-2 text-slate-800">{i.description}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{i.quantity} {i.uom}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{i.qty_received} {i.uom}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatINR(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {po.status === 'pending_approval' && can('purchasing', 'approve') && (
          <Input label="Review note (optional)" value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for changes / rejection" />
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onDownload}><Download className="h-4 w-4" /> Download PO</Button>
          {po.status === 'pending_approval' && can('purchasing', 'approve') && (
            <>
              <Button variant="ghost" onClick={() => onNeedsChanges(note || 'Please revise')} disabled={busy}><RotateCcw className="h-4 w-4" /> Needs changes</Button>
              <Button variant="danger" onClick={() => onReject(note || 'Rejected')} disabled={busy}><X className="h-4 w-4" /> Reject</Button>
              <Button variant="success" onClick={onApprove} disabled={busy}><Check className="h-4 w-4" /> Approve</Button>
            </>
          )}
          {po.status === 'approved' && can('purchasing', 'edit') && <Button onClick={onIssue} disabled={busy}><Send className="h-4 w-4" /> Issue PO</Button>}
          {['issued', 'partially_received'].includes(po.status) && can('goods_receipts', 'create') && <Button onClick={onReceive} disabled={busy}><PackageCheck className="h-4 w-4" /> Receive goods</Button>}
        </div>
      </div>
    </Modal>
  );
}
