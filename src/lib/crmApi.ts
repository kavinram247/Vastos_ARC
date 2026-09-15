// ─────────────────────────────────────────────────────────────
// CRM data access — hydration reads + write-through persistence for the
// Supabase-backed DataStore. Maps each store array to its crm_ table.
// PostgREST returns `numeric` as strings; we coerce known numeric fields back
// to numbers on hydration so the in-memory shape matches the app's expectations.
//
// Phase 5, item 2.6+: tables in MIGRATED_TABLES write through vastos-api's
// generic /api/data/:table layer instead of supabase-js directly — see
// vastosApi.ts. Reads for those tables already came from /api/firm/bootstrap
// (AuthContext.resolveSession → store.hydrateFromPayload), so hydrateAll()
// below is only ever reached as a fallback (see store.ts's hydrate()) and
// still queries every table including the migrated ones — harmless, just
// redundant if it ever runs.
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import * as vastosApi from './vastosApi';

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
  dashboardLayouts: 'crm_dashboard_layouts',
} as const;
export type StoreKey = keyof typeof TABLES;

// Tables whose writes go through vastos-api's /api/data/:table instead of
// supabase-js. vastos-api's db/table-registry.ts is the actual allowlist
// enforced server-side; this just decides which client to call.
//
// Every store table is here except roles/rolePermissions: their RLS grants
// `authenticated` SELECT only, so those writes are refused on either database
// (a pre-existing gap — saving role edits needs admin-gated RPCs, not a
// routing change) and nothing about them can diverge by staying put. Until
// Phase 5 item 2.13 only the three leads tables were listed, so every other
// write here still landed in Supabase while /api/firm/bootstrap read the VPS.
const MIGRATED_TABLES: ReadonlySet<StoreKey> = new Set([
  'profiles', 'projects', 'assignments', 'milestones', 'siteUpdates', 'paymentPlans', 'paymentSplits',
  'paymentsReceived', 'costEntries', 'comments', 'notifications', 'activityLog', 'leads',
  'leadInteractions', 'leadQuotations', 'projectDocuments', 'projectVendors', 'contacts',
  'pipelineStages', 'featureFlags', 'commChannels', 'dashboardLayouts',
]);

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

// ── Firm scoping for writes (audit H2) ──
// Reads were always firm-scoped; the write helpers below matched on `id` alone,
// so a harvested or guessed id was the only thing needed to address a row.
//
// Postgres already refuses those writes: every crm_* table carries
//   for all to authenticated
//     using (firm_id = current_firm_id()) with check (firm_id = current_firm_id())
// and current_firm_id() resolves from auth.uid(), so it cannot be forged the way
// the x-crm-role-id header could (C4). Verified as a second firm's owner against
// firm A's rows — PATCH and DELETE both matched zero rows.
//
// The predicate is added here anyway so the client and the database agree about
// the boundary, and so a future policy regression is not silently the only thing
// holding. Defence in depth, not the defence.
//
// The migrated (/api/data) path doesn't take a client-supplied firm_id at all —
// RLS on the VPS is the only enforcement there, which is tighter, not looser.
let activeFirmId: string | null = null;

/** Called on hydration; scopes every subsequent write to this firm. */
export function setActiveFirm(firmId: string | null) { activeFirmId = firmId; }

function scoped(q: any) {
  return activeFirmId ? q.eq('firm_id', activeFirmId) : q;
}

/** Load every CRM table for a firm into the store's array shape (numerics coerced). */
export async function hydrateAll(firmId: string): Promise<Record<StoreKey, any[]>> {
  setActiveFirm(firmId);
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
  if (MIGRATED_TABLES.has(key)) {
    vastosApi.insertRow(TABLES[key], row).catch((e) => console.error(`insert ${TABLES[key]}`, e.message));
    return;
  }
  sb.from(TABLES[key]).insert(row).then(({ error }: any) => { if (error) console.error(`insert ${TABLES[key]}`, error.message); });
}
export function persistUpsert(key: StoreKey, row: any) {
  sb.from(TABLES[key]).upsert(row, { onConflict: 'id' }).then(({ error }: any) => { if (error) console.error(`upsert ${TABLES[key]}`, error.message); });
}
export function persistUpdate(key: StoreKey, id: string, patch: any) {
  if (MIGRATED_TABLES.has(key)) {
    vastosApi.updateRow(TABLES[key], id, patch).catch((e) => console.error(`update ${TABLES[key]}`, e.message));
    return;
  }
  scoped(sb.from(TABLES[key]).update(patch).eq('id', id)).then(({ error }: any) => { if (error) console.error(`update ${TABLES[key]}`, error.message); });
}
export async function awaitUpdate(key: StoreKey, id: string, patch: any): Promise<string | null> {
  if (MIGRATED_TABLES.has(key)) {
    try { await vastosApi.updateRow(TABLES[key], id, patch); return null; }
    catch (e: any) { return e.message ?? 'update failed'; }
  }
  const { error } = await scoped(sb.from(TABLES[key]).update(patch).eq('id', id));
  return error?.message ?? null;
}
export async function awaitInsert(key: StoreKey, row: any): Promise<string | null> {
  if (MIGRATED_TABLES.has(key)) {
    try { await vastosApi.insertRow(TABLES[key], row); return null; }
    catch (e: any) { return e.message ?? 'insert failed'; }
  }
  const { error } = await sb.from(TABLES[key]).insert(row);
  return error?.message ?? null;
}
export function persistUpdateWhere(key: StoreKey, match: Record<string, any>, patch: any) {
  if (MIGRATED_TABLES.has(key)) {
    vastosApi.updateWhereRows(TABLES[key], match, patch).catch((e) => console.error(`updateWhere ${TABLES[key]}`, e.message));
    return;
  }
  let q = sb.from(TABLES[key]).update(patch);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  scoped(q).then(({ error }: any) => { if (error) console.error(`updateWhere ${TABLES[key]}`, error.message); });
}
export function persistDelete(key: StoreKey, id: string) {
  if (MIGRATED_TABLES.has(key)) {
    vastosApi.deleteRow(TABLES[key], id).catch((e) => console.error(`delete ${TABLES[key]}`, e.message));
    return;
  }
  scoped(sb.from(TABLES[key]).delete().eq('id', id)).then(({ error }: any) => { if (error) console.error(`delete ${TABLES[key]}`, error.message); });
}
export function persistDeleteWhere(key: StoreKey, match: Record<string, any>) {
  if (MIGRATED_TABLES.has(key)) {
    vastosApi.deleteWhereRows(TABLES[key], match).catch((e) => console.error(`deleteWhere ${TABLES[key]}`, e.message));
    return;
  }
  let q = sb.from(TABLES[key]).delete();
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  scoped(q).then(({ error }: any) => { if (error) console.error(`deleteWhere ${TABLES[key]}`, error.message); });
}

// ── atomic lead claim (self-assignment) ──
// Guards on assigned_to IS NULL so two agents racing to claim the same lead can
// never both win: Postgres evaluates the predicate atomically, so exactly one
// UPDATE matches. Returns the winning row on success, null when already taken,
// or throws on a transport error. `null` lets the caller fetch the true owner.
// `leads` is a migrated table — this always goes through vastos-api's
// dedicated /api/leads/:id/claim (the server sets updated_at itself; the
// updatedAt param is kept for call-site compatibility, unused here).
export async function claimLeadRow(leadId: string, userId: string, _updatedAt: string): Promise<any | null> {
  return vastosApi.claimLead(leadId, userId);
}

/** Read a single lead row back from the DB (used to reconcile after a lost claim race). */
export async function fetchLeadRow(leadId: string): Promise<any | null> {
  const row = await vastosApi.getOneRow(TABLES.leads, leadId);
  return row ? coerce([row])[0] : null;
}
