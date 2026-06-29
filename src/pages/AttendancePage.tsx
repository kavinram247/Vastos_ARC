import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../utils/format';
import {
  captureLocation, mapsUrl, getTodayRecord, listAttendance, checkIn, checkOut,
  saveManualAttendance, deleteAttendance,
  type AttendanceRecord, type AttendanceStatus, type ManualAttendanceInput,
} from '../lib/attendanceApi';
import {
  CalendarCheck, MapPin, LogIn, LogOut, Loader2, Clock, Plus, Pencil, Trash2, Check, Navigation,
} from 'lucide-react';

const STATUS: Record<AttendanceStatus, { label: string; variant: 'success' | 'error' | 'info' | 'warning' }> = {
  present: { label: 'Present', variant: 'success' },
  absent: { label: 'Absent', variant: 'error' },
  leave: { label: 'Leave', variant: 'info' },
  half_day: { label: 'Half day', variant: 'warning' },
};
const STATUS_OPTS = (Object.keys(STATUS) as AttendanceStatus[]).map((s) => ({ value: s, label: STATUS[s].label }));
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
const timeOf = (iso: string | null) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '');
const combine = (date: string, time: string) => (time ? new Date(`${date}T${time}`).toISOString() : null);
function hoursBetween(a: string | null, b: string | null): string {
  if (!a || !b) return '—';
  const m = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function AttendancePage() {
  const { user, firm } = useAuth();
  const store = useStore();
  const [myToday, setMyToday] = useState<AttendanceRecord | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'in' | 'out' | null>(null);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayStr());
  const [editing, setEditing] = useState<ManualAttendanceInput | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { can } = usePermissions();
  const isOwner = can('attendance', 'edit'); // can manage others' attendance
  const employees = useMemo(
    () => store.profiles.filter((p) => p.firm_id === user?.firm_id && p.role !== 'client'),
    [store.profiles, user?.firm_id],
  );

  // Resolve the crm_profiles.id for the current user by email match.
  // profiles.id (from auth context) and crm_profiles.id are separate UUID namespaces;
  // attendance_records must store crm_profiles.id so OwnerRegister can look them up by emp.id.
  const myCrmId = useMemo(() => {
    if (!user || !firm) return null;
    const crm = store.profiles.find((p) => (p as any).email === user.email && p.firm_id === firm.id);
    return crm?.id ?? user.id; // fallback to user.id for legacy demo profiles (they share the same id)
  }, [store.profiles, user, firm]);

  const load = useCallback(async () => {
    if (!user || !firm || !myCrmId) return;
    const [mine, recs] = await Promise.all([
      getTodayRecord(myCrmId, firm.id),
      isOwner ? listAttendance({ from: date, to: date }, firm.id) : listAttendance({ userId: myCrmId }, firm.id),
    ]);
    setMyToday(mine);
    setRecords(recs);
    setLoading(false);
  }, [user, firm, myCrmId, isOwner, date]);

  useEffect(() => { load().catch((e) => { console.error(e); setLoading(false); }); }, [load]);

  const onCheckIn = async () => {
    if (!user || !firm || !myCrmId) return;
    setBusy('in');
    try {
      const geo = await captureLocation();
      if (!geo && !confirm('Location is unavailable or was blocked. Check in without location?')) return;
      await checkIn({ id: myCrmId, name: user.full_name }, geo, label || null, myCrmId, firm.id);
      setLabel('');
      await load();
    } catch (e) { alert('Check-in failed: ' + (e as any).message); } finally { setBusy(null); }
  };

  const onCheckOut = async () => {
    if (!myToday) return;
    setBusy('out');
    try {
      const geo = await captureLocation();
      if (!geo && !confirm('Location is unavailable or was blocked. Check out without location?')) return;
      await checkOut(myToday.id, geo, label || null);
      setLabel('');
      await load();
    } catch (e) { alert('Check-out failed: ' + (e as any).message); } finally { setBusy(null); }
  };

  if (!user || !firm) return null;
  if (loading) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading attendance…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><CalendarCheck className="w-6 h-6 text-indigo-600" /> Attendance</h1>
        <p className="text-sm text-slate-500">Check in and out with your location. {isOwner ? 'Owner can view the full register and correct records.' : 'Your records are visible to you and the owner.'}</p>
      </div>

      {/* My attendance today */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle>My attendance · {formatDate(todayStr())}</CardTitle>
          {myToday && <Badge variant={STATUS[myToday.status].variant}>{STATUS[myToday.status].label}</Badge>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Punch label="Check in" at={myToday?.check_in_at ?? null} lat={myToday?.check_in_lat ?? null} lng={myToday?.check_in_lng ?? null} locLabel={myToday?.check_in_label ?? null} />
          <Punch label="Check out" at={myToday?.check_out_at ?? null} lat={myToday?.check_out_lat ?? null} lng={myToday?.check_out_lng ?? null} locLabel={myToday?.check_out_label ?? null} />
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Hours</div>
            <div className="text-lg font-semibold text-slate-900 mt-1">{hoursBetween(myToday?.check_in_at ?? null, myToday?.check_out_at ?? null)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Location note (optional)" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Kapoor Villa site" className="max-w-xs" />
          {!myToday?.check_in_at ? (
            <Button onClick={onCheckIn} disabled={busy !== null}>{busy === 'in' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Check in</Button>
          ) : !myToday?.check_out_at ? (
            <Button onClick={onCheckOut} disabled={busy !== null}>{busy === 'out' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Check out</Button>
          ) : (
            <div className="text-sm text-emerald-600 font-medium flex items-center gap-1.5 pb-2"><Check className="w-4 h-4" /> Done for today</div>
          )}
          <span className="text-[11px] text-slate-400 pb-2 inline-flex items-center gap-1"><Navigation className="w-3 h-3" /> Your device location is captured on check-in/out.</span>
        </div>
      </Card>

      {/* Register */}
      {isOwner ? (
        <OwnerRegister
          employees={employees} records={records} date={date} setDate={setDate}
          onAdd={() => { setEditing(null); setShowModal(true); }}
          onEdit={(rec) => { setEditing(recordToInput(rec)); setShowModal(true); }}
          onDelete={async (id) => { if (confirm('Delete this attendance record?')) { await deleteAttendance(id); await load(); } }}
        />
      ) : (
        <MyHistory records={records} />
      )}

      {showModal && isOwner && (
        <ManualModal
          employees={employees} initial={editing} defaultDate={date} markedBy={user.id} firmId={firm.id}
          onClose={() => setShowModal(false)}
          onSaved={async () => { setShowModal(false); await load(); }}
        />
      )}
    </div>
  );
}

function Punch({ label, at, lat, lng, locLabel }: { label: string; at: string | null; lat: number | null; lng: number | null; locLabel: string | null }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-slate-900 mt-1">{fmtTime(at)}</div>
      {locLabel && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{locLabel}</div>}
      {lat != null && lng != null ? (
        <a href={mapsUrl(lat, lng)} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1 mt-1">
          <MapPin className="w-3 h-3" /> View on map
        </a>
      ) : at ? <div className="text-[11px] text-slate-400 mt-1">No location</div> : null}
    </div>
  );
}

function OwnerRegister({ employees, records, date, setDate, onAdd, onEdit, onDelete }: {
  employees: { id: string; full_name: string; role: string }[]; records: AttendanceRecord[];
  date: string; setDate: (d: string) => void; onAdd: () => void; onEdit: (r: AttendanceRecord) => void; onDelete: (id: string) => void;
}) {
  const byUser = new Map(records.map((r) => [r.user_id, r]));
  const counts = { present: 0, half_day: 0, leave: 0, absent: 0, unmarked: 0 };
  employees.forEach((e) => { const r = byUser.get(e.id); if (!r) counts.unmarked++; else counts[r.status]++; });

  return (
    <Card padding="none">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Register</CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="Register date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Button size="sm" onClick={onAdd}><Plus className="w-4 h-4" /> Mark / correct</Button>
        </div>
      </div>
      <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span><b className="text-emerald-600">{counts.present}</b> present</span>
        <span><b className="text-amber-600">{counts.half_day}</b> half-day</span>
        <span><b className="text-sky-600">{counts.leave}</b> leave</span>
        <span><b className="text-red-600">{counts.absent}</b> absent</span>
        <span><b className="text-slate-600">{counts.unmarked}</b> not marked</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <th className="text-left px-4 py-2.5 font-medium">Employee</th>
            <th className="text-left px-2 py-2.5 font-medium">Status</th>
            <th className="text-left px-2 py-2.5 font-medium">Check-in</th>
            <th className="text-left px-2 py-2.5 font-medium">Check-out</th>
            <th className="text-right px-2 py-2.5 font-medium">Hours</th>
            <th className="px-4 py-2.5 w-16"></th>
          </tr></thead>
          <tbody>
            {employees.map((emp) => {
              const r = byUser.get(emp.id);
              return (
                <tr key={emp.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">{emp.full_name}</div>
                    <div className="text-xs text-slate-400 capitalize">{emp.role}</div>
                  </td>
                  <td className="px-2 py-2.5">{r ? <Badge variant={STATUS[r.status].variant} size="sm">{STATUS[r.status].label}</Badge> : <span className="text-xs text-slate-300">not marked</span>}</td>
                  <td className="px-2 py-2.5"><PunchCell at={r?.check_in_at ?? null} lat={r?.check_in_lat ?? null} lng={r?.check_in_lng ?? null} loc={r?.check_in_label ?? null} /></td>
                  <td className="px-2 py-2.5"><PunchCell at={r?.check_out_at ?? null} lat={r?.check_out_lat ?? null} lng={r?.check_out_lng ?? null} loc={r?.check_out_label ?? null} /></td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{hoursBetween(r?.check_in_at ?? null, r?.check_out_at ?? null)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button onClick={() => r ? onEdit(r) : onEdit({ ...emptyRec, user_id: emp.id, user_name: emp.full_name } as any)} title={r ? 'Edit' : 'Mark'} className="text-slate-300 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button>
                      {r && <button onClick={() => onDelete(r.id)} title="Delete" className="text-slate-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PunchCell({ at, lat, lng, loc }: { at: string | null; lat: number | null; lng: number | null; loc: string | null }) {
  if (!at) return <span className="text-xs text-slate-300">—</span>;
  return (
    <div>
      <div className="text-slate-700 tabular-nums">{fmtTime(at)}</div>
      {loc && <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{loc}</div>}
      {lat != null && lng != null && <a href={mapsUrl(lat, lng)} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" /> map</a>}
    </div>
  );
}

function MyHistory({ records }: { records: AttendanceRecord[] }) {
  return (
    <Card padding="none">
      <div className="p-4 border-b border-slate-200"><CardTitle>My history</CardTitle></div>
      {records.length === 0 ? (
        <p className="p-6 text-sm text-slate-400">No attendance records yet. Check in above to start.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th className="text-left px-4 py-2.5 font-medium">Date</th>
              <th className="text-left px-2 py-2.5 font-medium">Status</th>
              <th className="text-left px-2 py-2.5 font-medium">Check-in</th>
              <th className="text-left px-2 py-2.5 font-medium">Check-out</th>
              <th className="text-right px-4 py-2.5 font-medium">Hours</th>
            </tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 text-slate-700">{formatDate(r.work_date)}</td>
                  <td className="px-2 py-2.5"><Badge variant={STATUS[r.status].variant} size="sm">{STATUS[r.status].label}</Badge></td>
                  <td className="px-2 py-2.5"><PunchCell at={r.check_in_at} lat={r.check_in_lat} lng={r.check_in_lng} loc={r.check_in_label} /></td>
                  <td className="px-2 py-2.5"><PunchCell at={r.check_out_at} lat={r.check_out_lat} lng={r.check_out_lng} loc={r.check_out_label} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{hoursBetween(r.check_in_at, r.check_out_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const emptyRec = { status: 'present' as AttendanceStatus, check_in_at: null, check_out_at: null, check_in_label: null, check_out_label: null, notes: null };
function recordToInput(r: AttendanceRecord): ManualAttendanceInput {
  return {
    id: r.id, user_id: r.user_id, user_name: r.user_name, work_date: r.work_date, status: r.status,
    check_in_at: r.check_in_at, check_out_at: r.check_out_at, check_in_label: r.check_in_label, check_out_label: r.check_out_label, notes: r.notes,
  };
}

function ManualModal({ employees, initial, defaultDate, markedBy, firmId, onClose, onSaved }: {
  employees: { id: string; full_name: string; role: string }[]; initial: ManualAttendanceInput | null;
  defaultDate: string; markedBy: string; firmId: string; onClose: () => void; onSaved: () => void;
}) {
  const [userId, setUserId] = useState(initial?.user_id ?? employees[0]?.id ?? '');
  const [workDate, setWorkDate] = useState(initial?.work_date ?? defaultDate);
  const [status, setStatus] = useState<AttendanceStatus>(initial?.status ?? 'present');
  const [inTime, setInTime] = useState(timeOf(initial?.check_in_at ?? null));
  const [outTime, setOutTime] = useState(timeOf(initial?.check_out_at ?? null));
  const [inLabel, setInLabel] = useState(initial?.check_in_label ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const emp = employees.find((e) => e.id === userId);
    if (!emp) return;
    setSaving(true);
    try {
      await saveManualAttendance({
        id: initial?.id, user_id: emp.id, user_name: emp.full_name, work_date: workDate, status,
        check_in_at: combine(workDate, inTime), check_out_at: combine(workDate, outTime),
        check_in_label: inLabel || null, notes: notes || null,
      }, markedBy, firmId);
      onSaved();
    } catch (e) { alert('Save failed: ' + (e as any).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={initial?.id ? 'Edit attendance' : 'Mark / correct attendance'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Employee" value={userId} onChange={(e) => setUserId(e.target.value)} options={employees.map((e) => ({ value: e.id, label: e.full_name }))} disabled={!!initial?.id} />
          <Input label="Date" type="date" value={workDate} max={todayStr()} onChange={(e) => setWorkDate(e.target.value)} disabled={!!initial?.id} />
        </div>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} options={STATUS_OPTS} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Check-in time" type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} />
          <Input label="Check-out time" type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
        </div>
        <Input label="Location note (optional)" value={inLabel} onChange={(e) => setInLabel(e.target.value)} placeholder="e.g. Office / site name" />
        <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="text-[11px] text-slate-400">Manual entries don't capture GPS. For Absent/Leave, leave the times blank.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !userId}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save</Button>
        </div>
      </div>
    </Modal>
  );
}
