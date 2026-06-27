// Global marketing filter state + helpers. Every metric on the dashboard is
// derived from a dataset narrowed by these filters.
import { subDays, formatISO } from 'date-fns';
import type { MarketingDataset, AdInsight, Attribution } from './types';

export interface MarketingFilters {
  from: string;        // YYYY-MM-DD inclusive
  to: string;          // YYYY-MM-DD inclusive
  accountId: string;   // '' = all
  campaignId: string;  // '' = all
  platform: string;    // '' = all
  region: string;      // '' = all
  salespersonId: string; // '' = all
}

export type DatePreset = '7d' | '30d' | '90d' | 'all';

const iso = (d: Date) => formatISO(d, { representation: 'date' });

export function presetRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date();
  if (preset === 'all') return { from: '2000-01-01', to: iso(to) };
  const days = preset === '7d' ? 6 : preset === '30d' ? 29 : 89;
  return { from: iso(subDays(to, days)), to: iso(to) };
}

export function defaultFilters(): MarketingFilters {
  const { from, to } = presetRange('90d');
  return { from, to, accountId: '', campaignId: '', platform: '', region: '', salespersonId: '' };
}

function insightMatches(i: AdInsight, f: MarketingFilters): boolean {
  if (i.date < f.from || i.date > f.to) return false;
  if (f.accountId && i.ad_account_id !== f.accountId) return false;
  if (f.campaignId && i.campaign_id !== f.campaignId) return false;
  if (f.platform && i.platform !== f.platform) return false;
  if (f.region && i.region !== f.region) return false;
  return true;
}

function attributionMatches(a: Attribution, f: MarketingFilters): boolean {
  const day = (a.first_touch_at || a.created_at).slice(0, 10);
  if (day < f.from || day > f.to) return false;
  if (f.accountId && a.ad_account_id !== f.accountId) return false;
  if (f.campaignId && a.campaign_id !== f.campaignId) return false;
  if (f.region && a.region !== f.region) return false;
  if (f.salespersonId && a.salesperson_id !== f.salespersonId) return false;
  return true;
}

/** Narrow a dataset's fact rows (insights + attribution) to the active filters. */
export function applyFilters(data: MarketingDataset, f: MarketingFilters): MarketingDataset {
  return {
    ...data,
    insights: data.insights.filter(i => insightMatches(i, f)),
    attribution: data.attribution.filter(a => attributionMatches(a, f)),
    adLeads: data.adLeads.filter(l => {
      const day = (l.received_at || l.created_at).slice(0, 10);
      if (day < f.from || day > f.to) return false;
      if (f.accountId && l.ad_account_id !== f.accountId) return false;
      if (f.campaignId && l.campaign_id !== f.campaignId) return false;
      return true;
    }),
  };
}
