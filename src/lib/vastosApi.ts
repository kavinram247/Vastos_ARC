// Client for vastos-api (NestJS on the VPS) — document upload/download via R2
// presigned URLs, plus the /api/firm/bootstrap login-hydration endpoint
// (Phase 5, item 2). Separate from FUNCTIONS_BASE_URL (Supabase edge
// functions): this is a different service entirely.
import { supabase } from './supabase';
import type { UserRole } from '../types';

const VASTOS_API_URL = (import.meta as any).env?.VITE_VASTOS_API_URL as string | undefined;

export function isVastosApiConfigured(): boolean {
  return !!VASTOS_API_URL;
}

/** Base URL for building a link to a genuinely public vastos-api route
 * (webhook endpoints, share links) — nothing here carries a session. */
export function getVastosApiUrl(): string {
  if (!VASTOS_API_URL) {
    throw new Error('The Vastos API is not configured (VITE_VASTOS_API_URL is unset)');
  }
  return VASTOS_API_URL;
}

interface PresignUploadResult {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
}

interface PresignDownloadResult {
  downloadUrl: string;
  expiresIn: number;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!VASTOS_API_URL) {
    throw new Error('The Vastos API is not configured (VITE_VASTOS_API_URL is unset)');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const res = await fetch(`${VASTOS_API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
  return res;
}

/** authedFetch + .json() — the generic call other modules' api.ts files use
 * to reach vastos-api endpoints outside this file's own bespoke wrappers. */
export async function vastosApiFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(path, init);
  return res.json();
}

/** For routes with genuinely no session — a share-link viewer, a website's
 * own contact form. No Authorization header; the caller carries its own
 * token (in the path/body/header) as its whole trust boundary. */
export async function publicVastosApiFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  if (!VASTOS_API_URL) {
    throw new Error('The Vastos API is not configured (VITE_VASTOS_API_URL is unset)');
  }
  const res = await fetch(`${VASTOS_API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function presignUpload(
  projectId: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<PresignUploadResult> {
  const res = await authedFetch(`/documents/${projectId}/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, sizeBytes }),
  });
  return res.json();
}

// Uploads directly to R2, bypassing our server for the actual bytes — the
// whole point of a presigned URL. contentType MUST match what was passed to
// presignUpload(): R2 verifies the presigned signature against it.
export async function uploadToR2(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload to storage failed (${res.status})`);
}

export async function presignDownload(
  documentId: string,
  disposition: 'inline' | 'attachment' = 'inline',
): Promise<PresignDownloadResult> {
  const res = await authedFetch(`/documents/${documentId}/presign-download?disposition=${disposition}`);
  return res.json();
}

// ── /api/firm/bootstrap ─────────────────────────────────────────────────────
// One round trip for everything AuthContext + the DataStore need at login:
// the resolved session (profile/firm/plan/operator flag) and every crm_*
// table for the firm, already keyed by the DataStore's array names — see
// vastos-api's src/firm/firm.service.ts. Replaces the old resolveSession()
// (3 direct Supabase queries) + crmApi.hydrateAll() (24 parallel ones).
export interface BootstrapProfile {
  id: string;
  firm_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  role_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface BootstrapFirm {
  id: string;
  name: string;
  address: string | null;
  logo_url: string | null;
  gstin: string | null;
  payment_split_default: number;
  created_at: string;
}

export interface BootstrapPlan {
  id: string;
  name: string | null;
  module_keys: string[];
  max_users: number | null;
  max_projects: number | null;
  storage_gb: number | null;
  status: string;
  trial_ends_at: string | null;
}

export interface BootstrapPayload {
  session: {
    profile: BootstrapProfile;
    firm: BootstrapFirm;
    plan: BootstrapPlan | null;
    isVastosOperator: boolean;
  };
  // store-array name (e.g. "projects", "leads") → that table's firm-scoped rows
  data: Record<string, any[]>;
}

export async function fetchBootstrap(): Promise<BootstrapPayload> {
  const res = await authedFetch('/api/firm/bootstrap');
  return res.json();
}

// ── /api/data/:table — generic CRUD (Phase 5, item 2.6+) ────────────────────
// Server side of what supabase-js's .from(table).insert/update/delete() used
// to do directly against PostgREST. Only tables vastos-api's db/table-
// registry.ts has explicitly allowlisted will respond; everything else still
// goes through crmApi.ts's supabase-js path until it's migrated too.
export async function insertRow<T = any>(table: string, row: Record<string, any>): Promise<T> {
  const res = await authedFetch(`/api/data/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
  return res.json();
}

export async function updateRow<T = any>(table: string, id: string, patch: Record<string, any>): Promise<T> {
  const res = await authedFetch(`/api/data/${table}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function updateWhereRows(
  table: string,
  match: Record<string, any>,
  patch: Record<string, any>,
): Promise<{ updated: number }> {
  const res = await authedFetch(`/api/data/${table}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match, patch }),
  });
  return res.json();
}

export async function deleteRow(table: string, id: string): Promise<void> {
  await authedFetch(`/api/data/${table}/${id}`, { method: 'DELETE' });
}

export async function deleteWhereRows(table: string, match: Record<string, any>): Promise<{ deleted: number }> {
  const res = await authedFetch(`/api/data/${table}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match }),
  });
  return res.json();
}

export async function getOneRow<T = any>(table: string, id: string): Promise<T | null> {
  try {
    const res = await authedFetch(`/api/data/${table}/${id}`);
    return res.json();
  } catch {
    return null;
  }
}

// ── /api/leads/:id/claim — atomic self-assignment ───────────────────────────
export async function claimLead(leadId: string, userId: string): Promise<any | null> {
  const res = await authedFetch(`/api/leads/${leadId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const body = await res.json();
  return body.ok ? body.lead : null;
}

// ── /api/boq/quotations/:id/{share-token,schedule} — quote-share, firm side ─
export async function getBoqShareToken(quotationId: string): Promise<string | null> {
  const res = await authedFetch(`/api/boq/quotations/${quotationId}/share-token`);
  return res.json();
}

export async function getBoqSchedule(quotationId: string): Promise<any | null> {
  const res = await authedFetch(`/api/boq/quotations/${quotationId}/schedule`);
  return res.json();
}

// ── /api/leads/intake-tokens — website enquiry-capture webhook tokens ──────
export interface WebhookToken {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export async function listLeadIntakeTokens(): Promise<WebhookToken[]> {
  const res = await authedFetch('/api/leads/intake-tokens');
  return res.json();
}

export async function createLeadIntakeToken(label: string): Promise<{ id: string; token: string; firm_id: string }> {
  const res = await authedFetch('/api/leads/intake-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  return res.json();
}

export async function revokeLeadIntakeToken(id: string): Promise<void> {
  await authedFetch(`/api/leads/intake-tokens/${id}`, { method: 'DELETE' });
}

// ── /api/team/invites — team invites, authenticated half (Phase 5, item 3.5) ─
export interface CreatedInvite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
}

export async function createTeamInvite(
  email: string,
  fullName: string,
  roleId: string | null,
  phone: string | null,
): Promise<CreatedInvite> {
  const res = await authedFetch('/api/team/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, roleId, phone }),
  });
  return res.json();
}
