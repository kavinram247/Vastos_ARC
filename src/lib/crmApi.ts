// ─────────────────────────────────────────────────────────────
// CRM data access — hydration reads + write-through persistence for the
// Supabase-backed DataStore. Maps each store array to its crm_ table.
// PostgREST returns `numeric` as strings; we coerce known numeric fields back
// to numbers on hydration so the in-memory shape matches the app's expectations.
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID } from './supabase';

const sb = supabase as any;

// store-array name → crm_ table name
export const TABLES = {
  profiles: 'crm_profiles',
  projects: 'crm_projects',
  assignments: 'crm_project_assignments',
  milestones: 'crm_milestones',
  siteUpdates: 'crm_site_updates',
  paymentPlans: 'crm_payment_plans',
  paymentSplits: 'crm_payment_splits',
  paymentsReceived: 'crm_payments_received',
  costEntries: 'crm_cost_entries',
  comments: 'crm_comments',
  notifications: 'crm_notifications',
  activityLog: 'crm_activity_log',
  leads: 'crm_leads',
  leadInteractions: 'crm_lead_interactions',
  leadQuotations: 'crm_lead_quotations',
  projectDocuments: 'crm_project_documents',
  projectVendors: 'crm_project_vendors',
  contacts: 'crm_contacts',
  pipelineStages: 'crm_pipeline_stages',
  featureFlags: 'crm_feature_flags',
  commChannels: 'crm_comm_channels',
  roles: 'crm_roles',
  rolePermissions: 'crm_role_permissions',
} as const;
export type StoreKey = keyof typeof TABLES;

const NUMERIC_FIELDS = new Set([
  'project_value', 'total_amount', 'split_count', 'amount', 'gst_rate', 'gst_amount', 'total_with_gst',
  'estimated_cost', 'design_fees', 'supervision_fees', 'other_charges', 'estimated_budget', 'estimated_area',
  'contract_value', 'rating', 'file_size', 'order_index', 'split_number', 'version', 'validity_days',
]);

function coerce(rows: any[]): any[] {
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (NUMERIC_FIELDS.has(k) && row[k] != null) row[k] = Number(row[k]);
    }
  }
  return rows;
}

/** Load every CRM table for a firm into the store's array shape (numerics coerced). */
export async function hydrateAll(firmId = DEMO_FIRM_ID): Promise<Record<StoreKey, any[]>> {
  const keys = Object.keys(TABLES) as StoreKey[];
  const results = await Promise.all(keys.map((k) => sb.from(TABLES[k]).select('*').eq('firm_id', firmId)));
  const out = {} as Record<StoreKey, any[]>;
  keys.forEach((k, i) => {
    const { data, error } = results[i];
    if (error) throw new Error(`hydrate ${TABLES[k]}: ${error.message}`);
    out[k] = coerce(data || []);
  });
  return out;
}

// ── write-through helpers (fire-and-forget; log on failure) ──
export function persistInsert(key: StoreKey, row: any) {
  sb.from(TABLES[key]).insert(row).then(({ error }: any) => { if (error) console.error(`insert ${TABLES[key]}`, error.message); });
}
export function persistUpsert(key: StoreKey, row: any) {
  sb.from(TABLES[key]).upsert(row, { onConflict: 'id' }).then(({ error }: any) => { if (error) console.error(`upsert ${TABLES[key]}`, error.message); });
}
export function persistUpdate(key: StoreKey, id: string, patch: any) {
  sb.from(TABLES[key]).update(patch).eq('id', id).then(({ error }: any) => { if (error) console.error(`update ${TABLES[key]}`, error.message); });
}
export function persistUpdateWhere(key: StoreKey, match: Record<string, any>, patch: any) {
  let q = sb.from(TABLES[key]).update(patch);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  q.then(({ error }: any) => { if (error) console.error(`updateWhere ${TABLES[key]}`, error.message); });
}
export function persistDelete(key: StoreKey, id: string) {
  sb.from(TABLES[key]).delete().eq('id', id).then(({ error }: any) => { if (error) console.error(`delete ${TABLES[key]}`, error.message); });
}
export function persistDeleteWhere(key: StoreKey, match: Record<string, any>) {
  let q = sb.from(TABLES[key]).delete();
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  q.then(({ error }: any) => { if (error) console.error(`deleteWhere ${TABLES[key]}`, error.message); });
}
