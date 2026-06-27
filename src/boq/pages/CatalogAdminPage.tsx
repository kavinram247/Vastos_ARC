import { useState, useEffect, useMemo } from 'react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import {
  fetchMaterialRows, saveMaterialRate, saveProductWaste,
  fetchLabourRows, saveLabourRate, fetchMargin, saveMargin,
  fetchRegionAdmin, saveRegion,
  type MaterialRow, type LabourRow, type MarginRow, type RegionAdminRow,
} from '../adminApi';
import { Database, Hammer, Percent, MapPin, Search, Check, Loader2, Save } from 'lucide-react';

type Tab = 'materials' | 'labour' | 'margins' | 'regions';

export function CatalogAdminPage() {
  const [tab, setTab] = useState<Tab>('materials');
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'materials', label: 'Materials & Rates', icon: <Database className="w-4 h-4" /> },
    { id: 'labour', label: 'Labour Rates', icon: <Hammer className="w-4 h-4" /> },
    { id: 'margins', label: 'Margin Policy', icon: <Percent className="w-4 h-4" /> },
    { id: 'regions', label: 'Regional Pricing', icon: <MapPin className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-indigo-600" /> Catalog & Rate Cards
        </h1>
        <p className="text-sm text-slate-500">Your real cost prices feed every estimate. Edits are versioned — history is preserved.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'materials' && <MaterialsTab />}
      {tab === 'labour' && <LabourTab />}
      {tab === 'margins' && <MarginsTab />}
      {tab === 'regions' && <RegionsTab />}
    </div>
  );
}

// ── inline numeric editor with versioned save ──
function EditNum({ value, onSave, prefix, suffix, step = '1', width = 'w-28' }: {
  value: number | null; onSave: (v: number) => Promise<void>; prefix?: string; suffix?: string; step?: string; width?: string;
}) {
  const [val, setVal] = useState(value ?? 0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setVal(value ?? 0); }, [value]);
  const dirty = val !== (value ?? 0);
  const doSave = async () => {
    setSaving(true);
    try { await onSave(val); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    catch (e) { alert('Save failed: ' + (e as any).message); } finally { setSaving(false); }
  };
  return (
    <div className="inline-flex items-center gap-1">
      {prefix && <span className="text-slate-400 text-xs">{prefix}</span>}
      <input type="number" step={step} value={val}
        onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
        onKeyDown={(e) => { if (e.key === 'Enter' && dirty) doSave(); }}
        className={`${width} px-2 py-1 border rounded text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 ${dirty ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`} />
      {suffix && <span className="text-slate-400 text-xs">{suffix}</span>}
      {dirty ? (
        <button onClick={doSave} disabled={saving} className="text-indigo-600 hover:text-indigo-800 p-0.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </button>
      ) : saved ? <Check className="w-4 h-4 text-emerald-500" /> : <span className="w-4" />}
    </div>
  );
}

function MaterialsTab() {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchMaterialRows().then((r) => { setRows(r); setLoading(false); }).catch(console.error); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) => !s || r.name.toLowerCase().includes(s) || r.category.toLowerCase().includes(s) ||
      r.skus.some((k) => (k.brand || '').toLowerCase().includes(s)));
  }, [rows, q]);

  if (loading) return <Loading />;
  return (
    <Card padding="none">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <CardTitle>{rows.length} products · {rows.reduce((s, r) => s + r.skus.length, 0)} SKUs</CardTitle>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product / brand…"
            className="pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th className="text-left px-4 py-2.5 font-medium">Product / SKU</th>
              <th className="text-left px-2 py-2.5 font-medium">Category</th>
              <th className="text-left px-2 py-2.5 font-medium">Unit</th>
              <th className="text-right px-2 py-2.5 font-medium">Cost rate</th>
              <th className="text-right px-4 py-2.5 font-medium">Waste %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              p.skus.map((s, i) => (
                <tr key={s.sku_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    {i === 0 && <div className="font-medium text-slate-900">{p.name}</div>}
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      {s.brand || '—'} <Badge variant="outline" size="sm" className="capitalize">{s.grade}</Badge>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-slate-500 text-xs">{i === 0 ? p.category : ''}</td>
                  <td className="px-2 py-2 text-slate-400">{p.base_uom}</td>
                  <td className="px-2 py-2 text-right">
                    <EditNum value={s.current_rate} prefix="₹" step="0.5"
                      onSave={(v) => saveMaterialRate(s.sku_id, v)} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {i === 0 && <EditNum value={p.waste_factor * 100} suffix="%" step="0.5" width="w-20"
                      onSave={(v) => saveProductWaste(p.product_id, v / 100)} />}
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LabourTab() {
  const [rows, setRows] = useState<LabourRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchLabourRows().then((r) => { setRows(r); setLoading(false); }).catch(console.error); }, []);
  if (loading) return <Loading />;
  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th className="text-left px-4 py-2.5 font-medium">Activity</th>
              <th className="text-left px-2 py-2.5 font-medium">Trade</th>
              <th className="text-left px-2 py-2.5 font-medium">Unit</th>
              <th className="text-right px-4 py-2.5 font-medium">Rate (national)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.activity_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-900">{a.name}</td>
                <td className="px-2 py-2"><Badge variant="default" size="sm" className="capitalize">{a.trade || '—'}</Badge></td>
                <td className="px-2 py-2 text-slate-400">{a.base_uom}</td>
                <td className="px-4 py-2 text-right">
                  <EditNum value={a.current_rate} prefix="₹" step="5" onSave={(v) => saveLabourRate(a.activity_id, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-xs text-slate-400">National base rates. City labour indices (Regional Pricing tab) are applied automatically per project.</p>
    </Card>
  );
}

function MarginsTab() {
  const [m, setM] = useState<MarginRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { fetchMargin().then(setM).catch(console.error); }, []);
  if (!m) return <Loading />;
  const save = async () => {
    setSaving(true);
    try { await saveMargin(m.id, { target_margin_pct: m.target_margin_pct, margin_floor_pct: m.margin_floor_pct, overhead_pct: m.overhead_pct }); setDone(true); setTimeout(() => setDone(false), 1500); }
    finally { setSaving(false); }
  };
  return (
    <Card className="max-w-lg space-y-4">
      <CardTitle>Default margin policy</CardTitle>
      <p className="text-sm text-slate-500">Selling price = cost ÷ (1 − margin). The floor is enforced by the engine — it won't quote below it.</p>
      <Input label="Target margin (%)" type="number" value={m.target_margin_pct} onChange={(e) => setM({ ...m, target_margin_pct: parseFloat(e.target.value) || 0 })} />
      <Input label="Margin floor (%)" type="number" value={m.margin_floor_pct} onChange={(e) => setM({ ...m, margin_floor_pct: parseFloat(e.target.value) || 0 })} />
      <Input label="Overhead recovery (%)" type="number" value={m.overhead_pct} onChange={(e) => setM({ ...m, overhead_pct: parseFloat(e.target.value) || 0 })} />
      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} Save policy
      </Button>
    </Card>
  );
}

function RegionsTab() {
  const [rows, setRows] = useState<RegionAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchRegionAdmin().then((r) => { setRows(r); setLoading(false); }).catch(console.error); }, []);
  if (loading) return <Loading />;
  const upd = (id: string, patch: Partial<RegionAdminRow>) => setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));
  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th className="text-left px-4 py-2.5 font-medium">City</th>
              <th className="text-right px-2 py-2.5 font-medium">Material ×</th>
              <th className="text-right px-2 py-2.5 font-medium">Labour ×</th>
              <th className="text-right px-2 py-2.5 font-medium">Logistics ×</th>
              <th className="text-right px-4 py-2.5 font-medium">Avail. risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-900">{r.name}</td>
                <td className="px-2 py-2 text-right"><EditNum value={r.material_index} step="0.01" width="w-20" onSave={async (v) => { await saveRegion(r.id, { ...r, material_index: v }); upd(r.id, { material_index: v }); }} /></td>
                <td className="px-2 py-2 text-right"><EditNum value={r.labour_index} step="0.01" width="w-20" onSave={async (v) => { await saveRegion(r.id, { ...r, labour_index: v }); upd(r.id, { labour_index: v }); }} /></td>
                <td className="px-2 py-2 text-right"><EditNum value={r.logistics_index} step="0.01" width="w-20" onSave={async (v) => { await saveRegion(r.id, { ...r, logistics_index: v }); upd(r.id, { logistics_index: v }); }} /></td>
                <td className="px-4 py-2 text-right"><EditNum value={r.availability_risk} step="0.01" width="w-20" onSave={async (v) => { await saveRegion(r.id, { ...r, availability_risk: v }); upd(r.id, { availability_risk: v }); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
}
