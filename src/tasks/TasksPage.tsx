import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Loader2, ShieldCheck, ListTodo, ChevronDown, PanelLeft } from 'lucide-react';
import { Popover, MenuItem, MenuLabel, MenuDivider } from './Popover';
import { TaskSidebar, type Selection } from './TaskSidebar';
import { TaskListView } from './TaskListView';
import { TodayView } from './TodayView';
import { TaskDetailPanel } from './TaskDetailPanel';
import { COLOR_HEX } from './TaskRow';
import type { RowActions } from './TaskRow';
import { cn } from '../utils/cn';
import {
  SMART_VIEWS, SMART_VIEW_BY_ID, type SmartViewId,
} from './taskLogic';
import { linkNavTarget } from './taskLinks';
import {
  listTasks, listTaskLists, listSubtasks, listActivity, listAssignPrivileges,
  createTask, updateTask, deleteTask, setArchived, bulkUpdate,
  createTaskList, updateTaskList, deleteTaskList,
  addSubtask, updateSubtask, deleteSubtask, logActivity, setAssignPrivilege,
  type Task, type TaskInput, type TaskStatus, type TaskList, type Subtask, type TaskActivity,
} from '../lib/taskApi';
import type { Page } from '../types';
import { ListPlus } from 'lucide-react';
import { nextRepeatDate, todayStr, addDays } from './taskLogic';

const EMPTY_HINTS: Record<string, string> = {
  today: 'Tasks due today and anything overdue will appear here.',
  upcoming: 'Tasks due in the next 7 days show up here.',
  overdue: 'Nothing is past due. You’re on top of it.',
  important: 'Mark tasks Critical or High to see them here.',
  assigned_to_me: 'Tasks assigned to you will collect here.',
  followups: 'Flag client calls, quotes and reminders as follow-ups.',
  project_tasks: 'Link tasks to a project to track delivery work here.',
  personal: 'Your private to-dos, not tied to any record.',
  completed: 'Completed tasks are archived here for reference.',
  all: 'Every task across your workspace lives here.',
};

export function TasksPage({ onNavigate }: { onNavigate: (page: Page, projectId?: string) => void }) {
  const { user } = useAuth();
  const store = useStore();
  const { can } = usePermissions();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [privileges, setPrivileges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Selection>({ kind: 'smart', id: 'today' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [activity, setActivity] = useState<TaskActivity[] | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [managing, setManaging] = useState(false);

  const firmId = user?.firm_id ?? '';
  const me = useMemo(() => ({ id: user?.id ?? '', name: user?.full_name ?? '' }), [user]);

  const staff = useMemo(
    () => store.profiles.filter((p) => p.firm_id === firmId && p.role !== 'client')
      .map((p) => ({ id: p.id, full_name: p.full_name, role: p.role })),
    [store.profiles, firmId],
  );

  const isOwner = can('tasks', 'assign');
  const canAssignOthers = !!isOwner || (!!user && privileges.has(user.id));
  const canCreate = can('tasks', 'create');
  const canManage = (t: Task) => canAssignOthers || t.created_by_id === me.id;
  const canStatus = (t: Task) => canManage(t) || t.assignee_id === me.id;

  const load = () => Promise.all([listTasks(firmId), listTaskLists(firmId), listSubtasks(firmId), listAssignPrivileges(firmId)])
    .then(([t, l, s, p]) => { setTasks(t); setLists(l); setSubtasks(s); setPrivileges(p); setLoading(false); })
    .catch((e) => { console.error(e); setLoading(false); });
  useEffect(() => { if (firmId) load(); }, [firmId]);

  // load activity for the open task
  useEffect(() => {
    if (!openId) { setActivity(null); return; }
    setActivity(null);
    listActivity(openId).then(setActivity).catch(() => setActivity([]));
  }, [openId]);

  // ── derived ──
  const live = useMemo(() => tasks.filter((t) => !t.archived_at), [tasks]);
  const subtaskProgress = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const s of subtasks) { const e = m.get(s.task_id) ?? { done: 0, total: 0 }; e.total++; if (s.done) e.done++; m.set(s.task_id, e); }
    return m;
  }, [subtasks]);

  const smartCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of SMART_VIEWS) {
      if (v.id === 'all') c[v.id] = live.length;
      else if (v.id === 'completed') c[v.id] = live.filter((t) => t.status === 'completed').length;
      else c[v.id] = live.filter((t) => v.match(t, me.id)).length;
    }
    return c;
  }, [live, me.id]);

  const listCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of live) if (t.list_id && t.status !== 'completed' && t.status !== 'cancelled') c[t.list_id] = (c[t.list_id] ?? 0) + 1;
    return c;
  }, [live]);

  const listById = (id: string | null) => (id ? lists.find((l) => l.id === id) : undefined);

  // tasks for the current selection
  const viewTasks = useMemo(() => {
    if (sel.kind === 'list') {
      let base = live.filter((t) => t.list_id === sel.id);
      if (!showCompleted) base = base.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
      return base;
    }
    if (sel.id === 'all') {
      let base = tasks; // include archived in All
      if (!showCompleted) base = base.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
      return base;
    }
    const v = SMART_VIEW_BY_ID[sel.id];
    return live.filter((t) => v.match(t, me.id));
  }, [sel, live, tasks, showCompleted, me.id]);

  // ── mutations ──
  const patchLocal = (id: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const doUpdate = (id: string, patch: Partial<TaskInput>, activityKind?: TaskActivity['kind'], detail?: string) => {
    const local: Partial<Task> = { ...patch, updated_at: new Date().toISOString() } as any;
    if ('status' in patch) local.completed_at = patch.status === 'completed' ? new Date().toISOString() : null;
    patchLocal(id, local);
    updateTask(id, patch).catch((e) => { console.error(e); load(); });
    if (activityKind) logActivity(id, me, activityKind, detail ?? null, firmId).then(() => { if (openId === id) listActivity(id).then(setActivity); }).catch(() => {});
  };

  const toggleComplete = (t: Task) => {
    const completing = t.status !== 'completed';
    doUpdate(t.id, { status: completing ? 'completed' : 'not_started' }, completing ? 'completed' : 'reopened');
    if (completing && t.repeat !== 'none') {
      const next = nextRepeatDate(t.due_date || todayStr(), t.repeat);
      if (next) {
        const input: TaskInput = {
          title: t.title, description: t.description, assignee_id: t.assignee_id, assignee_name: t.assignee_name,
          project_id: t.project_id, project_name: t.project_name, priority: t.priority, status: 'not_started',
          start_date: null, due_date: next, repeat: t.repeat, tags: t.tags, notes: t.notes, attachments: t.attachments,
          list_id: t.list_id, link_type: t.link_type, link_id: t.link_id, link_label: t.link_label, is_followup: t.is_followup,
        };
        createTask(input, me, firmId).then((nt) => setTasks((p) => [nt, ...p])).catch((e) => console.error(e));
      }
    }
  };

  // smart defaults when quick-adding inside a view
  const defaultsFor = (): Partial<TaskInput> => {
    const d: Partial<TaskInput> = {};
    if (sel.kind === 'list') d.list_id = sel.id;
    else if (sel.id === 'today') d.due_date = todayStr();
    else if (sel.id === 'upcoming') d.due_date = addDays(todayStr(), 1);
    else if (sel.id === 'important') d.priority = 'high';
    else if (sel.id === 'followups') d.is_followup = true;
    return d;
  };

  const quickAdd = (title: string, extra?: Partial<TaskInput>) => {
    const tempId = uuid();
    const base: TaskInput = {
      title, assignee_id: me.id, assignee_name: me.name, priority: 'medium', status: 'not_started',
      ...defaultsFor(), ...extra,
    };
    const optimistic: Task = {
      id: tempId, title, description: null, assignee_id: base.assignee_id, assignee_name: base.assignee_name,
      created_by_id: me.id, created_by_name: me.name, project_id: base.project_id ?? null, project_name: base.project_name ?? null,
      status: base.status ?? 'not_started', priority: base.priority ?? 'medium', start_date: base.start_date ?? null,
      due_date: base.due_date ?? null, reminder_at: null, repeat: 'none', tags: base.tags ?? [], notes: null, attachments: [],
      list_id: base.list_id ?? null, link_type: base.link_type ?? null, link_id: base.link_id ?? null, link_label: base.link_label ?? null,
      is_followup: base.is_followup ?? false, progress: 0, order_index: Date.now(), archived_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null,
    };
    setTasks((p) => [optimistic, ...p]);
    createTask(base, me, firmId)
      .then((real) => setTasks((p) => p.map((t) => (t.id === tempId ? real : t))))
      .catch((e) => { console.error(e); setTasks((p) => p.filter((t) => t.id !== tempId)); });
  };

  const removeTask = (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    setSubtasks((p) => p.filter((s) => s.task_id !== id));
    if (openId === id) setOpenId(null);
    deleteTask(id).catch((e) => { console.error(e); load(); });
  };
  const archiveTask = (t: Task) => { patchLocal(t.id, { archived_at: t.archived_at ? null : new Date().toISOString() }); setArchived(t.id, !t.archived_at).catch(() => load()); };

  const doBulk = (ids: string[], patch: any) => { setTasks((p) => p.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t))); bulkUpdate(ids, patch).catch(() => load()); };
  const bulkDelete = (ids: string[]) => { setTasks((p) => p.filter((t) => !ids.includes(t.id))); Promise.all(ids.map((id) => deleteTask(id))).catch(() => load()); };

  // subtasks
  const addSub = (taskId: string, title: string) => {
    const order = subtasks.filter((s) => s.task_id === taskId).length;
    const temp: Subtask = { id: uuid(), firm_id: firmId, task_id: taskId, title, done: false, order_index: order, created_at: new Date().toISOString() };
    setSubtasks((p) => [...p, temp]);
    addSubtask(taskId, title, order, firmId).then((real) => setSubtasks((p) => p.map((s) => (s.id === temp.id ? real : s)))).catch(() => load());
  };
  const toggleSub = (id: string, done: boolean) => { setSubtasks((p) => p.map((s) => (s.id === id ? { ...s, done } : s))); updateSubtask(id, { done }).catch(() => load()); };
  const renameSub = (id: string, title: string) => { setSubtasks((p) => p.map((s) => (s.id === id ? { ...s, title } : s))); updateSubtask(id, { title }).catch(() => load()); };
  const removeSub = (id: string) => { setSubtasks((p) => p.filter((s) => s.id !== id)); deleteSubtask(id).catch(() => load()); };

  const addComment = (taskId: string, text: string) =>
    logActivity(taskId, me, 'comment', text, firmId).then(() => listActivity(taskId).then(setActivity)).catch(() => {});

  // lists
  const createList = (name: string, color: string) => createTaskList({ name, color }, me.id, firmId).then((l) => setLists((p) => [...p, l])).catch((e) => console.error(e));
  const renameList = (id: string, name: string) => { setLists((p) => p.map((l) => (l.id === id ? { ...l, name } : l))); updateTaskList(id, { name }).catch(() => load()); };
  const recolorList = (id: string, color: string) => { setLists((p) => p.map((l) => (l.id === id ? { ...l, color } : l))); updateTaskList(id, { color }).catch(() => load()); };
  const removeList = (id: string) => {
    setLists((p) => p.filter((l) => l.id !== id));
    setTasks((p) => p.map((t) => (t.list_id === id ? { ...t, list_id: null } : t)));
    if (sel.kind === 'list' && sel.id === id) setSel({ kind: 'smart', id: 'today' });
    deleteTaskList(id).catch(() => load());
  };

  const openLink = (t: Task) => { const tgt = linkNavTarget(t); if (tgt) onNavigate(tgt.page, tgt.projectId); };

  const rowActionsFor = (t: Task): RowActions => ({
    onOpen: () => setOpenId(t.id),
    onToggleComplete: () => toggleComplete(t),
    onStatus: (s: TaskStatus) => doUpdate(t.id, { status: s }, 'status', undefined),
    onPriority: (p) => doUpdate(t.id, { priority: p }),
    onSelect: () => {},
    onEdit: () => setOpenId(t.id),
    onArchive: () => archiveTask(t),
    onDelete: () => removeTask(t.id),
    onOpenLink: () => openLink(t),
    canManage: canManage(t),
    canStatus: canStatus(t),
  });

  const navigableFor = (t: Task) => linkNavTarget(t) !== null;

  // active view descriptor
  const viewDesc = useMemo(() => {
    if (sel.kind === 'list') {
      const l = listById(sel.id);
      return { label: l?.name ?? 'List', Icon: ListPlus, accent: '', id: sel.id, supportsCompleted: true, emptyHint: 'Add tasks to this list to organise your work.', color: l?.color };
    }
    const v = SMART_VIEW_BY_ID[sel.id];
    return { label: v.label, Icon: v.icon, accent: v.accent, id: v.id, supportsCompleted: v.id === 'all', emptyHint: EMPTY_HINTS[v.id] ?? '' };
  }, [sel, lists]);

  const openTask = openId ? tasks.find((t) => t.id === openId) : undefined;

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading tasks…</div>
  );

  return (
    <div className="-m-4 flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-slate-50 sm:-m-6 lg:-m-8 lg:h-dvh xl:-m-10">
      {/* sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-100/30 md:flex">
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-slate-200 px-4">
          <ListTodo className="h-[18px] w-[18px] text-indigo-600" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">Tasks</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <TaskSidebar selected={sel} onSelect={(s) => { setSel(s); setShowCompleted(false); }}
            smartCounts={smartCounts} lists={lists} listCounts={listCounts} canManageLists={canCreate}
            onCreateList={createList} onRenameList={renameList} onRecolorList={recolorList} onDeleteList={removeList} />
        </div>
        {isOwner && (
          <div className="shrink-0 border-t border-slate-200 p-2">
            <button onClick={() => setManaging(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] font-medium text-slate-500 hover:bg-white hover:text-slate-700">
              <ShieldCheck className="h-4 w-4 text-slate-400" /> Who can assign
            </button>
          </div>
        )}
      </aside>

      {/* main */}
      <main className="flex min-w-0 flex-1 flex-col bg-white">
        {/* mobile view switcher */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 md:hidden">
          <MobileSwitcher sel={sel} setSel={(s) => { setSel(s); setShowCompleted(false); }} lists={lists} smartCounts={smartCounts} listCounts={listCounts} />
        </div>

        {sel.kind === 'smart' && sel.id === 'today' ? (
          <TodayView tasks={live} me={me.id} meName={me.name} subtaskProgress={subtaskProgress}
            rowActionsFor={rowActionsFor} listFor={(t) => listById(t.list_id)} navigableFor={navigableFor}
            onQuickAdd={(title) => quickAdd(title, { due_date: todayStr() })} canQuickAdd={canCreate}
            onOpen={(t) => setOpenId(t.id)} onJump={(v: SmartViewId) => setSel({ kind: 'smart', id: v })} />
        ) : (
          <TaskListView key={`${sel.kind}:${sel.id}`} view={viewDesc} tasks={viewTasks} lists={lists} staff={staff}
            subtaskProgress={subtaskProgress} me={me.id} rowActionsFor={rowActionsFor}
            listFor={(t) => listById(t.list_id)} navigableFor={navigableFor}
            onQuickAdd={(title) => quickAdd(title)} canQuickAdd={canCreate}
            showCompleted={showCompleted} onToggleCompleted={() => setShowCompleted((v) => !v)}
            onBulk={doBulk} onBulkDelete={bulkDelete} />
        )}
      </main>

      {/* detail */}
      {openTask && (
        <TaskDetailPanel key={openTask.id} task={openTask} list={listById(openTask.list_id)} lists={lists}
          subtasks={subtasks.filter((s) => s.task_id === openTask.id).sort((a, b) => a.order_index - b.order_index)}
          activity={activity} staff={staff} store={store} firmId={firmId} me={me}
          canManage={canManage(openTask)} canStatus={canStatus(openTask)} navigable={navigableFor(openTask)}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => doUpdate(openTask.id, patch, patch.status ? 'status' : patch.assignee_id ? 'assigned' : (patch.link_type !== undefined ? 'linked' : undefined))}
          onSubtaskAdd={(title) => addSub(openTask.id, title)} onSubtaskToggle={toggleSub} onSubtaskRename={renameSub} onSubtaskDelete={removeSub}
          onComment={(text) => addComment(openTask.id, text)} onDelete={() => removeTask(openTask.id)}
          onArchive={() => archiveTask(openTask)} onOpenLink={() => openLink(openTask)} />
      )}

      {managing && isOwner && (
        <AssignersModal staff={staff} privileges={privileges} grantedBy={me.id} firmId={firmId}
          onClose={() => setManaging(false)} onChanged={load} />
      )}
    </div>
  );
}

function MobileSwitcher({ sel, setSel, lists, smartCounts, listCounts }: {
  sel: Selection; setSel: (s: Selection) => void; lists: TaskList[]; smartCounts: Record<string, number>; listCounts: Record<string, number>;
}) {
  const label = sel.kind === 'list' ? (lists.find((l) => l.id === sel.id)?.name ?? 'List') : SMART_VIEW_BY_ID[sel.id].label;
  return (
    <Popover width={240} trigger={({ toggle, ref }) => (
      <button ref={ref as any} onClick={toggle} className="inline-flex items-center gap-2 rounded-[9px] border border-slate-200 px-3 py-1.5 text-[14px] font-semibold text-slate-800">
        <PanelLeft className="h-4 w-4 text-slate-400" />{label}<ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
    )}>
      {(close) => (<>
        <MenuLabel>Smart views</MenuLabel>
        {SMART_VIEWS.map((v) => (
          <MenuItem key={v.id} active={sel.kind === 'smart' && sel.id === v.id} onClick={() => { setSel({ kind: 'smart', id: v.id }); close(); }}
            icon={<v.icon className={v.accent} />} label={v.label} trailing={smartCounts[v.id] ? <span className="text-[11px] text-slate-400">{smartCounts[v.id]}</span> : undefined} />
        ))}
        {lists.length > 0 && <><MenuDivider /><MenuLabel>Lists</MenuLabel></>}
        {lists.map((l) => (
          <MenuItem key={l.id} active={sel.kind === 'list' && sel.id === l.id} onClick={() => { setSel({ kind: 'list', id: l.id }); close(); }}
            icon={<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[l.color] ?? COLOR_HEX.slate }} />}
            label={l.name} trailing={listCounts[l.id] ? <span className="text-[11px] text-slate-400">{listCounts[l.id]}</span> : undefined} />
        ))}
      </>)}
    </Popover>
  );
}

function AssignersModal({ staff, privileges, grantedBy, firmId, onClose, onChanged }: {
  staff: { id: string; full_name: string; role: string }[]; privileges: Set<string>;
  grantedBy: string; firmId: string; onClose: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const assignable = staff.filter((s) => s.role !== 'owner');
  const toggle = async (id: string, name: string, granted: boolean) => {
    setBusy(id);
    try { await setAssignPrivilege(id, name, granted, grantedBy, firmId); onChanged(); }
    catch (e) { alert('Failed: ' + (e as any).message); } finally { setBusy(null); }
  };
  return (
    <Modal open onClose={onClose} title="Who can assign tasks">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">You can always assign tasks to anyone. Grant specific team members the right to assign work to others too.</p>
        <div className="divide-y divide-slate-50 rounded-lg border border-slate-100">
          {assignable.map((s) => {
            const on = privileges.has(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between px-3 py-2.5">
                <div><div className="text-sm font-medium text-slate-800">{s.full_name}</div><div className="text-xs capitalize text-slate-400">{s.role}</div></div>
                <button onClick={() => toggle(s.id, s.full_name, !on)} disabled={busy === s.id}
                  className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-indigo-600' : 'bg-slate-200')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
            );
          })}
          {assignable.length === 0 && <p className="px-3 py-4 text-sm text-slate-400">No staff to manage.</p>}
        </div>
        <div className="flex justify-end pt-1"><Button variant="secondary" onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  );
}
