// ─────────────────────────────────────────────────────────────
// Tasks data access — the operational task system for internal staff.
// Supabase-backed, firm-scoped. Assignee / creator / project / CRM-link ids
// reference the legacy in-memory profile/project/lead/etc. ids as TEXT (mock
// auth — non-owner users don't exist as Supabase profiles yet).
//
// Model (migration 27_tasks_redesign):
//   tasks          — rich task rows (status/priority/dates/links/tags/notes…)
//   task_lists     — user-created lists (Sales, Site Visits, …)
//   task_subtasks  — checklist items
//   task_activity  — timeline entries + comments (kind='comment')
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID } from './supabase';

export type TaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskRepeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

/** Polymorphic CRM link types a task can attach to. */
export type TaskLinkType =
  | 'lead' | 'client' | 'project' | 'boq' | 'quotation'
  | 'vendor' | 'site_visit' | 'purchase' | 'invoice' | 'general';

export interface TaskAttachment {
  name: string;
  url: string;
  added_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  assignee_name: string;
  created_by_id: string;
  created_by_name: string;
  // canonical project link (kept for back-compat + fast project filtering)
  project_id: string | null;
  project_name: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  reminder_at: string | null;
  repeat: TaskRepeat;
  tags: string[];
  notes: string | null;
  attachments: TaskAttachment[];
  list_id: string | null;
  // polymorphic CRM link
  link_type: TaskLinkType | null;
  link_id: string | null;
  link_label: string | null;
  is_followup: boolean;
  progress: number;
  order_index: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  assignee_id: string;
  assignee_name: string;
  project_id?: string | null;
  project_name?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
  reminder_at?: string | null;
  repeat?: TaskRepeat;
  tags?: string[];
  notes?: string | null;
  attachments?: TaskAttachment[];
  list_id?: string | null;
  link_type?: TaskLinkType | null;
  link_id?: string | null;
  link_label?: string | null;
  is_followup?: boolean;
  progress?: number;
}

export interface TaskList {
  id: string;
  firm_id: string;
  name: string;
  color: string;
  icon: string | null;
  order_index: number;
  created_by: string | null;
  created_at: string;
}

export interface Subtask {
  id: string;
  firm_id: string;
  task_id: string;
  title: string;
  done: boolean;
  order_index: number;
  created_at: string;
}

export type ActivityKind =
  | 'created' | 'updated' | 'status' | 'assigned' | 'completed'
  | 'reopened' | 'comment' | 'linked' | 'scheduled';

export interface TaskActivity {
  id: string;
  firm_id: string;
  task_id: string;
  actor_id: string | null;
  actor_name: string | null;
  kind: ActivityKind;
  detail: string | null;
  created_at: string;
}

const nowISO = () => new Date().toISOString();

// The columns the client writes (keeps insert/update payloads consistent).
const WRITABLE = [
  'title', 'description', 'assignee_id', 'assignee_name', 'project_id', 'project_name',
  'status', 'priority', 'start_date', 'due_date', 'reminder_at', 'repeat', 'tags',
  'notes', 'attachments', 'list_id', 'link_type', 'link_id', 'link_label',
  'is_followup', 'progress',
] as const;

function normalizeTask(row: any): Task {
  return {
    ...row,
    tags: row.tags ?? [],
    attachments: row.attachments ?? [],
    progress: row.progress ?? 0,
    repeat: row.repeat ?? 'none',
    is_followup: !!row.is_followup,
  } as Task;
}

// ─── TASKS ───
export async function listTasks(firmId = DEMO_FIRM_ID): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks').select('*').eq('firm_id', firmId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeTask);
}

export async function createTask(
  input: TaskInput, createdBy: { id: string; name: string }, firmId = DEMO_FIRM_ID,
): Promise<Task> {
  const payload: Record<string, any> = {
    firm_id: firmId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assignee_id: input.assignee_id,
    assignee_name: input.assignee_name,
    created_by_id: createdBy.id,
    created_by_name: createdBy.name,
    status: input.status || 'not_started',
    priority: input.priority || 'medium',
    repeat: input.repeat || 'none',
    tags: input.tags || [],
    attachments: input.attachments || [],
    is_followup: input.is_followup ?? false,
    progress: input.progress ?? 0,
    order_index: Date.now(),
  };
  for (const k of WRITABLE) {
    if (k in input && payload[k] === undefined) payload[k] = (input as any)[k] ?? null;
  }
  // ensure optional scalars are present (null when omitted)
  for (const k of ['project_id', 'project_name', 'start_date', 'due_date', 'reminder_at',
    'notes', 'list_id', 'link_type', 'link_id', 'link_label'] as const) {
    if (payload[k] === undefined) payload[k] = (input as any)[k] ?? null;
  }
  const { data, error } = await supabase.from('tasks').insert(payload as any).select('*').single();
  if (error) throw error;
  const task = normalizeTask(data);
  logActivity(task.id, createdBy, 'created', input.title.trim(), firmId).catch(() => {});
  return task;
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  const fields: Record<string, any> = { updated_at: nowISO() };
  for (const k of WRITABLE) if (k in patch) fields[k] = (patch as any)[k];
  if ('status' in patch) {
    fields.completed_at = patch.status === 'completed' ? nowISO() : null;
    if (patch.status === 'completed' && patch.progress === undefined) fields.progress = 100;
  }
  const { error } = await supabase.from('tasks').update(fields as any).eq('id', id);
  if (error) throw error;
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('tasks')
    .update({ archived_at: archived ? nowISO() : null, updated_at: nowISO() } as any).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

/** Bulk status / list / priority / archive changes from the multi-select bar. */
export async function bulkUpdate(ids: string[], patch: Partial<TaskInput> & { archived_at?: string | null }): Promise<void> {
  if (!ids.length) return;
  const fields: Record<string, any> = { ...patch, updated_at: nowISO() };
  if ('status' in patch) fields.completed_at = patch.status === 'completed' ? nowISO() : null;
  const { error } = await supabase.from('tasks').update(fields as any).in('id', ids);
  if (error) throw error;
}

// ─── LISTS ───
export async function listTaskLists(firmId = DEMO_FIRM_ID): Promise<TaskList[]> {
  const { data, error } = await supabase
    .from('task_lists').select('*').eq('firm_id', firmId).order('order_index', { ascending: true });
  if (error) throw error;
  return (data || []) as any as TaskList[];
}

export async function createTaskList(
  input: { name: string; color?: string; icon?: string | null }, createdBy: string, firmId = DEMO_FIRM_ID,
): Promise<TaskList> {
  const { data, error } = await supabase.from('task_lists').insert({
    firm_id: firmId, name: input.name.trim(), color: input.color || 'slate',
    icon: input.icon || null, order_index: Date.now() % 100000, created_by: createdBy,
  } as any).select('*').single();
  if (error) throw error;
  return data as any as TaskList;
}

export async function updateTaskList(id: string, patch: Partial<Pick<TaskList, 'name' | 'color' | 'icon' | 'order_index'>>): Promise<void> {
  const { error } = await supabase.from('task_lists').update(patch as any).eq('id', id);
  if (error) throw error;
}

export async function deleteTaskList(id: string): Promise<void> {
  // tasks.list_id is ON DELETE SET NULL → tasks survive, just unlinked.
  const { error } = await supabase.from('task_lists').delete().eq('id', id);
  if (error) throw error;
}

// ─── SUBTASKS ───
export async function listSubtasks(firmId = DEMO_FIRM_ID): Promise<Subtask[]> {
  const { data, error } = await supabase
    .from('task_subtasks').select('*').eq('firm_id', firmId).order('order_index', { ascending: true });
  if (error) throw error;
  return (data || []) as any as Subtask[];
}

export async function addSubtask(taskId: string, title: string, orderIndex: number, firmId = DEMO_FIRM_ID): Promise<Subtask> {
  const { data, error } = await supabase.from('task_subtasks').insert({
    firm_id: firmId, task_id: taskId, title: title.trim(), order_index: orderIndex,
  } as any).select('*').single();
  if (error) throw error;
  return data as any as Subtask;
}

export async function updateSubtask(id: string, patch: Partial<Pick<Subtask, 'title' | 'done' | 'order_index'>>): Promise<void> {
  const { error } = await supabase.from('task_subtasks').update(patch as any).eq('id', id);
  if (error) throw error;
}

export async function deleteSubtask(id: string): Promise<void> {
  const { error } = await supabase.from('task_subtasks').delete().eq('id', id);
  if (error) throw error;
}

// ─── ACTIVITY ───
export async function listActivity(taskId: string): Promise<TaskActivity[]> {
  const { data, error } = await supabase
    .from('task_activity').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as any as TaskActivity[];
}

export async function logActivity(
  taskId: string, actor: { id: string; name: string }, kind: ActivityKind, detail: string | null, firmId = DEMO_FIRM_ID,
): Promise<void> {
  const { error } = await supabase.from('task_activity').insert({
    firm_id: firmId, task_id: taskId, actor_id: actor.id, actor_name: actor.name, kind, detail,
  } as any);
  if (error) throw error;
}

// ─── ASSIGN PRIVILEGES (carried over) ───
export async function listAssignPrivileges(firmId = DEMO_FIRM_ID): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('task_assign_privileges').select('user_id').eq('firm_id', firmId);
  if (error) throw error;
  return new Set(((data || []) as any[]).map((r) => r.user_id));
}

export async function setAssignPrivilege(
  userId: string, userName: string, granted: boolean, grantedBy: string, firmId = DEMO_FIRM_ID,
): Promise<void> {
  if (granted) {
    const { error } = await supabase.from('task_assign_privileges')
      .upsert({ firm_id: firmId, user_id: userId, user_name: userName, granted_by: grantedBy } as any,
        { onConflict: 'firm_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('task_assign_privileges')
      .delete().eq('firm_id', firmId).eq('user_id', userId);
    if (error) throw error;
  }
}
