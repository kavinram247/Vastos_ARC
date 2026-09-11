// Client for vastos-api (NestJS on Hetzner) — currently just document
// upload/download via R2 presigned URLs. Separate from FUNCTIONS_BASE_URL
// (Supabase edge functions): this is a different service entirely.
import { supabase } from './supabase';

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
    throw new Error('Document uploads are not configured (VITE_VASTOS_API_URL is unset)');
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
