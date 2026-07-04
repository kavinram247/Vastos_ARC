import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useStore } from '../../hooks/useStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { formatDateTime, formatDate, statusLabel } from '../../utils/format';
import { Plus, Trash2, RotateCcw, Check, X, ClipboardCheck } from 'lucide-react';
import { InvHeader, StatusBadge, AsyncState, EmptyState, AccessNotice, ActionBanner, fmtQty } from '../ui';
import {
  listStockPositions, listMovements, listMaterials, listCounts, listAdjustments,
  saveCount, postCount, saveAdjustment, submitAdjustment, decideAdjustment, reverseMovement,
} from '../inventoryApi';
import type { StockPosition, StockMovement, Material, PhysicalCount, StockAdjustment } from '../types';

type Tab = 'stock' | 'movements' | 'counts' | 'adjustments';
const ADJ_KINDS = [
  { value: 'negative', label: 'Negative (loss)' }, { value: 'positive', label: 'Positive (found)' },
  { value: 'write_off', label: 'Damage / write-off' }, { value: 'supplier_return', label: 'Supplier return' },
];

export function StockPage() {
  const { firm } = useAuth();
  const { can, canAccess } = usePermissions();
  const store = useStore();
  const firmId = firm?.id;

  const [tab, setTab] = useState<Tab>('stock');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [counts, setCounts] = useState<PhysicalCount[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [countEditor, setCountEditor] = useState<any | null>(null);
  const [adjEditor, setAdjEditor] = useState<any | null>(null);

  const matBySku = useMemo(() => new Map(materials.map(m => [m.sku_id, m])), [materials]);
  const matName = (sku?: string | null) => (sku && matBySku.get(sku)?.name) || sku || '—';
  const projectName = (id?: string | null) => store.projects.find(p => p.id === id)?.name ?? id ?? '—';

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      const [p, mv, m, c, a] = await Promise.all([
        listStockPositions(firmId), listMovements(firmId, { limit: 400 }), listMaterials(firmId),
        listCounts(firmId), listAdjustments(firmId),
      ]);
      setPositions(p); setMoves(mv); setMaterials(m); setCounts(c); setAdjustments(a);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const projectOptions = [{ value: '', label: 'All projects' }, ...store.projects.map(p => ({ value: p.id, label: p.name }))];
  const projectPick = [{ value: '', label: 'Select project…' }, ...store.projects.map(p => ({ value: p.id, label: p.name }))];
  const materialOptions = [{ value: '', label: 'Material…' }, ...materials.map(m => ({ value: m.sku_id, label: `${m.name} (${m.base_uom})` }))];

  const shownPositions = positions.filter(p => (!projectFilter || p.project_id === projectFilter) && (p.on_hand !== 0 || p.reserved !== 0 || p.on_order !== 0));
  const shownMoves = moves.filter(m => !projectFilter || m.project_id === projectFilter);

  const act = async (fn: () => Promise<any>, ok: string, close?: () => void) => {
    setBusy(true);
    try { await fn(); close?.(); setBanner({ kind: 'success', message: ok }); await load(); }
    catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  // count editor
  const openCount = () => setCountEditor({ project: '', location: '', note: '', rows: [{ sku_id: '', uom: '', counted_qty: '' }] });
  const setCountRow = (i: number, patch: any) => setCountEditor((e: any) => ({ ...e, rows: e.rows.map((r: any, idx: number) => idx === i ? { ...r, ...patch } : r) }));
  const saveCountDoc = (postAfter: boolean) => {
    if (!countEditor.project) { setBanner({ kind: 'error', message: 'Choose a project.' }); return; }
    const items = countEditor.rows.filter((r: any) => r.sku_id);
    if (!items.length) { setBanner({ kind: 'error', message: 'Add at least one material.' }); return; }
    act(async () => {
      const id = await saveCount({ crm_project_id: countEditor.project, location: countEditor.location || null, note: countEditor.note || null },
        items.map((r: any) => ({ sku_id: r.sku_id, uom: r.uom, counted_qty: Number(r.counted_qty || 0) })));
      if (postAfter) await postCount(id);
    }, postAfter ? 'Count posted — variance booked.' : 'Count saved.', () => setCountEditor(null));
  };

  // adjustment editor
  const openAdj = () => setAdjEditor({ project: '', kind: 'negative', reason: '', evidence: '', rows: [{ sku_id: '', uom: '', quantity: '' }] });
  const setAdjRow = (i: number, patch: any) => setAdjEditor((e: any) => ({ ...e, rows: e.rows.map((r: any, idx: number) => idx === i ? { ...r, ...patch } : r) }));
  const saveAdjDoc = (submitAfter: boolean) => {
    if (!adjEditor.project || !adjEditor.reason.trim()) { setBanner({ kind: 'error', message: 'Project and reason are required.' }); return; }
    const items = adjEditor.rows.filter((r: any) => r.sku_id && Number(r.quantity) > 0);
    if (!items.length) { setBanner({ kind: 'error', message: 'Add at least one material.' }); return; }
    act(async () => {
      const id = await saveAdjustment({ crm_project_id: adjEditor.project, kind: adjEditor.kind, reason: adjEditor.reason, evidence_url: adjEditor.evidence || null },
        items.map((r: any) => ({ sku_id: r.sku_id, uom: r.uom, quantity: Number(r.quantity) })));
      if (submitAfter) await submitAdjustment(id);
    }, submitAfter ? 'Adjustment submitted for approval.' : 'Adjustment saved.', () => setAdjEditor(null));
  };

  if (!canAccess('stock')) return (<div className="space-y-6"><InvHeader title="Stock & Movements" /><AccessNotice label="Stock" /></div>);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'stock', label: 'Current stock' }, { id: 'movements', label: 'Movements' },
    { id: 'counts', label: 'Physical counts' }, { id: 'adjustments', label: 'Adjustments' },
  ];

  return (
    <div className="space-y-5">
      <InvHeader title="Stock & Movements" subtitle="Balances derived entirely from the immutable ledger — never edited directly." />
      {banner && <ActionBanner kind={banner.kind} message={banner.message} onClose={() => setBanner(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          {(tab === 'stock' || tab === 'movements') && <Select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} options={projectOptions} className="h-8 text-xs" />}
          {tab === 'counts' && can('stock_adjustments', 'create') && <Button size="sm" onClick={openCount}><Plus className="h-4 w-4" /> New count</Button>}
          {tab === 'adjustments' && can('stock_adjustments', 'create') && <Button size="sm" onClick={openAdj}><Plus className="h-4 w-4" /> New adjustment</Button>}
        </div>
      </div>

      <AsyncState loading={loading} error={error}>
        {tab === 'stock' && (
          shownPositions.length === 0 ? <EmptyState title="No stock on hand" message="Post a goods receipt to build stock. Balances appear here per project and SKU." /> : (
            <div className="surface-panel overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.04em] text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Project</th><th className="px-4 py-2.5 font-semibold">Material</th>
                  <th className="px-4 py-2.5 text-right font-semibold">On hand</th><th className="px-4 py-2.5 text-right font-semibold">Reserved</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Available</th><th className="px-4 py-2.5 text-right font-semibold">On order</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Projected</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {shownPositions.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 text-slate-600">{projectName(p.project_id)}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{matName(p.sku_id)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">{fmtQty(p.on_hand)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{fmtQty(p.reserved)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-800">{fmtQty(p.available)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{fmtQty(p.on_order)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${p.projected < 0 ? 'text-red-600' : 'text-slate-700'}`}>{fmtQty(p.projected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'movements' && (
          shownMoves.length === 0 ? <EmptyState title="No movements yet" message="Every receipt, consumption, transfer and adjustment is recorded here — permanently." /> : (
            <div className="surface-panel overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.04em] text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">When</th><th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Project</th><th className="px-4 py-2.5 font-semibold">Material</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Δ (base)</th><th className="px-4 py-2.5 font-semibold">By</th>
                  {can('inventory', 'edit') && <th className="px-4 py-2.5" />}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {shownMoves.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 tabular-nums text-slate-500">{formatDateTime(m.created_at)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={m.movement_type} /></td>
                      <td className="px-4 py-2.5 text-slate-600">{projectName(m.project_id)}</td>
                      <td className="px-4 py-2.5 text-slate-800">{matName(m.sku_id)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${m.qty_base < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{m.qty_base > 0 ? '+' : ''}{fmtQty(m.qty_base)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{m.posted_by_name ?? '—'}</td>
                      {can('inventory', 'edit') && (
                        <td className="px-4 py-2.5 text-right">
                          {m.movement_type !== 'reversal' && (
                            <button title="Reverse" onClick={() => act(() => reverseMovement(m.id, 'Manual reversal'), 'Movement reversed.')}
                              className="rounded p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-700"><RotateCcw className="h-4 w-4" /></button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'counts' && (
          counts.length === 0 ? <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="No physical counts" message="Count site stock to reconcile the ledger against reality; variance posts as an adjustment." /> : (
            <div className="surface-panel divide-y divide-slate-50">
              {counts.map(c => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div><div className="font-medium text-slate-800">{c.count_number}</div><div className="text-xs text-slate-500">{projectName(c.crm_project_id)} · {formatDate(c.counted_at)}</div></div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'adjustments' && (
          adjustments.length === 0 ? <EmptyState title="No adjustments" message="Corrections, write-offs and supplier returns are recorded here — each auditable and approved." /> : (
            <div className="surface-panel divide-y divide-slate-50">
              {adjustments.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-800">{a.adjustment_number} <span className="text-xs font-normal text-slate-400">· {statusLabel(a.kind)}</span></div>
                    <div className="text-xs text-slate-500">{projectName(a.crm_project_id)}{a.reason ? ` · ${a.reason}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.status === 'pending_approval' && can('stock_adjustments', 'approve') && (
                      <>
                        <button title="Reject" onClick={() => act(() => decideAdjustment(a.id, 'reject', 'Rejected'), 'Adjustment rejected.')} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                        <button title="Approve & post" onClick={() => act(() => decideAdjustment(a.id, 'approve', null), 'Adjustment posted.')} className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"><Check className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </AsyncState>

      {/* Count editor */}
      {countEditor && (
        <Modal open onClose={() => setCountEditor(null)} title="New physical count" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Project" value={countEditor.project} onChange={e => setCountEditor({ ...countEditor, project: e.target.value })} options={projectPick} />
              <Input label="Location" value={countEditor.location} onChange={e => setCountEditor({ ...countEditor, location: e.target.value })} />
            </div>
            <div className="space-y-2">
              {countEditor.rows.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-[10px] border border-slate-200 p-2.5">
                  <div className="flex-1"><Select value={r.sku_id} onChange={e => { const m = matBySku.get(e.target.value); setCountRow(i, { sku_id: e.target.value, uom: m?.base_uom ?? '' }); }} options={materialOptions} /></div>
                  <Input type="number" value={r.counted_qty} onChange={e => setCountRow(i, { counted_qty: e.target.value })} placeholder="counted" className="w-28" />
                  <span className="w-12 text-xs text-slate-400">{r.uom}</span>
                  <button aria-label="Remove" onClick={() => setCountEditor({ ...countEditor, rows: countEditor.rows.filter((_: any, idx: number) => idx !== i) })} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button onClick={() => setCountEditor({ ...countEditor, rows: [...countEditor.rows, { sku_id: '', uom: '', counted_qty: '' }] })} className="flex w-full items-center gap-2 rounded-[9px] border border-dashed border-slate-200 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50/50"><Plus className="h-4 w-4" /> Add material</button>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setCountEditor(null)} disabled={busy}>Cancel</Button>
              <Button variant="secondary" onClick={() => saveCountDoc(false)} disabled={busy}>Save draft</Button>
              <Button onClick={() => saveCountDoc(true)} disabled={busy}><ClipboardCheck className="h-4 w-4" /> Post count</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Adjustment editor */}
      {adjEditor && (
        <Modal open onClose={() => setAdjEditor(null)} title="New stock adjustment" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Project" value={adjEditor.project} onChange={e => setAdjEditor({ ...adjEditor, project: e.target.value })} options={projectPick} />
              <Select label="Kind" value={adjEditor.kind} onChange={e => setAdjEditor({ ...adjEditor, kind: e.target.value })} options={ADJ_KINDS} />
            </div>
            <Input label="Reason (required)" value={adjEditor.reason} onChange={e => setAdjEditor({ ...adjEditor, reason: e.target.value })} />
            <Input label="Evidence URL (photo / document)" value={adjEditor.evidence} onChange={e => setAdjEditor({ ...adjEditor, evidence: e.target.value })} />
            <div className="space-y-2">
              {adjEditor.rows.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-[10px] border border-slate-200 p-2.5">
                  <div className="flex-1"><Select value={r.sku_id} onChange={e => { const m = matBySku.get(e.target.value); setAdjRow(i, { sku_id: e.target.value, uom: m?.base_uom ?? '' }); }} options={materialOptions} /></div>
                  <Input type="number" value={r.quantity} onChange={e => setAdjRow(i, { quantity: e.target.value })} placeholder="qty" className="w-24" />
                  <span className="w-12 text-xs text-slate-400">{r.uom}</span>
                  <button aria-label="Remove" onClick={() => setAdjEditor({ ...adjEditor, rows: adjEditor.rows.filter((_: any, idx: number) => idx !== i) })} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button onClick={() => setAdjEditor({ ...adjEditor, rows: [...adjEditor.rows, { sku_id: '', uom: '', quantity: '' }] })} className="flex w-full items-center gap-2 rounded-[9px] border border-dashed border-slate-200 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50/50"><Plus className="h-4 w-4" /> Add material</button>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setAdjEditor(null)} disabled={busy}>Cancel</Button>
              <Button variant="secondary" onClick={() => saveAdjDoc(false)} disabled={busy}>Save draft</Button>
              <Button onClick={() => saveAdjDoc(true)} disabled={busy}>Submit for approval</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
