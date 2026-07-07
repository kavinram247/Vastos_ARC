// ─────────────────────────────────────────────────────────────
// Widget registry — the single source of truth for what widgets exist and how
// they render. Everything a widget can do (its chart choices, default size,
// how it turns store data into a visualization) lives in ONE entry here, so
// adding a future widget type = adding one WIDGET_REGISTRY entry (no changes to
// the grid, settings, or persistence code). Render fns read the reactive store
// via the metrics helpers, so widgets recompute live on any lead change.
// ─────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import { formatINRCompact } from '../../utils/format';
import { timeAgo } from '../../utils/format';
import { cn } from '../../utils/cn';
import {
  UserPlus, UserCheck, ArrowRightLeft, Trophy, XCircle, CalendarClock, FileText, StickyNote, Activity,
} from 'lucide-react';
import type { DashboardWidget, WidgetType, WidgetWidth, WidgetHeight, KpiMetric } from './types';
import {
  computeStats, computeStatsFor, statusBreakdown, agentPerformance, recentActivity,
  KPI_META, ALL_KPI_METRICS,
} from './metrics';
import {
  Pie, Donut, BarChart, VBar, StackedBar, ProgressCards, Gauge, Leaderboard, Heatmap,
  KanbanSummary, Funnel, LineChart, type Slice,
} from './viz';

export interface WidgetRenderCtx {
  firmId: string;
  userId: string;
  scope: 'all' | 'mine';   // agents can scope the whole board to their own leads
}

export interface WidgetDef {
  label: string;
  description: string;
  defaultSize: { w: WidgetWidth; h: WidgetHeight };
  chartTypes: string[];          // [] = no chart-type choice
  defaultChart?: string;
  render: (widget: DashboardWidget, ctx: WidgetRenderCtx) => ReactNode;
}

const scopedStats = (ctx: WidgetRenderCtx) =>
  ctx.scope === 'mine' ? computeStatsFor(ctx.firmId, l => l.assigned_to === ctx.userId) : computeStats(ctx.firmId);

const fmtKpi = (metric: KpiMetric, v: number) => {
  const kind = KPI_META[metric].kind;
  if (kind === 'percent') return `${v}%`;
  if (kind === 'money') return formatINRCompact(v);
  return String(v);
};

const ACCENT: Record<string, string> = {
  indigo: 'text-indigo-600', emerald: 'text-emerald-600', amber: 'text-amber-600',
  sky: 'text-sky-600', red: 'text-red-600', slate: 'text-slate-900',
};

// ── KPI ──
function KpiBody(widget: DashboardWidget, ctx: WidgetRenderCtx): ReactNode {
  const metric = widget.metric || 'total';
  const meta = KPI_META[metric];
  const stats = scopedStats(ctx);
  const raw = stats[metric];
  const total = stats.total || 1;
  if (widget.chartType === 'progress' && meta.kind === 'count') {
    return (
      <div>
        <div className={cn('text-3xl font-bold tabular-nums', ACCENT[meta.accent])}>{raw}</div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (raw / total) * 100)}%`, background: widget.options?.colors?.[0] || 'var(--dash-primary, #6366f1)' }} />
        </div>
        <div className="mt-1 text-[11px] text-slate-400">{Math.round((raw / total) * 100)}% of {total} leads</div>
      </div>
    );
  }
  return <div className={cn('flex h-full flex-col justify-center')}><div className={cn('text-4xl font-bold tabular-nums', ACCENT[meta.accent])}>{fmtKpi(metric, raw)}</div></div>;
}

// ── Lead distribution ──
function DistributionBody(widget: DashboardWidget, ctx: WidgetRenderCtx): ReactNode {
  const stats = scopedStats(ctx);
  const data: Slice[] = [{ label: 'Assigned', value: stats.assigned }, { label: 'Unassigned', value: stats.unassigned }];
  const o = widget.options;
  switch (widget.chartType) {
    case 'pie': return <Pie slices={data} options={o} />;
    case 'bar': return <VBar items={data} options={o} />;
    case 'hbar': return <BarChart items={data.map((d, i) => ({ label: d.label, value: d.value, color: o?.colors?.[i] }))} />;
    case 'stacked': return <StackedBar items={data} options={o} />;
    case 'progress': return <ProgressCards items={data} options={o} />;
    case 'gauge': return <Gauge value={stats.assigned} max={stats.assigned + stats.unassigned} label="Assigned share" options={o} />;
    case 'donut':
    default: return <Donut slices={data.map((d, i) => ({ ...d, color: o?.colors?.[i] }))} />;
  }
}

// ── Agent performance ──
function AgentBody(widget: DashboardWidget, ctx: WidgetRenderCtx): ReactNode {
  const rows = agentPerformance(ctx.firmId);
  const o = widget.options;
  switch (widget.chartType) {
    case 'bar':
      return <VBar items={rows.map(r => ({ label: r.name.split(' ')[0], value: r.assigned }))} options={o} />;
    case 'pie':
      return <Pie slices={rows.map((r, i) => ({ label: r.name.split(' ')[0], value: r.assigned, color: o?.colors?.[i] }))} options={o} />;
    case 'cards':
      return (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {rows.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No assigned leads yet.</p>}
          {rows.map(r => (
            <div key={r.id} className="rounded-lg border border-slate-100 p-3">
              <div className="truncate text-sm font-semibold text-slate-800">{r.name}</div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>{r.assigned} leads · {r.won} won</span>
                <span className={cn('font-bold', r.conversion >= 30 ? 'text-emerald-600' : 'text-slate-600')}>{r.conversion}%</span>
              </div>
            </div>
          ))}
        </div>
      );
    case 'heatmap':
      return (
        <Heatmap
          rowLabels={rows.map(r => r.name.split(' ')[0])}
          colLabels={['assigned', 'contacted', 'qualified', 'won', 'lost']}
          matrix={rows.map(r => [r.assigned, r.contacted, r.qualified, r.won, r.lost])}
          options={o}
        />
      );
    case 'leaderboard':
    default:
      return <Leaderboard rows={rows.map(r => ({ name: r.name, primary: r.won, sub: `${r.assigned} leads · ${r.conversion}%`, bar: r.won }))} options={o} />;
  }
}

// ── Lead status ──
function StatusBody(widget: DashboardWidget, ctx: WidgetRenderCtx): ReactNode {
  const data = statusBreakdown(ctx.firmId);
  const o = widget.options;
  switch (widget.chartType) {
    case 'kanban': return <KanbanSummary columns={data.map(d => ({ label: d.label, count: d.count, color: d.color }))} />;
    case 'pie': return <Pie slices={data.map((d, i) => ({ label: d.label, value: d.count, color: o?.colors?.[i] }))} options={o} />;
    case 'bar': return <VBar items={data.map((d, i) => ({ label: d.label, value: d.count, color: o?.colors?.[i] }))} options={o} />;
    case 'line': return <LineChart labels={data.map(d => d.label)} series={[{ name: 'Leads', color: o?.colors?.[0] || '#6366f1', values: data.map(d => d.count) }]} />;
    case 'funnel':
    default: return <Funnel stages={data.map(d => ({ label: d.label, value: d.count }))} />;
  }
}

// ── Recent activity ──
const ACTIVITY_ICON: Record<string, ReactNode> = {
  created: <UserPlus className="h-3.5 w-3.5" />, assigned: <UserCheck className="h-3.5 w-3.5" />,
  status_changed: <ArrowRightLeft className="h-3.5 w-3.5" />, updated: <StickyNote className="h-3.5 w-3.5" />,
  won: <Trophy className="h-3.5 w-3.5" />, lost: <XCircle className="h-3.5 w-3.5" />,
  commented: <FileText className="h-3.5 w-3.5" />, scheduled: <CalendarClock className="h-3.5 w-3.5" />,
};
function ActivityBody(_widget: DashboardWidget, ctx: WidgetRenderCtx): ReactNode {
  const rows = recentActivity(ctx.firmId);
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-slate-400">No recent lead activity.</p>;
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="flex gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">{ACTIVITY_ICON[r.action] || <Activity className="h-3.5 w-3.5" />}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-slate-700">{r.label}</div>
            {r.detail && <div className="truncate text-[11px] text-slate-400">{r.detail}</div>}
          </div>
          <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(r.when)}</span>
        </div>
      ))}
    </div>
  );
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDef> = {
  kpi: {
    label: 'KPI Card', description: 'A single headline metric',
    defaultSize: { w: 1, h: 'sm' }, chartTypes: ['number', 'progress'], defaultChart: 'number',
    render: KpiBody,
  },
  lead_distribution: {
    label: 'Lead Distribution', description: 'Assigned vs unassigned',
    defaultSize: { w: 2, h: 'md' }, chartTypes: ['donut', 'pie', 'bar', 'hbar', 'stacked', 'progress', 'gauge'], defaultChart: 'donut',
    render: DistributionBody,
  },
  agent_performance: {
    label: 'Agent Performance', description: 'Per-agent leads, wins, conversion',
    defaultSize: { w: 2, h: 'lg' }, chartTypes: ['leaderboard', 'bar', 'pie', 'cards', 'heatmap'], defaultChart: 'leaderboard',
    render: AgentBody,
  },
  lead_status: {
    label: 'Lead Status', description: 'Pipeline stage breakdown',
    defaultSize: { w: 2, h: 'md' }, chartTypes: ['funnel', 'kanban', 'pie', 'bar', 'line'], defaultChart: 'funnel',
    render: StatusBody,
  },
  recent_activity: {
    label: 'Recent Activity', description: 'Latest lead events',
    defaultSize: { w: 2, h: 'lg' }, chartTypes: [], render: ActivityBody,
  },
};

/** Default title for a widget instance (KPIs use their metric label). */
export function widgetTitle(w: DashboardWidget): string {
  if (w.title) return w.title;
  if (w.type === 'kpi' && w.metric) return KPI_META[w.metric].label;
  return WIDGET_REGISTRY[w.type].label;
}

/** Addable catalog for the "Add widget" menu (KPIs expand per metric). */
export function addableWidgets(): { type: WidgetType; metric?: KpiMetric; label: string }[] {
  const kpis = ALL_KPI_METRICS.map(m => ({ type: 'kpi' as WidgetType, metric: m, label: `KPI · ${KPI_META[m].label}` }));
  const others = (Object.keys(WIDGET_REGISTRY) as WidgetType[])
    .filter(t => t !== 'kpi')
    .map(t => ({ type: t, label: WIDGET_REGISTRY[t].label }));
  return [...others, ...kpis];
}

export { KPI_META, ALL_KPI_METRICS } from './metrics';
