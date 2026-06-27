import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { formatINR } from '../../utils/format';
import { fetchTemplates, fetchRegions, fetchPricingContext, saveBoq, type TemplateRow, type RegionRow } from '../api';
import { estimateModule, rollup, priceLineValues, type PricingContext, type Grade, type EstimatedLine } from '../engine/estimator';
import {
  Boxes, Plus, Trash2, Save, Sparkles, Eye, EyeOff, Calculator, Info, Loader2, CheckCircle2, Pencil,
} from 'lucide-react';

interface EditLine extends EstimatedLine { uid: string; is_optional: boolean; source: 'engine' | 'manual' }
interface BoqSection { key: string; templateCode: string; name: string; grade: Grade; lines: EditLine[]; params: Record<string, any>; edited: boolean }

const GRADES: { value: Grade; label: string }[] = [
  { value: 'economy', label: 'Economy' }, { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' }, { value: 'luxury', label: 'Luxury' },
];

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const toEditLine = (l: EstimatedLine): EditLine => ({ ...l, uid: uid(), is_optional: false, source: 'engine' });

export function BoqEstimatorPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [regionId, setRegionId] = useState<string>('');
  const [ctx, setCtx] = useState<PricingContext | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeCode, setActiveCode] = useState<string>('');
  const [params, setParams] = useState<Record<string, any>>({});
  const [grade, setGrade] = useState<Grade>('standard');

  const [sections, setSections] = useState<BoqSection[]>([]);
  const [showInternal, setShowInternal] = useState(true);
  const [title, setTitle] = useState('New Estimate');
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [tpls, rgs] = await Promise.all([fetchTemplates(), fetchRegions()]);
      setTemplates(tpls); setRegions(rgs);
      const mumbai = rgs.find((r) => r.name === 'Mumbai') || rgs[0];
      setRegionId(mumbai?.id || '');
      if (tpls[0]) { setActiveCode(tpls[0].code); setParams(defaultsFor(tpls[0])); }
      setLoading(false);
    })().catch((e) => { console.error(e); setLoading(false); });
  }, []);

  useEffect(() => { if (regionId) fetchPricingContext(regionId).then(setCtx).catch(console.error); }, [regionId]);

  // re-estimate on context change — but never clobber hand-edited or custom sections
  useEffect(() => {
    if (!ctx || sections.length === 0) return;
    setSections((prev) => prev.map((s) => {
      if (s.edited || s.templateCode === 'custom') return s;
      const tpl = templates.find((t) => t.code === s.templateCode);
      if (!tpl) return s;
      return { ...s, lines: estimateModule(tpl, tpl.rules, s.params, s.grade, ctx).map(toEditLine) };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  const activeTpl = templates.find((t) => t.code === activeCode);
  const preview = useMemo(() => {
    if (!activeTpl || !ctx) return null;
    const lines = estimateModule(activeTpl, activeTpl.rules, params, grade, ctx);
    return { lines, totals: rollup(lines) };
  }, [activeTpl, ctx, params, grade]);

  const onSelectTemplate = (code: string) => {
    const tpl = templates.find((t) => t.code === code);
    setActiveCode(code);
    if (tpl) setParams(defaultsFor(tpl));
  };

  const addSection = useCallback(() => {
    if (!activeTpl || !ctx || !preview) return;
    setSections((prev) => [...prev, {
      key: uid(), templateCode: activeCode, name: activeTpl.name, grade,
      lines: preview.lines.map(toEditLine), params, edited: false,
    }]);
    setSavedId(null);
  }, [activeTpl, ctx, preview, activeCode, grade, params]);

  // ── line/section mutations (any edit marks the section so it won't auto-recompute) ──
  const patchSection = (key: string, fn: (s: BoqSection) => BoqSection) =>
    setSections((prev) => prev.map((s) => (s.key === key ? fn(s) : s)));

  const updateLine = useCallback((sectionKey: string, lineUid: string, patch: Partial<EditLine>) => {
    if (!ctx) return;
    patchSection(sectionKey, (s) => ({
      ...s, edited: true,
      lines: s.lines.map((l) => {
        if (l.uid !== lineUid) return l;
        const next = { ...l, ...patch };
        if ('quantity' in patch || 'rate' in patch || 'gst_rate' in patch) {
          const p = priceLineValues(next.quantity, next.rate, next.gst_rate, ctx.margin);
          return { ...next, ...p };
        }
        return next;
      }),
    }));
    setSavedId(null);
  }, [ctx]);

  const deleteLine = (sectionKey: string, lineUid: string) =>
    patchSection(sectionKey, (s) => ({ ...s, edited: true, lines: s.lines.filter((l) => l.uid !== lineUid) }));

  const addLine = (sectionKey: string) => {
    if (!ctx) return;
    const p = priceLineValues(1, 0, 18, ctx.margin);
    const line: EditLine = {
      uid: uid(), source: 'manual', is_optional: false, rule_id: 'manual', output_kind: 'service',
      product_id: null, sku_id: null, labour_activity_id: null, description: 'New item', uom: 'nos',
      base_quantity: 1, quantity: 1, rate: 0, gst_rate: 18, derivation: { manual: true }, ...p,
    };
    patchSection(sectionKey, (s) => ({ ...s, edited: true, lines: [...s.lines, line] }));
  };

  const addCustomSection = () =>
    setSections((prev) => [...prev, { key: uid(), templateCode: 'custom', name: 'Custom Section', grade, lines: [], params: {}, edited: true }]);

  const allLines = sections.flatMap((s) => s.lines);
  const committed = allLines.filter((l) => !l.is_optional);
  const optional = allLines.filter((l) => l.is_optional);
  const grand = rollup(committed);
  const optionalTotals = rollup(optional);

  const onSave = async () => {
    if (sections.length === 0) return;
    setSaving(true);
    try {
      const id = await saveBoq({
        title, regionId,
        sections: sections.map((s) => ({ name: s.name, lines: s.lines })),
        totals: grand,
      });
      setSavedId(id);
    } catch (e) { console.error(e); alert('Save failed: ' + (e as any).message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading catalog…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Calculator className="w-6 h-6 text-indigo-600" /> BOQ Estimator</h1>
          <p className="text-sm text-slate-500">Parametric estimation · fully editable line items · live pricing</p>
        </div>
        <div className="flex items-center gap-2">
          <Select aria-label="Region" value={regionId} onChange={(e) => setRegionId(e.target.value)} options={regions.map((r) => ({ value: r.id, label: `📍 ${r.name}` }))} />
          <Button variant="secondary" size="sm" onClick={() => setShowInternal((v) => !v)}>
            {showInternal ? <><EyeOff className="w-4 h-4" /> Customer view</> : <><Eye className="w-4 h-4" /> Internal view</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configurator */}
        <Card className="space-y-4 h-fit">
          <CardTitle>Add a module</CardTitle>
          <Select label="Module type" value={activeCode} onChange={(e) => onSelectTemplate(e.target.value)} options={templates.map((t) => ({ value: t.code, label: t.name }))} />
          <Select label="Quality grade" value={grade} onChange={(e) => setGrade(e.target.value as Grade)} options={GRADES} />
          {activeTpl && (
            <div className="space-y-3 pt-1">
              {Object.entries(activeTpl.param_schema).map(([key, def]: [string, any]) => (
                <ParamField key={key} name={key} def={def} value={params[key]} onChange={(v) => setParams((p) => ({ ...p, [key]: v }))} />
              ))}
            </div>
          )}
          {preview && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 space-y-1">
              <div className="flex justify-between text-xs text-slate-500"><span>Cost</span><span>{formatINR(preview.totals.cost_price)}</span></div>
              <div className="flex justify-between text-sm font-semibold text-slate-900"><span>Selling + GST</span><span>{formatINR(preview.totals.grand_total)}</span></div>
              <div className="flex justify-between text-xs text-emerald-600"><span>Margin</span><span>{preview.totals.margin_pct}% · {preview.lines.length} lines</span></div>
            </div>
          )}
          <Button className="w-full" onClick={addSection} disabled={!preview || preview.lines.length === 0}><Plus className="w-4 h-4" /> Add to BOQ</Button>
          <Button className="w-full" variant="secondary" onClick={addCustomSection}><Pencil className="w-4 h-4" /> Add custom section</Button>
        </Card>

        {/* BOQ output */}
        <div className="lg:col-span-2 space-y-4">
          <Card padding="none">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold text-slate-900 bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1" />
              <div className="flex items-center gap-2">
                {savedId && <Badge variant="success" size="sm"><CheckCircle2 className="w-3 h-3 mr-1" /> Saved</Badge>}
                <Button size="sm" onClick={onSave} disabled={saving || sections.length === 0}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save BOQ</Button>
              </div>
            </div>
            {sections.length === 0 ? (
              <div className="text-center py-16 text-slate-400"><Boxes className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Add a module or a custom section to start your BOQ.</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sections.map((s, i) => (
                  <SectionBlock key={s.key} section={s} index={i} showInternal={showInternal}
                    onRemove={() => setSections((prev) => prev.filter((x) => x.key !== s.key))}
                    onRename={(name) => patchSection(s.key, (x) => ({ ...x, name }))}
                    onUpdateLine={(u, patch) => updateLine(s.key, u, patch)}
                    onDeleteLine={(u) => deleteLine(s.key, u)}
                    onAddLine={() => addLine(s.key)} />
                ))}
              </div>
            )}
            {sections.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-1">
                <div className="flex flex-wrap justify-end gap-x-8 gap-y-1 text-sm">
                  {showInternal && <Row label="Total cost" value={formatINR(grand.cost_price)} muted />}
                  <Row label="Subtotal (selling)" value={formatINR(grand.selling_price)} />
                  <Row label="GST" value={formatINR(grand.gst)} muted />
                  {showInternal && <Row label="Margin" value={`${grand.margin_pct}%`} accent />}
                  <Row label="Grand total" value={formatINR(grand.grand_total)} bold />
                </div>
                {optional.length > 0 && (
                  <div className="flex justify-end text-xs text-slate-400 pt-1">
                    + {optional.length} optional add-on{optional.length > 1 ? 's' : ''}: {formatINR(optionalTotals.grand_total)} (excluded from total)
                  </div>
                )}
              </div>
            )}
          </Card>
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Engine-generated lines are fully editable. Edit quantity/rate, rename, mark optional, delete, or add custom lines — prices recompute live. Edited sections won't be overwritten when you change region.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionBlock({ section, index, showInternal, onRemove, onRename, onUpdateLine, onDeleteLine, onAddLine }: {
  section: BoqSection; index: number; showInternal: boolean; onRemove: () => void; onRename: (n: string) => void;
  onUpdateLine: (uid: string, patch: Partial<EditLine>) => void; onDeleteLine: (uid: string) => void; onAddLine: () => void;
}) {
  const totals = rollup(section.lines.filter((l) => !l.is_optional));
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
          {showInternal
            ? <input value={section.name} onChange={(e) => onRename(e.target.value)} className="font-semibold text-slate-900 bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1 min-w-0" />
            : <h3 className="font-semibold text-slate-900 truncate">{section.name}</h3>}
          <Badge variant="default" size="sm" className="capitalize shrink-0">{section.grade}</Badge>
          {section.edited && <Badge variant="info" size="sm" className="shrink-0">edited</Badge>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-slate-900">{formatINR(totals.grand_total)}</span>
          <button onClick={onRemove} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100">
              <th className="text-left font-medium py-1.5">Item</th>
              <th className="text-right font-medium w-20">Qty</th>
              <th className="text-left font-medium pl-2 w-14">Unit</th>
              {showInternal && <th className="text-right font-medium w-24">Rate</th>}
              {showInternal && <th className="text-right font-medium w-24">Cost</th>}
              <th className="text-right font-medium w-24">Selling</th>
              {showInternal && <th className="w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {section.lines.map((l) => (
              <tr key={l.uid} className={`border-b border-slate-50 last:border-0 ${l.is_optional ? 'opacity-60' : ''}`}>
                <td className="py-1 pr-2">
                  {showInternal ? (
                    <input value={l.description} onChange={(e) => onUpdateLine(l.uid, { description: e.target.value })}
                      className="w-full bg-transparent text-slate-800 focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1" />
                  ) : <span className="text-slate-800">{l.description}</span>}
                  <span className="inline-flex items-center gap-1 ml-1">
                    {l.source === 'manual' && <Badge variant="outline" size="sm">manual</Badge>}
                    {l.output_kind === 'labour' && <Badge variant="warning" size="sm">labour</Badge>}
                    {l.is_optional && <Badge variant="info" size="sm">optional</Badge>}
                    {l.source === 'engine' && <span title={derivationText(l)} className="text-slate-300 hover:text-indigo-500 cursor-help"><Info className="w-3 h-3" /></span>}
                  </span>
                </td>
                <td className="text-right">
                  {showInternal ? <NumCell value={l.quantity} onCommit={(v) => onUpdateLine(l.uid, { quantity: v })} /> : <span className="tabular-nums text-slate-600">{l.quantity.toFixed(2)}</span>}
                </td>
                <td className="pl-2">
                  {showInternal ? <input value={l.uom} onChange={(e) => onUpdateLine(l.uid, { uom: e.target.value })} className="w-12 bg-transparent text-slate-400 focus:outline-none focus:bg-slate-50 rounded" /> : <span className="text-slate-400">{l.uom}</span>}
                </td>
                {showInternal && <td className="text-right"><NumCell value={l.rate} onCommit={(v) => onUpdateLine(l.uid, { rate: v })} /></td>}
                {showInternal && <td className="text-right tabular-nums text-slate-500">{formatINR(l.cost_price)}</td>}
                <td className="text-right tabular-nums text-slate-900 font-medium">{formatINR(l.selling_price)}</td>
                {showInternal && (
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button title="Toggle optional" onClick={() => onUpdateLine(l.uid, { is_optional: !l.is_optional })} className={`text-xs px-1 rounded ${l.is_optional ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}>opt</button>
                      <button title="Delete line" onClick={() => onDeleteLine(l.uid)} className="text-slate-300 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showInternal && (
        <button onClick={onAddLine} className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add line</button>
      )}
    </div>
  );
}

// number cell that commits on change (kept simple; reprices upstream)
function NumCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  return (
    <input type="number" value={value}
      onChange={(e) => onCommit(parseFloat(e.target.value) || 0)}
      className="w-20 text-right tabular-nums bg-transparent text-slate-700 px-1 rounded focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-indigo-300" />
  );
}

function ParamField({ name, def, value, onChange }: { name: string; def: any; value: any; onChange: (v: any) => void }) {
  const label = name.replace(/_/g, ' ').replace(/\bmm\b/, '(mm)').replace(/\b\w/, (c) => c.toUpperCase());
  if (def.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
        <span className="text-sm text-slate-700">{label}</span>
      </label>
    );
  }
  if (def.type === 'enum') {
    return <Select label={label} value={value ?? def.default} onChange={(e) => onChange(e.target.value)} options={(def.values as string[]).map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))} />;
  }
  return <Input label={label} type="number" value={value ?? def.default ?? 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />;
}

function Row({ label, value, bold, muted, accent }: { label: string; value: string; bold?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={muted ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
      <span className={bold ? 'text-lg font-bold text-slate-900' : accent ? 'font-semibold text-emerald-600' : 'font-medium text-slate-700'}>{value}</span>
    </div>
  );
}

function defaultsFor(t: TemplateRow): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, def] of Object.entries(t.param_schema || {})) out[k] = (def as any).default;
  return out;
}
function derivationText(l: EstimatedLine): string {
  const d = l.derivation;
  return `formula: ${d.formula}\nbase qty: ${d.base_qty} → +waste ${Number(d.waste) * 100}% +pkg ${Number(d.packaging) * 100}% +install ${Number(d.install) * 100}%\nregion factor ×${d.region_factor} · cost rate ₹${d.cost_rate}\noverhead ${d.overhead_pct}% · margin ${d.margin_pct}%`;
}
