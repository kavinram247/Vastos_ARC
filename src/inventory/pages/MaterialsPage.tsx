import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Search } from 'lucide-react';
import { InvHeader, AsyncState, EmptyState, AccessNotice, ActionBanner, fmtQty } from '../ui';
import { listMaterials, listItemSettings, listStockPositions, saveItemSetting } from '../inventoryApi';
import type { Material, ItemSetting, StockPosition } from '../types';

export function MaterialsPage() {
  const { firm } = useAuth();
  const { can, canAccess } = usePermissions();
  const firmId = firm?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [settings, setSettings] = useState<ItemSetting[]>([]);
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [query, setQuery] = useState('');
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [editor, setEditor] = useState<{ m: Material; reorder: string; safety: string; max: string; lead: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      const [m, s, p] = await Promise.all([listMaterials(firmId), listItemSettings(firmId), listStockPositions(firmId)]);
      setMaterials(m); setSettings(s); setPositions(p);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  // firm-wide default setting (project_id null) per sku
  const settingBySku = useMemo(() => {
    const m = new Map<string, ItemSetting>();
    for (const s of settings) if (s.project_id == null) m.set(s.sku_id, s);
    return m;
  }, [settings]);
  const onHandBySku = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of positions) m.set(p.sku_id, (m.get(p.sku_id) ?? 0) + p.on_hand);
    return m;
  }, [positions]);

  const filtered = materials.filter(m => {
    const q = query.trim().toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.sku_code.toLowerCase().includes(q) || (m.brand ?? '').toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
  });

  const openEditor = (m: Material) => {
    const s = settingBySku.get(m.sku_id);
    setEditor({ m, reorder: String(s?.reorder_level ?? 0), safety: String(s?.safety_stock ?? 0), max: s?.max_level == null ? '' : String(s.max_level), lead: s?.lead_time_days == null ? '' : String(s.lead_time_days) });
  };
  const saveSetting = async () => {
    if (!editor) return;
    setBusy(true);
    try {
      await saveItemSetting(editor.m.sku_id, null, Number(editor.reorder || 0), Number(editor.safety || 0), editor.max ? Number(editor.max) : null, editor.lead ? Number(editor.lead) : null, null, null);
      setEditor(null); setBanner({ kind: 'success', message: 'Reorder policy saved.' }); await load();
    } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  if (!canAccess('materials')) return (<div className="space-y-6"><InvHeader title="Materials" /><AccessNotice label="Materials" /></div>);

  return (
    <div className="space-y-5">
      <InvHeader title="Materials" subtitle="SKU-level catalog with canonical UOM, purchase UOM conversions and firm-wide reorder policy." />
      {banner && <ActionBanner kind={banner.kind} message={banner.message} onClose={() => setBanner(null)} />}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search materials…"
          className="h-10 w-full rounded-[9px] border border-slate-200 pl-9 pr-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12" />
      </div>

      <AsyncState loading={loading} error={error}>
        {filtered.length === 0 ? (
          <EmptyState title="No materials found" message="Materials come from the catalog. Add SKUs in Catalog & Rates, then set reorder levels here." />
        ) : (
          <div className="surface-panel overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.04em] text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Material</th><th className="px-4 py-2.5 font-semibold">Category</th>
                <th className="px-4 py-2.5 font-semibold">Canonical UOM</th><th className="px-4 py-2.5 font-semibold">Purchase UOM</th>
                <th className="px-4 py-2.5 text-right font-semibold">On hand</th><th className="px-4 py-2.5 text-right font-semibold">Reorder</th>
                <th className="px-4 py-2.5 text-right font-semibold">Safety</th><th className="px-4 py-2.5" />
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(m => {
                  const s = settingBySku.get(m.sku_id);
                  const onHand = onHandBySku.get(m.sku_id) ?? 0;
                  const low = s && s.reorder_level > 0 && onHand <= s.reorder_level;
                  return (
                    <tr key={m.sku_id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{m.name}</div>
                        <div className="text-xs text-slate-500">{m.sku_code}{m.brand ? ` · ${m.brand}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{m.category}</td>
                      <td className="px-4 py-3 text-slate-600">{m.base_uom}</td>
                      <td className="px-4 py-3 text-slate-600">{m.secondary_uom ? `${m.secondary_uom} (×${m.uom_conversion ?? '—'})` : '—'}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${low ? 'font-semibold text-amber-600' : 'text-slate-700'}`}>{fmtQty(onHand)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{s ? fmtQty(s.reorder_level) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{s ? fmtQty(s.safety_stock) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {can('materials', 'edit') && <Button variant="ghost" size="sm" onClick={() => openEditor(m)}>Set policy</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AsyncState>

      {editor && (
        <Modal open onClose={() => setEditor(null)} title={`Reorder policy · ${editor.m.name}`} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Firm-wide defaults in <span className="font-medium text-slate-700">{editor.m.base_uom}</span>. Alerts fire when available falls to or below the reorder level.</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Reorder level" type="number" value={editor.reorder} onChange={e => setEditor({ ...editor, reorder: e.target.value })} />
              <Input label="Safety stock" type="number" value={editor.safety} onChange={e => setEditor({ ...editor, safety: e.target.value })} />
              <Input label="Max level" type="number" value={editor.max} onChange={e => setEditor({ ...editor, max: e.target.value })} />
              <Input label="Lead time (days)" type="number" value={editor.lead} onChange={e => setEditor({ ...editor, lead: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>Cancel</Button>
              <Button onClick={saveSetting} disabled={busy}>Save policy</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
