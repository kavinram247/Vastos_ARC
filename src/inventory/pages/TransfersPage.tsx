import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useStore } from '../../hooks/useStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { formatDate } from '../../utils/format';
import { Plus, Trash2, Send, PackageCheck, ArrowRight } from 'lucide-react';
import { InvHeader, StatusBadge, AsyncState, EmptyState, AccessNotice, ActionBanner, fmtQty } from '../ui';
import {
  listTransfers, getTransferItems, listMaterials, listStockPositions,
  saveTransfer, dispatchTransfer, receiveTransfer,
} from '../inventoryApi';
import type { StockTransfer, Material, StockPosition } from '../types';

type Row = { sku_id: string; uom: string; quantity: string };

export function TransfersPage() {
  const { firm } = useAuth();
  const { can, canAccess } = usePermissions();
  const store = useStore();
  const firmId = firm?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<any | null>(null);
  const [detail, setDetail] = useState<{ t: StockTransfer; items: any[] } | null>(null);
  const [recv, setRecv] = useState<Record<string, string>>({});

  const matBySku = useMemo(() => new Map(materials.map(m => [m.sku_id, m])), [materials]);
  const posMap = useMemo(() => new Map(positions.map(p => [`${p.project_id}::${p.sku_id}`, p])), [positions]);

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      const [t, m, p] = await Promise.all([listTransfers(firmId), listMaterials(firmId), listStockPositions(firmId)]);
      setTransfers(t); setMaterials(m); setPositions(p);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const projectName = (id?: string | null) => store.projects.find(p => p.id === id)?.name ?? id ?? '—';
  const projectOptions = [{ value: '', label: 'Select project…' }, ...store.projects.map(p => ({ value: p.id, label: p.name }))];
  const materialOptions = [{ value: '', label: 'Material…' }, ...materials.map(m => ({ value: m.sku_id, label: `${m.name} (${m.base_uom})` }))];

  const openNew = () => setEditor({ from_project: '', to_project: '', from_location: '', to_location: '', note: '', rows: [{ sku_id: '', uom: '', quantity: '' } as Row] });
  const setRow = (i: number, patch: Partial<Row>) => setEditor((e: any) => ({ ...e, rows: e.rows.map((r: Row, idx: number) => idx === i ? { ...r, ...patch } : r) }));
  const onPick = (i: number, sku: string) => { const m = matBySku.get(sku); setRow(i, { sku_id: sku, uom: m?.base_uom ?? '' }); };

  const save = async (dispatch: boolean) => {
    if (!editor.from_project || !editor.to_project) { setBanner({ kind: 'error', message: 'Choose both projects.' }); return; }
    if (editor.from_project === editor.to_project) { setBanner({ kind: 'error', message: 'Source and destination must differ.' }); return; }
    const items = editor.rows.filter((r: Row) => r.sku_id && Number(r.quantity) > 0);
    if (!items.length) { setBanner({ kind: 'error', message: 'Add a material and quantity.' }); return; }
    setBusy(true);
    try {
      const id = await saveTransfer(
        { from_project: editor.from_project, to_project: editor.to_project, from_location: editor.from_location || null, to_location: editor.to_location || null, note: editor.note || null },
        items.map((r: Row) => ({ sku_id: r.sku_id, uom: r.uom, quantity: Number(r.quantity) })),
      );
      if (dispatch) await dispatchTransfer(id);
      setEditor(null); setBanner({ kind: 'success', message: dispatch ? 'Transfer dispatched — stock moved out.' : 'Draft saved.' }); await load();
    } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  const openDetail = async (t: StockTransfer) => {
    const items = await getTransferItems(t.id);
    setDetail({ t, items });
    setRecv(Object.fromEntries(items.map((i: any) => [i.id, String(i.dispatched_qty || i.quantity)])));
  };

  const doReceive = async () => {
    setBusy(true);
    try {
      await receiveTransfer(detail!.t.id, Object.fromEntries(Object.entries(recv).map(([k, v]) => [k, Number(v)])));
      setDetail(null); setBanner({ kind: 'success', message: 'Transfer received — stock added at destination.' }); await load();
    } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };
  const doDispatch = async () => {
    setBusy(true);
    try { await dispatchTransfer(detail!.t.id); setDetail(null); setBanner({ kind: 'success', message: 'Transfer dispatched.' }); await load(); }
    catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  if (!canAccess('transfers')) return (<div className="space-y-6"><InvHeader title="Transfers" /><AccessNotice label="Transfers" /></div>);

  return (
    <div className="space-y-5">
      <InvHeader title="Transfers & Returns" subtitle="Move stock between projects and sites. Every transfer posts a balanced pair of out/in ledger movements."
        actions={can('transfers', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New transfer</Button>} />
      {banner && <ActionBanner kind={banner.kind} message={banner.message} onClose={() => setBanner(null)} />}

      <AsyncState loading={loading} error={error}>
        {transfers.length === 0 ? (
          <EmptyState title="No transfers yet" message="Move surplus material between projects instead of over-purchasing."
            action={can('transfers', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New transfer</Button>} />
        ) : (
          <div className="surface-panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.04em] text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Transfer</th><th className="px-4 py-2.5 font-semibold">Route</th>
                <th className="px-4 py-2.5 font-semibold">Created</th><th className="px-4 py-2.5 font-semibold">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {transfers.map(t => (
                  <tr key={t.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => openDetail(t)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{t.transfer_number}</td>
                    <td className="px-4 py-3 text-slate-600"><span className="inline-flex items-center gap-1.5">{projectName(t.from_project)} <ArrowRight className="h-3.5 w-3.5 text-slate-400" /> {projectName(t.to_project)}</span></td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncState>

      {editor && (
        <Modal open onClose={() => setEditor(null)} title="New stock transfer" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="From project" value={editor.from_project} onChange={e => setEditor({ ...editor, from_project: e.target.value })} options={projectOptions} />
              <Select label="To project" value={editor.to_project} onChange={e => setEditor({ ...editor, to_project: e.target.value })} options={projectOptions} />
              <Input label="From location" value={editor.from_location} onChange={e => setEditor({ ...editor, from_location: e.target.value })} />
              <Input label="To location" value={editor.to_location} onChange={e => setEditor({ ...editor, to_location: e.target.value })} />
            </div>
            <div className="space-y-2">
              {editor.rows.map((r: Row, i: number) => {
                const p = editor.from_project && r.sku_id ? posMap.get(`${editor.from_project}::${r.sku_id}`) : undefined;
                const over = p && Number(r.quantity || 0) > p.available;
                return (
                  <div key={i} className="flex items-center gap-2 rounded-[10px] border border-slate-200 p-2.5">
                    <div className="flex-1"><Select value={r.sku_id} onChange={e => onPick(i, e.target.value)} options={materialOptions} /></div>
                    <Input type="number" min="0" value={r.quantity} onChange={e => setRow(i, { quantity: e.target.value })} placeholder="qty" className="w-24" />
                    <span className="w-12 text-xs text-slate-400">{r.uom}</span>
                    <span className={`w-24 text-right text-xs ${over ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{p ? `avail ${fmtQty(p.available)}` : ''}</span>
                    <button aria-label="Remove" onClick={() => setEditor({ ...editor, rows: editor.rows.filter((_: Row, idx: number) => idx !== i) })} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
              <button onClick={() => setEditor({ ...editor, rows: [...editor.rows, { sku_id: '', uom: '', quantity: '' }] })} className="flex w-full items-center gap-2 rounded-[9px] border border-dashed border-slate-200 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50/50"><Plus className="h-4 w-4" /> Add material</button>
            </div>
            <Textarea label="Note" value={editor.note} onChange={e => setEditor({ ...editor, note: e.target.value })} rows={2} />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>Cancel</Button>
              <Button variant="secondary" onClick={() => save(false)} disabled={busy}>Save draft</Button>
              <Button onClick={() => save(true)} disabled={busy}><Send className="h-4 w-4" /> Dispatch</Button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`${detail.t.transfer_number} · ${projectName(detail.t.from_project)} → ${projectName(detail.t.to_project)}`} size="lg">
          <div className="space-y-3">
            <StatusBadge status={detail.t.status} />
            <div className="overflow-hidden rounded-[10px] border border-slate-200">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-[0.03em] text-slate-500">
                  <th className="px-3 py-2 font-semibold">Material</th><th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Dispatched</th>
                  {detail.t.status === 'dispatched' && <th className="px-3 py-2 font-semibold">Receive</th>}
                  {detail.t.status === 'received' && <th className="px-3 py-2 font-semibold">Received</th>}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {detail.items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-slate-800">{matBySku.get(it.sku_id)?.name ?? it.sku_id}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">{fmtQty(it.quantity, it.uom)}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">{fmtQty(it.dispatched_qty)}</td>
                      {detail.t.status === 'dispatched' && (
                        <td className="px-3 py-2"><input type="number" min="0" value={recv[it.id] ?? ''} onChange={e => setRecv({ ...recv, [it.id]: e.target.value })} className="h-8 w-20 rounded-md border border-slate-200 px-2 text-sm tabular-nums" /></td>
                      )}
                      {detail.t.status === 'received' && <td className="px-3 py-2 tabular-nums font-medium text-emerald-700">{fmtQty(it.received_qty)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              {detail.t.status === 'draft' && can('transfers', 'create') && <Button onClick={doDispatch} disabled={busy}><Send className="h-4 w-4" /> Dispatch</Button>}
              {detail.t.status === 'dispatched' && can('transfers', 'approve') && <Button onClick={doReceive} disabled={busy}><PackageCheck className="h-4 w-4" /> Confirm receipt</Button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
