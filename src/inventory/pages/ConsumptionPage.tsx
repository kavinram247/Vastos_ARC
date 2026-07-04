import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useStore } from '../../hooks/useStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { formatDate } from '../../utils/format';
import { Plus, Trash2, Flame } from 'lucide-react';
import { InvHeader, StatusBadge, AsyncState, EmptyState, AccessNotice, ActionBanner, fmtQty } from '../ui';
import { listConsumptions, listMaterials, listStockPositions, saveConsumption, postConsumption } from '../inventoryApi';
import type { Consumption, Material, StockPosition } from '../types';

type Row = { sku_id: string; uom: string; quantity: string };

export function ConsumptionPage() {
  const { firm } = useAuth();
  const { can, canAccess } = usePermissions();
  const store = useStore();
  const firmId = firm?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Consumption[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<any | null>(null);

  const matBySku = useMemo(() => new Map(materials.map(m => [m.sku_id, m])), [materials]);
  const posMap = useMemo(() => new Map(positions.map(p => [`${p.project_id}::${p.sku_id}`, p])), [positions]);

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      const [c, m, p] = await Promise.all([listConsumptions(firmId), listMaterials(firmId), listStockPositions(firmId)]);
      setRows(c); setMaterials(m); setPositions(p);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const projectName = (id?: string | null) => store.projects.find(p => p.id === id)?.name ?? id ?? '—';
  const projectOptions = [{ value: '', label: 'Select project…' }, ...store.projects.map(p => ({ value: p.id, label: p.name }))];
  const materialOptions = [{ value: '', label: 'Material…' }, ...materials.map(m => ({ value: m.sku_id, label: `${m.name} (${m.base_uom})` }))];
  const milestoneOptions = (proj: string) => [{ value: '', label: 'Milestone (optional)…' }, ...store.milestones.filter(m => m.project_id === proj).map(m => ({ value: m.id, label: m.name }))];

  const openNew = () => setEditor({ project: '', location: '', milestone_id: '', consumed_at: new Date().toISOString().slice(0, 10), note: '', rows: [{ sku_id: '', uom: '', quantity: '' } as Row] });
  const setRow = (i: number, patch: Partial<Row>) => setEditor((e: any) => ({ ...e, rows: e.rows.map((r: Row, idx: number) => idx === i ? { ...r, ...patch } : r) }));
  const onPick = (i: number, sku: string) => { const m = matBySku.get(sku); setRow(i, { sku_id: sku, uom: m?.base_uom ?? '' }); };

  const save = async (postAfter: boolean) => {
    if (!editor.project) { setBanner({ kind: 'error', message: 'Choose a project.' }); return; }
    const items = editor.rows.filter((r: Row) => r.sku_id && Number(r.quantity) > 0);
    if (!items.length) { setBanner({ kind: 'error', message: 'Add a material and quantity used.' }); return; }
    setBusy(true);
    try {
      const id = await saveConsumption(
        { crm_project_id: editor.project, location: editor.location || null, milestone_id: editor.milestone_id || null, consumed_at: editor.consumed_at, note: editor.note || null },
        items.map((r: Row) => ({ sku_id: r.sku_id, uom: r.uom, quantity: Number(r.quantity) })),
      );
      if (postAfter) await postConsumption(id);
      setEditor(null); setBanner({ kind: 'success', message: postAfter ? 'Consumption posted — stock reduced.' : 'Draft saved.' }); await load();
    } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  if (!canAccess('consumption')) return (<div className="space-y-6"><InvHeader title="Site Consumption" /><AccessNotice label="Consumption" /></div>);

  return (
    <div className="space-y-5">
      <InvHeader title="Site Consumption" subtitle="Log material used on site. Posting reduces available stock and feeds BOQ actual-vs-estimate."
        actions={can('consumption', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Log usage</Button>} />
      {banner && <ActionBanner kind={banner.kind} message={banner.message} onClose={() => setBanner(null)} />}

      <AsyncState loading={loading} error={error}>
        {rows.length === 0 ? (
          <EmptyState icon={<Flame className="h-8 w-8" />} title="No consumption logged" message="Record what's used at site to keep stock and project cost accurate."
            action={can('consumption', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Log usage</Button>} />
        ) : (
          <div className="surface-panel divide-y divide-slate-50">
            {rows.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium text-slate-800">{c.consumption_number}</div>
                  <div className="text-xs text-slate-500">{projectName(c.crm_project_id)} · {formatDate(c.consumed_at)}{c.entered_by_name ? ` · ${c.entered_by_name}` : ''}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </AsyncState>

      {editor && (
        <Modal open onClose={() => setEditor(null)} title="Log site consumption" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Project" value={editor.project} onChange={e => setEditor({ ...editor, project: e.target.value, milestone_id: '' })} options={projectOptions} />
              <Input label="Site / location" value={editor.location} onChange={e => setEditor({ ...editor, location: e.target.value })} />
              <Select label="Milestone / activity" value={editor.milestone_id} onChange={e => setEditor({ ...editor, milestone_id: e.target.value })} options={milestoneOptions(editor.project)} />
              <Input label="Date" type="date" value={editor.consumed_at} onChange={e => setEditor({ ...editor, consumed_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              {editor.rows.map((r: Row, i: number) => {
                const p = editor.project && r.sku_id ? posMap.get(`${editor.project}::${r.sku_id}`) : undefined;
                const over = p && Number(r.quantity || 0) > p.available;
                return (
                  <div key={i} className="rounded-[10px] border border-slate-200 p-3">
                    <Select value={r.sku_id} onChange={e => onPick(i, e.target.value)} options={materialOptions} />
                    <div className="mt-2 flex items-center gap-2">
                      <Input type="number" min="0" value={r.quantity} onChange={e => setRow(i, { quantity: e.target.value })} placeholder="Qty used" />
                      <span className="text-sm text-slate-400">{r.uom}</span>
                      <span className={`ml-auto text-xs ${over ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{p ? `avail ${fmtQty(p.available)}` : ''}</span>
                      <button aria-label="Remove" onClick={() => setEditor({ ...editor, rows: editor.rows.filter((_: Row, idx: number) => idx !== i) })} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {over && <div className="mt-1 text-xs text-red-600">Exceeds available stock — posting will be blocked.</div>}
                  </div>
                );
              })}
              <button onClick={() => setEditor({ ...editor, rows: [...editor.rows, { sku_id: '', uom: '', quantity: '' }] })} className="flex w-full items-center gap-2 rounded-[9px] border border-dashed border-slate-200 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50/50"><Plus className="h-4 w-4" /> Add material</button>
            </div>
            <Textarea label="Notes" value={editor.note} onChange={e => setEditor({ ...editor, note: e.target.value })} rows={2} />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>Cancel</Button>
              <Button variant="secondary" onClick={() => save(false)} disabled={busy}>Save draft</Button>
              <Button onClick={() => save(true)} disabled={busy}><Flame className="h-4 w-4" /> Post usage</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
