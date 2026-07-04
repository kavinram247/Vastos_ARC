// ─────────────────────────────────────────────────────────────
// RBAC catalog + permission helpers — the single source of truth for which
// modules and actions exist. Roles and their grants are DATA (crm_roles /
// crm_role_permissions, hydrated into the store); this file only declares the
// fixed catalog (modules map to code pages) and pure lookup helpers over the
// store's `roles` / `rolePermissions` arrays.
//
// Backend note: enforcement is layered. The app gates every nav item, page, and
// action with can()/canAccess(); Postgres RLS additionally consults
// crm_has_permission() using the `x-crm-role-id` request header the app stamps
// after login (see supabase.ts → setRoleContext). Under the shared anon key that
// header is spoofable, so it is defense-in-depth only. Production hardening:
// drop the *_anon_dev policies and switch crm_has_permission to resolve the role
// from auth.uid() once real Supabase Auth is wired.
// ─────────────────────────────────────────────────────────────
import {
  LayoutDashboard, TrendingUp, FolderKanban, ListChecks, CalendarCheck,
  Calculator, Receipt, Truck, Database, Target, Users, ShieldCheck, Bell, Activity,
  Home, Milestone as MilestoneIcon, Wallet, IndianRupee, FileText, MessageSquare, Camera, BarChart3, Settings, ShoppingBag,
} from 'lucide-react';
import type { Page } from '../types';
import { store } from '../data/store';

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'assign', 'import', 'export', 'approve'] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<Action, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
  assign: 'Assign', import: 'Import', export: 'Export', approve: 'Approve',
};

export type NavGroupName = 'Workspace' | 'Commercial' | 'Admin';
export const NAV_GROUPS: NavGroupName[] = ['Workspace', 'Commercial', 'Admin'];

export interface ModuleDef {
  key: string;
  label: string;
  /** Sidebar group, or null for project sub-pages / non-nav modules. */
  group: NavGroupName | null;
  /** Page this module gates (used by the router guard + nav). */
  page: Page;
  /** Whether it appears in the sidebar. */
  nav: boolean;
  icon: React.ElementType;
  /** Actions that are meaningful for this module (drives the permission matrix). */
  actions: Action[];
}

// Keep `module` keys + `actions` in sync with the seed in crm_role_permissions.
export const MODULES: ModuleDef[] = [
  { key: 'dashboard',     label: 'Dashboard',       group: 'Workspace',  page: 'dashboard',       nav: true,  icon: LayoutDashboard, actions: ['view'] },
  { key: 'leads',         label: 'Leads',           group: 'Workspace',  page: 'leads',           nav: true,  icon: TrendingUp,      actions: ['view', 'create', 'edit', 'delete', 'assign', 'import', 'export'] },
  { key: 'projects',      label: 'Projects',        group: 'Workspace',  page: 'projects',        nav: true,  icon: FolderKanban,    actions: ['view', 'create', 'edit', 'delete', 'assign', 'export'] },
  { key: 'tasks',         label: 'Tasks',           group: 'Workspace',  page: 'tasks',           nav: true,  icon: ListChecks,      actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { key: 'attendance',    label: 'Attendance',      group: 'Workspace',  page: 'attendance',      nav: true,  icon: CalendarCheck,   actions: ['view', 'create', 'edit', 'export'] },
  { key: 'client-portal', label: 'Overview',        group: 'Workspace',  page: 'client-portal',   nav: true,  icon: Home,            actions: ['view'] },

  { key: 'marketing',     label: 'Marketing',       group: 'Commercial', page: 'marketing',       nav: true,  icon: BarChart3,       actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'purchase',      label: 'Purchase',        group: 'Commercial', page: 'purchase',        nav: true,  icon: ShoppingBag,     actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
  { key: 'boq',           label: 'BOQ Estimator',   group: 'Commercial', page: 'boq',             nav: true,  icon: Calculator,      actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
  { key: 'quotations',    label: 'Quotations',      group: 'Commercial', page: 'quotations',      nav: true,  icon: Receipt,         actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
  { key: 'vendors',       label: 'Vendors',         group: 'Commercial', page: 'vendors',         nav: true,  icon: Truck,           actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'catalog',       label: 'Catalog & Rates', group: 'Commercial', page: 'catalog',         nav: true,  icon: Database,        actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'calibration',   label: 'Accuracy',        group: 'Commercial', page: 'calibration',     nav: true,  icon: Target,          actions: ['view', 'edit'] },

  { key: 'leads-admin',   label: 'Leads Admin',     group: 'Admin',       page: 'leads-admin',     nav: true,  icon: Settings,        actions: ['view', 'edit'] },
  { key: 'users',         label: 'Users',           group: 'Admin',       page: 'user-management', nav: true,  icon: Users,           actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { key: 'roles',         label: 'Roles & Access',  group: 'Admin',       page: 'roles',           nav: true,  icon: ShieldCheck,     actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'notifications', label: 'Notifications',   group: 'Admin',       page: 'notifications',   nav: true,  icon: Bell,            actions: ['view'] },
  { key: 'activity-log',  label: 'Activity Log',    group: 'Admin',       page: 'activity-log',    nav: true,  icon: Activity,        actions: ['view', 'export'] },

  // Project sub-pages — permissioned but not in the sidebar.
  { key: 'milestones',    label: 'Milestones',      group: null,         page: 'milestones',      nav: false, icon: MilestoneIcon,   actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'payments',      label: 'Payments',        group: null,         page: 'payments',        nav: false, icon: Wallet,          actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
  { key: 'costs',         label: 'Costs',           group: null,         page: 'costs',           nav: false, icon: IndianRupee,     actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'documents',     label: 'Documents',       group: null,         page: 'documents',       nav: false, icon: FileText,        actions: ['view', 'create', 'edit', 'delete', 'import', 'export'] },
  { key: 'comments',      label: 'Comments',        group: null,         page: 'comments',        nav: false, icon: MessageSquare,   actions: ['view', 'create', 'delete'] },
  { key: 'site-updates',  label: 'Site Updates',    group: null,         page: 'site-updates',    nav: false, icon: Camera,          actions: ['view', 'create', 'edit', 'delete'] },
];

export const MODULE_BY_KEY: Record<string, ModuleDef> = Object.fromEntries(MODULES.map(m => [m.key, m]));

// Pages that aren't 1:1 with a module map here; everything else falls back to a
// module whose `page` equals the page id.
const PAGE_TO_MODULE_OVERRIDE: Partial<Record<Page, string>> = {
  'project-detail': 'projects',
  'leads-admin': 'leads', // pipeline-stage admin; page additionally requires can('leads','edit')
  'marketing-connect': 'marketing',
  'login': 'dashboard',
};

export function pageToModule(page: Page): string {
  if (PAGE_TO_MODULE_OVERRIDE[page]) return PAGE_TO_MODULE_OVERRIDE[page]!;
  const m = MODULES.find(mod => mod.page === page);
  return m ? m.key : page;
}

// ── pure lookups over the hydrated store ──
export function roleById(roleId?: string | null) {
  return roleId ? store.roles.find(r => r.id === roleId) : undefined;
}

/** Map of module → granted actions for a role (admin gets everything). */
export function permissionsForRole(roleId?: string | null): Record<string, Action[]> {
  const role = roleById(roleId);
  if (!role) return {};
  if (role.is_admin) return Object.fromEntries(MODULES.map(m => [m.key, [...m.actions]]));
  const out: Record<string, Action[]> = {};
  for (const rp of store.rolePermissions) {
    if (rp.role_id === roleId) out[rp.module] = (rp.actions || []) as Action[];
  }
  return out;
}

export function can(roleId: string | null | undefined, module: string, action: Action): boolean {
  const role = roleById(roleId);
  if (!role || !role.enabled) return false;
  if (role.is_admin) return true;
  const rp = store.rolePermissions.find(p => p.role_id === roleId && p.module === module);
  return !!rp && (rp.actions || []).includes(action);
}

export function canAccess(roleId: string | null | undefined, module: string): boolean {
  return can(roleId, module, 'view');
}
