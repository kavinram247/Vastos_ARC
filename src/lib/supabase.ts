import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Publishable (anon) key. "Not a secret" is only true while RLS is correct —
// it is still the sole credential the browser holds, so it is configuration,
// not a constant.
//
// There is deliberately NO fallback (audit H5). The previous hardcoded pair
// pointed at the production project, so any deploy that forgot its env vars
// silently connected real users to production. Failing at startup is the whole
// point: a misconfigured build should be obvious, not quietly wrong.
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local for local development.',
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Base URL for edge functions. Derived from the same configured project as the
// database client, so a staging build cannot address production functions.
// Phase 1 removed the hardcoded production URL here and in AcceptInvitePage,
// but two more survived in src/leads/LeadsAdminPage.tsx (audit H5, residual) —
// they addressed the production project literally, by ref, from every build.
export const FUNCTIONS_BASE_URL = `${SUPABASE_URL}/functions/v1`;

// ── RBAC backend context ──
// Removed (audit C4). This used to stamp `x-crm-role-id` on every PostgREST
// request, and crm_current_role_id() read the role straight back out of that
// header — so the caller declared their own permissions and
// `curl -H "x-crm-role-id: role-admin"` passed every check.
//
// crm_current_role_id() now resolves from auth.uid() server-side and ignores
// the header entirely. Nothing needs to be sent from the client.
// See supabase/migrations/20260728010000_security_phase1_c4_rbac_and_c1_revoke_anon.sql

// ── DEMO_FIRM_ID / DEMO_USER_ID ──
// Removed (audit H3). These were default parameter values on ~50 API
// functions, so any call site that omitted firmId read and WROTE the demo
// tenant — every firm's users shared firm 1111…'s vendors, rates, margins and
// BOQs, and the audit trail attributed writes to a user who does not exist.
//
// firmId is now a required argument threaded from useAuth().firm.id, and
// created_by from useAuth().user.id. Identity comes from the session; there is
// no ambient default to fall back to.
