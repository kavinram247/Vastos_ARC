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
