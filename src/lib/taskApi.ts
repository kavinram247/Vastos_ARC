// ─────────────────────────────────────────────────────────────
// Tasks data access — the operational task system for internal staff.
// Firm-scoped. Assignee / creator / project / CRM-link ids reference the
// legacy in-memory profile/project/lead/etc. ids as TEXT (mock auth —
// non-owner users don't exist as Supabase profiles yet).
//
// Phase 5, item 2.9: calls vastos-api instead of Supabase. Writes on
// tasks/task_lists/task_subtasks/task_activity go through the generic
// /api/data/:table layer (insertRow/updateRow/updateWhereRows/deleteRow in
// vastosApi.ts) — plain single-table CRUD, same as the leads module.
// task_assign_privileges needs upsert-on-conflict, which that generic layer
// doesn't have, so it gets two small dedicated endpoints instead. The five
// list*() reads are dedicated GET endpoints too (vastos-api's
// src/tasks/tasks.service.ts) — the generic layer has only ever supported
// get-one-by-id, never a filtered/ordered list. Every default-computation
// (WRITABLE merge, order_index, completed_at derivation) and the
// fire-and-forget activity-log side effect on create are unchanged, still
// entirely client-side; only the transport underneath moved.
//
// Model (migration 27_tasks_redesign):
//   tasks          — rich task rows (status/priority/dates/links/tags/notes…)
//   task_lists     — user-created lists (Sales, Site Visits, …)
//   task_subtasks  — checklist items
//   task_activity  — timeline entries + comments (kind='comment')
// ─────────────────────────────────────────────────────────────
import { vastosApiFetch, insertRow, updateRow, updateWhereRows, deleteRow } from './vastosApi';

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
    // Array.isArray, not ??: until vastos-api's jsonb fix (Phase 5 item 2.13)
    // new tasks were stored with attachments = {} (an object), which the
    // detail panel then .map()s and spreads.
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    progress: row.progress ?? 0,
    repeat: row.repeat ?? 'none',
    is_followup: !!row.is_followup,
  } as Task;
}

// ─── TASKS ───
export async function listTasks(_firmId: string): Promise<Task[]> {
  const rows = await vastosApiFetch<any[]>('/api/tasks');
  return rows.map(normalizeTask);
}

export async function createTask(
  input: TaskInput, createdBy: { id: string; name: string }, firmId: string,
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
  const data = await insertRow<any>('tasks', payload);
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
  await updateRow('tasks', id, fields);
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await updateRow('tasks', id, { archived_at: archived ? nowISO() : null, updated_at: nowISO() });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteRow('tasks', id);
}

/** Bulk status / list / priority / archive changes from the multi-select bar. */
export async function bulkUpdate(ids: string[], patch: Partial<TaskInput> & { archived_at?: string | null }): Promise<void> {
  if (!ids.length) return;
  const fields: Record<string, any> = { ...patch, updated_at: nowISO() };
  if ('status' in patch) fields.completed_at = patch.status === 'completed' ? nowISO() : null;
  await updateWhereRows('tasks', { id: ids }, fields);
}

// ─── LISTS ───
export async function listTaskLists(_firmId: string): Promise<TaskList[]> {
  return vastosApiFetch('/api/tasks/lists');
}

export async function createTaskList(
  input: { name: string; color?: string; icon?: string | null }, createdBy: string, firmId: string,
): Promise<TaskList> {
  return insertRow<TaskList>('task_lists', {
    firm_id: firmId, name: input.name.trim(), color: input.color || 'slate',
    icon: input.icon || null, order_index: Date.now() % 100000, created_by: createdBy,
  });
}

export async function updateTaskList(id: string, patch: Partial<Pick<TaskList, 'name' | 'color' | 'icon' | 'order_index'>>): Promise<void> {
  await updateRow('task_lists', id, patch);
}

export async function deleteTaskList(id: string): Promise<void> {
  // tasks.list_id is ON DELETE SET NULL → tasks survive, just unlinked.
  await deleteRow('task_lists', id);
}

// ─── SUBTASKS ───
export async function listSubtasks(_firmId: string): Promise<Subtask[]> {
  return vastosApiFetch('/api/tasks/subtasks');
}

export async function addSubtask(taskId: string, title: string, orderIndex: number, firmId: string): Promise<Subtask> {
  return insertRow<Subtask>('task_subtasks', {
    firm_id: firmId, task_id: taskId, title: title.trim(), order_index: orderIndex,
  });
}

export async function updateSubtask(id: string, patch: Partial<Pick<Subtask, 'title' | 'done' | 'order_index'>>): Promise<void> {
  await updateRow('task_subtasks', id, patch);
}

export async function deleteSubtask(id: string): Promise<void> {
  await deleteRow('task_subtasks', id);
}

// ─── ACTIVITY ───
export async function listActivity(taskId: string): Promise<TaskActivity[]> {
  return vastosApiFetch(`/api/tasks/activity/${taskId}`);
}

export async function logActivity(
  taskId: string, actor: { id: string; name: string }, kind: ActivityKind, detail: string | null, firmId: string,
): Promise<void> {
  await insertRow('task_activity', {
    firm_id: firmId, task_id: taskId, actor_id: actor.id, actor_name: actor.name, kind, detail,
  });
}

// ─── ASSIGN PRIVILEGES (carried over) ───
export async function listAssignPrivileges(_firmId: string): Promise<Set<string>> {
  const userIds = await vastosApiFetch<string[]>('/api/tasks/assign-privileges');
  return new Set(userIds);
}

export async function setAssignPrivilege(
  userId: string, userName: string, granted: boolean, grantedBy: string, _firmId: string,
): Promise<void> {
  if (granted) {
    await vastosApiFetch('/api/tasks/assign-privileges', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, grantedBy }),
    });
  } else {
    await vastosApiFetch(`/api/tasks/assign-privileges/${userId}`, { method: 'DELETE' });
  }
}
