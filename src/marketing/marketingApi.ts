// Marketing data access. Marketing data is analytical/high-volume, so it is
// fetched on demand here rather than hydrated into the global CRM store.
//
// Phase 5, item 2.10: fetchMarketingData()/recordSyncRun() call vastos-api's
// src/marketing/ module (8-table assembly / a 2-write transaction — neither
// fits the generic /api/data/:table layer). setAccountStatus()/
// setSyncInterval() go through that generic layer instead (plain update by
// id on crm_ad_accounts) via updateRow in vastosApi.ts. Signatures unchanged
// so MarketingPage.tsx needs no changes.
import { vastosApiFetch, updateRow } from '../lib/vastosApi';
import type { MarketingDataset, AdInsight, Attribution } from './types';

const num = (v: any) => (v == null ? 0 : Number(v));

function coerceInsights(rows: any[]): AdInsight[] {
  return rows.map(r => ({
    ...r,
    impressions: num(r.impressions), reach: num(r.reach), frequency: num(r.frequency),
    clicks: num(r.clicks), link_clicks: num(r.link_clicks), video_views: num(r.video_views),
    leads: num(r.leads), spend: num(r.spend),
  }));
}
function coerceAttribution(rows: any[]): Attribution[] {
  return rows.map(r => ({ ...r, revenue: num(r.revenue) }));
}

/** Fetch the full marketing dataset for a firm (filtering happens client-side). */
export async function fetchMarketingData(_firmId: string): Promise<MarketingDataset> {
  const data = await vastosApiFetch<{
    accounts: any[]; campaigns: any[]; adSets: any[]; ads: any[];
    insights: any[]; adLeads: any[]; attribution: any[]; syncRuns: any[];
  }>('/api/marketing/data');

  return {
    accounts: data.accounts,
    campaigns: data.campaigns,
    adSets: data.adSets,
    ads: data.ads,
    insights: coerceInsights(data.insights),
    adLeads: data.adLeads,
    attribution: coerceAttribution(data.attribution),
    syncRuns: data.syncRuns,
  };
}

/** Record a sync run (used by the mock connector's "Sync now"). */
export async function recordSyncRun(_firmId: string, accountId: string, rows: number, trigger: 'manual' | 'mock' = 'manual') {
  await vastosApiFetch('/api/marketing/sync-runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, rows, trigger }),
  });
}

export async function setAccountStatus(accountId: string, status: string) {
  await updateRow('crm_ad_accounts', accountId, { status, updated_at: new Date().toISOString() });
}

export async function setSyncInterval(accountId: string, minutes: number) {
  await updateRow('crm_ad_accounts', accountId, { sync_interval_minutes: minutes });
}
