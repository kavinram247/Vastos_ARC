import { useState, useEffect, useMemo } from 'react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import {
  fetchMaterialRows, saveMaterialRate, saveProductWaste,
  fetchLabourRows, saveLabourRate, ensureMargin, saveMargin,
  fetchRegionAdmin, saveRegion,
  fetchTemplatesAdmin, updateTemplateActive, saveTemplateMeta, createTemplateFull,
  saveRule, updateRule, deleteRule, fetchProductsSimple, fetchLabourSimple,
  type MaterialRow, type LabourRow, type MarginRow, type RegionAdminRow,
  type TemplateAdminRow, type RuleAdminRow, type ProductSimple, type LabourSimple,
} from '../adminApi';
import { Database, Hammer, Percent, MapPin, Search, Check, Loader2, Save, LayoutTemplate, Plus, Pencil, Trash2, X } from 'lucide-react';

type Tab = 'materials' | 'labour' | 'margins' | 'regions' | 'templates';

const UOM_OPTIONS = ['sqft','sqm','rft','rmt','nos','sheet','set','pair','litre','kg','box','bag','point','day','hour','lumpsum','cum'] as const;

export function CatalogAdminPage() {
  const [tab, setTab] = useState<Tab>('materials');
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'materials', label: 'Materials & Rates', icon: <Database className="w-4 h-4" /> },
    { id: 'labour', label: 'Labour Rates', icon: <Hammer className="w-4 h-4" /> },
    { id: 'margins', label: 'Margin Policy', icon: <Percent className="w-4 h-4" /> },
    { id: 'regions', label: 'Regional Pricing', icon: <MapPin className="w-4 h-4" /> },
    { id: 'templates', label: 'Module Templates', icon: <LayoutTemplate className="w-4 h-4" /> },
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
      {tab === 'templates' && <TemplatesTab />}
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const reload = () => { setLoading(true); ensureMargin().then(setM).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, []);
  if (loading) return <Loading />;
  if (!m) return (
    <Card className="max-w-lg space-y-3">
      <CardTitle>Default margin policy</CardTitle>
      <p className="text-sm text-slate-500">Couldn't load or create the margin policy. Check the Supabase connection and retry.</p>
      <Button variant="secondary" onClick={reload}>Retry</Button>
    </Card>
  );
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

// ── Templates Tab ─────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<TemplateAdminRow[]>([]);
  const [products, setProducts] = useState<ProductSimple[]>([]);
  const [labour, setLabour] = useState<LabourSimple[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    Promise.all([fetchTemplatesAdmin(), fetchProductsSimple(), fetchLabourSimple()])
      .then(([tpls, prods, labs]) => {
        setTemplates(tpls);
        setProducts(prods);
        setLabour(labs);
        if (tpls.length) setSelected(prev => prev ?? tpls[0].id);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const patch = (id: string, changes: Partial<TemplateAdminRow>) =>
    setTemplates(ts => ts.map(t => t.id === id ? { ...t, ...changes } : t));

  const selectedTpl = templates.find(t => t.id === selected) ?? null;

  if (loading) return <Loading />;

  return (
    <div className="flex gap-4" style={{ minHeight: 560 }}>
      {/* Left: template list */}
      <div className="w-56 shrink-0 flex flex-col gap-1">
        {templates.map(t => (
          <button key={t.id} onClick={() => setSelected(t.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
              selected === t.id
                ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{t.name}</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${t.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{t.category}</div>
          </button>
        ))}
        <button
          onClick={() => setShowNew(true)}
          className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Right: detail panel */}
      {selectedTpl ? (
        <div className="flex-1 min-w-0 space-y-4">
          <TemplateDetail
            key={selectedTpl.id}
            template={selectedTpl}
            products={products}
            labour={labour}
            onPatch={(changes) => patch(selectedTpl.id, changes)}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Select a template
        </div>
      )}

      {showNew && (
        <NewTemplateModal
          onClose={() => setShowNew(false)}
          onCreate={(t) => { setTemplates(ts => [...ts, t]); setSelected(t.id); setShowNew(false); }}
        />
      )}
    </div>
  );
}

function TemplateDetail({ template, products, labour, onPatch }: {
  template: TemplateAdminRow;
  products: ProductSimple[];
  labour: LabourSimple[];
  onPatch: (changes: Partial<TemplateAdminRow>) => void;
}) {
  const [toggling, setToggling] = useState(false);

  const handleActiveToggle = async () => {
    setToggling(true);
    try {
      await updateTemplateActive(template.id, !template.is_active);
      onPatch({ is_active: !template.is_active });
    } catch (e) { alert('Failed: ' + (e as any).message); }
    finally { setToggling(false); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{template.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" size="sm" className="capitalize">{template.category}</Badge>
              <span className="text-xs text-slate-400 font-mono">{template.code}</span>
            </div>
          </div>
          <button
            onClick={handleActiveToggle}
            disabled={toggling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              template.is_active
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}>
            <span className={`w-2 h-2 rounded-full ${template.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {template.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>
        {template.description && <p className="text-sm text-slate-500">{template.description}</p>}
      </Card>

      <DerivedVarsSection template={template} onPatch={onPatch} />
      <RulesSection template={template} products={products} labour={labour} onPatch={onPatch} />
    </div>
  );
}

function DerivedVarsSection({ template, onPatch }: {
  template: TemplateAdminRow;
  onPatch: (changes: Partial<TemplateAdminRow>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: '', formula: '' });
  const [showAdd, setShowAdd] = useState(false);

  const persistVars = async (newVars: Array<{ name: string; formula: string }>) => {
    setSaving(true);
    try {
      await saveTemplateMeta(template.id, {
        name: template.name, description: template.description || '',
        category: template.category, param_schema: template.param_schema, derived_vars: newVars,
      });
      onPatch({ derived_vars: newVars });
    } catch (e) { alert('Save failed: ' + (e as any).message); }
    finally { setSaving(false); }
  };

  const deleteVar = (i: number) => persistVars(template.derived_vars.filter((_, idx) => idx !== i));

  const addVar = async () => {
    if (!draft.name.trim() || !draft.formula.trim()) return;
    await persistVars([...template.derived_vars, { name: draft.name.trim(), formula: draft.formula.trim() }]);
    setDraft({ name: '', formula: '' });
    setShowAdd(false);
  };

  const updateVar = async (i: number) => {
    if (!draft.name.trim() || !draft.formula.trim()) return;
    await persistVars(template.derived_vars.map((v, idx) => idx === i ? { name: draft.name.trim(), formula: draft.formula.trim() } : v));
    setEditing(null);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <CardTitle>Derived Variables ({template.derived_vars.length})</CardTitle>
        <button onClick={() => { setShowAdd(true); setDraft({ name: '', formula: '' }); setEditing(null); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Variable
        </button>
      </div>
      <p className="text-xs text-slate-400">Variables computed from params, reusable in qty formulas. E.g. <code className="bg-slate-100 px-1 rounded">width_ft = width_mm / 304.8</code></p>

      {template.derived_vars.length === 0 && !showAdd ? (
        <p className="text-sm text-slate-400 italic py-1">No derived variables defined.</p>
      ) : (
        <div className="space-y-1.5">
          {template.derived_vars.map((v, i) => (
            <div key={i} className="flex items-center gap-2 group rounded-lg px-2 py-1 hover:bg-slate-50">
              {editing === i ? (
                <>
                  <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                    className="w-28 px-2 py-1 border border-indigo-400 rounded text-sm font-mono focus:outline-none" placeholder="var_name" />
                  <span className="text-slate-400 text-sm">=</span>
                  <input value={draft.formula} onChange={e => setDraft({ ...draft, formula: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') updateVar(i); if (e.key === 'Escape') setEditing(null); }}
                    className="flex-1 px-2 py-1 border border-indigo-400 rounded text-sm font-mono focus:outline-none" placeholder="formula" autoFocus />
                  <button onClick={() => updateVar(i)} disabled={saving} className="text-emerald-600 hover:text-emerald-800 p-0.5">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 p-0.5"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <code className="w-28 text-sm text-indigo-700 font-mono shrink-0">{v.name}</code>
                  <span className="text-slate-300 text-sm">=</span>
                  <code className="flex-1 text-sm text-slate-600 font-mono truncate">{v.formula}</code>
                  <button onClick={() => { setEditing(i); setDraft({ name: v.name, formula: v.formula }); setShowAdd(false); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 p-0.5 transition-opacity">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteVar(i)} disabled={saving}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}

          {showAdd && (
            <div className="flex items-center gap-2 border-t border-slate-100 pt-2 mt-1">
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="var_name" autoFocus />
              <span className="text-slate-400 text-sm">=</span>
              <input value={draft.formula} onChange={e => setDraft({ ...draft, formula: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') addVar(); if (e.key === 'Escape') setShowAdd(false); }}
                className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="formula expression" />
              <button onClick={addVar} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Add
              </button>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function RulesSection({ template, products, labour, onPatch }: {
  template: TemplateAdminRow;
  products: ProductSimple[];
  labour: LabourSimple[];
  onPatch: (changes: Partial<TemplateAdminRow>) => void;
}) {
  const [editRule, setEditRule] = useState<RuleAdminRow | null>(null);
  const [addRule, setAddRule] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    setDeleting(id);
    try {
      await deleteRule(id);
      onPatch({ rules: template.rules.filter(r => r.id !== id) });
    } catch (e) { alert('Delete failed: ' + (e as any).message); }
    finally { setDeleting(null); }
  };

  const productName = (id: string | null) => id ? (products.find(p => p.id === id)?.name ?? id) : '—';
  const labourName = (id: string | null) => id ? (labour.find(l => l.id === id)?.name ?? id) : '—';

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <CardTitle>Rules ({template.rules.length})</CardTitle>
        <button onClick={() => { setAddRule(true); setEditRule(null); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </button>
      </div>

      {template.rules.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          No rules yet. Add rules to define which materials and labour this template estimates.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-2 py-2 font-medium">Label</th>
                <th className="text-left px-2 py-2 font-medium">Type</th>
                <th className="text-left px-2 py-2 font-medium">Product / Activity</th>
                <th className="text-left px-2 py-2 font-medium">Qty formula</th>
                <th className="text-left px-2 py-2 font-medium">UOM</th>
                <th className="text-left px-2 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 w-14" />
              </tr>
            </thead>
            <tbody>
              {template.rules.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                  <td className="px-3 py-2 text-slate-400 text-xs tabular-nums">{r.seq}</td>
                  <td className="px-2 py-2 font-medium text-slate-800 max-w-[140px] truncate">{r.label}</td>
                  <td className="px-2 py-2">
                    <Badge variant={r.output_kind === 'labour' ? 'default' : 'outline'} size="sm" className="capitalize">{r.output_kind}</Badge>
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-500 max-w-[140px] truncate">
                    {r.output_kind === 'labour' ? labourName(r.labour_activity_id) : productName(r.product_id)}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-indigo-700 max-w-[140px] truncate">{r.qty_formula}</td>
                  <td className="px-2 py-2 text-xs text-slate-500">{r.uom}</td>
                  <td className="px-2 py-2 text-xs text-slate-400 italic max-w-[100px] truncate">{r.condition || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditRule(r); setAddRule(false); }}
                        className="text-slate-400 hover:text-indigo-600 p-0.5" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                        className="text-slate-400 hover:text-red-500 p-0.5" title="Delete">
                        {deleting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(addRule || editRule) && (
        <RuleModal
          template={template}
          rule={editRule}
          products={products}
          labour={labour}
          onClose={() => { setAddRule(false); setEditRule(null); }}
          onSaved={(r) => {
            onPatch({ rules: editRule ? template.rules.map(x => x.id === r.id ? r : x) : [...template.rules, r] });
            setAddRule(false); setEditRule(null);
          }}
        />
      )}
    </Card>
  );
}

function RuleModal({ template, rule, products, labour, onClose, onSaved }: {
  template: TemplateAdminRow;
  rule: RuleAdminRow | null;
  products: ProductSimple[];
  labour: LabourSimple[];
  onClose: () => void;
  onSaved: (r: RuleAdminRow) => void;
}) {
  const nextSeq = template.rules.length ? Math.max(...template.rules.map(r => r.seq)) + 1 : 1;
  const [form, setForm] = useState<Omit<RuleAdminRow, 'id'>>({
    template_id: template.id,
    seq: rule?.seq ?? nextSeq,
    label: rule?.label ?? '',
    output_kind: rule?.output_kind ?? 'material',
    product_id: rule?.product_id ?? null,
    labour_activity_id: rule?.labour_activity_id ?? null,
    qty_formula: rule?.qty_formula ?? '',
    condition: rule?.condition ?? '',
    uom: rule?.uom ?? 'sqft',
  });
  const [saving, setSaving] = useState(false);
  const isLabour = form.output_kind === 'labour';
  const f = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.label.trim()) { alert('Label is required.'); return; }
    if (!form.qty_formula.trim()) { alert('Qty formula is required.'); return; }
    if (isLabour && !form.labour_activity_id) { alert('Select a labour activity.'); return; }
    if (!isLabour && !form.product_id) { alert('Select a product.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        condition: form.condition?.trim() || null,
        product_id: isLabour ? null : form.product_id,
        labour_activity_id: isLabour ? form.labour_activity_id : null,
      };
      let saved: RuleAdminRow;
      if (rule) {
        await updateRule(rule.id, payload);
        saved = { ...payload, id: rule.id };
      } else {
        saved = await saveRule(payload);
      }
      onSaved(saved);
    } catch (e) { alert('Save failed: ' + (e as any).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{rule ? 'Edit Rule' : 'Add Rule'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Seq</label>
            <input type="number" value={form.seq} onChange={e => f('seq', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Type</label>
            <select value={form.output_kind} onChange={e => f('output_kind', e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="material">Material</option>
              <option value="labour">Labour</option>
              <option value="hardware">Hardware</option>
              <option value="service">Service</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Label <span className="text-red-500">*</span></label>
          <input value={form.label} onChange={e => f('label', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Carcass (18mm BWP Ply)" />
        </div>

        {isLabour ? (
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Labour Activity <span className="text-red-500">*</span></label>
            <select value={form.labour_activity_id ?? ''} onChange={e => f('labour_activity_id', e.target.value || null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— select activity —</option>
              {labour.map(l => <option key={l.id} value={l.id}>{l.name} [{l.code}]</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Product <span className="text-red-500">*</span></label>
            <select value={form.product_id ?? ''} onChange={e => f('product_id', e.target.value || null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— select product —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">Qty Formula <span className="text-red-500">*</span></label>
            <input value={form.qty_formula} onChange={e => f('qty_formula', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. face_sqft * 1.05" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">UOM</label>
            <select value={form.uom} onChange={e => f('uom', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Condition <span className="text-slate-400 font-normal">(optional — rule applies only when true)</span>
          </label>
          <input value={form.condition ?? ''} onChange={e => f('condition', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. has_loft == 1" />
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Rule
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewTemplateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (t: TemplateAdminRow) => void;
}) {
  const [form, setForm] = useState({ code: '', name: '', category: '', description: '', param_schema: '{}' });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleCreate = async () => {
    if (!form.code.trim() || !form.name.trim()) { alert('Code and name are required.'); return; }
    let param_schema: any;
    try { param_schema = JSON.parse(form.param_schema); } catch { alert('Param schema is not valid JSON.'); return; }
    setSaving(true);
    try {
      const id = await createTemplateFull({
        code: form.code.trim(), name: form.name.trim(), category: form.category.trim(),
        description: form.description.trim(), param_schema, derived_vars: [],
      });
      onCreate({
        id, code: form.code.trim(), name: form.name.trim(), category: form.category.trim(),
        description: form.description.trim() || null, param_schema, derived_vars: [], is_active: true, rules: [],
      });
    } catch (e) { alert('Create failed: ' + (e as any).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">New Module Template</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Code <span className="text-red-500">*</span></label>
            <input value={form.code}
              onChange={e => f('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. WARDROBE" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Category</label>
            <input value={form.category} onChange={e => f('category', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Joinery" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Name <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={e => f('name', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Sliding Wardrobe" />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Description</label>
          <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Brief description of what this template covers" />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Param Schema <span className="text-slate-400 font-normal">(JSON — defines the input sliders)</span>
          </label>
          <textarea value={form.param_schema} onChange={e => f('param_schema', e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            placeholder={'{"width_mm":{"type":"number","default":2400}}'} />
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Template
          </Button>
        </div>
      </div>
    </div>
  );
}
