import { v4 as uuid } from 'uuid';
import type {
  Firm, Profile, Project, ProjectAssignment, Milestone,
  SiteUpdate, PaymentPlan, PaymentSplit, PaymentReceived,
  CostEntry, Comment, Notification, ActivityLog,
  Lead, LeadInteraction, LeadQuotation, ProjectDocument, ProjectVendor,
  Contact, PipelineStage, FeatureFlag, CommChannel,
  Role, RolePermission, RoleScope
} from '../types';
import type { DashboardLayout } from '../leads/dashboard/types';
import { firms as initialFirms } from './mockData';
import { DEMO_FIRM_ID } from '../lib/supabase';
import * as crm from '../lib/crmApi';

function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

const nowISO = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().split('T')[0];

// Supabase-backed store. Reads stay synchronous (hydrated into in-memory arrays
// on init); mutations update locally + notify immediately, then write through to
// Supabase. The firm record stays a local seed (id = DEMO_FIRM_ID); all entity
// data lives in the crm_ tables.
class DataStore {
  firms: Firm[] = clone(initialFirms);
  profiles: Profile[] = [];
  projects: Project[] = [];
  assignments: ProjectAssignment[] = [];
  milestones: Milestone[] = [];
  siteUpdates: SiteUpdate[] = [];
  paymentPlans: PaymentPlan[] = [];
  paymentSplits: PaymentSplit[] = [];
  paymentsReceived: PaymentReceived[] = [];
  costEntries: CostEntry[] = [];
  comments: Comment[] = [];
  notifications: Notification[] = [];
  activityLog: ActivityLog[] = [];
  leads: Lead[] = [];
  leadInteractions: LeadInteraction[] = [];
  leadQuotations: LeadQuotation[] = [];
  projectDocuments: ProjectDocument[] = [];
  projectVendors: ProjectVendor[] = [];
  contacts: Contact[] = [];
  pipelineStages: PipelineStage[] = [];
  featureFlags: FeatureFlag[] = [];
  commChannels: CommChannel[] = [];
  roles: Role[] = [];
  rolePermissions: RolePermission[] = [];
  dashboardLayouts: DashboardLayout[] = [];

  loaded = false;
  private hydrating: Promise<void> | null = null;
  private listeners: Set<() => void> = new Set();

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // ─── Reset (call on logout so the next login re-hydrates from DB) ───
  reset() {
    this.loaded = false;
    this.hydrating = null;
    this.roles = [];
    this.rolePermissions = [];
    this.profiles = [];
    this.projects = [];
    this.assignments = [];
    this.milestones = [];
    this.siteUpdates = [];
    this.paymentPlans = [];
    this.paymentSplits = [];
    this.paymentsReceived = [];
    this.costEntries = [];
    this.comments = [];
    this.notifications = [];
    this.activityLog = [];
    this.leads = [];
    this.leadInteractions = [];
    this.leadQuotations = [];
    this.projectDocuments = [];
    this.projectVendors = [];
    this.contacts = [];
    this.pipelineStages = [];
    this.featureFlags = [];
    this.commChannels = [];
    this.dashboardLayouts = [];
    this.notify();
  }

  // ─── Hydration (idempotent) ───
  hydrate(firmId = DEMO_FIRM_ID): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.hydrating) return this.hydrating;
    this.hydrating = crm.hydrateAll(firmId).then((d) => {
      this.profiles = d.profiles as Profile[];
      this.projects = d.projects as Project[];
      this.assignments = d.assignments as ProjectAssignment[];
      this.milestones = d.milestones as Milestone[];
      this.siteUpdates = d.siteUpdates as SiteUpdate[];
      this.paymentPlans = d.paymentPlans as PaymentPlan[];
      this.paymentSplits = d.paymentSplits as PaymentSplit[];
      this.paymentsReceived = d.paymentsReceived as PaymentReceived[];
      this.costEntries = d.costEntries as CostEntry[];
      this.comments = d.comments as Comment[];
      this.notifications = d.notifications as Notification[];
      this.activityLog = d.activityLog as ActivityLog[];
      this.leads = d.leads as Lead[];
      this.leadInteractions = d.leadInteractions as LeadInteraction[];
      this.leadQuotations = d.leadQuotations as LeadQuotation[];
      this.projectDocuments = d.projectDocuments as ProjectDocument[];
      this.projectVendors = d.projectVendors as ProjectVendor[];
      this.contacts = d.contacts as Contact[];
      this.pipelineStages = (d.pipelineStages as PipelineStage[]).sort((a, b) => a.order_index - b.order_index);
      this.featureFlags = d.featureFlags as FeatureFlag[];
      this.commChannels = d.commChannels as CommChannel[];
      this.roles = d.roles as Role[];
      this.rolePermissions = d.rolePermissions as RolePermission[];
      this.dashboardLayouts = d.dashboardLayouts as DashboardLayout[];
      this.loaded = true;
      this.notify();
    });
    return this.hydrating;
  }

  // ─── RLS-like tenant filtering ───
  forFirm(firmId: string) {
    return {
      projects: this.projects.filter(p => p.firm_id === firmId),
      profiles: this.profiles.filter(p => p.firm_id === firmId),
      assignments: this.assignments.filter(a => a.firm_id === firmId),
      milestones: this.milestones.filter(m => m.firm_id === firmId),
      siteUpdates: this.siteUpdates.filter(s => s.firm_id === firmId),
      paymentPlans: this.paymentPlans.filter(p => p.firm_id === firmId),
      paymentSplits: this.paymentSplits.filter(p => p.firm_id === firmId),
      paymentsReceived: this.paymentsReceived.filter(p => p.firm_id === firmId),
      costEntries: this.costEntries.filter(c => c.firm_id === firmId),
      comments: this.comments.filter(c => c.firm_id === firmId),
      notifications: this.notifications.filter(n => n.firm_id === firmId),
      activityLog: this.activityLog.filter(a => a.firm_id === firmId),
      leads: this.leads.filter(l => l.firm_id === firmId),
      leadInteractions: this.leadInteractions.filter(i => i.firm_id === firmId),
      leadQuotations: this.leadQuotations.filter(q => q.firm_id === firmId),
      projectDocuments: this.projectDocuments.filter(d => d.firm_id === firmId),
      projectVendors: this.projectVendors.filter(v => v.firm_id === firmId),
    };
  }

  // ─── RBAC resolvers ───
  roleForUser(userId: string): Role | undefined {
    const p = this.profiles.find(x => x.id === userId);
    if (!p) return undefined;
    if (p.role_id) return this.roles.find(r => r.id === p.role_id);
    // legacy fallback (pre-RBAC profiles): map by key
    return this.roles.find(r => r.key === p.role);
  }

  /** Data scope for a user, derived from their role (legacy role string as fallback). */
  scopeForUser(userId: string): RoleScope {
    const role = this.roleForUser(userId);
    if (role) return role.scope;
    const p = this.profiles.find(x => x.id === userId);
    return p?.role === 'engineer' ? 'assigned' : p?.role === 'client' ? 'own' : 'all';
  }

  /** Users whose role receives admin-level notifications (replaces role==='owner'). */
  adminUserIds(firmId: string): string[] {
    const adminRoleIds = this.roles.filter(r => r.firm_id === firmId && r.is_admin).map(r => r.id);
    return this.profiles
      .filter(p => p.firm_id === firmId && p.role_id && adminRoleIds.includes(p.role_id))
      .map(p => p.id);
  }

  // Scope-based project access (replaces the old hardcoded-role version).
  getProjectsForUser(userId: string, firmId: string, _role?: string): Project[] {
    const firmProjects = this.projects.filter(p => p.firm_id === firmId);
    const scope = this.scopeForUser(userId);
    if (scope === 'all') return firmProjects;
    if (scope === 'assigned') {
      const assignedProjectIds = this.assignments
        .filter(a => a.user_id === userId)
        .map(a => a.project_id);
      return firmProjects.filter(p => assignedProjectIds.includes(p.id));
    }
    // own
    return firmProjects.filter(p => p.client_id === userId);
  }

  // ─── PROFILES ───
  addProfile(profile: Omit<Profile, 'id' | 'created_at'>) {
    const newProfile: Profile = { ...profile, id: uuid(), created_at: nowISO() };
    this.profiles.push(newProfile);
    this.notify();
    crm.persistInsert('profiles', newProfile);
    return newProfile;
  }

  updateProfile(id: string, updates: Partial<Profile>) {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.profiles[idx] = { ...this.profiles[idx], ...updates };
      this.notify();
      crm.persistUpdate('profiles', id, updates);
    }
  }

  // ─── PROJECTS ───
  addProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
    const now = nowISO();
    const newProject: Project = { ...project, id: uuid(), created_at: now, updated_at: now };
    this.projects.push(newProject);
    this.notify();
    crm.persistInsert('projects', newProject);
    return newProject;
  }

  updateProject(id: string, updates: Partial<Project>) {
    const idx = this.projects.findIndex(p => p.id === id);
    if (idx >= 0) {
      const patch = { ...updates, updated_at: nowISO() };
      this.projects[idx] = { ...this.projects[idx], ...patch };
      this.notify();
      crm.persistUpdate('projects', id, patch);
    }
  }

  // ─── ASSIGNMENTS ───
  addAssignment(assignment: Omit<ProjectAssignment, 'id' | 'assigned_at'>) {
    const newA: ProjectAssignment = { ...assignment, id: uuid(), assigned_at: nowISO() };
    this.assignments.push(newA);
    this.notify();
    crm.persistInsert('assignments', newA);
    return newA;
  }

  removeUserAssignments(firmId: string, userId: string) {
    this.assignments = this.assignments.filter(a => !(a.user_id === userId && a.firm_id === firmId));
    this.notify();
    crm.persistDeleteWhere('assignments', { firm_id: firmId, user_id: userId });
  }

  removeProjectAssignments(firmId: string, projectId: string) {
    this.assignments = this.assignments.filter(a => !(a.project_id === projectId && a.firm_id === firmId));
    this.notify();
    crm.persistDeleteWhere('assignments', { firm_id: firmId, project_id: projectId });
  }

  // ─── MILESTONES ───
  addMilestone(milestone: Omit<Milestone, 'id' | 'created_at'>) {
    const newMs: Milestone = { ...milestone, id: uuid(), created_at: nowISO() };
    this.milestones.push(newMs);
    this.notify();
    crm.persistInsert('milestones', newMs);
    return newMs;
  }

  updateMilestone(id: string, updates: Partial<Milestone>) {
    const idx = this.milestones.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.milestones[idx] = { ...this.milestones[idx], ...updates };
      this.notify();
      crm.persistUpdate('milestones', id, updates);
    }
  }

  // ─── SITE UPDATES ───
  addSiteUpdate(update: Omit<SiteUpdate, 'id' | 'created_at'>) {
    const newUpdate: SiteUpdate = { ...update, id: uuid(), created_at: nowISO() };
    this.siteUpdates.push(newUpdate);
    this.notify();
    crm.persistInsert('siteUpdates', newUpdate);
    return newUpdate;
  }

  // ─── COSTS ───
  addCostEntry(entry: Omit<CostEntry, 'id' | 'created_at'>) {
    const newEntry: CostEntry = { ...entry, id: uuid(), created_at: nowISO() };
    this.costEntries.push(newEntry);
    this.notify();
    crm.persistInsert('costEntries', newEntry);
    return newEntry;
  }

  // ─── PAYMENTS ───
  addPaymentPlan(plan: Omit<PaymentPlan, 'id' | 'created_at'>) {
    const newPlan: PaymentPlan = { ...plan, id: uuid(), created_at: nowISO() };
    this.paymentPlans.push(newPlan);
    this.notify();
    crm.persistInsert('paymentPlans', newPlan);
    return newPlan;
  }

  addPaymentSplit(split: Omit<PaymentSplit, 'id' | 'created_at'>) {
    const newSplit: PaymentSplit = { ...split, id: uuid(), created_at: nowISO() };
    this.paymentSplits.push(newSplit);
    this.notify();
    crm.persistInsert('paymentSplits', newSplit);
    return newSplit;
  }

  updatePaymentSplit(id: string, updates: Partial<PaymentSplit>) {
    const idx = this.paymentSplits.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.paymentSplits[idx] = { ...this.paymentSplits[idx], ...updates };
      this.notify();
      crm.persistUpdate('paymentSplits', id, updates);
    }
  }

  addPaymentReceived(payment: Omit<PaymentReceived, 'id' | 'created_at'>) {
    const newPayment: PaymentReceived = { ...payment, id: uuid(), created_at: nowISO() };
    this.paymentsReceived.push(newPayment);
    crm.persistInsert('paymentsReceived', newPayment);
    // Update split status
    const splitIdx = this.paymentSplits.findIndex(s => s.id === payment.payment_split_id);
    if (splitIdx >= 0) {
      const split = this.paymentSplits[splitIdx];
      const totalReceived = this.paymentsReceived
        .filter(p => p.payment_split_id === split.id)
        .reduce((sum, p) => sum + p.amount, 0);
      const status = totalReceived >= split.total_with_gst ? 'paid' : 'partially_paid';
      this.paymentSplits[splitIdx] = { ...split, status: status as PaymentSplit['status'] };
      crm.persistUpdate('paymentSplits', split.id, { status });
    }
    this.notify();
    return newPayment;
  }

  // ─── COMMENTS ───
  addComment(comment: Omit<Comment, 'id' | 'created_at' | 'updated_at'>) {
    const now = nowISO();
    const newComment: Comment = { ...comment, id: uuid(), created_at: now, updated_at: now };
    this.comments.push(newComment);
    this.notify();
    crm.persistInsert('comments', newComment);
    return newComment;
  }

  togglePinComment(id: string) {
    const idx = this.comments.findIndex(c => c.id === id);
    if (idx >= 0) {
      const is_pinned = !this.comments[idx].is_pinned;
      this.comments[idx].is_pinned = is_pinned;
      this.notify();
      crm.persistUpdate('comments', id, { is_pinned });
    }
  }

  // ─── NOTIFICATIONS ───
  addNotification(notification: Omit<Notification, 'id' | 'created_at'>) {
    const newNotif: Notification = { ...notification, id: uuid(), created_at: nowISO() };
    this.notifications.push(newNotif);
    this.notify();
    crm.persistInsert('notifications', newNotif);
    return newNotif;
  }

  markNotificationRead(id: string) {
    const idx = this.notifications.findIndex(n => n.id === id);
    if (idx >= 0) {
      this.notifications[idx].read = true;
      this.notify();
      crm.persistUpdate('notifications', id, { read: true });
    }
  }

  markAllNotificationsRead(userId: string) {
    this.notifications.forEach(n => { if (n.user_id === userId) n.read = true; });
    this.notify();
    crm.persistUpdateWhere('notifications', { user_id: userId }, { read: true });
  }

  // ─── ACTIVITY LOG ───
  addActivityLog(entry: Omit<ActivityLog, 'id' | 'created_at'>) {
    const newEntry: ActivityLog = { ...entry, id: uuid(), created_at: nowISO() };
    this.activityLog.push(newEntry);
    this.notify();
    crm.persistInsert('activityLog', newEntry);
    return newEntry;
  }

  // ─── LEADS ───
  addLead(lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) {
    const now = nowISO();
    const newLead: Lead = { ...lead, id: uuid(), created_at: now, updated_at: now };
    this.leads.push(newLead);
    this.notify();
    crm.persistInsert('leads', newLead);
    return newLead;
  }

  updateLead(id: string, updates: Partial<Lead>) {
    const idx = this.leads.findIndex(l => l.id === id);
    if (idx >= 0) {
      const patch = { ...updates, updated_at: nowISO() };
      this.leads[idx] = { ...this.leads[idx], ...patch };
      this.notify();
      crm.persistUpdate('leads', id, patch);
    }
  }

  // ─── SELF-ASSIGNMENT ───
  /**
   * Atomically claim an unassigned lead. Guards on assigned_to IS NULL in the
   * DB so two agents racing can never both win. Returns { ok:true } for the
   * winner; { ok:false, reason:'taken' } for the loser (local row reconciled to
   * the true owner). Optimistically flips the local row so the caller's UI
   * updates instantly, then rolls back if the write reveals it was taken.
   */
  async claimLead(id: string, userId: string): Promise<{ ok: boolean; reason?: 'taken' | 'error' }> {
    const idx = this.leads.findIndex(l => l.id === id);
    if (idx < 0) return { ok: false, reason: 'error' };
    if (this.leads[idx].assigned_to) return { ok: false, reason: 'taken' };
    const now = nowISO();
    const prev = this.leads[idx];
    // optimistic
    this.leads[idx] = { ...prev, assigned_to: userId, updated_at: now };
    this.notify();
    try {
      const won = await crm.claimLeadRow(id, userId, now);
      if (won) return { ok: true };
      // lost the race — reconcile to the DB's truth (the actual winner)
      const fresh = await crm.fetchLeadRow(id);
      const j = this.leads.findIndex(l => l.id === id);
      if (j >= 0 && fresh) { this.leads[j] = fresh as Lead; this.notify(); }
      return { ok: false, reason: 'taken' };
    } catch {
      // transport error — roll back the optimistic flip
      const j = this.leads.findIndex(l => l.id === id);
      if (j >= 0) { this.leads[j] = prev; this.notify(); }
      return { ok: false, reason: 'error' };
    }
  }

  /** Manager override — assign a lead to an agent (or null to unassign). */
  assignLead(id: string, userId: string | null) {
    const idx = this.leads.findIndex(l => l.id === id);
    if (idx < 0) return;
    // persist an explicit null on unassign (supabase-js drops `undefined` keys)
    const patch = { assigned_to: userId ?? null, updated_at: nowISO() };
    this.leads[idx] = { ...this.leads[idx], assigned_to: userId ?? undefined, updated_at: patch.updated_at };
    this.notify();
    crm.persistUpdate('leads', id, patch);
  }

  /** Manager override — remove ownership (back to the Fresh Enquiries queue). */
  unassignLead(id: string) {
    this.assignLead(id, null);
  }

  /** Manager override — bulk (re)assign / unassign. */
  bulkAssignLeads(ids: string[], userId: string | null) {
    ids.forEach(id => this.assignLead(id, userId));
  }

  deleteLead(id: string) {
    this.leads = this.leads.filter(l => l.id !== id);
    this.leadInteractions = this.leadInteractions.filter(i => i.lead_id !== id);
    this.leadQuotations = this.leadQuotations.filter(q => q.lead_id !== id);
    this.notify();
    crm.persistDelete('leads', id);
    crm.persistDeleteWhere('leadInteractions', { lead_id: id });
    crm.persistDeleteWhere('leadQuotations', { lead_id: id });
  }

  addLeadInteraction(interaction: Omit<LeadInteraction, 'id' | 'created_at'>) {
    const newInt: LeadInteraction = { ...interaction, id: uuid(), created_at: nowISO() };
    this.leadInteractions.push(newInt);
    crm.persistInsert('leadInteractions', newInt);
    // Update lead's last contact date
    const leadIdx = this.leads.findIndex(l => l.id === interaction.lead_id);
    if (leadIdx >= 0) {
      const patch = { last_contact_date: todayStr(), updated_at: nowISO() };
      this.leads[leadIdx] = { ...this.leads[leadIdx], ...patch };
      crm.persistUpdate('leads', this.leads[leadIdx].id, patch);
    }
    this.notify();
    return newInt;
  }

  addLeadQuotation(quotation: Omit<LeadQuotation, 'id' | 'created_at' | 'updated_at'>) {
    const now = nowISO();
    const newQuote: LeadQuotation = { ...quotation, id: uuid(), created_at: now, updated_at: now };
    this.leadQuotations.push(newQuote);
    this.notify();
    crm.persistInsert('leadQuotations', newQuote);
    return newQuote;
  }

  updateLeadQuotation(id: string, updates: Partial<LeadQuotation>) {
    const idx = this.leadQuotations.findIndex(q => q.id === id);
    if (idx >= 0) {
      const patch = { ...updates, updated_at: nowISO() };
      this.leadQuotations[idx] = { ...this.leadQuotations[idx], ...patch };
      this.notify();
      crm.persistUpdate('leadQuotations', id, patch);
    }
  }

  convertLeadToProject(leadId: string, projectId: string) {
    const idx = this.leads.findIndex(l => l.id === leadId);
    if (idx >= 0) {
      const patch = { status: 'won' as Lead['status'], converted_project_id: projectId, updated_at: nowISO() };
      this.leads[idx] = { ...this.leads[idx], ...patch };
      this.notify();
      crm.persistUpdate('leads', leadId, patch);
    }
  }

  // ─── PROJECT DOCUMENTS ───
  addProjectDocument(doc: Omit<ProjectDocument, 'id' | 'created_at'>) {
    const newDoc: ProjectDocument = { ...doc, id: uuid(), created_at: nowISO() };
    this.projectDocuments.push(newDoc);
    this.notify();
    crm.persistInsert('projectDocuments', newDoc);
    return newDoc;
  }

  deleteProjectDocument(id: string) {
    this.projectDocuments = this.projectDocuments.filter(d => d.id !== id);
    this.notify();
    crm.persistDelete('projectDocuments', id);
  }

  toggleDocumentClientVisibility(id: string) {
    const idx = this.projectDocuments.findIndex(d => d.id === id);
    if (idx >= 0) {
      const visible_to_client = !this.projectDocuments[idx].visible_to_client;
      this.projectDocuments[idx].visible_to_client = visible_to_client;
      this.notify();
      crm.persistUpdate('projectDocuments', id, { visible_to_client });
    }
  }

  // ─── PROJECT VENDORS ───
  addProjectVendor(vendor: Omit<ProjectVendor, 'id' | 'created_at' | 'updated_at'>) {
    const now = nowISO();
    const newVendor: ProjectVendor = { ...vendor, id: uuid(), created_at: now, updated_at: now };
    this.projectVendors.push(newVendor);
    this.notify();
    crm.persistInsert('projectVendors', newVendor);
    return newVendor;
  }

  updateProjectVendor(id: string, updates: Partial<ProjectVendor>) {
    const idx = this.projectVendors.findIndex(v => v.id === id);
    if (idx >= 0) {
      const patch = { ...updates, updated_at: nowISO() };
      this.projectVendors[idx] = { ...this.projectVendors[idx], ...patch };
      this.notify();
      crm.persistUpdate('projectVendors', id, patch);
    }
  }

  deleteProjectVendor(id: string) {
    this.projectVendors = this.projectVendors.filter(v => v.id !== id);
    this.notify();
    crm.persistDelete('projectVendors', id);
  }

  // ─── CONTACTS (returning-customer recognition) ───
  addContact(contact: Omit<Contact, 'id' | 'created_at' | 'first_seen'> & { first_seen?: string }) {
    const now = nowISO();
    const newC: Contact = { ...contact, id: uuid(), first_seen: contact.first_seen || now, created_at: now } as Contact;
    this.contacts.push(newC);
    this.notify();
    crm.persistInsert('contacts', newC);
    return newC;
  }
  updateContact(id: string, updates: Partial<Contact>) {
    const idx = this.contacts.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.contacts[idx] = { ...this.contacts[idx], ...updates };
      this.notify();
      crm.persistUpdate('contacts', id, updates);
    }
  }
  /** Find an existing contact by email or phone (returning-customer match). */
  findContact(firmId: string, email?: string | null, phone?: string | null): Contact | undefined {
    const e = (email || '').trim().toLowerCase();
    const p = (phone || '').replace(/\s+/g, '');
    return this.contacts.find(c => c.firm_id === firmId && (
      (!!e && (c.email || '').trim().toLowerCase() === e) ||
      (!!p && (c.phone || '').replace(/\s+/g, '') === p)
    ));
  }

  // ─── PIPELINE STAGES (admin-editable) ───
  addPipelineStage(stage: Omit<PipelineStage, 'id' | 'created_at'>) {
    const newS: PipelineStage = { ...stage, id: uuid(), created_at: nowISO() };
    this.pipelineStages.push(newS);
    this.pipelineStages.sort((a, b) => a.order_index - b.order_index);
    this.notify();
    crm.persistInsert('pipelineStages', newS);
    return newS;
  }
  updatePipelineStage(id: string, updates: Partial<PipelineStage>) {
    const idx = this.pipelineStages.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.pipelineStages[idx] = { ...this.pipelineStages[idx], ...updates };
      this.pipelineStages.sort((a, b) => a.order_index - b.order_index);
      this.notify();
      crm.persistUpdate('pipelineStages', id, updates);
    }
  }
  deletePipelineStage(id: string) {
    this.pipelineStages = this.pipelineStages.filter(s => s.id !== id);
    this.notify();
    crm.persistDelete('pipelineStages', id);
  }

  // ─── FEATURE FLAGS ───
  setFeatureFlag(firmId: string, key: string, enabled: boolean) {
    const idx = this.featureFlags.findIndex(f => f.firm_id === firmId && f.key === key);
    if (idx >= 0) {
      this.featureFlags[idx] = { ...this.featureFlags[idx], enabled };
      this.notify();
      crm.persistUpdate('featureFlags', this.featureFlags[idx].id, { enabled });
    } else {
      const newF: FeatureFlag = { id: uuid(), firm_id: firmId, key, enabled, created_at: nowISO() };
      this.featureFlags.push(newF);
      this.notify();
      crm.persistInsert('featureFlags', newF);
    }
  }
  isFeatureEnabled(firmId: string, key: string, dflt = true): boolean {
    const f = this.featureFlags.find(x => x.firm_id === firmId && x.key === key);
    return f ? f.enabled : dflt;
  }

  // ─── COMM CHANNELS ───
  updateCommChannel(id: string, updates: Partial<CommChannel>) {
    const idx = this.commChannels.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.commChannels[idx] = { ...this.commChannels[idx], ...updates };
      this.notify();
      crm.persistUpdate('commChannels', id, updates);
    }
  }

  // ─── DELETE PRIMITIVES (reversible un-convert) ───
  deleteProject(id: string) {
    this.projects = this.projects.filter(p => p.id !== id);
    this.notify();
    crm.persistDelete('projects', id);
  }
  deleteMilestone(id: string) {
    this.milestones = this.milestones.filter(m => m.id !== id);
    this.notify();
    crm.persistDelete('milestones', id);
  }
  deletePaymentPlan(id: string) {
    this.paymentPlans = this.paymentPlans.filter(p => p.id !== id);
    this.notify();
    crm.persistDelete('paymentPlans', id);
  }
  deletePaymentSplit(id: string) {
    this.paymentSplits = this.paymentSplits.filter(s => s.id !== id);
    this.notify();
    crm.persistDelete('paymentSplits', id);
  }

  // ─── ROLES & PERMISSIONS (RBAC) ───
  addRole(role: Omit<Role, 'id' | 'created_at' | 'updated_at'>): Role {
    const now = nowISO();
    const newRole: Role = { ...role, id: uuid(), created_at: now, updated_at: now };
    this.roles.push(newRole);
    this.notify();
    crm.persistInsert('roles', newRole);
    return newRole;
  }

  updateRole(id: string, updates: Partial<Role>) {
    const idx = this.roles.findIndex(r => r.id === id);
    if (idx >= 0) {
      const patch = { ...updates, updated_at: nowISO() };
      this.roles[idx] = { ...this.roles[idx], ...patch };
      this.notify();
      crm.persistUpdate('roles', id, patch);
    }
  }

  setRoleEnabled(id: string, enabled: boolean) {
    this.updateRole(id, { enabled });
  }

  /** Duplicate a role and all its permission rows under a new id/key/name. */
  cloneRole(sourceId: string, overrides: Partial<Pick<Role, 'name' | 'key' | 'description'>> = {}): Role | undefined {
    const src = this.roles.find(r => r.id === sourceId);
    if (!src) return undefined;
    const clone = this.addRole({
      firm_id: src.firm_id,
      key: overrides.key || `${src.key}-copy-${Math.random().toString(36).slice(2, 6)}`,
      name: overrides.name || `${src.name} (Copy)`,
      description: overrides.description ?? src.description,
      scope: src.scope,
      is_system: false,   // clones are always editable/deletable
      is_admin: false,
      enabled: true,
      color: src.color,
    });
    this.rolePermissions
      .filter(p => p.role_id === sourceId)
      .forEach(p => this.setRolePermissions(clone.id, p.module, [...(p.actions || [])], clone.firm_id));
    return clone;
  }

  deleteRole(id: string) {
    const role = this.roles.find(r => r.id === id);
    if (!role || role.is_system) return; // system roles are protected
    this.roles = this.roles.filter(r => r.id !== id);
    this.rolePermissions = this.rolePermissions.filter(p => p.role_id !== id);
    // Unassign users that pointed at this role
    this.profiles.forEach(p => { if (p.role_id === id) p.role_id = null; });
    this.notify();
    crm.persistDelete('roles', id); // cascades role_permissions in DB
    crm.persistUpdateWhere('profiles', { role_id: id }, { role_id: null });
  }

  /** Upsert the granted actions for one (role, module) pair. Returns DB error message if the write fails. */
  async setRolePermissions(roleId: string, module: string, actions: string[], firmId?: string): Promise<string | null> {
    const idx = this.rolePermissions.findIndex(p => p.role_id === roleId && p.module === module);
    if (idx >= 0) {
      this.rolePermissions[idx] = { ...this.rolePermissions[idx], actions };
      this.notify();
      return crm.awaitUpdate('rolePermissions', this.rolePermissions[idx].id, { actions });
    } else {
      const fid = firmId || this.roles.find(r => r.id === roleId)?.firm_id || '';
      const row: RolePermission = { id: uuid(), firm_id: fid, role_id: roleId, module, actions, created_at: nowISO() };
      this.rolePermissions.push(row);
      this.notify();
      return crm.awaitInsert('rolePermissions', row);
    }
  }

  assignUserRole(userId: string, roleId: string) {
    const idx = this.profiles.findIndex(p => p.id === userId);
    if (idx >= 0) {
      this.profiles[idx] = { ...this.profiles[idx], role_id: roleId };
      this.notify();
      crm.persistUpdate('profiles', userId, { role_id: roleId });
    }
  }

  // ─── DASHBOARD LAYOUTS (per-user customizable dashboards) ───
  addDashboardLayout(layout: Omit<DashboardLayout, 'id' | 'created_at' | 'updated_at'>): DashboardLayout {
    const now = nowISO();
    const row: DashboardLayout = { ...layout, id: uuid(), created_at: now, updated_at: now };
    this.dashboardLayouts.push(row);
    this.notify();
    crm.persistInsert('dashboardLayouts', row);
    return row;
  }

  updateDashboardLayout(id: string, updates: Partial<DashboardLayout>) {
    const idx = this.dashboardLayouts.findIndex(l => l.id === id);
    if (idx >= 0) {
      const patch = { ...updates, updated_at: nowISO() };
      this.dashboardLayouts[idx] = { ...this.dashboardLayouts[idx], ...patch };
      this.notify();
      crm.persistUpdate('dashboardLayouts', id, patch);
    }
  }

  /** Make one layout the user's default (clears the flag on their other layouts of the same module). */
  setDefaultDashboardLayout(id: string, userId: string, module: string) {
    this.dashboardLayouts.forEach(l => {
      if (l.user_id === userId && l.module === module && l.is_default && l.id !== id) {
        this.updateDashboardLayout(l.id, { is_default: false });
      }
    });
    this.updateDashboardLayout(id, { is_default: true });
  }

  deleteDashboardLayout(id: string) {
    this.dashboardLayouts = this.dashboardLayouts.filter(l => l.id !== id);
    this.notify();
    crm.persistDelete('dashboardLayouts', id);
  }
}

export const store = new DataStore();
