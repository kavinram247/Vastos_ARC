// ─────────────────────────────────────────────────────────────
// Task Manager data access — team tasks for internal staff.
// Persisted in Supabase, firm-scoped. Assignee/creator/project reference the
// legacy in-memory profile/project ids as TEXT (mock auth — non-owner users
// don't exist as Supabase profiles yet).
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID } from './supabase';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  assignee_name: string;
  created_by_id: string;
  created_by_name: string;
  project_id: string | null;
  project_name: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
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
  due_date?: string | null;
}

export async function listTasks(firmId = DEMO_FIRM_ID): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select('*').eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as any as Task[];
}

export async function createTask(input: TaskInput, createdBy: { id: string; name: string }, firmId = DEMO_FIRM_ID): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert({
    firm_id: firmId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    assignee_id: input.assignee_id,
    assignee_name: input.assignee_name,
    created_by_id: createdBy.id,
    created_by_name: createdBy.name,
    project_id: input.project_id || null,
    project_name: input.project_name || null,
    status: input.status || 'todo',
    priority: input.priority || 'medium',
    due_date: input.due_date || null,
  } as any).select('*').single();
  if (error) throw error;
  return data as any as Task;
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  const fields: Record<string, any> = { updated_at: new Date().toISOString() };
  (['title', 'description', 'assignee_id', 'assignee_name', 'project_id', 'project_name', 'status', 'priority', 'due_date'] as const)
    .forEach((k) => { if (k in patch) fields[k] = (patch as any)[k]; });
  if ('status' in patch) fields.completed_at = patch.status === 'done' ? new Date().toISOString() : null;
  const { error } = await supabase.from('tasks').update(fields as any).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

/** Set of user ids the owner has granted "can assign to others" rights. */
export async function listAssignPrivileges(firmId = DEMO_FIRM_ID): Promise<Set<string>> {
  const { data, error } = await supabase.from('task_assign_privileges').select('user_id').eq('firm_id', firmId);
  if (error) throw error;
  return new Set(((data || []) as any[]).map((r) => r.user_id));
}

export async function setAssignPrivilege(
  userId: string, userName: string, granted: boolean, grantedBy: string, firmId = DEMO_FIRM_ID,
): Promise<void> {
  if (granted) {
    const { error } = await supabase.from('task_assign_privileges')
      .upsert({ firm_id: firmId, user_id: userId, user_name: userName, granted_by: grantedBy } as any, { onConflict: 'firm_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('task_assign_privileges').delete().eq('firm_id', firmId).eq('user_id', userId);
    if (error) throw error;
  }
}
