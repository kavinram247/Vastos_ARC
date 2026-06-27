import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../utils/format';
import {
  listTasks, createTask, updateTask, deleteTask, listAssignPrivileges, setAssignPrivilege,
  type Task, type TaskStatus, type TaskPriority, type TaskInput,
} from '../lib/taskApi';
import {
  ListTodo, Plus, Pencil, Trash2, Loader2, Check, ShieldCheck, CalendarClock, User, FolderKanban,
} from 'lucide-react';

const STATUS_COLS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: 'todo', label: 'To do', dot: 'bg-slate-400' },
  { id: 'in_progress', label: 'In progress', dot: 'bg-amber-500' },
  { id: 'done', label: 'Done', dot: 'bg-emerald-500' },
];
const STATUS_OPTS = STATUS_COLS.map((c) => ({ value: c.id, label: c.label }));
const PRIORITY: Record<TaskPriority, { label: string; variant: 'default' | 'info' | 'warning' | 'error' }> = {
  low: { label: 'Low', variant: 'default' },
  medium: { label: 'Medium', variant: 'info' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'error' },
};
const PRIORITY_OPTS = (Object.keys(PRIORITY) as TaskPriority[]).map((p) => ({ value: p, label: PRIORITY[p].label }));
const todayStr = () => new Date().toISOString().slice(0, 10);

export function TasksPage() {
  const { user } = useAuth();
  const store = useStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);
  const [projectFilter, setProjectFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);

  // internal non-owner staff = the only valid assignees
  const staff = useMemo(
    () => store.profiles.filter((p) => p.firm_id === user?.firm_id && (p.role === 'architect' || p.role === 'engineer')),
    [store.profiles, user?.firm_id],
  );
  const projects = useMemo(
    () => store.projects.filter((p) => p.firm_id === user?.firm_id),
    [store.projects, user?.firm_id],
  );

  const isOwner = user?.role === 'owner';
  const canAssignOthers = !!isOwner || (!!user && privileges.has(user.id));

  const load = () => Promise.all([listTasks(), listAssignPrivileges()])
    .then(([t, p]) => { setTasks(t); setPrivileges(p); setLoading(false); })
    .catch((e) => { console.error(e); setLoading(false); });
  useEffect(() => { load(); }, []);

  const canManage = (t: Task) => canAssignOthers || t.created_by_id === user?.id;
  const canUpdateStatus = (t: Task) => canManage(t) || t.assignee_id === user?.id;

  const filtered = useMemo(() => tasks.filter((t) => {
    if (mineOnly && t.assignee_id !== user?.id) return false;
    if (projectFilter && t.project_id !== projectFilter) return false;
    if (assigneeFilter && t.assignee_id !== assigneeFilter) return false;
    return true;
  }), [tasks, mineOnly, projectFilter, assigneeFilter, user?.id]);

  const byStatus = (s: TaskStatus) => filtered.filter((t) => t.status === s);

  const changeStatus = async (t: Task, status: TaskStatus) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
    try { await updateTask(t.id, { status }); } catch (e) { console.error(e); load(); }
  };

  const onDelete = async (t: Task) => {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    try { await deleteTask(t.id); } catch (e) { alert('Delete failed: ' + (e as any).message); load(); }
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading tasks…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ListTodo className="w-6 h-6 text-indigo-600" /> Task Manager</h1>
          <p className="text-sm text-slate-500">
            {isOwner ? 'Assign work to your team and control who else can assign.'
              : canAssignOthers ? 'Create and assign tasks across the team.'
              : 'Your tasks and anything you create for yourself.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && <Button variant="secondary" size="sm" onClick={() => setManaging(true)}><ShieldCheck className="w-4 h-4" /> Who can assign</Button>}
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New task</Button>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
          options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
        {canAssignOthers && (
          <Select label="Assignee" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}
            options={[{ value: '', label: 'Everyone' }, ...staff.map((s) => ({ value: s.id, label: s.full_name }))]} />
        )}
        <button onClick={() => setMineOnly((v) => !v)}
          className={`h-10 px-3 rounded-[9px] border text-sm font-medium inline-flex items-center gap-1.5 ${mineOnly ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
          <User className="w-4 h-4" /> My tasks
        </button>
        <div className="text-xs text-slate-400 ml-auto self-center">{filtered.length} task{filtered.length === 1 ? '' : 's'}</div>
      </div>

      {/* board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_COLS.map((col) => {
          const items = byStatus(col.id);
          return (
            <div key={col.id} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <h3 className="font-semibold text-slate-700 text-sm">{col.label}</h3>
                <span className="text-xs text-slate-400">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">Nothing here</div>}
                {items.map((t) => (
                  <TaskCard key={t.id} t={t} me={user?.id} projects={projects}
                    canManage={canManage(t)} canUpdateStatus={canUpdateStatus(t)}
                    onStatus={(s) => changeStatus(t, s)} onEdit={() => setEditing(t)} onDelete={() => onDelete(t)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <TaskModal
          task={editing} staff={staff} projects={projects}
          canAssignOthers={canAssignOthers} me={{ id: user!.id, name: user!.full_name }}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      {managing && isOwner && (
        <AssignersModal staff={staff} privileges={privileges} grantedBy={user!.id}
          onClose={() => setManaging(false)} onChanged={load} />
      )}
    </div>
  );
}

function TaskCard({ t, me, projects, canManage, canUpdateStatus, onStatus, onEdit, onDelete }: {
  t: Task; me?: string; projects: { id: string; name: string }[];
  canManage: boolean; canUpdateStatus: boolean;
  onStatus: (s: TaskStatus) => void; onEdit: () => void; onDelete: () => void;
}) {
  const overdue = t.due_date && t.status !== 'done' && t.due_date < todayStr();
  const pr = PRIORITY[t.priority];
  return (
    <Card padding="none" className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-slate-900 text-sm leading-snug">{t.title}</div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} title="Edit" className="text-slate-300 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} title="Delete" className="text-slate-300 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
      {t.description && <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={pr.variant} size="sm">{pr.label}</Badge>
        {t.project_id && <Badge variant="outline" size="sm"><FolderKanban className="w-3 h-3 mr-1" />{t.project_name || projects.find((p) => p.id === t.project_id)?.name || 'Project'}</Badge>}
        {t.due_date && (
          <span className={`inline-flex items-center gap-1 text-[11px] ${overdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
            <CalendarClock className="w-3 h-3" />{formatDate(t.due_date)}{overdue ? ' · overdue' : ''}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
          <User className="w-3 h-3 text-slate-400" />{t.assignee_id === me ? 'You' : t.assignee_name}
        </span>
        {canUpdateStatus ? (
          <select value={t.status} onChange={(e) => onStatus(e.target.value as TaskStatus)}
            className="text-[11px] rounded-md border border-slate-200 px-1.5 py-0.5 text-slate-600 focus:outline-none focus:border-indigo-400 hover:border-slate-300">
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : <span className="text-[11px] text-slate-400">{STATUS_COLS.find((c) => c.id === t.status)?.label}</span>}
      </div>
    </Card>
  );
}

function TaskModal({ task, staff, projects, canAssignOthers, me, onClose, onSaved }: {
  task: Task | null; staff: { id: string; full_name: string; role: string }[];
  projects: { id: string; name: string }[]; canAssignOthers: boolean;
  me: { id: string; name: string }; onClose: () => void; onSaved: () => void;
}) {
  const selfIsStaff = staff.some((s) => s.id === me.id);
  const defaultAssignee = task ? task.assignee_id
    : canAssignOthers ? (selfIsStaff ? me.id : (staff[0]?.id ?? ''))
    : me.id;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [assigneeId, setAssigneeId] = useState(defaultAssignee);
  const [projectId, setProjectId] = useState(task?.project_id ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'todo');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [saving, setSaving] = useState(false);

  // assignee options: full staff list if you can assign others, else just yourself
  const assigneeOptions = canAssignOthers
    ? staff.map((s) => ({ value: s.id, label: `${s.full_name} · ${s.role}` }))
    : [{ value: me.id, label: `${me.name} (you)` }];

  const resolveName = (id: string) => staff.find((s) => s.id === id)?.full_name ?? (id === me.id ? me.name : '');

  const submit = async () => {
    if (!title.trim() || !assigneeId) return;
    setSaving(true);
    const payload: TaskInput = {
      title, description: description || null, assignee_id: assigneeId, assignee_name: resolveName(assigneeId),
      project_id: projectId || null, project_name: projectId ? (projects.find((p) => p.id === projectId)?.name ?? null) : null,
      priority, status, due_date: dueDate || null,
    };
    try {
      if (task) await updateTask(task.id, payload);
      else await createTask(payload, me);
      onSaved();
    } catch (e) { alert('Save failed: ' + (e as any).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={task ? 'Edit task' : 'New task'}>
      <div className="space-y-4">
        <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Finalise kitchen elevation" />
        <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select label="Assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} options={assigneeOptions} disabled={!canAssignOthers} />
            {!canAssignOthers && <p className="text-[11px] text-slate-400 mt-1">Only the owner (or staff they authorise) can assign to others.</p>}
          </div>
          <Select label="Project (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}
            options={[{ value: '', label: '— None (standalone) —' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} options={PRIORITY_OPTS} />
          <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {task && <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} options={STATUS_OPTS} />}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !title.trim() || !assigneeId}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {task ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignersModal({ staff, privileges, grantedBy, onClose, onChanged }: {
  staff: { id: string; full_name: string; role: string }[]; privileges: Set<string>;
  grantedBy: string; onClose: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (id: string, name: string, granted: boolean) => {
    setBusy(id);
    try { await setAssignPrivilege(id, name, granted, grantedBy); onChanged(); }
    catch (e) { alert('Failed: ' + (e as any).message); } finally { setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} title="Who can assign tasks">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          You can always assign tasks. Grant specific team members the right to assign tasks to others too. No one can assign tasks to an owner.
        </p>
        <div className="border border-slate-100 rounded-lg divide-y divide-slate-50">
          {staff.map((s) => {
            const on = privileges.has(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-slate-800">{s.full_name}</div>
                  <div className="text-xs text-slate-400 capitalize">{s.role}</div>
                </div>
                <button onClick={() => toggle(s.id, s.full_name, !on)} disabled={busy === s.id}
                  className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            );
          })}
          {staff.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">No staff to manage.</p>}
        </div>
        <div className="flex justify-end pt-1"><Button variant="secondary" onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  );
}
