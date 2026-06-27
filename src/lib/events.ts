// ─────────────────────────────────────────────────────────────
// Event backbone — the workspace "nervous system". emitEvent() appends to the
// unified activity timeline AND fans out in-app notifications to the right
// people per routing rules. Called from flows/pages (not the store) to avoid a
// circular dependency (events imports store; store does not import events).
// ─────────────────────────────────────────────────────────────
import { store } from '../data/store';
import type { Page } from '../types';

export type EventType =
  | 'lead_won' | 'project_created'
  | 'milestone_completed' | 'milestone_delayed'
  | 'payment_due' | 'payment_received'
  | 'site_update_posted' | 'document_shared' | 'comment_posted';

const NOTIF_TYPE: Record<EventType, 'info' | 'success' | 'warning' | 'error'> = {
  lead_won: 'success', project_created: 'success', milestone_completed: 'success',
  milestone_delayed: 'warning', payment_due: 'warning', payment_received: 'success',
  site_update_posted: 'info', document_shared: 'info', comment_posted: 'info',
};

export interface EmitArgs {
  type: EventType;
  firmId: string;
  actorId: string;
  projectId?: string;
  title: string;
  message?: string;
  link?: string;              // serialized via linkTo(): "page" or "page|projectId"
  module: string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
}

/** Serialize a deep link for a notification. */
export function linkTo(page: Page, projectId?: string): string {
  return projectId ? `${page}|${projectId}` : page;
}
export function parseLink(link?: string | null): { page: Page; projectId?: string } | null {
  if (!link) return null;
  const [page, projectId] = link.split('|');
  return { page: page as Page, projectId: projectId || undefined };
}

/** Who should be notified for an event (deduped, actor excluded). */
function recipients(type: EventType, firmId: string, projectId: string | undefined, actorId: string): string[] {
  const d = store.forFirm(firmId);
  const owners = store.adminUserIds(firmId);
  const project = projectId ? d.projects.find(p => p.id === projectId) : undefined;
  const client = project?.client_id ? [project.client_id] : [];
  const team = projectId ? d.assignments.filter(a => a.project_id === projectId).map(a => a.user_id) : [];

  let set: string[];
  switch (type) {
    case 'lead_won':
    case 'project_created': set = owners; break;
    case 'milestone_completed': set = [...client, ...team]; break;
    case 'milestone_delayed': set = [...owners, ...client]; break;
    case 'payment_due': set = client; break;
    case 'payment_received': set = [...client, ...owners]; break;
    case 'site_update_posted':
    case 'document_shared': set = client; break;
    case 'comment_posted': set = [...client, ...team, ...owners]; break;
    default: set = owners;
  }
  return [...new Set(set)].filter(id => id && id !== actorId);
}

/** Append to the activity timeline and fan out notifications. */
export function emitEvent(args: EmitArgs) {
  store.addActivityLog({
    firm_id: args.firmId,
    user_id: args.actorId,
    action: args.action as any,
    action_label: args.title,
    module: args.module as any,
    entity_type: args.entityType || args.module,
    entity_id: args.entityId || '',
    entity_name: args.entityName,
    details: args.message || args.title,
  });
  for (const uid of recipients(args.type, args.firmId, args.projectId, args.actorId)) {
    store.addNotification({
      firm_id: args.firmId,
      user_id: uid,
      title: args.title,
      message: args.message || '',
      type: NOTIF_TYPE[args.type],
      read: false,
      link: args.link,
    });
  }
}

/** Audit-log a role / permission / user-management change (no notification fan-out). */
export function logAdminAction(args: {
  firmId: string;
  actorId: string;
  action: string;            // 'created' | 'updated' | 'deleted' | 'assigned' | 'status_changed' | …
  actionLabel: string;
  module: 'role' | 'permission' | 'user' | 'marketing';
  entityId?: string;
  entityName?: string;
  previousValue?: string;
  updatedValue?: string;
  details?: string;
}) {
  store.addActivityLog({
    firm_id: args.firmId,
    user_id: args.actorId,
    action: args.action as any,
    action_label: args.actionLabel,
    module: args.module as any,
    entity_type: args.module,
    entity_id: args.entityId || '',
    entity_name: args.entityName,
    previous_value: args.previousValue,
    updated_value: args.updatedValue,
    details: args.details,
  });
}
