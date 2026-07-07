// ─────────────────────────────────────────────────────────────
// Leads dashboard visualizations — hand-built SVG/HTML (no charting lib, keeps
// the single-file bundle small). Reuses the marketing chart kit for the shared
// primitives (Donut/BarChart/Funnel/LineChart/Sparkline) and adds the extra
// visualizations the leads dashboard needs. Every chart honours WidgetOptions
// (colors, legend, grid, axis, labels, border radius, animation, background).
// ─────────────────────────────────────────────────────────────
import { chartColor, Donut, BarChart, Funnel, LineChart, Sparkline } from '../../marketing/charts';
import type { WidgetOptions } from './types';
import { cn } from '../../utils/cn';

export { Donut, BarChart, Funnel, LineChart, Sparkline, chartColor };

export type Slice = { label: string; value: number; color?: string };

export const colorAt = (opts: WidgetOptions | undefined, i: number, fallback?: string) =>
  opts?.colors?.[i] || fallback || chartColor(i);

// ── Pie (full disc) ──
export function Pie({ slices, options }: { slices: Slice[]; options?: WidgetOptions }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const cx = 80, cy = 80, r = 76;
  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const a0 = acc * 2 * Math.PI, a1 = (acc + frac) * 2 * Math.PI;
    acc += frac;
    const x0 = cx + r * Math.sin(a0), y0 = cy - r * Math.cos(a0);
    const x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1);
    const large = frac > 0.5 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    return { d, color: colorAt(options, i, s.color), label: s.label, pct: Math.round(frac * 100) };
  });
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="h-36 w-36">
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} className={options?.animate ? 'origin-center animate-[fadeIn_.4s_ease]' : ''} />)}
      </svg>
      {options?.showLegend !== false && (
        <div className="space-y-1.5">
          {arcs.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
              <span className="capitalize text-slate-600">{a.label}</span>
              {options?.showLabels !== false && <span className="font-medium text-slate-800">{a.pct}%</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gauge (semicircle, single ratio) ──
export function Gauge({ value, max, label, options }: { value: number; max: number; label?: string; options?: WidgetOptions }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const R = 70, cx = 90, cy = 90;
  const a = Math.PI * (1 - pct); // sweep from left (π) to right (0)
  const x = cx + R * Math.cos(a), y = cy - R * Math.sin(a);
  const track = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const fill = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${x} ${y}`;
  const color = colorAt(options, 0, '#6366f1');
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" className="w-full max-w-[220px]">
        <path d={track} fill="none" stroke="#f1f5f9" strokeWidth={16} strokeLinecap="round" />
        <path d={fill} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
      </svg>
      <div className="-mt-4 text-center">
        <div className="text-2xl font-bold tabular-nums text-slate-900">{Math.round(pct * 100)}%</div>
        {label && <div className="text-[11px] text-slate-400">{label}</div>}
      </div>
    </div>
  );
}

// ── Single 100%-width stacked bar ──
export function StackedBar({ items, options }: { items: Slice[]; options?: WidgetOptions }) {
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  const radius = options?.borderRadius ?? 8;
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden" style={{ borderRadius: radius }}>
        {items.map((it, i) => {
          const w = (it.value / total) * 100;
          if (w <= 0) return null;
          return <div key={i} className="flex items-center justify-center text-[10px] font-semibold text-white" style={{ width: `${w}%`, background: colorAt(options, i, it.color) }} title={`${it.label}: ${it.value}`}>{options?.showLabels !== false && w > 8 ? it.value : ''}</div>;
        })}
      </div>
      {options?.showLegend !== false && (
        <div className="mt-2.5 flex flex-wrap gap-3">
          {items.map((it, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorAt(options, i, it.color) }} />{it.label}
              <span className="font-medium text-slate-800">{it.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vertical bar / column chart ──
export function VBar({ items, options, fmt = (n: number) => String(n) }: { items: Slice[]; options?: WidgetOptions; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  const radius = options?.borderRadius ?? 6;
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: 150 }}>
        {items.map((it, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            {options?.showLabels !== false && <span className="text-[10px] font-medium tabular-nums text-slate-500">{fmt(it.value)}</span>}
            <div className="w-full" style={{ height: `${(it.value / max) * 100}%`, minHeight: it.value > 0 ? 4 : 0, background: colorAt(options, i, it.color), borderRadius: `${radius}px ${radius}px 0 0` }} />
          </div>
        ))}
      </div>
      {options?.showAxis !== false && (
        <div className="mt-1.5 flex gap-2 border-t border-slate-100 pt-1.5">
          {items.map((it, i) => <div key={i} className="flex-1 truncate text-center text-[10px] capitalize text-slate-500" title={it.label}>{it.label}</div>)}
        </div>
      )}
    </div>
  );
}

// ── Progress cards ──
export function ProgressCards({ items, options, fmt = (n: number) => String(n) }: { items: Slice[]; options?: WidgetOptions; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-slate-100 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="capitalize text-slate-600">{it.label}</span>
            <span className="font-semibold tabular-nums text-slate-800">{fmt(it.value)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: colorAt(options, i, it.color) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Leaderboard ──
export function Leaderboard({ rows, options }: {
  rows: { name: string; primary: number; sub?: string; bar: number }[]; options?: WidgetOptions;
}) {
  const max = Math.max(1, ...rows.map(r => r.bar));
  const medal = ['bg-amber-400', 'bg-slate-300', 'bg-orange-400'];
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="py-6 text-center text-xs text-slate-400">No assigned leads yet.</p>}
      {rows.map((r, i) => (
        <div key={r.name} className="flex items-center gap-3">
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white', i < 3 ? medal[i] : 'bg-slate-200 text-slate-600')}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate font-medium text-slate-700">{r.name}</span>
              <span className="tabular-nums text-slate-500">{r.sub}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${(r.bar / max) * 100}%`, background: colorAt(options, 0, '#6366f1') }} />
            </div>
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-slate-800">{r.primary}</span>
        </div>
      ))}
    </div>
  );
}

// ── Heatmap (agents × metrics) ──
export function Heatmap({ rowLabels, colLabels, matrix, options }: {
  rowLabels: string[]; colLabels: string[]; matrix: number[][]; options?: WidgetOptions;
}) {
  const max = Math.max(1, ...matrix.flat());
  const base = colorAt(options, 0, '#6366f1');
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="text-left" />
            {colLabels.map(c => <th key={c} className="px-1 text-[10px] font-medium capitalize text-slate-400">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((rl, ri) => (
            <tr key={rl}>
              <td className="pr-2 text-right text-[11px] font-medium text-slate-600 whitespace-nowrap">{rl}</td>
              {matrix[ri].map((v, ci) => (
                <td key={ci}>
                  <div className="flex h-8 min-w-[36px] items-center justify-center rounded text-[11px] font-semibold tabular-nums"
                    style={{ background: v === 0 ? '#f8fafc' : hexWithAlpha(base, 0.15 + 0.85 * (v / max)), color: v / max > 0.5 ? '#fff' : '#334155' }}>
                    {v}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Kanban-style stage summary ──
export function KanbanSummary({ columns }: { columns: { label: string; count: number; color: string }[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {columns.map(c => (
        <div key={c.label} className="min-w-[92px] flex-1 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', c.color)} />
            <span className="truncate text-[11px] font-medium text-slate-600">{c.label}</span>
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">{c.count}</div>
        </div>
      ))}
    </div>
  );
}

function hexWithAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
