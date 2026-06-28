// ─────────────────────────────────────────────────────────────
// Pure task logic — smart-view predicates, grouping, sorting, filtering, and
// the label/colour/icon metadata shared across the Tasks UI. No React, no IO.
// ─────────────────────────────────────────────────────────────
import {
  CalendarDays, CalendarClock, AlertTriangle, Flag, UserCircle, PhoneCall,
  FolderKanban, User, CheckCircle2, Inbox, type LucideIcon,
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskLinkType } from '../lib/taskApi';

// ── date helpers (local-day, not UTC) ──
export const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isActive = (t: Task) => t.status !== 'completed' && t.status !== 'cancelled';
export const isOverdue = (t: Task): boolean => !!t.due_date && isActive(t) && t.due_date < todayStr();
export const isDueToday = (t: Task): boolean => !!t.due_date && isActive(t) && t.due_date === todayStr();

/** Human due-date label + urgency tone. */
export function dueMeta(due: string | null, status: TaskStatus): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } | null {
  if (!due) return null;
  const today = todayStr();
  const active = status !== 'completed' && status !== 'cancelled';
  const d = new Date(due + 'T00:00:00');
  const diff = Math.round((d.getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
  const base = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (diff < 0) return { label: active ? `${base} · ${Math.abs(diff)}d overdue` : base, tone: active ? 'overdue' : 'normal' };
  if (diff === 0) return { label: 'Today', tone: active ? 'today' : 'normal' };
  if (diff === 1) return { label: 'Tomorrow', tone: active ? 'soon' : 'normal' };
  if (diff <= 6) return { label: d.toLocaleDateString('en-IN', { weekday: 'long' }), tone: 'normal' };
  return { label: base, tone: 'normal' };
}

// ── status metadata ──
export const STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'waiting', 'completed', 'cancelled'];
export const STATUS_META: Record<TaskStatus, { label: string; dot: string; chip: string }> = {
  not_started: { label: 'Not started', dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In progress', dot: 'bg-indigo-500',  chip: 'bg-indigo-50 text-indigo-700' },
  waiting:     { label: 'Waiting',     dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700' },
  completed:   { label: 'Completed',   dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  cancelled:   { label: 'Cancelled',   dot: 'bg-slate-300',   chip: 'bg-slate-100 text-slate-400 line-through' },
};

// ── priority metadata (Critical → Low) ──
export const PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
export const PRIORITY_META: Record<TaskPriority, { label: string; rank: number; flag: string; chip: string; bar: string }> = {
  critical: { label: 'Critical', rank: 0, flag: 'text-red-600',    chip: 'bg-red-50 text-red-700',       bar: 'bg-red-500' },
  high:     { label: 'High',     rank: 1, flag: 'text-amber-600',  chip: 'bg-amber-50 text-amber-700',   bar: 'bg-amber-500' },
  medium:   { label: 'Medium',   rank: 2, flag: 'text-indigo-600', chip: 'bg-indigo-50 text-indigo-700', bar: 'bg-indigo-400' },
  low:      { label: 'Low',      rank: 3, flag: 'text-slate-400',  chip: 'bg-slate-100 text-slate-500',  bar: 'bg-slate-300' },
};

// ── CRM link metadata ──
export const LINK_META: Record<TaskLinkType, { label: string; icon: LucideIcon; tone: string }> = {
  lead:       { label: 'Lead',       icon: UserCircle,   tone: 'text-violet-600' },
  client:     { label: 'Client',     icon: User,         tone: 'text-sky-600' },
  project:    { label: 'Project',    icon: FolderKanban, tone: 'text-indigo-600' },
  boq:        { label: 'BOQ',        icon: FolderKanban, tone: 'text-emerald-600' },
  quotation:  { label: 'Quotation',  icon: FolderKanban, tone: 'text-amber-600' },
  vendor:     { label: 'Vendor',     icon: FolderKanban, tone: 'text-orange-600' },
  site_visit: { label: 'Site visit', icon: CalendarClock,tone: 'text-rose-600' },
  purchase:   { label: 'Purchase',   icon: FolderKanban, tone: 'text-teal-600' },
  invoice:    { label: 'Invoice',    icon: FolderKanban, tone: 'text-slate-600' },
  general:    { label: 'General',    icon: Inbox,        tone: 'text-slate-500' },
};

// ── smart views ──
export type SmartViewId =
  | 'today' | 'upcoming' | 'overdue' | 'important' | 'assigned_to_me'
  | 'followups' | 'project_tasks' | 'personal' | 'completed' | 'all';

export interface SmartView {
  id: SmartViewId;
  label: string;
  icon: LucideIcon;
  accent: string;   // text colour for the icon
  /** predicate over a task; `me` = current user id. */
  match: (t: Task, me: string) => boolean;
  /** completed/cancelled tasks are excluded by default unless this is true. */
  includesDone?: boolean;
}

const SOON_DAYS = 7;
export const SMART_VIEWS: SmartView[] = [
  { id: 'today',          label: 'Today',        icon: CalendarDays,  accent: 'text-indigo-600',
    match: (t) => isDueToday(t) || isOverdue(t) },
  { id: 'upcoming',       label: 'Upcoming',     icon: CalendarClock, accent: 'text-sky-600',
    match: (t) => { const today = todayStr(); return isActive(t) && !!t.due_date && t.due_date > today && t.due_date <= addDays(today, SOON_DAYS); } },
  { id: 'overdue',        label: 'Overdue',      icon: AlertTriangle, accent: 'text-red-600',
    match: (t) => isOverdue(t) },
  { id: 'important',      label: 'Important',    icon: Flag,          accent: 'text-amber-600',
    match: (t) => isActive(t) && (t.priority === 'critical' || t.priority === 'high') },
  { id: 'assigned_to_me', label: 'Assigned to me', icon: UserCircle,  accent: 'text-violet-600',
    match: (t, me) => isActive(t) && t.assignee_id === me },
  { id: 'followups',      label: 'Follow-ups',   icon: PhoneCall,     accent: 'text-rose-600',
    match: (t) => isActive(t) && t.is_followup },
  { id: 'project_tasks',  label: 'Project tasks', icon: FolderKanban, accent: 'text-emerald-600',
    match: (t) => isActive(t) && (!!t.project_id || t.link_type === 'project') },
  { id: 'personal',       label: 'Personal',     icon: User,          accent: 'text-teal-600',
    match: (t, me) => isActive(t) && !t.project_id && !t.list_id && (!t.link_type || t.link_type === 'general') && t.created_by_id === me && t.assignee_id === me },
  { id: 'completed',      label: 'Completed',    icon: CheckCircle2,  accent: 'text-slate-500',
    match: (t) => t.status === 'completed', includesDone: true },
  { id: 'all',            label: 'All tasks',    icon: Inbox,         accent: 'text-slate-500',
    match: () => true, includesDone: true },
];
export const SMART_VIEW_BY_ID: Record<string, SmartView> = Object.fromEntries(SMART_VIEWS.map((v) => [v.id, v]));

// ── filtering / sorting / grouping ──
export interface TaskFilters {
  search: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  assignee: string;       // user id
  linkType: TaskLinkType | '';
  tag: string;
}
export const EMPTY_FILTERS: TaskFilters = { search: '', status: '', priority: '', assignee: '', linkType: '', tag: '' };

export type SortKey = 'manual' | 'due' | 'priority' | 'created' | 'title' | 'status';
export type GroupKey = 'none' | 'status' | 'priority' | 'due' | 'assignee' | 'list';

export function filterTasks(tasks: Task[], f: TaskFilters): Task[] {
  const q = f.search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (f.status && t.status !== f.status) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.assignee && t.assignee_id !== f.assignee) return false;
    if (f.linkType && t.link_type !== f.linkType) return false;
    if (f.tag && !t.tags.includes(f.tag)) return false;
    if (q) {
      const hay = `${t.title} ${t.description ?? ''} ${t.notes ?? ''} ${t.link_label ?? ''} ${t.project_name ?? ''} ${t.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

const dueSortVal = (t: Task) => (t.due_date ? new Date(t.due_date).getTime() : Number.MAX_SAFE_INTEGER);

export function sortTasks(tasks: Task[], key: SortKey): Task[] {
  const out = [...tasks];
  switch (key) {
    case 'due':      out.sort((a, b) => dueSortVal(a) - dueSortVal(b)); break;
    case 'priority': out.sort((a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || dueSortVal(a) - dueSortVal(b)); break;
    case 'created':  out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    case 'title':    out.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'status':   out.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)); break;
    case 'manual':
    default:         out.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)); break;
  }
  return out;
}

export interface TaskGroup { key: string; label: string; tasks: Task[]; tone?: string; }

export function groupTasks(
  tasks: Task[], key: GroupKey,
  ctx: { lists: { id: string; name: string }[]; staffName: (id: string) => string },
): TaskGroup[] {
  if (key === 'none') return [{ key: 'all', label: '', tasks }];

  const groups = new Map<string, TaskGroup>();
  const push = (gk: string, label: string, t: Task, tone?: string) => {
    if (!groups.has(gk)) groups.set(gk, { key: gk, label, tasks: [], tone });
    groups.get(gk)!.tasks.push(t);
  };

  for (const t of tasks) {
    if (key === 'status') push(t.status, STATUS_META[t.status].label, t, STATUS_META[t.status].dot);
    else if (key === 'priority') push(t.priority, PRIORITY_META[t.priority].label, t, PRIORITY_META[t.priority].bar);
    else if (key === 'assignee') push(t.assignee_id, ctx.staffName(t.assignee_id) || t.assignee_name || 'Unassigned', t);
    else if (key === 'list') {
      const gk = t.list_id ?? '__none';
      push(gk, t.list_id ? (ctx.lists.find((l) => l.id === t.list_id)?.name ?? 'List') : 'No list', t);
    } else if (key === 'due') {
      const today = todayStr();
      if (isOverdue(t)) push('overdue', 'Overdue', t, 'bg-red-500');
      else if (!t.due_date) push('none', 'No date', t);
      else if (t.due_date === today) push('today', 'Today', t, 'bg-indigo-500');
      else if (t.due_date <= addDays(today, SOON_DAYS)) push('week', 'Next 7 days', t, 'bg-sky-500');
      else push('later', 'Later', t);
    }
  }

  // stable ordering of the groups themselves
  const order: Record<GroupKey, string[]> = {
    status: STATUSES,
    priority: PRIORITIES,
    due: ['overdue', 'today', 'week', 'later', 'none'],
    assignee: [], list: [], none: [],
  };
  const seq = order[key];
  return [...groups.values()].sort((a, b) => {
    const ia = seq.indexOf(a.key); const ib = seq.indexOf(b.key);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.label.localeCompare(b.label);
  });
}

/** Next occurrence date for a repeating task, from a base ISO date. */
export function nextRepeatDate(base: string, repeat: Task['repeat']): string | null {
  if (repeat === 'none') return null;
  if (repeat === 'daily') return addDays(base, 1);
  if (repeat === 'weekly') return addDays(base, 7);
  if (repeat === 'weekdays') {
    let d = addDays(base, 1);
    const dow = new Date(d + 'T00:00:00').getDay();
    if (dow === 6) d = addDays(d, 2);      // Sat → Mon
    else if (dow === 0) d = addDays(d, 1); // Sun → Mon
    return d;
  }
  if (repeat === 'monthly') {
    const d = new Date(base + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}
