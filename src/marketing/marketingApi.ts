// Marketing data access — direct Supabase reads (mirrors boq/*Api.ts). Marketing
// data is analytical/high-volume, so it is fetched on demand here rather than
// hydrated into the global CRM store.
import { supabase, DEMO_FIRM_ID } from '../lib/supabase';
import type { MarketingDataset, AdInsight, Attribution } from './types';

const sb = supabase as any;
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
export async function fetchMarketingData(firmId = DEMO_FIRM_ID): Promise<MarketingDataset> {
  const q = (t: string) => sb.from(t).select('*').eq('firm_id', firmId);
  const [accounts, campaigns, adSets, ads, insights, adLeads, attribution, syncRuns] = await Promise.all([
    q('crm_ad_accounts').order('created_at', { ascending: true }),
    q('crm_ad_campaigns'),
    q('crm_ad_sets'),
    q('crm_ads'),
    q('crm_ad_insights'),
    q('crm_ad_leads'),
    q('crm_marketing_attribution'),
    q('crm_sync_runs').order('started_at', { ascending: false }),
  ]);
  const err = [accounts, campaigns, adSets, ads, insights, adLeads, attribution, syncRuns].find(r => r.error);
  if (err?.error) throw new Error(`marketing fetch: ${err.error.message}`);

  return {
    accounts: accounts.data || [],
    campaigns: campaigns.data || [],
    adSets: adSets.data || [],
    ads: ads.data || [],
    insights: coerceInsights(insights.data || []),
    adLeads: adLeads.data || [],
    attribution: coerceAttribution(attribution.data || []),
    syncRuns: syncRuns.data || [],
  };
}

/** Record a sync run (used by the mock connector's "Sync now"). */
export async function recordSyncRun(firmId: string, accountId: string, rows: number, trigger: 'manual' | 'mock' = 'manual') {
  const now = new Date().toISOString();
  const { error } = await sb.from('crm_sync_runs').insert({
    firm_id: firmId, ad_account_id: accountId, provider: 'meta',
    status: 'success', trigger, rows_upserted: rows, started_at: now, finished_at: now,
  });
  if (error) throw new Error(error.message);
  await sb.from('crm_ad_accounts').update({ last_synced_at: now }).eq('id', accountId);
}

export async function setAccountStatus(accountId: string, status: string) {
  await sb.from('crm_ad_accounts').update({ status, updated_at: new Date().toISOString() }).eq('id', accountId);
}

export async function setSyncInterval(accountId: string, minutes: number) {
  await sb.from('crm_ad_accounts').update({ sync_interval_minutes: minutes }).eq('id', accountId);
}
