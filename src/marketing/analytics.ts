// Marketing analytics — pure aggregation functions over a (filtered) dataset.
// No I/O; everything here is deterministic and unit-testable.
import type { AdInsight, Attribution, AdSet, Ad, MarketingDataset } from './types';

export interface Metrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;        // clicks / impressions
  platformLeads: number;
  crmLeads: number;   // attribution rows (captured into CRM)
  qualified: number;  // stage qualified|quoted|won
  wins: number;       // stage won
  revenue: number;
  cpl: number;        // spend / platformLeads
  cpc: number;        // spend / clicks
  cpm: number;        // spend / impressions * 1000
  roas: number;       // revenue / spend
  roi: number;        // (revenue - spend) / spend
  cac: number;        // spend / wins
  ltv: number;        // revenue / wins (avg won-deal value)
  convRate: number;   // wins / crmLeads
}

const div = (a: number, b: number) => (b ? a / b : 0);

/** Core metric bundle for any subset of fact rows. */
export function aggMetrics(insights: AdInsight[], attribution: Attribution[]): Metrics {
  const spend = sum(insights, i => i.spend);
  const impressions = sum(insights, i => i.impressions);
  const reach = sum(insights, i => i.reach);
  const clicks = sum(insights, i => i.clicks);
  const platformLeads = sum(insights, i => i.leads);
  const crmLeads = attribution.length;
  const qualified = attribution.filter(a => a.stage === 'qualified' || a.stage === 'quoted' || a.stage === 'won').length;
  const wins = attribution.filter(a => a.stage === 'won').length;
  const revenue = sum(attribution, a => a.revenue);
  return {
    spend, impressions, reach, clicks, platformLeads, crmLeads, qualified, wins, revenue,
    ctr: div(clicks, impressions),
    cpl: div(spend, platformLeads),
    cpc: div(spend, clicks),
    cpm: div(spend, impressions) * 1000,
    roas: div(revenue, spend),
    roi: spend ? (revenue - spend) / spend : 0,
    cac: div(spend, wins),
    ltv: div(revenue, wins),
    convRate: div(wins, crmLeads),
  };
}

export function summary(data: MarketingDataset): Metrics {
  return aggMetrics(data.insights, data.attribution);
}

export interface BudgetUtilization { spend: number; budget: number; pct: number; }
export function budgetUtilization(data: MarketingDataset): BudgetUtilization {
  const days = new Set(data.insights.map(i => i.date)).size || 1;
  const activeCampaignIds = new Set(data.insights.map(i => i.campaign_id));
  const dailyBudget = data.campaigns
    .filter(c => activeCampaignIds.has(c.id))
    .reduce((s, c) => s + (c.daily_budget || 0), 0);
  const budget = dailyBudget * days;
  const spend = sum(data.insights, i => i.spend);
  return { spend, budget, pct: div(spend, budget) };
}

export interface TimePoint { date: string; spend: number; revenue: number; leads: number; clicks: number; impressions: number; }
export function timeSeries(data: MarketingDataset): TimePoint[] {
  const map = new Map<string, TimePoint>();
  const get = (d: string) => {
    let p = map.get(d);
    if (!p) { p = { date: d, spend: 0, revenue: 0, leads: 0, clicks: 0, impressions: 0 }; map.set(d, p); }
    return p;
  };
  for (const i of data.insights) {
    const p = get(i.date);
    p.spend += i.spend; p.leads += i.leads; p.clicks += i.clicks; p.impressions += i.impressions;
  }
  for (const a of data.attribution) {
    const d = (a.first_touch_at || a.created_at).slice(0, 10);
    get(d).revenue += a.revenue;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface FunnelStage { label: string; value: number; }
export function funnel(data: MarketingDataset): FunnelStage[] {
  const m = summary(data);
  return [
    { label: 'Impressions', value: m.impressions },
    { label: 'Clicks', value: m.clicks },
    { label: 'Platform Leads', value: m.platformLeads },
    { label: 'CRM Leads', value: m.crmLeads },
    { label: 'Qualified', value: m.qualified },
    { label: 'Won', value: m.wins },
  ];
}

export interface CampaignRow extends Metrics { id: string; name: string; objective: string | null; status: string; }
export function campaignTable(data: MarketingDataset): CampaignRow[] {
  return groupRows(data, data.campaigns, c => c.id,
    (c, ins, att) => ({ id: c.id, name: c.name, objective: c.objective, status: c.status, ...aggMetrics(ins, att) }),
    i => i.campaign_id, a => a.campaign_id)
    .sort((a, b) => b.spend - a.spend);
}

export interface AdSetRow extends Metrics { id: string; name: string; }
export function adSetTable(data: MarketingDataset, campaignId: string): AdSetRow[] {
  const sets = data.adSets.filter(s => s.campaign_id === campaignId);
  return groupRows(data, sets, s => s.id,
    (s, ins, att) => ({ id: s.id, name: s.name, ...aggMetrics(ins, att) }),
    i => i.ad_set_id, a => a.ad_set_id)
    .sort((a, b) => b.spend - a.spend);
}

export interface AdRow extends Metrics { id: string; name: string; creative: Ad['creative']; }
export function adTable(data: MarketingDataset, adSetId: string): AdRow[] {
  const ads = data.ads.filter(a => a.ad_set_id === adSetId);
  return groupRows(data, ads, a => a.id,
    (ad, ins, att) => ({ id: ad.id, name: ad.name, creative: ad.creative, ...aggMetrics(ins, att) }),
    i => i.ad_id, a => a.ad_id)
    .sort((a, b) => b.spend - a.spend);
}

export interface Slice { key: string; spend: number; leads: number; revenue: number; impressions: number; }
export function byPlatform(data: MarketingDataset): Slice[] { return breakdown(data, i => i.platform || 'unknown', () => null); }
export function byRegion(data: MarketingDataset): Slice[] { return breakdown(data, i => i.region || 'unknown', a => a.region || 'unknown'); }

export interface CreativeRow extends Metrics { id: string; name: string; creative: Ad['creative']; }
export function creativePerformance(data: MarketingDataset): CreativeRow[] {
  return groupRows(data, data.ads, a => a.id,
    (ad, ins, att) => ({ id: ad.id, name: ad.name, creative: ad.creative, ...aggMetrics(ins, att) }),
    i => i.ad_id, a => a.ad_id)
    .sort((a, b) => b.roas - a.roas);
}

export interface SalesRow { id: string; assigned: number; qualified: number; wins: number; revenue: number; convRate: number; }
export function salespersonPerformance(data: MarketingDataset): SalesRow[] {
  const map = new Map<string, SalesRow>();
  for (const a of data.attribution) {
    const id = a.salesperson_id || 'unassigned';
    let r = map.get(id);
    if (!r) { r = { id, assigned: 0, qualified: 0, wins: 0, revenue: 0, convRate: 0 }; map.set(id, r); }
    r.assigned += 1;
    if (a.stage === 'qualified' || a.stage === 'quoted' || a.stage === 'won') r.qualified += 1;
    if (a.stage === 'won') { r.wins += 1; r.revenue += a.revenue; }
  }
  return [...map.values()].map(r => ({ ...r, convRate: div(r.wins, r.assigned) })).sort((a, b) => b.revenue - a.revenue);
}

export interface AudienceRow { id: string; name: string; targeting: AdSet['targeting']; leads: number; wins: number; revenue: number; roas: number; spend: number; }
export function audienceInsights(data: MarketingDataset): AudienceRow[] {
  return groupRows(data, data.adSets, s => s.id,
    (s, ins, att) => {
      const m = aggMetrics(ins, att);
      return { id: s.id, name: s.name, targeting: s.targeting, leads: m.crmLeads, wins: m.wins, revenue: m.revenue, roas: m.roas, spend: m.spend };
    },
    i => i.ad_set_id, a => a.ad_set_id)
    .sort((a, b) => b.roas - a.roas);
}

// ── helpers ──
function sum<T>(rows: T[], f: (r: T) => number): number { return rows.reduce((s, r) => s + (f(r) || 0), 0); }

function groupRows<E, R>(
  data: MarketingDataset, entities: E[], idOf: (e: E) => string,
  build: (e: E, ins: AdInsight[], att: Attribution[]) => R,
  insKey: (i: AdInsight) => string | null, attKey: (a: Attribution) => string | null,
): R[] {
  return entities.map(e => {
    const id = idOf(e);
    return build(e, data.insights.filter(i => insKey(i) === id), data.attribution.filter(a => attKey(a) === id));
  });
}

function breakdown(data: MarketingDataset, insKey: (i: AdInsight) => string, attKey: (a: Attribution) => string | null): Slice[] {
  const map = new Map<string, Slice>();
  const get = (k: string) => { let s = map.get(k); if (!s) { s = { key: k, spend: 0, leads: 0, revenue: 0, impressions: 0 }; map.set(k, s); } return s; };
  for (const i of data.insights) { const s = get(insKey(i)); s.spend += i.spend; s.leads += i.leads; s.impressions += i.impressions; }
  for (const a of data.attribution) { const k = attKey(a); if (k) get(k).revenue += a.revenue; }
  return [...map.values()].sort((a, b) => b.spend - a.spend);
}
