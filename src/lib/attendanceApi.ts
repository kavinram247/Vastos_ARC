// ─────────────────────────────────────────────────────────────
// Attendance register data access. One record per employee per day, with
// check-in / check-out timestamps + device GPS. Self check-in/out and owner
// override. References the legacy in-memory profile id as TEXT.
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID } from './supabase';

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  user_name: string;
  work_date: string;            // YYYY-MM-DD
  status: AttendanceStatus;
  check_in_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy: number | null;
  check_in_label: string | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_accuracy: number | null;
  check_out_label: string | null;
  notes: string | null;
  marked_by: string | null;
}

export interface GeoFix { lat: number; lng: number; accuracy: number }

/** Capture the device's location. Resolves null if unavailable/denied (never rejects). */
export function captureLocation(timeoutMs = 8000): Promise<GeoFix | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

const today = () => new Date().toISOString().slice(0, 10);
const SELECT = 'id,user_id,user_name,work_date,status,check_in_at,check_in_lat,check_in_lng,check_in_accuracy,check_in_label,check_out_at,check_out_lat,check_out_lng,check_out_accuracy,check_out_label,notes,marked_by';

export async function listAttendance(opts: { from?: string; to?: string; userId?: string } = {}, firmId = DEMO_FIRM_ID): Promise<AttendanceRecord[]> {
  let q = supabase.from('attendance_records').select(SELECT).eq('firm_id', firmId);
  if (opts.from) q = q.gte('work_date', opts.from);
  if (opts.to) q = q.lte('work_date', opts.to);
  if (opts.userId) q = q.eq('user_id', opts.userId);
  const { data, error } = await q.order('work_date', { ascending: false });
  if (error) throw error;
  return (data || []) as any as AttendanceRecord[];
}

/** Today's record for a user, or null. */
export async function getTodayRecord(userId: string, firmId = DEMO_FIRM_ID): Promise<AttendanceRecord | null> {
  const { data, error } = await supabase.from('attendance_records').select(SELECT)
    .eq('firm_id', firmId).eq('user_id', userId).eq('work_date', today()).maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function checkIn(
  user: { id: string; name: string }, geo: GeoFix | null, label: string | null, markedBy: string, firmId = DEMO_FIRM_ID,
): Promise<void> {
  const { error } = await supabase.from('attendance_records').upsert({
    firm_id: firmId, user_id: user.id, user_name: user.name, work_date: today(), status: 'present',
    check_in_at: new Date().toISOString(),
    check_in_lat: geo?.lat ?? null, check_in_lng: geo?.lng ?? null, check_in_accuracy: geo?.accuracy ?? null,
    check_in_label: label || null, marked_by: markedBy, updated_at: new Date().toISOString(),
  } as any, { onConflict: 'firm_id,user_id,work_date' });
  if (error) throw error;
}

export async function checkOut(recordId: string, geo: GeoFix | null, label: string | null): Promise<void> {
  const { error } = await supabase.from('attendance_records').update({
    check_out_at: new Date().toISOString(),
    check_out_lat: geo?.lat ?? null, check_out_lng: geo?.lng ?? null, check_out_accuracy: geo?.accuracy ?? null,
    check_out_label: label || null, updated_at: new Date().toISOString(),
  } as any).eq('id', recordId);
  if (error) throw error;
}

export interface ManualAttendanceInput {
  id?: string;
  user_id: string;
  user_name: string;
  work_date: string;
  status: AttendanceStatus;
  check_in_at?: string | null;
  check_out_at?: string | null;
  check_in_label?: string | null;
  check_out_label?: string | null;
  notes?: string | null;
}

/** Owner create/correct a record (backfill). Upserts on (firm,user,date). */
export async function saveManualAttendance(input: ManualAttendanceInput, markedBy: string, firmId = DEMO_FIRM_ID): Promise<void> {
  const row = {
    firm_id: firmId, user_id: input.user_id, user_name: input.user_name, work_date: input.work_date,
    status: input.status, check_in_at: input.check_in_at || null, check_out_at: input.check_out_at || null,
    check_in_label: input.check_in_label || null, check_out_label: input.check_out_label || null,
    notes: input.notes || null, marked_by: markedBy, updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('attendance_records').upsert(row as any, { onConflict: 'firm_id,user_id,work_date' });
  if (error) throw error;
}

export async function deleteAttendance(id: string): Promise<void> {
  const { error } = await supabase.from('attendance_records').delete().eq('id', id);
  if (error) throw error;
}
