import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { timeAgo } from '../utils/format';
import {
  listTasks, createTask, updateTask, deleteTask, listAssignPrivileges, setAssignPrivilege,
  type Task, type TaskStatus, type TaskPriority, type TaskInput,
} from '../lib/taskApi';
import {
  ListTodo, Plus, Trash2, Loader2, Check, ShieldCheck, Star,
  ChevronRight, ChevronDown, Search, X, SlidersHorizontal,
  LayoutList, LayoutGrid, FolderOpen, Calendar, User, AlertCircle,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ─── constants ───────────────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_META: Record<TaskPriority, { label: string; color: string; border: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-600',   border: 'border-l-red-500' },
  high:   { label: 'High',   color: 'text-amber-600', border: 'border-l-amber-400' },
  medium: { label: 'Medium', color: 'text-indigo-500',border: 'border-l-indigo-300' },
  low:    { label: 'Low',    color: 'text-slate-400',  border: 'border-l-slate-200' },
};

type GroupKey = 'overdue' | 'today' | 'week' | 'later' | 'nodate' | 'done';
const GROUP_CONFIG: { key: GroupKey; label: string; defaultOpen: boolean }[] = [
  { key: 'overdue', label: 'Overdue',    defaultOpen: true  },
  { key: 'today',   label: 'Today',      defaultOpen: true  },
  { key: 'week',    label: 'This week',  defaultOpen: true  },
  { key: 'later',   label: 'Later',      defaultOpen: true  },
  { key: 'nodate',  label: 'No due date',defaultOpen: true  },
  { key: 'done',    label: 'Completed',  defaultOpen: false },
];

type SortKey = 'created' | 'due' | 'priority' | 'updated';
const SORT_LABELS: Record<SortKey, string> = {
  created:  'Date created',
  due:      'Due date',
  priority: 'Priority',
  updated:  'Last updated',
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const weekEndStr = () => {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatRelativeDue(dateStr: string): { text: string; color: string } {
  const today = todayStr();
  if (dateStr === today) return { text: 'Today', color: 'text-amber-600 font-medium' };
  const diff = Math.round((new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000);
  if (diff === 1)  return { text: 'Tomorrow', color: 'text-slate-500' };
  if (diff === -1) return { text: 'Yesterday', color: 'text-red-600 font-medium' };
  if (diff < -1)   return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-600 font-medium' };
  if (diff <= 6) {
    const day = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
    return { text: day, color: 'text-slate-500' };
  }
  const date = new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return { text: date, color: 'text-slate-400' };
}

function groupTasks(tasks: Task[]): Record<GroupKey, Task[]> {
  const today = todayStr();
  const weekEnd = weekEndStr();
  return {
    overdue: tasks.filter(t => t.status !== 'done' && !!t.due_date && t.due_date < today),
    today:   tasks.filter(t => t.status !== 'done' && t.due_date === today),
    week:    tasks.filter(t => t.status !== 'done' && !!t.due_date && t.due_date > today && t.due_date <= weekEnd),
    later:   tasks.filter(t => t.status !== 'done' && !!t.due_date && t.due_date > weekEnd),
    nodate:  tasks.filter(t => t.status !== 'done' && !t.due_date),
    done:    tasks.filter(t => t.status === 'done'),
  };
}

function isImportant(priority: TaskPriority) { return priority === 'urgent' || priority === 'high'; }

// ─── main page ────────────────────────────────────────────────────────────────

export function TasksPage() {
  const { user } = useAuth();
  const store = useStore();
  const { can } = usePermissions();

  const [tasks, setTasks]         = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating]   = useState(false);
  const [managing, setManaging]   = useState(false);
  const [view, setView]           = useState<'list' | 'board'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [mineOnly, setMineOnly]   = useState(false);
  const [projectFilter, setProjectFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortBy, setSortBy]       = useState<SortKey>('created');
  const [collapsed, setCollapsed] = useState<Set<GroupKey>>(new Set(['done']));

  const staff = useMemo(
    () => store.profiles.filter(p => p.firm_id === user?.firm_id && p.role !== 'client'),
    [store.profiles, user?.firm_id],
  );
  const projects = useMemo(
    () => store.projects.filter(p => p.firm_id === user?.firm_id),
    [store.projects, user?.firm_id],
  );

  const isOwner = can('tasks', 'assign');
  const canAssignOthers = !!isOwner || (!!user && privileges.has(user.id));

  const load = useCallback(() =>
    Promise.all([listTasks(), listAssignPrivileges()])
      .then(([t, p]) => { setTasks(t); setPrivileges(p); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); }),
  []);
  useEffect(() => { load(); }, [load]);

  const canManage      = (t: Task) => canAssignOthers || t.created_by_id === user?.id;
  const canUpdateStatus = (t: Task) => canManage(t) || t.assignee_id === user?.id;

  // ── filtering + sorting ──
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = tasks.filter(t => {
      if (mineOnly && t.assignee_id !== user?.id) return false;
      if (projectFilter && t.project_id !== projectFilter) return false;
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false;
      if (priorityFilter === 'urgent' && t.priority !== 'urgent') return false;
      if (priorityFilter === 'important' && !isImportant(t.priority)) return false;
      if (q && ![ t.title, t.description, t.assignee_name, t.project_name ]
          .filter(Boolean).some(f => f!.toLowerCase().includes(q))) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'due') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (sortBy === 'priority') return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (sortBy === 'updated')  return b.updated_at.localeCompare(a.updated_at);
      return b.created_at.localeCompare(a.created_at); // 'created' default
    });
    return list;
  }, [tasks, searchQuery, mineOnly, projectFilter, assigneeFilter, priorityFilter, sortBy, user?.id]);

  // ── stats ──
  const today = todayStr();
  const stats = useMemo(() => ({
    total:      filtered.length,
    inProgress: filtered.filter(t => t.status === 'in_progress').length,
    done:       filtered.filter(t => t.status === 'done').length,
    overdue:    filtered.filter(t => t.status !== 'done' && !!t.due_date && t.due_date < today).length,
  }), [filtered, today]);

  // ── mutations ──
  const toggleDone = async (t: Task) => {
    const next: TaskStatus = t.status === 'done' ? 'todo' : 'done';
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    try { await updateTask(t.id, { status: next }); } catch { load(); }
  };

  const toggleImportant = async (t: Task) => {
    const next: TaskPriority = isImportant(t.priority) ? 'medium' : 'urgent';
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, priority: next } : x));
    try { await updateTask(t.id, { priority: next }); } catch { load(); }
  };

  const patchTask = async (id: string, patch: Partial<TaskInput>) => {
    setTasks(prev => prev.map(x => x.id === id ? { ...x, ...patch } as Task : x));
    try { await updateTask(id, patch); } catch { load(); }
  };

  const onDelete = async (t: Task) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    if (selectedId === t.id) setSelectedId(null);
    setTasks(prev => prev.filter(x => x.id !== t.id));
    try { await deleteTask(t.id); } catch { load(); }
  };

  const onQuickAdd = async (title: string, dueDate?: string) => {
    if (!title.trim()) return;
    const payload: TaskInput = {
      title: title.trim(), description: null,
      assignee_id: user!.id, assignee_name: user!.full_name,
      project_id: projectFilter || null,
      project_name: projectFilter ? (projects.find(p => p.id === projectFilter)?.name ?? null) : null,
      priority: 'medium', status: 'todo', due_date: dueDate ?? null,
    };
    const created = await createTask(payload, { id: user!.id, name: user!.full_name });
    setTasks(prev => [created, ...prev]);
  };

  const selectedTask = tasks.find(t => t.id === selectedId) ?? null;

  const toggleCollapse = (key: GroupKey) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading tasks…
    </div>
  );

  return (
    <div className="flex gap-0 min-h-0">
      {/* ── main content ── */}
      <div className={cn('flex-1 min-w-0 space-y-4 transition-all duration-300', selectedTask ? 'mr-4' : '')}>

        {/* header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ListTodo className="w-6 h-6 text-indigo-600 shrink-0" /> Task Manager
            </h1>
            {/* stats pills */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-400">{stats.total} task{stats.total !== 1 ? 's' : ''}</span>
              {stats.inProgress > 0 && <><span className="text-slate-200">·</span><span className="text-xs text-amber-600">{stats.inProgress} in progress</span></>}
              {stats.done > 0 && <><span className="text-slate-200">·</span><span className="text-xs text-emerald-600">{stats.done} done</span></>}
              {stats.overdue > 0 && <><span className="text-slate-200">·</span><span className="text-xs text-red-600 font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" />{stats.overdue} overdue</span></>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <Button variant="secondary" size="sm" onClick={() => setManaging(true)}>
                <ShieldCheck className="w-4 h-4" /> Who can assign
              </Button>
            )}
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" /> New task
            </Button>
          </div>
        </div>

        {/* search + filters */}
        <div className="space-y-2">
          {/* search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks, projects, people…"
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Select label="" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              options={[{ value: '', label: 'All projects' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
              className="!mb-0 text-sm" />
            {canAssignOthers && (
              <Select label="" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
                options={[{ value: '', label: 'Everyone' }, ...staff.map(s => ({ value: s.id, label: s.full_name }))]}
                className="!mb-0 text-sm" />
            )}
            <Select label="" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              options={[{ value: '', label: 'All priorities' }, { value: 'important', label: 'High & Urgent' }, { value: 'urgent', label: 'Urgent only' }]}
              className="!mb-0 text-sm" />
            <button onClick={() => setMineOnly(v => !v)}
              className={cn('h-9 px-3 rounded-[9px] border text-xs font-medium inline-flex items-center gap-1.5 transition-colors',
                mineOnly ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white')}>
              <User className="w-3.5 h-3.5" /> My tasks
            </button>

            {/* sort */}
            <div className="relative ml-auto">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
                className="h-9 rounded-[9px] border border-slate-200 bg-white pl-7 pr-3 text-xs text-slate-600 focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer">
                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                  <option key={k} value={k}>{SORT_LABELS[k]}</option>
                ))}
              </select>
              <SlidersHorizontal className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* view toggle */}
            <div className="flex rounded-[9px] border border-slate-200 bg-white overflow-hidden">
              <button onClick={() => setView('list')}
                className={cn('h-9 px-2.5 flex items-center transition-colors', view === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600')}>
                <LayoutList className="w-4 h-4" />
              </button>
              <button onClick={() => setView('board')}
                className={cn('h-9 px-2.5 flex items-center border-l border-slate-200 transition-colors', view === 'board' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600')}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── list view ── */}
        {view === 'list' && (
          <div className="space-y-1">
            {GROUP_CONFIG.map(({ key, label, defaultOpen: _ }) => {
              const groups = groupTasks(filtered);
              const items = groups[key];
              const open = !collapsed.has(key);
              const isOverdueGroup = key === 'overdue';
              return (
                <div key={key}>
                  {/* group header */}
                  <button
                    onClick={() => toggleCollapse(key)}
                    className="w-full flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    {open
                      ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    }
                    <span className={cn('text-xs font-semibold uppercase tracking-wide',
                      isOverdueGroup && items.length > 0 ? 'text-red-500' : 'text-slate-400')}>
                      {label}
                    </span>
                    {items.length > 0 && (
                      <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-medium',
                        isOverdueGroup ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500')}>
                        {items.length}
                      </span>
                    )}
                  </button>

                  {/* task rows */}
                  {open && (
                    <div className="ml-5 space-y-px">
                      {items.map(t => (
                        <TaskRow
                          key={t.id} t={t} me={user?.id}
                          selected={selectedId === t.id}
                          canManage={canManage(t)} canUpdateStatus={canUpdateStatus(t)}
                          onSelect={() => setSelectedId(selectedId === t.id ? null : t.id)}
                          onToggleDone={() => toggleDone(t)}
                          onToggleImportant={() => toggleImportant(t)}
                          onEdit={() => { setSelectedId(t.id); }}
                          onDelete={() => onDelete(t)}
                        />
                      ))}
                      {items.length === 0 && key !== 'done' && (
                        <div className="py-1 text-xs text-slate-300 pl-2">Nothing here</div>
                      )}
                      {/* inline add — only for open non-done groups */}
                      {key !== 'done' && (
                        <InlineAddTask
                          onAdd={(title) => onQuickAdd(title, key === 'today' ? todayStr() : undefined)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── board view ── */}
        {view === 'board' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['todo', 'in_progress', 'done'] as TaskStatus[]).map(status => {
              const items = filtered.filter(t => t.status === status);
              const doneCount = filtered.filter(t => t.status === 'done').length;
              const total = filtered.filter(t => t.status !== 'done' || status === 'done').length;
              const dot = status === 'todo' ? 'bg-slate-400' : status === 'in_progress' ? 'bg-amber-500' : 'bg-emerald-500';
              const label = status === 'todo' ? 'To do' : status === 'in_progress' ? 'In progress' : 'Done';
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    <span className="text-xs text-slate-400">{items.length}</span>
                    {status === 'done' && total > 0 && (
                      <span className="text-[11px] text-emerald-600 ml-auto">{Math.round(doneCount / filtered.length * 100)}%</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">Nothing here</div>
                    )}
                    {items.map(t => (
                      <BoardCard
                        key={t.id} t={t} me={user?.id}
                        selected={selectedId === t.id}
                        canManage={canManage(t)} canUpdateStatus={canUpdateStatus(t)}
                        onSelect={() => setSelectedId(selectedId === t.id ? null : t.id)}
                        onToggleDone={() => toggleDone(t)}
                        onToggleImportant={() => toggleImportant(t)}
                        onDelete={() => onDelete(t)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── detail panel ── */}
      {selectedTask && (
        <TaskPanel
          task={selectedTask} staff={staff} projects={projects}
          me={{ id: user!.id, name: user!.full_name }}
          canManage={canManage(selectedTask)}
          onClose={() => setSelectedId(null)}
          onPatch={(patch) => patchTask(selectedTask.id, patch)}
          onToggleDone={() => toggleDone(selectedTask)}
          onToggleImportant={() => toggleImportant(selectedTask)}
          onDelete={() => onDelete(selectedTask)}
        />
      )}

      {/* modals */}
      {creating && (
        <TaskModal
          task={null} staff={staff} projects={projects}
          canAssignOthers={canAssignOthers} me={{ id: user!.id, name: user!.full_name }}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
        />
      )}
      {managing && isOwner && (
        <AssignersModal
          staff={staff} privileges={privileges} grantedBy={user!.id}
          onClose={() => setManaging(false)} onChanged={load}
        />
      )}
    </div>
  );
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────

function TaskRow({ t, me, selected, canManage, onSelect, onToggleDone, onToggleImportant, onDelete }: {
  t: Task; me?: string; selected: boolean; canManage: boolean;
  onSelect: () => void; onToggleDone: () => void; onToggleImportant: () => void;
  onDelete: () => void; canUpdateStatus: boolean; onEdit: () => void;
}) {
  const isDone = t.status === 'done';
  const important = isImportant(t.priority);
  const due = t.due_date ? formatRelativeDue(t.due_date) : null;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
        selected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50',
        isDone && 'opacity-60',
      )}
      onClick={onSelect}
    >
      {/* circle toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggleDone(); }}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
          isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400',
        )}
        title={isDone ? 'Mark incomplete' : 'Mark complete'}
      >
        {isDone && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>

      {/* title */}
      <span className={cn('flex-1 text-sm min-w-0 truncate', isDone ? 'line-through text-slate-400' : 'text-slate-800 font-medium')}>
        {t.title}
      </span>

      {/* metadata chips */}
      <div className="hidden group-hover:flex sm:flex items-center gap-2 shrink-0">
        {t.project_name && (
          <span className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5 max-w-[120px] truncate">
            <FolderOpen className="w-3 h-3 shrink-0" />{t.project_name}
          </span>
        )}
        {due && (
          <span className={cn('flex items-center gap-1 text-[11px]', due.color)}>
            <Calendar className="w-3 h-3 shrink-0" />{due.text}
          </span>
        )}
        <Avatar name={t.assignee_id === me ? 'You' : t.assignee_name} size="sm" className="w-6 h-6 text-[10px]" />
      </div>

      {/* star */}
      <button
        onClick={e => { e.stopPropagation(); onToggleImportant(); }}
        className={cn('shrink-0 transition-colors', important ? 'text-amber-400 hover:text-amber-500' : 'text-slate-200 hover:text-amber-300')}
        title={important ? 'Remove importance' : 'Mark important'}
      >
        <Star className="w-4 h-4" fill={important ? 'currentColor' : 'none'} />
      </button>

      {/* actions on hover */}
      {canManage && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 shrink-0 text-slate-300 hover:text-red-500 transition-all"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── BoardCard ────────────────────────────────────────────────────────────────

function BoardCard({ t, me, selected, canManage, onSelect, onToggleDone, onToggleImportant, onDelete }: {
  t: Task; me?: string; selected: boolean; canManage: boolean;
  onSelect: () => void; onToggleDone: () => void; onToggleImportant: () => void;
  onDelete: () => void; canUpdateStatus: boolean;
}) {
  const isDone = t.status === 'done';
  const important = isImportant(t.priority);
  const due = t.due_date ? formatRelativeDue(t.due_date) : null;
  const pm = PRIORITY_META[t.priority];

  return (
    <div
      onClick={onSelect}
      className={cn(
        'rounded-xl border bg-white p-3 border-l-[3px] cursor-pointer transition-all space-y-2',
        pm.border,
        selected ? 'ring-1 ring-indigo-300 border-t-indigo-100 border-r-indigo-100 border-b-indigo-100' : 'hover:shadow-sm border-t-slate-100 border-r-slate-100 border-b-slate-100',
        isDone && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <button onClick={e => { e.stopPropagation(); onToggleDone(); }}
          className={cn('mt-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all w-[18px] h-[18px]',
            isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400')}>
          {isDone && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
        </button>
        <span className={cn('flex-1 text-sm font-medium leading-snug', isDone ? 'line-through text-slate-400' : 'text-slate-800')}>{t.title}</span>
        <button onClick={e => { e.stopPropagation(); onToggleImportant(); }}
          className={cn('shrink-0 transition-colors', important ? 'text-amber-400' : 'text-slate-200 hover:text-amber-300')}>
          <Star className="w-3.5 h-3.5" fill={important ? 'currentColor' : 'none'} />
        </button>
      </div>
      {t.description && <p className="text-xs text-slate-500 line-clamp-2 pl-6">{t.description}</p>}
      <div className="flex items-center justify-between pl-6 pt-0.5">
        <div className="flex items-center gap-2">
          {due && <span className={cn('text-[11px] flex items-center gap-1', due.color)}><Calendar className="w-3 h-3" />{due.text}</span>}
          {t.project_name && <span className="text-[11px] text-slate-400 truncate max-w-[80px]">{t.project_name}</span>}
        </div>
        <div className="flex items-center gap-1">
          {canManage && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
          )}
          <Avatar name={t.assignee_id === me ? 'You' : t.assignee_name} size="sm" className="w-6 h-6 text-[10px]" />
        </div>
      </div>
    </div>
  );
}

// ─── InlineAddTask ────────────────────────────────────────────────────────────

function InlineAddTask({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activate = () => { setActive(true); setTimeout(() => inputRef.current?.focus(), 50); };
  const cancel = () => { setActive(false); setValue(''); };

  const submit = async () => {
    if (!value.trim() || saving) return;
    setSaving(true);
    try { await onAdd(value); setValue(''); setActive(false); }
    catch { /* noop */ } finally { setSaving(false); }
  };

  if (!active) {
    return (
      <button onClick={activate}
        className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400 hover:text-indigo-500 hover:bg-slate-50 rounded-lg w-full transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add a task
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-indigo-200 ring-1 ring-indigo-100">
      <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
      <input
        ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') cancel(); }}
        placeholder="Task title…"
        className="flex-1 text-sm text-slate-800 bg-transparent outline-none placeholder-slate-300"
      />
      <button onClick={submit} disabled={!value.trim() || saving}
        className="text-indigo-600 hover:text-indigo-700 disabled:opacity-30 shrink-0">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      </button>
      <button onClick={cancel} className="text-slate-400 hover:text-slate-600 shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );
}

// ─── TaskPanel ────────────────────────────────────────────────────────────────

function TaskPanel({ task, staff, projects, me, canManage, onClose, onPatch, onToggleDone, onToggleImportant, onDelete }: {
  task: Task; staff: { id: string; full_name: string; role: string }[];
  projects: { id: string; name: string }[]; me: { id: string; name: string };
  canManage: boolean;
  onClose: () => void; onPatch: (patch: Partial<TaskInput>) => void;
  onToggleDone: () => void; onToggleImportant: () => void; onDelete: () => void;
}) {
  const isDone = task.status === 'done';
  const important = isImportant(task.priority);
  const [titleEdit, setTitleEdit] = useState(task.title);

  // sync title when task changes
  useEffect(() => { setTitleEdit(task.title); }, [task.id, task.title]);

  const saveTitle = () => {
    if (titleEdit.trim() && titleEdit.trim() !== task.title)
      onPatch({ title: titleEdit.trim() });
  };

  const PRIORITY_OPTS = (['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => ({
    value: p, label: PRIORITY_META[p].label,
  }));
  const STATUS_OPTS = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
  ];

  return (
    <div className="w-80 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-lg flex flex-col max-h-[calc(100vh-8rem)] overflow-hidden">
      {/* panel header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-100">
        <button onClick={onToggleDone}
          className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
            isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400')}>
          {isDone && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>
        <input
          value={titleEdit} onChange={e => setTitleEdit(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={e => { if (e.key === 'Enter') { saveTitle(); e.currentTarget.blur(); } }}
          className={cn('flex-1 text-sm font-semibold bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-400 transition-colors',
            isDone ? 'line-through text-slate-400' : 'text-slate-900')}
        />
        <button onClick={onToggleImportant}
          className={cn('shrink-0 transition-colors', important ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300')}>
          <Star className="w-4 h-4" fill={important ? 'currentColor' : 'none'} />
        </button>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X className="w-4 h-4" /></button>
      </div>

      {/* panel body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* project */}
        <div className="flex items-center gap-3">
          <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={task.project_id ?? ''}
            onChange={e => {
              const pid = e.target.value || null;
              onPatch({ project_id: pid, project_name: pid ? (projects.find(p => p.id === pid)?.name ?? null) : null });
            }}
            disabled={!canManage}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-100 hover:border-slate-300 focus:border-indigo-400 outline-none py-0.5 transition-colors"
          >
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* assignee */}
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={task.assignee_id}
            onChange={e => {
              const s = staff.find(s => s.id === e.target.value) ?? { id: me.id, full_name: me.name };
              onPatch({ assignee_id: s.id, assignee_name: s.full_name });
            }}
            disabled={!canManage}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-100 hover:border-slate-300 focus:border-indigo-400 outline-none py-0.5 transition-colors"
          >
            <option value={me.id}>{me.name} (me)</option>
            {staff.filter(s => s.id !== me.id).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>

        {/* due date */}
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="date" value={task.due_date ?? ''}
            onChange={e => onPatch({ due_date: e.target.value || null })}
            disabled={!canManage}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-100 hover:border-slate-300 focus:border-indigo-400 outline-none py-0.5 transition-colors"
          />
        </div>

        {/* priority */}
        <div className="flex items-center gap-3">
          <Star className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={task.priority}
            onChange={e => onPatch({ priority: e.target.value as TaskPriority })}
            disabled={!canManage}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-100 hover:border-slate-300 focus:border-indigo-400 outline-none py-0.5 transition-colors"
          >
            {PRIORITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* status */}
        <div className="flex items-center gap-3">
          <ListTodo className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={task.status}
            onChange={e => onPatch({ status: e.target.value as TaskStatus })}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-100 hover:border-slate-300 focus:border-indigo-400 outline-none py-0.5 transition-colors"
          >
            {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* description */}
        <div className="pt-1">
          <textarea
            value={task.description ?? ''}
            onChange={e => onPatch({ description: e.target.value || null })}
            onBlur={e => onPatch({ description: e.target.value || null })}
            disabled={!canManage}
            placeholder="Add a note…"
            rows={3}
            className="w-full text-sm text-slate-700 bg-slate-50 rounded-lg border border-slate-100 p-2.5 resize-none outline-none focus:border-indigo-300 focus:bg-white placeholder-slate-300 transition-colors"
          />
        </div>

        {/* meta footer */}
        <div className="text-[11px] text-slate-400 pt-1">
          Created by {task.created_by_name} · {timeAgo(task.created_at)}
          {task.completed_at && <span> · Done {timeAgo(task.completed_at)}</span>}
        </div>
      </div>

      {/* panel footer */}
      {canManage && (
        <div className="px-4 py-3 border-t border-slate-100">
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete task
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TaskModal (full create/edit) ─────────────────────────────────────────────

function TaskModal({ task, staff, projects, canAssignOthers, me, onClose, onSaved }: {
  task: Task | null; staff: { id: string; full_name: string; role: string }[];
  projects: { id: string; name: string }[]; canAssignOthers: boolean;
  me: { id: string; name: string }; onClose: () => void; onSaved: () => void;
}) {
  const selfIsStaff = staff.some(s => s.id === me.id);
  const defaultAssignee = task ? task.assignee_id
    : canAssignOthers ? (selfIsStaff ? me.id : (staff[0]?.id ?? ''))
    : me.id;

  const [title, setTitle]       = useState(task?.title ?? '');
  const [description, setDesc]  = useState(task?.description ?? '');
  const [assigneeId, setAssignee] = useState(defaultAssignee);
  const [projectId, setProject]   = useState(task?.project_id ?? '');
  const [priority, setPriority]   = useState<TaskPriority>(task?.priority ?? 'medium');
  const [status, setStatus]       = useState<TaskStatus>(task?.status ?? 'todo');
  const [dueDate, setDue]         = useState(task?.due_date ?? '');
  const [saving, setSaving]       = useState(false);

  const assigneeOptions = canAssignOthers
    ? [{ value: me.id, label: `${me.name} (me)` }, ...staff.filter(s => s.id !== me.id).map(s => ({ value: s.id, label: `${s.full_name} · ${s.role}` }))]
    : [{ value: me.id, label: `${me.name} (you)` }];

  const resolveName = (id: string) => staff.find(s => s.id === id)?.full_name ?? (id === me.id ? me.name : '');

  const submit = async () => {
    if (!title.trim() || !assigneeId) return;
    setSaving(true);
    const payload: TaskInput = {
      title, description: description || null,
      assignee_id: assigneeId, assignee_name: resolveName(assigneeId),
      project_id: projectId || null,
      project_name: projectId ? (projects.find(p => p.id === projectId)?.name ?? null) : null,
      priority, status, due_date: dueDate || null,
    };
    try {
      if (task) await updateTask(task.id, payload);
      else await createTask(payload, me);
      onSaved();
    } catch (e) { alert('Save failed: ' + (e as any).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={task ? 'Edit task' : 'New task'}>
      <div className="space-y-4">
        <Input label="Title *" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Finalise kitchen elevation" />
        <Textarea label="Description" rows={3} value={description} onChange={e => setDesc(e.target.value)} placeholder="Optional details…" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select label="Assignee" value={assigneeId} onChange={e => setAssignee(e.target.value)} options={assigneeOptions} disabled={!canAssignOthers} />
            {!canAssignOthers && <p className="text-[11px] text-slate-400 mt-1">Only the owner can assign to others.</p>}
          </div>
          <Select label="Project (optional)" value={projectId} onChange={e => setProject(e.target.value)}
            options={[{ value: '', label: '— None —' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Priority" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}
            options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
          <Input label="Due date" type="date" value={dueDate} onChange={e => setDue(e.target.value)} />
          {task && (
            <Select label="Status" value={status} onChange={e => setStatus(e.target.value as TaskStatus)}
              options={[{ value: 'todo', label: 'To do' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' }]} />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !title.trim() || !assigneeId}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── AssignersModal ───────────────────────────────────────────────────────────

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
        <p className="text-sm text-slate-500">Grant team members the right to assign tasks to others.</p>
        <div className="border border-slate-100 rounded-lg divide-y divide-slate-50">
          {staff.map(s => {
            const on = privileges.has(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Avatar name={s.full_name} size="sm" className="w-7 h-7 text-xs" />
                  <div>
                    <div className="text-sm font-medium text-slate-800">{s.full_name}</div>
                    <div className="text-xs text-slate-400 capitalize">{s.role}</div>
                  </div>
                </div>
                <button onClick={() => toggle(s.id, s.full_name, !on)} disabled={busy === s.id}
                  className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-indigo-600' : 'bg-slate-200')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
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
