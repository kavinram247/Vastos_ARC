// Mock Meta connector — Phase 1. Data is pre-seeded in the DB; "Sync now" records
// a sync run and refreshes last_synced_at so the full pipeline is demoable without
// Meta credentials. Swap this for `metaConnector` (live edge functions) once an
// FB App ID/Secret is configured — the interface is identical.
import { supabase } from '../../lib/supabase';
import { recordSyncRun } from '../marketingApi';
import type { AdConnector } from './types';

const sb = supabase as any;

export const mockMetaConnector: AdConnector = {
  provider: 'meta',
  label: 'Meta (Facebook & Instagram)',
  isLive: () => false,
  getConnectUrl: () => null,
  async sync(firmId, accountId) {
    const { count } = await sb
      .from('crm_ad_insights')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq('ad_account_id', accountId);
    const rows = count ?? 0;
    // Simulate work, then record the run.
    await new Promise(r => setTimeout(r, 700));
    await recordSyncRun(firmId, accountId, rows, 'manual');
    return rows;
  },
};
