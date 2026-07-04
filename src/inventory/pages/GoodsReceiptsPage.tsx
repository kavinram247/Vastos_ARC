import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useStore } from '../../hooks/useStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';
import { formatDate } from '../../utils/format';
import { PackageCheck } from 'lucide-react';
import { InvHeader, StatusBadge, AsyncState, EmptyState, AccessNotice, ActionBanner, fmtQty } from '../ui';
import { takePendingOpen } from '../nav';
import {
  listGoodsReceipts, getGoodsReceiptItems, listPurchaseOrders, getPoLineItems,
  saveGoodsReceipt, postGoodsReceipt,
} from '../inventoryApi';
import type { GoodsReceipt, GoodsReceiptItem, PurchaseOrder } from '../types';

type Row = {
  po_line_id: string | null; sku_id: string | null; material_name: string; uom: string;
  ordered_qty: number; prev_received_qty: number; delivered_qty: string; accepted_qty: string;
  rejected_qty: string; damaged_qty: string; rejection_reason: string; batch_ref: string; unit_cost: string;
};

export function GoodsReceiptsPage() {
  const { firm } = useAuth();
  const { can, canAccess } = usePermissions();
  const store = useStore();
  const firmId = firm?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<any | null>(null);
  const [detail, setDetail] = useState<{ grn: GoodsReceipt; items: GoodsReceiptItem[] } | null>(null);

  const receivablePos = useMemo(() => pos.filter(p => ['issued', 'partially_received'].includes(p.status)), [pos]);

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      const [g, p] = await Promise.all([listGoodsReceipts(firmId), listPurchaseOrders(firmId)]);
      setGrns(g); setPos(p);
      const poId = takePendingOpen('goods-receipts');
      if (poId) { const po = p.find(x => x.id === poId); if (po) await startFromPo(po); }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const projectName = (id?: string | null) => store.projects.find(p => p.id === id)?.name ?? id ?? '—';

  const startFromPo = async (po: PurchaseOrder) => {
    const lines = await getPoLineItems(po.id);
    const rows: Row[] = lines.map(l => {
      const remaining = Math.max(l.quantity - l.qty_received, 0);
      return {
        po_line_id: l.id, sku_id: l.sku_id, material_name: l.description, uom: l.uom,
        ordered_qty: l.quantity, prev_received_qty: l.qty_received,
        delivered_qty: String(remaining), accepted_qty: String(remaining),
        rejected_qty: '0', damaged_qty: '0', rejection_reason: '', batch_ref: '', unit_cost: String(l.rate),
      };
    });
    setEditor({ po_id: po.id, crm_project_id: po.crm_project_id, vendor_id: po.vendor_id, location: '', delivery_date: new Date().toISOString().slice(0, 10), challan_no: '', notes: '', rows });
  };

  const setRow = (i: number, patch: Partial<Row>) => setEditor((e: any) => ({ ...e, rows: e.rows.map((r: Row, idx: number) => idx === i ? { ...r, ...patch } : r) }));

  const save = async (postAfter: boolean) => {
    setBusy(true);
    try {
      const id = await saveGoodsReceipt(
        { po_id: editor.po_id, crm_project_id: editor.crm_project_id, vendor_id: editor.vendor_id, location: editor.location || null, delivery_date: editor.delivery_date, challan_no: editor.challan_no || null, notes: editor.notes || null },
        editor.rows.map((r: Row) => ({ po_line_id: r.po_line_id, sku_id: r.sku_id, material_name: r.material_name, uom: r.uom, ordered_qty: r.ordered_qty, prev_received_qty: r.prev_received_qty, delivered_qty: Number(r.delivered_qty || 0), accepted_qty: Number(r.accepted_qty || 0), rejected_qty: Number(r.rejected_qty || 0), damaged_qty: Number(r.damaged_qty || 0), rejection_reason: r.rejection_reason || null, batch_ref: r.batch_ref || null, unit_cost: r.unit_cost ? Number(r.unit_cost) : null })),
      );
      if (postAfter) await postGoodsReceipt(id);
      setEditor(null); setBanner({ kind: 'success', message: postAfter ? 'Goods receipt posted — stock updated.' : 'Draft receipt saved.' }); await load();
    } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  const openDetail = async (grn: GoodsReceipt) => setDetail({ grn, items: await getGoodsReceiptItems(grn.id) });
  const post = async (id: string) => {
    setBusy(true);
    try { await postGoodsReceipt(id); setDetail(null); setBanner({ kind: 'success', message: 'Goods receipt posted — stock updated.' }); await load(); }
    catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  if (!canAccess('goods_receipts')) return (<div className="space-y-6"><InvHeader title="Goods Receipts" /><AccessNotice label="Goods Receipts" /></div>);

  return (
    <div className="space-y-5">
      <InvHeader title="Goods Receipts" subtitle="Inspect deliveries against a PO. Only accepted quantities from a posted receipt increase stock." />
      {banner && <ActionBanner kind={banner.kind} message={banner.message} onClose={() => setBanner(null)} />}

      <AsyncState loading={loading} error={error}>
        {can('goods_receipts', 'create') && (
          <div className="surface-panel p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">Awaiting delivery</div>
            {receivablePos.length === 0 ? <div className="text-sm text-slate-500">No issued POs are awaiting goods.</div> : (
              <div className="flex flex-wrap gap-2">
                {receivablePos.map(po => (
                  <button key={po.id} onClick={() => startFromPo(po)}
                    className="flex items-center gap-2 rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-sm hover:border-indigo-300 hover:bg-indigo-50/40">
                    <PackageCheck className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium text-slate-800">{po.po_number}</span>
                    <span className="text-slate-500">{projectName(po.crm_project_id)}</span>
                    <StatusBadge status={po.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {grns.length === 0 ? (
          <EmptyState title="No goods receipts yet" message="Receive an issued PO to record delivered, accepted and rejected quantities." />
        ) : (
          <div className="surface-panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.04em] text-slate-500">
                <th className="px-4 py-2.5 font-semibold">GRN</th><th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold">Delivery</th><th className="px-4 py-2.5 font-semibold">Challan</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {grns.map(g => (
                  <tr key={g.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => openDetail(g)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{g.grn_number}</td>
                    <td className="px-4 py-3 text-slate-600">{projectName(g.crm_project_id)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{formatDate(g.delivery_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{g.challan_no ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={g.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncState>

      {editor && (
        <Modal open onClose={() => setEditor(null)} title="Goods receipt & inspection" size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input label="Delivery date" type="date" value={editor.delivery_date} onChange={e => setEditor({ ...editor, delivery_date: e.target.value })} />
              <Input label="Delivery challan #" value={editor.challan_no} onChange={e => setEditor({ ...editor, challan_no: e.target.value })} />
              <Input label="Location" value={editor.location} onChange={e => setEditor({ ...editor, location: e.target.value })} placeholder="site store" />
            </div>
            <div className="overflow-x-auto rounded-[10px] border border-slate-200">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-[0.03em] text-slate-500">
                  <th className="px-2 py-2 font-semibold">Material</th><th className="px-2 py-2 font-semibold">Ordered</th>
                  <th className="px-2 py-2 font-semibold">Prev.</th><th className="px-2 py-2 font-semibold">Delivered</th>
                  <th className="px-2 py-2 font-semibold">Accepted</th><th className="px-2 py-2 font-semibold">Rejected</th>
                  <th className="px-2 py-2 font-semibold">Damaged</th><th className="px-2 py-2 font-semibold">Batch</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {editor.rows.map((r: Row, i: number) => (
                    <tr key={i}>
                      <td className="px-2 py-2 text-slate-800">{r.material_name}<div className="text-xs text-slate-400">{r.uom}</div></td>
                      <td className="px-2 py-2 tabular-nums text-slate-500">{fmtQty(r.ordered_qty)}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-500">{fmtQty(r.prev_received_qty)}</td>
                      {(['delivered_qty', 'accepted_qty', 'rejected_qty', 'damaged_qty'] as const).map(f => (
                        <td key={f} className="px-2 py-2"><input type="number" min="0" value={(r as any)[f]} onChange={e => setRow(i, { [f]: e.target.value } as any)} className="h-8 w-20 rounded-md border border-slate-200 px-2 text-sm tabular-nums" /></td>
                      ))}
                      <td className="px-2 py-2"><input value={r.batch_ref} onChange={e => setRow(i, { batch_ref: e.target.value })} className="h-8 w-24 rounded-md border border-slate-200 px-2 text-sm" placeholder="batch" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Textarea label="Quality notes" value={editor.notes} onChange={e => setEditor({ ...editor, notes: e.target.value })} rows={2} />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>Cancel</Button>
              <Button variant="secondary" onClick={() => save(false)} disabled={busy}>Save draft</Button>
              {can('goods_receipts', 'approve') && <Button onClick={() => save(true)} disabled={busy}><PackageCheck className="h-4 w-4" /> Post &amp; add to stock</Button>}
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`${detail.grn.grn_number} · ${projectName(detail.grn.crm_project_id)}`} size="lg">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-500"><StatusBadge status={detail.grn.status} /><span>· {formatDate(detail.grn.delivery_date)}</span>{detail.grn.challan_no && <span>· challan {detail.grn.challan_no}</span>}</div>
            <div className="overflow-hidden rounded-[10px] border border-slate-200">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-[0.03em] text-slate-500">
                  <th className="px-3 py-2 font-semibold">Material</th><th className="px-3 py-2 font-semibold">Delivered</th>
                  <th className="px-3 py-2 font-semibold">Accepted</th><th className="px-3 py-2 font-semibold">Rejected/Dmg</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {detail.items.map(it => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-slate-800">{it.material_name}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">{fmtQty(it.delivered_qty, it.uom ?? undefined)}</td>
                      <td className="px-3 py-2 tabular-nums font-medium text-emerald-700">{fmtQty(it.accepted_qty)}</td>
                      <td className="px-3 py-2 tabular-nums text-red-600">{fmtQty(it.rejected_qty + it.damaged_qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.grn.status === 'draft' && can('goods_receipts', 'approve') && (
              <div className="flex justify-end border-t border-slate-100 pt-3">
                <Button onClick={() => post(detail.grn.id)} disabled={busy}><PackageCheck className="h-4 w-4" /> Post &amp; add to stock</Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
