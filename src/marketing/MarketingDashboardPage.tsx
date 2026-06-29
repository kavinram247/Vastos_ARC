import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { AccessDenied } from '../components/AccessDenied';
import { formatINRCompact } from '../utils/format';
import type { Page } from '../types';
import { fetchMarketingData } from './marketingApi';
import { applyFilters, defaultFilters, presetRange, type MarketingFilters, type DatePreset } from './filters';
import {
  summary, timeSeries, funnel, campaignTable, adSetTable, adTable, byPlatform, byRegion,
  creativePerformance, salespersonPerformance, audienceInsights, budgetUtilization,
} from './analytics';
import { generateInsights, type Insight } from './insights';
import { KpiCard, LineChart, BarChart, Donut, Funnel, chartColor } from './charts';
import { downloadCSV, downloadXLS, printToPDF } from './exportUtils';
import { logAdminAction } from '../lib/events';
import type { MarketingDataset } from './types';
import {
  BarChart3, Loader2, Plug, Download, FileSpreadsheet, Printer, ChevronRight, ChevronDown,
  Lightbulb, AlertTriangle, TrendingUp, Info, Sparkles, ArrowRight,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props { onNavigate: (page: Page, projectId?: string) => void; }

const money = (n: number) => formatINRCompact(n);
const intf = (n: number) => Math.round(n).toLocaleString('en-IN');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const xf = (n: number) => `${n.toFixed(1)}×`;

export function MarketingDashboardPage({ onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [data, setData] = useState<MarketingDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MarketingFilters>(defaultFilters());

  useEffect(() => {
    let alive = true;
    fetchMarketingData(firm?.id)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { if (alive) { setError(String(e.message || e)); setLoading(false); } });
    return () => { alive = false; };
  }, [firm?.id]);

  const filtered = useMemo(() => (data ? applyFilters(data, filters) : null), [data, filters]);
  const a = useMemo(() => {
    if (!filtered) return null;
    return {
      kpi: summary(filtered), ts: timeSeries(filtered), fn: funnel(filtered),
      camps: campaignTable(filtered), platforms: byPlatform(filtered), regions: byRegion(filtered),
      creatives: creativePerformance(filtered), sales: salespersonPerformance(filtered),
      audiences: audienceInsights(filtered), budget: budgetUtilization(filtered),
      insights: generateInsights(filtered),
    };
  }, [filtered]);

  if (!user || !firm) return null;
  if (!can('marketing', 'view')) return <AccessDenied module="Marketing" />;

  if (loading) return <div className="flex items-center justify-center py-32 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading marketing analytics…</div>;
  if (error) return <div className="py-24 text-center text-red-500">Failed to load: {error}</div>;
  if (!data || !filtered || !a) return null;

  const personName = (id: string) => id === 'unassigned' ? 'Unassigned' : (store.profiles.find(p => p.id === id)?.full_name || id);
  const campaignName = (id: string | null) => data.campaigns.find(c => c.id === id)?.name || '—';

  const exportCampaigns = (fmt: 'csv' | 'xls') => {
    const rows = a.camps.map(c => ({
      Campaign: c.name, Objective: c.objective || '', Status: c.status,
      Spend: Math.round(c.spend), Impressions: c.impressions, Clicks: c.clicks, CTR: pct(c.ctr),
      Leads: c.crmLeads, Qualified: c.qualified, Wins: c.wins, Revenue: Math.round(c.revenue),
      ROAS: c.roas.toFixed(2), CPL: Math.round(c.cpl), CAC: Math.round(c.cac),
    }));
    (fmt === 'csv' ? downloadCSV : downloadXLS)(`marketing-campaigns-${filters.from}_${filters.to}`, rows);
    logAdminAction({ firmId: firm.id, actorId: user.id, action: 'exported', actionLabel: `Exported campaign report (${fmt.toUpperCase()})`, module: 'marketing', details: `${rows.length} campaigns` });
  };

  const setPreset = (p: DatePreset) => setFilters(f => ({ ...f, ...presetRange(p) }));
  const isPreset = (p: DatePreset) => { const r = presetRange(p); return filters.from === r.from && filters.to === r.to; };

  const platformSlices = a.platforms.map((s, i) => ({ label: s.key, value: s.spend, color: chartColor(i) }));
  const roasItems = a.camps.filter(c => c.spend > 0).map(c => ({ label: c.name.replace(/ —.*/, ''), value: Number(c.roas.toFixed(2)) }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10"><BarChart3 className="h-5 w-5 text-indigo-600" /></span>
            Marketing Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">Ad spend tied to leads, sales, and revenue — the full picture from click to close.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('marketing', 'export') && (
            <>
              <button onClick={() => exportCampaigns('csv')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"><Download className="h-3.5 w-3.5" /> CSV</button>
              <button onClick={() => exportCampaigns('xls')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</button>
              <button onClick={printToPDF} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"><Printer className="h-3.5 w-3.5" /> PDF</button>
            </>
          )}
          {can('marketing', 'edit') && (
            <button onClick={() => onNavigate('marketing-connect')} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"><Plug className="h-3.5 w-3.5" /> Connections</button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white p-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
          {(['7d', '30d', '90d', 'all'] as DatePreset[]).map(p => (
            <button key={p} onClick={() => setPreset(p)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium', isPreset(p) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{p === 'all' ? 'All' : p}</button>
          ))}
        </div>
        <FilterSelect value={filters.accountId} onChange={v => setFilters(f => ({ ...f, accountId: v }))} all="All accounts" options={data.accounts.map(ac => ({ value: ac.id, label: ac.name }))} />
        <FilterSelect value={filters.campaignId} onChange={v => setFilters(f => ({ ...f, campaignId: v }))} all="All campaigns" options={data.campaigns.map(c => ({ value: c.id, label: c.name }))} />
        <FilterSelect value={filters.platform} onChange={v => setFilters(f => ({ ...f, platform: v }))} all="All platforms" options={[...new Set(data.insights.map(i => i.platform).filter(Boolean) as string[])].map(p => ({ value: p, label: p }))} />
        <FilterSelect value={filters.region} onChange={v => setFilters(f => ({ ...f, region: v }))} all="All regions" options={[...new Set(data.insights.map(i => i.region).filter(Boolean) as string[])].map(r => ({ value: r, label: r }))} />
        <FilterSelect value={filters.salespersonId} onChange={v => setFilters(f => ({ ...f, salespersonId: v }))} all="All salespeople" options={[...new Set(data.attribution.map(at => at.salesperson_id).filter(Boolean) as string[])].map(s => ({ value: s, label: personName(s) }))} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Ad spend" value={money(a.kpi.spend)} accent="slate" sub={`${pct(a.budget.pct)} of budget`} />
        <KpiCard label="Revenue" value={money(a.kpi.revenue)} accent="emerald" />
        <KpiCard label="ROAS" value={xf(a.kpi.roas)} accent={a.kpi.roas >= 1 ? 'emerald' : 'red'} sub={`ROI ${pct(a.kpi.roi)}`} />
        <KpiCard label="Leads" value={intf(a.kpi.crmLeads)} accent="indigo" sub={`${intf(a.kpi.platformLeads)} platform`} />
        <KpiCard label="Cost / lead" value={money(a.kpi.cpl)} accent="amber" />
        <KpiCard label="Wins" value={intf(a.kpi.wins)} accent="sky" sub={`${pct(a.kpi.convRate)} conv.`} />
        <KpiCard label="CAC" value={money(a.kpi.cac)} accent="amber" />
        <KpiCard label="Avg deal (LTV)" value={money(a.kpi.ltv)} accent="emerald" />
        <KpiCard label="Impressions" value={intf(a.kpi.impressions)} accent="slate" />
        <KpiCard label="Clicks" value={intf(a.kpi.clicks)} accent="slate" sub={`CTR ${pct(a.kpi.ctr)}`} />
        <KpiCard label="Qualified" value={intf(a.kpi.qualified)} accent="indigo" />
        <KpiCard label="CPM" value={money(Math.round(a.kpi.cpm))} accent="slate" />
      </div>

      {/* Attribution pipeline */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(16,32,26,0.04)]">
        <div className="mb-4">
          <div className="text-sm font-semibold text-slate-800">Spend → Leads → Revenue</div>
          <div className="text-[11px] text-slate-400">Full attribution pipeline — every rupee of ad spend tracked to the closed deal</div>
        </div>
        <div className="flex flex-nowrap items-stretch gap-0 overflow-x-auto pb-1">
          {[
            { label: 'Ad Spend', value: money(a.kpi.spend), sub: `${pct(a.budget.pct)} of budget`, bg: 'bg-slate-50', text: 'text-slate-900', border: 'border-slate-200' },
            { label: 'Platform Leads', value: intf(a.kpi.platformLeads), sub: `CPL ${money(a.kpi.cpl)}`, bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
            { label: 'CRM Captured', value: intf(a.kpi.crmLeads), sub: `${pct(a.kpi.crmLeads / Math.max(1, a.kpi.platformLeads))} captured`, bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200' },
            { label: 'Qualified', value: intf(a.kpi.qualified), sub: `${pct(a.kpi.qualified / Math.max(1, a.kpi.crmLeads))} of leads`, bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
            { label: 'Deals Won', value: intf(a.kpi.wins), sub: `CAC ${money(a.kpi.cac)}`, bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
            { label: 'Revenue', value: money(a.kpi.revenue), sub: `ROAS ${xf(a.kpi.roas)}`, bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-300' },
          ].map((stage, i, arr) => (
            <div key={stage.label} className="flex items-center">
              <div className={cn('flex min-w-[110px] flex-col items-center rounded-xl border px-3 py-3 text-center', stage.bg, stage.border)}>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{stage.label}</div>
                <div className={cn('mt-1 text-lg font-bold tabular-nums', stage.text)}>{stage.value}</div>
                <div className="text-[10px] text-slate-400">{stage.sub}</div>
              </div>
              {i < arr.length - 1 && <ArrowRight className="mx-1.5 h-4 w-4 shrink-0 text-slate-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* Trend + funnel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Spend vs Revenue" className="lg:col-span-2">
          <LineChart labels={a.ts.map(t => t.date)} fmt={money}
            series={[
              { name: 'Spend', color: '#f59e0b', values: a.ts.map(t => t.spend) },
              { name: 'Revenue', color: '#10b981', values: a.ts.map(t => t.revenue) },
            ]} />
        </Panel>
        <Panel title="Conversion funnel"><Funnel stages={a.fn} /></Panel>
      </div>

      {/* Leads + CPL trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Leads over time" subtitle="Platform leads captured per day">
          <LineChart labels={a.ts.map(t => t.date)} fmt={intf}
            series={[{ name: 'Leads', color: '#6366f1', values: a.ts.map(t => t.leads) }]} />
        </Panel>
        <Panel title="Cost per lead trend" subtitle="Daily spend ÷ daily platform leads">
          <LineChart labels={a.ts.map(t => t.date)} fmt={money}
            series={[{ name: 'CPL', color: '#f59e0b', values: a.ts.map(t => t.leads > 0 ? Math.round(t.spend / t.leads) : 0) }]} />
        </Panel>
      </div>

      {/* ROAS + platform + region */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="ROAS by campaign"><BarChart items={roasItems} fmt={n => `${n}×`} /></Panel>
        <Panel title="Spend by platform"><Donut slices={platformSlices} /></Panel>
        <Panel title="Revenue by region">
          <BarChart items={a.regions.map(r => ({ label: r.key, value: r.revenue }))} fmt={money} />
        </Panel>
      </div>

      {/* AI insights */}
      <Panel title={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-500" /> AI Insights & Recommendations</span>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {a.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
        </div>
      </Panel>

      {/* Campaign table with drill-down */}
      <Panel title="Campaign performance" subtitle="Click a row to drill into ad sets and ads">
        <CampaignTable data={filtered} rows={a.camps} campaignName={campaignName} />
      </Panel>

      {/* Sales attribution + creatives */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Salesperson performance" subtitle="Against marketing-generated leads">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400"><th className="py-1.5">Salesperson</th><th className="text-right">Leads</th><th className="text-right">Wins</th><th className="text-right">Revenue</th><th className="text-right">Conv.</th></tr></thead>
            <tbody>
              {a.sales.map(s => (
                <tr key={s.id} className="border-t border-slate-50">
                  <td className="py-2 font-medium text-slate-700">{personName(s.id)}</td>
                  <td className="text-right tabular-nums">{s.assigned}</td>
                  <td className="text-right tabular-nums">{s.wins}</td>
                  <td className="text-right tabular-nums text-emerald-600">{money(s.revenue)}</td>
                  <td className="text-right tabular-nums">{pct(s.convRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Creative performance" subtitle="Best ROAS first">
          <div className="space-y-2.5">
            {a.creatives.filter(c => c.spend > 0).slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold uppercase text-slate-500">{c.creative.format || 'img'}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-800">{c.creative.headline || c.name}</div>
                  <div className="text-[11px] text-slate-400">{money(c.spend)} spend · {c.crmLeads} leads · CTR {pct(c.ctr)}</div>
                </div>
                <div className="text-right"><div className={cn('text-sm font-bold', c.roas >= 1 ? 'text-emerald-600' : 'text-red-500')}>{xf(c.roas)}</div><div className="text-[10px] text-slate-400">ROAS</div></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Audience insights */}
      <Panel title="Audience insights" subtitle="Segments ranked by ROAS">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {a.audiences.filter(s => s.spend > 0).map(s => (
            <div key={s.id} className="rounded-lg border border-slate-100 p-3">
              <div className="truncate text-sm font-medium text-slate-800" title={s.name}>{s.name}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(s.targeting).slice(0, 3).map(([k, v]) => (
                  <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{k}: {Array.isArray(v) ? v.join('/') : String(v)}</span>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">{s.leads} leads · {s.wins} wins</span>
                <span className={cn('font-bold', s.roas >= 1 ? 'text-emerald-600' : 'text-red-500')}>{xf(s.roas)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── sub-components ──
function Panel({ title, subtitle, children, className }: { title: React.ReactNode; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(16,32,26,0.04)]', className)}>
      <div className="mb-3"><div className="text-sm font-semibold text-slate-800">{title}</div>{subtitle && <div className="text-[11px] text-slate-400">{subtitle}</div>}</div>
      {children}
    </div>
  );
}

function FilterSelect({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 focus:border-indigo-500 focus:outline-none">
      <option value="">{all}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const styles = {
    positive: { box: 'border-emerald-100 bg-emerald-50/50', icon: <TrendingUp className="h-4 w-4 text-emerald-600" /> },
    warning: { box: 'border-amber-100 bg-amber-50/50', icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> },
    critical: { box: 'border-red-100 bg-red-50/50', icon: <AlertTriangle className="h-4 w-4 text-red-600" /> },
    info: { box: 'border-slate-100 bg-slate-50/50', icon: <Info className="h-4 w-4 text-slate-500" /> },
  }[insight.severity];
  return (
    <div className={cn('rounded-lg border p-3', styles.box)}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{styles.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{insight.category}</span>
            {insight.metric && <span className="rounded bg-white px-1.5 text-[11px] font-bold text-slate-700">{insight.metric}</span>}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-800">{insight.title}</div>
          <div className="text-xs text-slate-500">{insight.detail}</div>
          {insight.recommendation && <div className="mt-1.5 flex items-start gap-1.5 text-xs text-indigo-700"><Lightbulb className="mt-0.5 h-3 w-3 shrink-0" /> {insight.recommendation}</div>}
        </div>
      </div>
    </div>
  );
}

function CampaignTable({ data, rows, campaignName }: { data: MarketingDataset; rows: ReturnType<typeof campaignTable>; campaignName: (id: string | null) => string }) {
  const [openCamp, setOpenCamp] = useState<Set<string>>(new Set());
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const toggle = (s: Set<string>, set: (x: Set<string>) => void, id: string) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); set(n); };
  void campaignName;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="py-2">Campaign</th><th className="text-right">Spend</th><th className="text-right">Leads</th><th className="text-right">CPL</th>
            <th className="text-right">Wins</th><th className="text-right">Revenue</th><th className="text-right">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => {
            const open = openCamp.has(c.id);
            return (
              <Fragment key={c.id}>
                <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/60" onClick={() => toggle(openCamp, setOpenCamp, c.id)}>
                  <td className="py-2.5 font-medium text-slate-800"><span className="inline-flex items-center gap-1.5">{open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}{c.name}</span></td>
                  <td className="text-right tabular-nums">{money(c.spend)}</td>
                  <td className="text-right tabular-nums">{c.crmLeads}</td>
                  <td className="text-right tabular-nums">{money(c.cpl)}</td>
                  <td className="text-right tabular-nums">{c.wins}</td>
                  <td className="text-right tabular-nums text-emerald-600">{money(c.revenue)}</td>
                  <td className={cn('text-right font-semibold tabular-nums', c.roas >= 1 ? 'text-emerald-600' : 'text-red-500')}>{xf(c.roas)}</td>
                </tr>
                {open && adSetTable(data, c.id).map(s => {
                  const sOpen = openSet.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <tr className="cursor-pointer border-t border-slate-50 bg-slate-50/40 text-xs" onClick={() => toggle(openSet, setOpenSet, s.id)}>
                        <td className="py-2 pl-6 text-slate-600"><span className="inline-flex items-center gap-1.5">{sOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{s.name}</span></td>
                        <td className="text-right tabular-nums">{money(s.spend)}</td><td className="text-right tabular-nums">{s.crmLeads}</td><td className="text-right tabular-nums">{money(s.cpl)}</td>
                        <td className="text-right tabular-nums">{s.wins}</td><td className="text-right tabular-nums">{money(s.revenue)}</td><td className="text-right tabular-nums">{xf(s.roas)}</td>
                      </tr>
                      {sOpen && adTable(data, s.id).map(ad => (
                        <tr key={ad.id} className="border-t border-slate-50 text-xs text-slate-500">
                          <td className="py-1.5 pl-12">{ad.name}</td>
                          <td className="text-right tabular-nums">{money(ad.spend)}</td><td className="text-right tabular-nums">{ad.crmLeads}</td><td className="text-right tabular-nums">{money(ad.cpl)}</td>
                          <td className="text-right tabular-nums">{ad.wins}</td><td className="text-right tabular-nums">{money(ad.revenue)}</td><td className="text-right tabular-nums">{xf(ad.roas)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
