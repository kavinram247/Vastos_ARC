// Lightweight hand-built SVG charts — no charting library (keeps the inlined
// single-file bundle small). Styled to match the existing CRM UI.
import { cn } from '../utils/cn';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6', '#14b8a6'];
export const chartColor = (i: number) => PALETTE[i % PALETTE.length];

// ── KPI card ──
export function KpiCard({ label, value, sub, accent = 'slate', trend }: {
  label: string; value: string; sub?: string; accent?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'red' | 'slate';
  trend?: { dir: 'up' | 'down'; text: string };
}) {
  const color = {
    indigo: 'text-indigo-600', emerald: 'text-emerald-600', amber: 'text-amber-600',
    sky: 'text-sky-600', red: 'text-red-600', slate: 'text-slate-900',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(16,32,26,0.04)]">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold tabular-nums', color)}>{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
        {trend && <span className={trend.dir === 'up' ? 'text-emerald-600' : 'text-red-500'}>{trend.dir === 'up' ? '▲' : '▼'} {trend.text}</span>}
        {sub && <span className="text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

// ── Multi-series line chart ──
export interface LineSeries { name: string; color: string; values: number[]; }
export function LineChart({ series, labels, height = 200, fmt = (n: number) => String(Math.round(n)) }: {
  series: LineSeries[]; labels: string[]; height?: number; fmt?: (n: number) => string;
}) {
  const W = 640, H = height, pad = { l: 8, r: 8, t: 12, b: 18 };
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const xAt = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const yAt = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map(g => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={yAt(max * g)} y2={yAt(max * g)} stroke="#f1f5f9" strokeWidth={1} />
        ))}
        {series.map((s, si) => {
          const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`).join(' ');
          const area = `${d} L ${xAt(n - 1)} ${H - pad.b} L ${xAt(0)} ${H - pad.b} Z`;
          return (
            <g key={s.name}>
              {si === 0 && <path d={area} fill={s.color} opacity={0.08} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
        {series.map(s => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.name}
            <span className="font-medium text-slate-700">{fmt(s.values.reduce((a, b) => a + b, 0))}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal bar chart ──
export function BarChart({ items, fmt = (n: number) => String(Math.round(n)) }: {
  items: { label: string; value: number; color?: string }[]; fmt?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-3">
          <div className="w-40 shrink-0 truncate text-xs text-slate-600" title={it.label}>{it.label}</div>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <div className="h-full rounded" style={{ width: `${(it.value / max) * 100}%`, background: it.color || chartColor(i) }} />
          </div>
          <div className="w-20 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">{fmt(it.value)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Donut ──
export function Donut({ slices }: { slices: { label: string; value: number; color?: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const R = 60, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="h-36 w-36 -rotate-90">
        <circle cx={80} cy={80} r={R} fill="none" stroke="#f1f5f9" strokeWidth={20} />
        {slices.map((s, i) => {
          const frac = s.value / total;
          const dash = `${frac * C} ${C}`;
          const el = <circle key={s.label} cx={80} cy={80} r={R} fill="none" stroke={s.color || chartColor(i)} strokeWidth={20} strokeDasharray={dash} strokeDashoffset={-acc * C} />;
          acc += frac;
          return el;
        })}
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color || chartColor(i) }} />
            <span className="capitalize text-slate-600">{s.label}</span>
            <span className="font-medium text-slate-800">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Funnel ──
export function Funnel({ stages, fmt = (n: number) => Math.round(n).toLocaleString('en-IN') }: {
  stages: { label: string; value: number }[]; fmt?: (n: number) => string;
}) {
  const max = Math.max(1, ...stages.map(s => s.value));
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const conv = i > 0 && stages[i - 1].value ? (s.value / stages[i - 1].value) * 100 : 100;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-right text-xs text-slate-500">{s.label}</div>
            <div className="flex-1">
              <div className="mx-auto flex h-9 items-center justify-center rounded-md text-xs font-semibold text-white transition-all"
                style={{ width: `${Math.max(8, pct)}%`, background: chartColor(i) }}>
                {fmt(s.value)}
              </div>
            </div>
            <div className="w-12 shrink-0 text-[11px] text-slate-400">{i > 0 ? `${conv.toFixed(0)}%` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({ values, color = '#6366f1', height = 32 }: { values: number[]; color?: string; height?: number }) {
  const W = 120, H = height, max = Math.max(1, ...values), min = Math.min(...values, 0);
  const xAt = (i: number) => (i * W) / Math.max(1, values.length - 1);
  const yAt = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none"><path d={d} fill="none" stroke={color} strokeWidth={2} /></svg>;
}
