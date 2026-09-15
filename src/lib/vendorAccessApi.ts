// ─────────────────────────────────────────────────────────────
// Vendor visibility (allow-list). The project "Vendors & Contractors" section
// is hidden from non-owner staff unless the owner has granted them access.
// Firm-wide; references the legacy in-memory profile id as TEXT.
// Cut over to vastos-api (Phase 5, item 2.13): src/vendor-access/. firmId stays
// in both signatures for ProjectDetailPage but is resolved server-side.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch } from './vastosApi';

/** Set of user ids the owner has granted "can see project vendors" access. */
export async function listVendorViewers(_firmId: string): Promise<Set<string>> {
  return new Set(await vastosApiFetch<string[]>('/api/vendor-access'));
}

export async function setVendorViewer(
  userId: string, userName: string, granted: boolean, grantedBy: string, _firmId: string,
): Promise<void> {
  if (granted) {
    await vastosApiFetch('/api/vendor-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, grantedBy }),
    });
  } else {
    await vastosApiFetch(`/api/vendor-access/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  }
}
