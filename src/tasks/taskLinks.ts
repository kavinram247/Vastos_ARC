// ─────────────────────────────────────────────────────────────
// CRM link sources + navigation. Bridges a task's polymorphic link
// (link_type/link_id/link_label) to the in-memory store and the app router.
// ─────────────────────────────────────────────────────────────
import type { store } from '../data/store';
import type { Task, TaskLinkType } from '../lib/taskApi';
import type { Page } from '../types';

type StoreLike = typeof store;

export interface LinkOption { id: string; label: string; sub?: string; }

/** Link types that resolve to a searchable entity picker (vs. free-text label). */
export const PICKABLE_LINK_TYPES: TaskLinkType[] = ['project', 'lead', 'client', 'vendor'];

/** Entities the user can attach for a given link type, from live store data. */
export function linkOptions(store: StoreLike, type: TaskLinkType, firmId: string): LinkOption[] {
  switch (type) {
    case 'project':
      return store.projects.filter((p) => p.firm_id === firmId)
        .map((p) => ({ id: p.id, label: p.name, sub: p.status.replace('_', ' ') }));
    case 'lead':
      return store.leads.filter((l) => l.firm_id === firmId)
        .map((l) => ({ id: l.id, label: l.client_name, sub: l.project_type }));
    case 'client':
      return store.profiles.filter((p) => p.firm_id === firmId && p.role === 'client')
        .map((p) => ({ id: p.id, label: p.full_name, sub: p.email }));
    case 'vendor':
      return store.projectVendors.filter((v) => v.firm_id === firmId)
        .map((v) => ({ id: v.id, label: v.company_name, sub: v.category }));
    default:
      return [];
  }
}

/** Router destination for opening a linked record, or null if not navigable. */
export function linkNavTarget(task: Pick<Task, 'link_type' | 'link_id' | 'project_id'>): { page: Page; projectId?: string } | null {
  if (task.link_type === 'project' && task.link_id) return { page: 'project-detail', projectId: task.link_id };
  if (task.project_id) return { page: 'project-detail', projectId: task.project_id };
  if (task.link_type === 'lead') return { page: 'leads' };
  if (task.link_type === 'vendor') return { page: 'vendors' };
  return null;
}
