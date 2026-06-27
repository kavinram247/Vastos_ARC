// ─────────────────────────────────────────────────────────────
// Vendor visibility (allow-list). The project "Vendors & Contractors" section
// is hidden from non-owner staff unless the owner has granted them access.
// Firm-wide; references the legacy in-memory profile id as TEXT.
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID } from './supabase';

/** Set of user ids the owner has granted "can see project vendors" access. */
export async function listVendorViewers(firmId = DEMO_FIRM_ID): Promise<Set<string>> {
  const { data, error } = await supabase.from('vendor_visibility_grants').select('user_id').eq('firm_id', firmId);
  if (error) throw error;
  return new Set(((data || []) as any[]).map((r) => r.user_id));
}

export async function setVendorViewer(
  userId: string, userName: string, granted: boolean, grantedBy: string, firmId = DEMO_FIRM_ID,
): Promise<void> {
  if (granted) {
    const { error } = await supabase.from('vendor_visibility_grants')
      .upsert({ firm_id: firmId, user_id: userId, user_name: userName, granted_by: grantedBy } as any, { onConflict: 'firm_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('vendor_visibility_grants').delete().eq('firm_id', firmId).eq('user_id', userId);
    if (error) throw error;
  }
}
