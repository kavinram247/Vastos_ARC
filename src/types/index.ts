export type UserRole = 'owner' | 'architect' | 'engineer' | 'client';

export interface Firm {
  id: string;
  name: string;
  gstin: string;
  address: string;
  logo_url?: string;
  payment_split_default: number;
  created_at: string;
}

export interface Profile {
  id: string;
  firm_id: string;
  email: string;
  full_name: string;
  role: UserRole;          // legacy — kept for back-compat; RBAC resolves via role_id
  role_id?: string | null; // FK → Role.id (dynamic RBAC)
  phone?: string;
  avatar_url?: string;
  created_at: string;
}

// ─── DYNAMIC RBAC ───
/** Data scope a role grants over rows (preserves legacy row-level access). */
export type RoleScope = 'all' | 'assigned' | 'own';

export interface Role {
  id: string;
  firm_id: string;
  key: string;
  name: string;
  description?: string | null;
  scope: RoleScope;
  is_system: boolean;  // default role — cannot be deleted
  is_admin: boolean;   // implicit all-access + receives admin notifications
  enabled: boolean;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  firm_id: string;
  role_id: string;
  module: string;     // ModuleDef.key
  actions: string[];  // subset of ACTIONS
  created_at: string;
}

// ─── LEADS MODULE ───
export type LeadStatus = 'new' | 'contacted' | 'site_visit' | 'quotation_sent' | 'negotiation' | 'won' | 'lost' | 'junk' | 'on_hold';

export interface ProjectDocument {
  id: string;
  firm_id: string;
  project_id: string;
  name: string;
  file_type: string; // 'pdf' | 'image' | 'drawing' | 'spreadsheet' | 'other'
  file_url: string;
  file_size: number; // in KB
  category: 'drawing' | 'contract' | 'invoice' | 'permit' | 'report' | 'photo' | 'other';
  uploaded_by: string;
  visible_to_client: boolean;
  version?: number;
  description?: string;
  created_at: string;
}

export type VendorCategory = 'materials' | 'labour' | 'mep' | 'interior' | 'civil' | 'landscaping' | 'consultant' | 'other';

export interface ProjectVendor {
  id: string;
  firm_id: string;
  project_id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email?: string;
  gstin?: string;
  category: VendorCategory;
  scope_of_work: string;
  contract_value?: number;
  status: 'active' | 'completed' | 'on_hold' | 'blacklisted';
  start_date?: string;
  end_date?: string;
  rating?: number; // 1-5
  notes?: string;
  added_by: string;
  created_at: string;
  updated_at: string;
}
export type LeadSource = 'referral' | 'website' | 'social_media' | 'walk_in' | 'advertisement' | 'other';
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';
export type InteractionType = 'call' | 'email' | 'meeting' | 'site_visit' | 'whatsapp' | 'other';

export interface Lead {
  id: string;
  firm_id: string;
  // Contact info
  client_name: string;
  client_email?: string;
  client_phone: string;
  client_whatsapp?: string;
  client_company?: string;
  // Project details
  project_type: string; // e.g., "Residential Villa", "Commercial Office", "Interior Design"
  project_location?: string;
  estimated_budget?: number;
  estimated_area?: number; // in sq ft
  project_requirements?: string;
  // Lead tracking
  status: LeadStatus;
  source: LeadSource;
  priority: LeadPriority;
  assigned_to?: string; // user_id
  // Dates
  inquiry_date: string;
  expected_start_date?: string;
  last_contact_date?: string;
  next_follow_up?: string;
  // Conversion
  converted_project_id?: string;
  lost_reason?: string;
  lost_reason_category?: LostReasonCategory | null;
  prev_status?: LeadStatus | null;   // for junk-restore + reversible un-convert
  contact_id?: string | null;        // canonical contact (returning-customer)
  // Meta
  tags?: string[];
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type InteractionChannel = 'call' | 'email' | 'sms' | 'whatsapp' | 'meeting' | 'note' | 'meta';
export type LostReasonCategory = 'price' | 'competition' | 'scope' | 'timing' | 'unresponsive' | 'other';

export interface LeadInteraction {
  id: string;
  firm_id: string;
  lead_id: string;
  type: InteractionType;
  subject: string;
  description: string;
  outcome?: string;
  next_steps?: string;
  scheduled_at?: string; // for meetings/site visits
  completed_at?: string;
  logged_by: string;
  created_at: string;
  // unified 360° timeline
  channel?: InteractionChannel | null;
  direction?: 'inbound' | 'outbound' | null;
  contact_id?: string | null;
  external_id?: string | null;
}

// ─── LEADS MODULE: configurable pipeline, contacts, flags, channels ───
export interface Contact {
  id: string;
  firm_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  tags?: string[];
  notes?: string | null;
  first_seen: string;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  firm_id: string;
  key: string;
  label: string;
  order_index: number;
  category: 'active' | 'terminal';
  is_won: boolean;
  is_lost: boolean;
  color?: string | null;
  enabled: boolean;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  firm_id: string;
  key: string;
  enabled: boolean;
  created_at: string;
}

export interface CommChannel {
  id: string;
  firm_id: string;
  provider: string;
  category: string;
  display_name?: string | null;
  status: 'disconnected' | 'connected';
  config: Record<string, any>;
  connected_by?: string | null;
  connected_at?: string | null;
  created_at: string;
}

export interface LeadQuotation {
  id: string;
  firm_id: string;
  lead_id: string;
  quotation_number: string;
  version: number;
  // Amounts
  estimated_cost: number;
  design_fees: number;
  supervision_fees: number;
  other_charges: number;
  total_amount: number;
  // Details
  scope_of_work: string;
  inclusions?: string;
  exclusions?: string;
  terms_conditions?: string;
  validity_days: number;
  // Status
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'revised';
  sent_at?: string;
  client_response?: string;
  // Meta
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  firm_id: string;
  name: string;
  client_id: string;
  project_value: number;
  start_date: string;
  estimated_end_date: string;
  actual_end_date?: string;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  description?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectAssignment {
  id: string;
  firm_id: string;
  project_id: string;
  user_id: string;
  role: 'lead_architect' | 'architect' | 'engineer';
  assigned_at: string;
}

export interface Milestone {
  id: string;
  firm_id: string;
  project_id: string;
  name: string;
  description?: string;
  planned_start: string;
  planned_end: string;
  actual_start?: string;
  actual_end?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  delay_reason?: string;
  order_index: number;
  created_at: string;
}

export interface SiteUpdate {
  id: string;
  firm_id: string;
  project_id: string;
  posted_by: string;
  date: string;
  note: string;
  photo_urls: string[];
  created_at: string;
}

export interface PaymentPlan {
  id: string;
  firm_id: string;
  project_id: string;
  total_amount: number;
  split_count: number;
  client_signed_off: boolean;
  signed_off_at?: string;
  created_at: string;
}

export interface PaymentSplit {
  id: string;
  firm_id: string;
  payment_plan_id: string;
  project_id: string;
  split_number: number;
  amount: number;
  trigger_type: 'date' | 'milestone';
  trigger_date?: string;
  trigger_milestone_id?: string;
  status: 'scheduled' | 'upcoming' | 'due' | 'paid' | 'partially_paid' | 'overdue';
  gst_rate: number;
  gst_amount: number;
  total_with_gst: number;
  created_at: string;
}

export interface PaymentReceived {
  id: string;
  firm_id: string;
  payment_split_id: string;
  project_id: string;
  amount: number;
  received_date: string;
  mode: 'bank_transfer' | 'cheque' | 'cash' | 'upi';
  reference?: string;
  marked_by: string;
  created_at: string;
}

export interface CostEntry {
  id: string;
  firm_id: string;
  project_id: string;
  category: 'materials' | 'labour' | 'vendor';
  description: string;
  amount: number;
  date: string;
  vendor_name?: string;
  receipt_url?: string;
  created_by: string;
  created_at: string;
}

export interface Comment {
  id: string;
  firm_id: string;
  project_id: string;
  author_id: string;
  content: string;
  is_pinned: boolean;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  firm_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  link?: string;
  created_at: string;
}

export type AuditModule = 'project' | 'lead' | 'milestone' | 'payment' | 'cost' | 'site_update' | 'comment' | 'document' | 'vendor' | 'user' | 'system';
export type AuditAction = 'created' | 'updated' | 'deleted' | 'status_changed' | 'assigned' | 'commented' | 'approved' | 'uploaded' | 'payment_received' | 'exported' | 'login' | 'other';

export interface ActivityLog {
  id: string;
  firm_id: string;
  user_id: string;
  action: AuditAction;
  action_label: string;
  module: AuditModule;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  previous_value?: string;
  updated_value?: string;
  details?: string;
  remarks?: string;
  created_at: string;
}

export type Page = 
  | 'login'
  | 'dashboard'
  | 'projects'
  | 'project-detail'
  | 'milestones'
  | 'site-updates'
  | 'payments'
  | 'costs'
  | 'comments'
  | 'client-portal'
  | 'notifications'
  | 'activity-log'
  | 'team'
  | 'user-management'
  | 'leads'
  | 'leads-admin'
  | 'roles'
  | 'documents'
  | 'tasks'
  | 'attendance'
  | 'boq'
  | 'quotations'
  | 'vendors'
  | 'catalog'
  | 'calibration';
