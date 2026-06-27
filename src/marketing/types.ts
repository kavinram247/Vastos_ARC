// Marketing Analytics — row + analytics types. Mirrors the crm_ad_* / attribution
// tables. Provider-agnostic so Google/LinkedIn/TikTok plug in later.

export type AdProvider = 'meta' | 'google' | 'linkedin' | 'tiktok';
export type AdAccountStatus = 'connected' | 'mock' | 'disconnected' | 'error';
export type InsightLevel = 'account' | 'campaign' | 'adset' | 'ad';
export type AttributionStage = 'lead' | 'qualified' | 'quoted' | 'won' | 'lost';
export type SyncStatus = 'success' | 'error' | 'running';
export type SyncTrigger = 'manual' | 'scheduled' | 'mock';

export interface AdAccount {
  id: string;
  firm_id: string;
  provider: AdProvider;
  external_account_id: string | null;
  name: string;
  currency: string;
  status: AdAccountStatus;
  sync_interval_minutes: number;
  last_synced_at: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdCampaign {
  id: string;
  firm_id: string;
  ad_account_id: string;
  provider: AdProvider;
  external_id: string | null;
  name: string;
  objective: string | null;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_date: string | null;
  stop_date: string | null;
  created_at: string;
}

export interface AdSet {
  id: string;
  firm_id: string;
  campaign_id: string;
  external_id: string | null;
  name: string;
  status: string;
  optimization_goal: string | null;
  targeting: Record<string, any>;
  daily_budget: number | null;
  created_at: string;
}

export interface Ad {
  id: string;
  firm_id: string;
  ad_set_id: string;
  campaign_id: string;
  external_id: string | null;
  name: string;
  status: string;
  creative: { headline?: string; body?: string; cta?: string; format?: string; image_url?: string };
  created_at: string;
}

export interface AdInsight {
  id: string;
  firm_id: string;
  provider: AdProvider;
  ad_account_id: string | null;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  level: InsightLevel;
  date: string;
  platform: string | null;
  region: string | null;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  link_clicks: number;
  video_views: number;
  leads: number;
  spend: number;
}

export interface AdLead {
  id: string;
  firm_id: string;
  provider: AdProvider;
  external_lead_id: string | null;
  ad_account_id: string | null;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  form_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  raw_fields: Record<string, any>;
  crm_lead_id: string | null;
  contact_id: string | null;
  status: 'mapped' | 'duplicate' | 'unmapped';
  received_at: string;
  created_at: string;
}

export interface Attribution {
  id: string;
  firm_id: string;
  lead_id: string | null;
  ad_lead_id: string | null;
  provider: AdProvider;
  ad_account_id: string | null;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  stage: AttributionStage;
  converted_project_id: string | null;
  quotation_id: string | null;
  salesperson_id: string | null;
  region: string | null;
  revenue: number;
  first_touch_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncRun {
  id: string;
  firm_id: string;
  ad_account_id: string | null;
  provider: AdProvider;
  status: SyncStatus;
  trigger: SyncTrigger;
  rows_upserted: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

/** Everything the dashboard needs, fetched once then aggregated client-side. */
export interface MarketingDataset {
  accounts: AdAccount[];
  campaigns: AdCampaign[];
  adSets: AdSet[];
  ads: Ad[];
  insights: AdInsight[];
  adLeads: AdLead[];
  attribution: Attribution[];
  syncRuns: SyncRun[];
}
