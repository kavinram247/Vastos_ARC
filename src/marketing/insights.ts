// AI-style insights — a deterministic heuristic engine over the analytics output.
// Produces ranked, actionable recommendations (no external API). Swappable for an
// LLM-backed engine later; the Insight[] contract stays the same.
import type { MarketingDataset } from './types';
import { summary, campaignTable, timeSeries, budgetUtilization, type CampaignRow } from './analytics';

export type InsightSeverity = 'positive' | 'info' | 'warning' | 'critical';
export interface Insight {
  id: string;
  severity: InsightSeverity;
  category: string;
  title: string;
  detail: string;
  recommendation?: string;
  metric?: string;
}

const SEV_WEIGHT: Record<InsightSeverity, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const x = (n: number) => `${n.toFixed(1)}×`;

export interface Forecast { nextSpend: number; nextRevenue: number; nextLeads: number; slopeRevenue: number; }

/** Linear-regression projection of the next `days` from the time series. */
export function forecast(data: MarketingDataset, days = 30): Forecast {
  const ts = timeSeries(data);
  const proj = (ys: number[]) => {
    const n = ys.length;
    if (n < 2) return Math.max(0, (ys[0] || 0) * days);
    const xs = ys.map((_, i) => i);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    const slope = den ? num / den : 0;
    const intercept = my - slope * mx;
    let total = 0;
    for (let i = n; i < n + days; i++) total += Math.max(0, slope * i + intercept);
    return total;
  };
  const ys = ts.map(t => t.revenue);
  const n = ys.length;
  const slopeRevenue = n >= 2 ? (ys[n - 1] - ys[0]) / (n - 1) : 0;
  return {
    nextSpend: proj(ts.map(t => t.spend)),
    nextRevenue: proj(ys),
    nextLeads: proj(ts.map(t => t.leads)),
    slopeRevenue,
  };
}

export function generateInsights(data: MarketingDataset): Insight[] {
  const out: Insight[] = [];
  const m = summary(data);
  const camps = campaignTable(data).filter(c => c.spend > 0);
  const spent = camps.length ? camps : [];

  // 1. Top performer (by ROAS, among campaigns that produced revenue)
  const earners = spent.filter(c => c.revenue > 0).sort((a, b) => b.roas - a.roas);
  if (earners.length) {
    const top = earners[0];
    out.push({
      id: 'top-campaign', severity: 'positive', category: 'Top performer',
      title: `${top.name} is your best ROAS`,
      detail: `It returned ${x(top.roas)} (${inr(top.revenue)} from ${inr(top.spend)}) with ${top.wins} win${top.wins === 1 ? '' : 's'}.`,
      recommendation: 'Protect or increase this budget — it is converting efficiently.',
      metric: x(top.roas),
    });
  }

  // 2. Underperformers — meaningful spend, no/low return
  const laggards = spent.filter(c => c.spend > avg(spent, c2 => c2.spend) * 0.5 && c.roas < 1);
  for (const c of laggards.sort((a, b) => a.roas - b.roas).slice(0, 2)) {
    out.push({
      id: `under-${c.id}`, severity: c.wins === 0 ? 'critical' : 'warning', category: 'Underperformer',
      title: `${c.name} is burning budget`,
      detail: `${inr(c.spend)} spent, ${inr(c.revenue)} returned (${x(c.roas)} ROAS), ${c.wins} wins.`,
      recommendation: c.wins === 0
        ? 'Pause this campaign and reallocate its budget to higher-ROAS campaigns.'
        : 'Refresh creative/targeting or trim budget until efficiency improves.',
      metric: x(c.roas),
    });
  }

  // 3. Budget reallocation opportunity
  if (earners.length && laggards.length) {
    const best = earners[0], worst = laggards[0];
    const shift = Math.round(worst.spend * 0.5);
    out.push({
      id: 'reallocate', severity: 'info', category: 'Budget optimization',
      title: 'Reallocate spend toward proven winners',
      detail: `${worst.name} (${x(worst.roas)}) is far below ${best.name} (${x(best.roas)}).`,
      recommendation: `Shift ~${inr(shift)} from ${worst.name} to ${best.name}; at current ROAS that could add ~${inr(shift * best.roas)} revenue.`,
    });
  }

  // 4. CAC vs LTV health
  if (m.wins > 0) {
    const healthy = m.ltv > m.cac;
    out.push({
      id: 'cac-ltv', severity: healthy ? 'positive' : 'warning', category: 'Unit economics',
      title: healthy ? 'Acquisition economics are healthy' : 'CAC is eating into deal value',
      detail: `Avg CAC ${inr(m.cac)} vs avg won-deal value ${inr(m.ltv)} (LTV:CAC ${x(m.ltv / (m.cac || 1))}).`,
      recommendation: healthy ? undefined : 'Lower CAC (better targeting) or raise average deal value before scaling spend.',
      metric: `${x(m.ltv / (m.cac || 1))}`,
    });
  }

  // 5. Lead-quality flag — high volume, low qualification
  const lowQuality = spent
    .map(c => ({ c, qr: c.crmLeads ? c.qualified / c.crmLeads : 0 }))
    .filter(o => o.c.crmLeads >= 5 && o.qr < 0.3)
    .sort((a, b) => a.qr - b.qr)[0];
  if (lowQuality) {
    out.push({
      id: `quality-${lowQuality.c.id}`, severity: 'warning', category: 'Lead quality',
      title: `${lowQuality.c.name} brings low-quality leads`,
      detail: `${Math.round(lowQuality.qr * 100)}% of its ${lowQuality.c.crmLeads} leads qualify.`,
      recommendation: 'Tighten audience targeting or add qualifying questions to the lead form.',
      metric: `${Math.round(lowQuality.qr * 100)}%`,
    });
  }

  // 6. Anomaly detection — last day vs trailing window (z-score on spend)
  const ts = timeSeries(data);
  if (ts.length >= 8) {
    const spends = ts.map(t => t.spend);
    const last = spends[spends.length - 1];
    const window = spends.slice(0, -1);
    const mean = avg(window, v => v);
    const sd = Math.sqrt(avg(window, v => (v - mean) ** 2)) || 1;
    const z = (last - mean) / sd;
    if (Math.abs(z) >= 2) {
      out.push({
        id: 'anomaly-spend', severity: z > 0 ? 'warning' : 'info', category: 'Anomaly',
        title: z > 0 ? 'Spend spiked recently' : 'Spend dropped recently',
        detail: `Latest daily spend ${inr(last)} is ${Math.abs(z).toFixed(1)}σ ${z > 0 ? 'above' : 'below'} the period average ${inr(mean)}.`,
        recommendation: z > 0 ? 'Confirm this increase is intentional and check pacing against budget.' : 'A delivery issue or budget exhaustion may have throttled spend.',
      });
    }
  }

  // 7. Budget utilization / pacing
  const bu = budgetUtilization(data);
  if (bu.budget > 0 && (bu.pct < 0.6 || bu.pct > 1.05)) {
    out.push({
      id: 'pacing', severity: bu.pct > 1.05 ? 'warning' : 'info', category: 'Pacing',
      title: bu.pct > 1.05 ? 'Over-pacing budget' : 'Under-utilizing budget',
      detail: `Spend is at ${Math.round(bu.pct * 100)}% of allocated budget for the period.`,
      recommendation: bu.pct > 1.05 ? 'Raise budgets or expect early exhaustion.' : 'Headroom exists — scale winning ad sets to use it.',
      metric: `${Math.round(bu.pct * 100)}%`,
    });
  }

  // 8. Forecast
  const f = forecast(data, 30);
  out.push({
    id: 'forecast', severity: 'info', category: 'Forecast',
    title: '30-day projection',
    detail: `On current trend: ~${inr(f.nextSpend)} spend → ~${inr(f.nextRevenue)} revenue (${Math.round(f.nextLeads)} leads).`,
    recommendation: f.slopeRevenue >= 0 ? 'Revenue trend is positive — sustain the current mix.' : 'Revenue trend is softening — refresh creative and revisit targeting.',
  });

  return out.sort((a, b) => SEV_WEIGHT[a.severity] - SEV_WEIGHT[b.severity]);
}

function avg<T>(rows: T[], f: (r: T) => number): number { return rows.length ? rows.reduce((s, r) => s + f(r), 0) / rows.length : 0; }

// keep CampaignRow import used for typing clarity
export type { CampaignRow };
