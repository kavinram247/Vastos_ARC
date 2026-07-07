// Per-widget configuration — chart type, colors, background, labels, legend,
// grid, axis, border radius, animation, and a title override. Everything here
// is data written back onto the widget's config, so a chart can change type or
// palette without any code change.
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { DashboardWidget, WidgetOptions } from './types';
import { WIDGET_REGISTRY, widgetTitle } from './widgets';
import { cn } from '../../utils/cn';

const CHART_LABEL: Record<string, string> = {
  number: 'Number', progress: 'Progress bar',
  donut: 'Donut', pie: 'Pie', bar: 'Bar', hbar: 'Horizontal bar', stacked: 'Stacked bar',
  gauge: 'Gauge', funnel: 'Funnel', kanban: 'Kanban summary', line: 'Line',
  leaderboard: 'Leaderboard', cards: 'Cards', heatmap: 'Heatmap',
};

const SWATCHES = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6', '#14b8a6', '#1b6a59'];

interface Props {
  widget: DashboardWidget;
  onSave: (w: DashboardWidget) => void;
  onClose: () => void;
}

export function WidgetSettingsModal({ widget, onSave, onClose }: Props) {
  const def = WIDGET_REGISTRY[widget.type];
  const [draft, setDraft] = useState<DashboardWidget>({ ...widget, options: { ...widget.options } });
  const opt = draft.options || {};
  const setOpt = (patch: Partial<WidgetOptions>) => setDraft(d => ({ ...d, options: { ...d.options, ...patch } }));
  const colors = opt.colors && opt.colors.length ? opt.colors : [];
  const setColor = (i: number, hex: string) => {
    const next = [...(colors.length ? colors : SWATCHES.slice(0, 5))];
    next[i] = hex;
    setOpt({ colors: next });
  };

  const supportsCartesian = ['bar', 'hbar', 'line', 'stacked'].includes(draft.chartType || '');
  const showColorRow = def.chartTypes.length > 0 && draft.chartType !== 'number' && draft.chartType !== 'progress';

  return (
    <Modal open onClose={onClose} title={`Configure · ${widgetTitle(widget)}`} size="md">
      <div className="space-y-5">
        <Input label="Widget title (optional)" value={draft.title || ''} placeholder={def.label}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value || undefined }))} />

        {def.chartTypes.length > 0 && (
          <Field label="Chart type">
            <div className="flex flex-wrap gap-1.5">
              {def.chartTypes.map(ct => (
                <button key={ct} onClick={() => setDraft(d => ({ ...d, chartType: ct }))}
                  className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium', draft.chartType === ct ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                  {CHART_LABEL[ct] || ct}
                </button>
              ))}
            </div>
          </Field>
        )}

        {showColorRow && (
          <Field label="Colors">
            <div className="flex flex-wrap items-center gap-2">
              {[0, 1, 2, 3, 4].map(i => (
                <input key={i} type="color" aria-label={`Color ${i + 1}`}
                  value={colors[i] || SWATCHES[i]} onChange={e => setColor(i, e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5" />
              ))}
              {colors.length > 0 && <button onClick={() => setOpt({ colors: undefined })} className="text-xs text-slate-400 hover:text-slate-600">Reset</button>}
            </div>
          </Field>
        )}

        <Field label="Background">
          <div className="flex items-center gap-2">
            <input type="color" aria-label="Background" value={opt.background || '#ffffff'} onChange={e => setOpt({ background: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5" />
            <span className="text-xs text-slate-500">{opt.background || 'inherit'}</span>
            {opt.background && <button onClick={() => setOpt({ background: undefined })} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>}
          </div>
        </Field>

        {showColorRow && (
          <Field label="Border radius">
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={20} value={opt.borderRadius ?? 8} onChange={e => setOpt({ borderRadius: Number(e.target.value) })} className="flex-1" />
              <span className="w-10 text-right text-xs tabular-nums text-slate-500">{opt.borderRadius ?? 8}px</span>
            </div>
          </Field>
        )}

        {showColorRow && (
          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Legend" checked={opt.showLegend !== false} onChange={v => setOpt({ showLegend: v })} />
            <Toggle label="Labels" checked={opt.showLabels !== false} onChange={v => setOpt({ showLabels: v })} />
            <Toggle label="Animation" checked={!!opt.animate} onChange={v => setOpt({ animate: v })} />
            {supportsCartesian && <Toggle label="Axis" checked={opt.showAxis !== false} onChange={v => setOpt({ showAxis: v })} />}
            {supportsCartesian && <Toggle label="Grid" checked={!!opt.showGrid} onChange={v => setOpt({ showGrid: v })} />}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(draft); onClose(); }}>Apply</Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="block text-xs font-semibold text-slate-700">{label}</label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-300">
      {label}
      <span className={cn('relative h-4 w-7 rounded-full transition-colors', checked ? 'bg-indigo-600' : 'bg-slate-200')}>
        <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all', checked ? 'left-[14px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
