// ─────────────────────────────────────────────────────────────
// Attendance register data access. One record per employee per day, with
// check-in / check-out timestamps + device GPS. Self check-in/out and owner
// override. References the legacy in-memory profile id as TEXT.
//
// Phase 5, item 2.10: calls vastos-api instead of Supabase. checkOut()/
// deleteAttendance() go through the generic /api/data/attendance_records
// layer (plain update/delete by id, RLS-scoped) — same pattern as leads/
// tasks. checkIn()/saveManualAttendance() are upserts on
// (firm_id,user_id,work_date), which that generic layer has no primitive
// for, so they call vastos-api's src/attendance/ module instead, same as
// listAttendance/getTodayRecord (filtered reads the generic layer has never
// supported — it only ever did get-one-by-id). Signatures unchanged so
// AttendancePage.tsx needs no changes.
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch, updateRow, deleteRow } from './vastosApi';

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

const nowISO = () => new Date().toISOString();

export async function listAttendance(opts: { from?: string; to?: string; userId?: string } = {}, _firmId: string): Promise<AttendanceRecord[]> {
  const qs = new URLSearchParams();
  if (opts.from) qs.set('from', opts.from);
  if (opts.to) qs.set('to', opts.to);
  if (opts.userId) qs.set('userId', opts.userId);
  const query = qs.toString();
  return vastosApiFetch(`/api/attendance${query ? `?${query}` : ''}`);
}

/** Today's record for a user, or null. */
export async function getTodayRecord(userId: string, _firmId: string): Promise<AttendanceRecord | null> {
  return vastosApiFetch(`/api/attendance/today?userId=${encodeURIComponent(userId)}`);
}

export async function checkIn(
  user: { id: string; name: string }, geo: GeoFix | null, label: string | null, markedBy: string, _firmId: string,
): Promise<void> {
  await vastosApiFetch('/api/attendance/check-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, geo, label, markedBy }),
  });
}

// firmId is unused now — RLS scopes the update by id regardless of what the
// client sends, same as every other migrated write this phase.
export async function checkOut(recordId: string, geo: GeoFix | null, label: string | null, _firmId: string): Promise<void> {
  await updateRow('attendance_records', recordId, {
    check_out_at: nowISO(),
    check_out_lat: geo?.lat ?? null, check_out_lng: geo?.lng ?? null, check_out_accuracy: geo?.accuracy ?? null,
    check_out_label: label || null, updated_at: nowISO(),
  });
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
export async function saveManualAttendance(input: ManualAttendanceInput, markedBy: string, _firmId: string): Promise<void> {
  await vastosApiFetch('/api/attendance/manual', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, markedBy }),
  });
}

export async function deleteAttendance(id: string, _firmId: string): Promise<void> {
  await deleteRow('attendance_records', id);
}
