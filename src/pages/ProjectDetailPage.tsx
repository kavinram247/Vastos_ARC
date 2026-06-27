import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { listVendorViewers, setVendorViewer } from '../lib/vendorAccessApi';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { formatINR, formatINRCompact, formatDate, getStatusColor, statusLabel } from '../utils/format';
import type { Page, VendorCategory, ProjectVendor } from '../types';
import {
  ArrowLeft, MapPin, Calendar, IndianRupee,
  Camera, MessageSquare, Milestone, CreditCard,
  TrendingUp, Truck, Phone, Mail, Star, Ban,
  Plus, Edit2, Trash2, MoreVertical, Building2, FileText as FileIcon,
  CheckCircle2, PauseCircle, XCircle, PlayCircle, Settings2, ShieldCheck, Lock, ChevronsUpDown, TrendingUp as TrendingUpIcon, FolderOpen,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  projectId: string;
  onNavigate: (page: Page, projectId?: string) => void;
}

const vendorCategoryConfig: Record<VendorCategory, { label: string; color: string; bg: string }> = {
  materials: { label: 'Materials', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  labour: { label: 'Labour', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  mep: { label: 'MEP', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
  interior: { label: 'Interior', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  civil: { label: 'Civil', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  landscaping: { label: 'Landscaping', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  consultant: { label: 'Consultant', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  other: { label: 'Other', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
};

const vendorStatusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  active: { label: 'Active', variant: 'success' },
  completed: { label: 'Completed', variant: 'default' },
  on_hold: { label: 'On Hold', variant: 'warning' },
  blacklisted: { label: 'Blacklisted', variant: 'error' },
};

export function ProjectDetailPage({ projectId, onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const [vendorMenuOpen, setVendorMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Vendor visibility allow-list (firm-wide). null = still loading → fail closed.
  const [vendorViewers, setVendorViewers] = useState<Set<string> | null>(null);
  const [showVendorAccess, setShowVendorAccess] = useState(false);

  const loadVendorViewers = () => listVendorViewers()
    .then(setVendorViewers)
    .catch((e) => { console.error(e); setVendorViewers(new Set()); });
  useEffect(() => { loadVendorViewers(); }, []);

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const project = data.projects.find(p => p.id === projectId);
  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Project not found.</p>
        <Button variant="ghost" onClick={() => onNavigate('projects')} className="mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Button>
      </div>
    );
  }

  const client = data.profiles.find(p => p.id === project.client_id);
  const team = data.assignments.filter(a => a.project_id === project.id);
  const teamProfiles = team.map(t => data.profiles.find(p => p.id === t.user_id)).filter(Boolean);
  const milestones = data.milestones.filter(m => m.project_id === project.id).sort((a, b) => a.order_index - b.order_index);
  const completedMs = milestones.filter(m => m.status === 'completed').length;
  const progress = milestones.length > 0 ? Math.round((completedMs / milestones.length) * 100) : 0;
  const updates = data.siteUpdates.filter(u => u.project_id === project.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestUpdate = updates[0];
  const received = data.paymentsReceived.filter(p => p.project_id === project.id).reduce((s, p) => s + p.amount, 0);
  const costs = data.costEntries.filter(c => c.project_id === project.id).reduce((s, c) => s + c.amount, 0);
  const profit = received - costs;
  const vendors = data.projectVendors.filter(v => v.project_id === project.id);

  // Group vendors by category
  const vendorsByCategory = vendors.reduce<Record<string, typeof vendors>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {});

  const docs = data.projectDocuments.filter(d => d.project_id === project.id);

  const navCards = [
    { page: 'milestones' as Page, label: 'Milestones', icon: Milestone, desc: `${completedMs}/${milestones.length} completed`, color: 'text-indigo-600 bg-indigo-50' },
    { page: 'site-updates' as Page, label: 'Site Updates', icon: Camera, desc: `${updates.length} update${updates.length !== 1 ? 's' : ''}`, color: 'text-emerald-600 bg-emerald-50' },
    { page: 'payments' as Page, label: 'Payments', icon: CreditCard, desc: `${formatINRCompact(received)} received`, color: 'text-amber-600 bg-amber-50' },
    { page: 'costs' as Page, label: 'Costs & Profit', icon: TrendingUp, desc: `Profit: ${formatINRCompact(profit)}`, color: 'text-purple-600 bg-purple-50' },
    { page: 'documents' as Page, label: 'Documents', icon: FileIcon, desc: `${docs.length} file${docs.length !== 1 ? 's' : ''}`, color: 'text-rose-600 bg-rose-50' },
    { page: 'comments' as Page, label: 'Discussions', icon: MessageSquare, desc: `${data.comments.filter(c => c.project_id === project.id).length} comments`, color: 'text-sky-600 bg-sky-50' },
  ];

  const activeVendors = vendors.filter(v => v.status === 'active').length;
  const totalVendorValue = vendors.filter(v => v.contract_value).reduce((s, v) => s + v.contract_value!, 0);
  // Allow-list: vendor-managers always; other non-client staff only if explicitly granted.
  const isOwner = can('vendors', 'view') || can('projects', 'edit');
  const canViewVendors = isOwner || (store.scopeForUser(user.id) !== 'own' && !!vendorViewers?.has(user.id));

  const handleDeleteVendor = (id: string) => {
    store.deleteProjectVendor(id);
    setDeleteConfirm(null);
    setVendorMenuOpen(null);
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={cn('w-3.5 h-3.5', star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200')}
        />
      ))}
    </div>
  );

  const canEditStatus = can('projects', 'edit');
  const switchProjects = store.getProjectsForUser(user.id, firm.id, user.role);
  const sourceLead = data.leads.find(l => l.converted_project_id === project.id);

  type ProjectStatus = typeof project.status;
  const projectStatusConfig: { key: ProjectStatus; label: string; icon: React.ReactNode; desc: string; colorCls: string; bgCls: string; borderCls: string }[] = [
    { key: 'planning', label: 'Planning', icon: <Settings2 className="w-4 h-4" />, desc: 'Design & pre-construction', colorCls: 'text-slate-700', bgCls: 'bg-slate-50', borderCls: 'border-slate-300' },
    { key: 'in_progress', label: 'In Progress', icon: <PlayCircle className="w-4 h-4" />, desc: 'Active construction', colorCls: 'text-blue-700', bgCls: 'bg-blue-50', borderCls: 'border-blue-300' },
    { key: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-4 h-4" />, desc: 'Temporarily paused', colorCls: 'text-amber-700', bgCls: 'bg-amber-50', borderCls: 'border-amber-300' },
    { key: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, desc: 'Project finished', colorCls: 'text-emerald-700', bgCls: 'bg-emerald-50', borderCls: 'border-emerald-300' },
    { key: 'cancelled', label: 'Cancelled', icon: <XCircle className="w-4 h-4" />, desc: 'Project cancelled', colorCls: 'text-red-700', bgCls: 'bg-red-50', borderCls: 'border-red-300' },
  ];
  const currentStatusIdx = projectStatusConfig.findIndex(s => s.key === project.status);

  const handleStatusChange = (newStatus: ProjectStatus) => {
    const updates: Partial<typeof project> = { status: newStatus };
    if (newStatus === 'completed') {
      updates.actual_end_date = new Date().toISOString().split('T')[0];
    }
    store.updateProject(project.id, updates);
    store.addActivityLog({
      firm_id: firm.id, user_id: user.id,
      action: 'status_changed', action_label: 'Status Changed', module: 'project',
      entity_type: 'project', entity_id: project.id, entity_name: project.name,
      previous_value: statusLabel(project.status), updated_value: statusLabel(newStatus),
      details: `Changed project status to ${statusLabel(newStatus)}`,
    });
    setShowStatusModal(false);
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-slate-200 pb-5">
        <button aria-label="Back to projects" onClick={() => onNavigate('projects')} className="mt-0.5 rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Project switcher — jump between projects without leaving the hub */}
            <div className="relative">
              <button onClick={() => setSwitcherOpen(o => !o)}
                className="group flex items-center gap-2 rounded-lg px-1 -mx-1 hover:bg-white">
                <h1 className="text-[28px] font-semibold leading-tight text-slate-900 text-left">{project.name}</h1>
                <ChevronsUpDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
              </button>
              {switcherOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSwitcherOpen(false)} />
                  <div className="floating-panel absolute left-0 top-full z-20 mt-1 w-72 max-h-80 overflow-y-auto py-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch project</div>
                    {switchProjects.map(p => (
                      <button key={p.id} onClick={() => { setSwitcherOpen(false); onNavigate('project-detail', p.id); }}
                        className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                          p.id === project.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700')}>
                        <span className="truncate">{p.name}</span>
                        <Badge variant={getStatusColor(p.status)} size="sm">{statusLabel(p.status)}</Badge>
                      </button>
                    ))}
                    <div className="border-t border-slate-100 mt-1">
                      <button onClick={() => { setSwitcherOpen(false); onNavigate('projects'); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
                        <FolderOpen className="w-4 h-4" /> All projects
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Badge variant={getStatusColor(project.status)} size="md">
              {statusLabel(project.status)}
            </Badge>
            {sourceLead && (
              <button onClick={() => onNavigate('leads')}
                className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100">
                <TrendingUpIcon className="w-3 h-3" /> From lead: {sourceLead.client_name}
              </button>
            )}
          </div>
          <p className="mt-1.5 max-w-[72ch] text-sm text-slate-500">{project.description}</p>
        </div>
        {canEditStatus && (
          <Button size="sm" variant="secondary" onClick={() => setShowStatusModal(true)}>
            <Settings2 className="w-4 h-4" /> Update Status
          </Button>
        )}
      </div>

      {/* ── PROJECT STATUS PIPELINE ── */}
      <div className="surface-panel p-4">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          Project Lifecycle
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {projectStatusConfig.map((stage, idx) => {
            const isCurrent = project.status === stage.key;
            const isPast = idx < currentStatusIdx && currentStatusIdx >= 0;
            return (
              <div key={stage.key} className="flex items-center gap-1 shrink-0">
                {idx > 0 && (
                  <div className={cn('w-6 h-0.5 rounded', isPast || isCurrent ? 'bg-indigo-400' : 'bg-slate-200')} />
                )}
                <button
                  disabled={!canEditStatus}
                  onClick={() => canEditStatus && handleStatusChange(stage.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all',
                    isCurrent
                      ? cn('border-transparent text-white', stage.key === 'completed' ? 'bg-emerald-600' : stage.key === 'cancelled' ? 'bg-red-600' : stage.key === 'on_hold' ? 'bg-amber-600' : stage.key === 'in_progress' ? 'bg-indigo-600' : 'bg-slate-600')
                      : isPast
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                      : 'bg-white border-slate-200 text-slate-500',
                    canEditStatus && !isCurrent && 'hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer',
                    !canEditStatus && 'cursor-default'
                  )}
                  title={canEditStatus ? `Set status to ${stage.label}` : stage.label}
                >
                  {isCurrent && stage.icon}
                  {isPast && !isCurrent && <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{stage.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project facts */}
      <div className={cn('metric-strip', !canViewVendors && 'metric-strip--three')}>
        <div className="metric-cell">
          <div className="metric-label flex items-center gap-2">
            <IndianRupee className="h-3.5 w-3.5" /> Project value
          </div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900">{formatINR(project.project_value)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" /> Timeline
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{formatDate(project.start_date)}</div>
          <div className="mt-1 text-xs text-slate-500">to {formatDate(project.estimated_end_date)}</div>
        </div>
        {canViewVendors && (
          <div className="metric-cell">
            <div className="metric-label flex items-center gap-2">
              <Truck className="w-3.5 h-3.5" /> Vendors
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{activeVendors}<span className="text-sm font-normal text-slate-400">/{vendors.length}</span></div>
            <div className="mt-1 text-xs text-slate-500">{formatINRCompact(totalVendorValue)} contracted</div>
          </div>
        )}
        <div className="metric-cell">
          <div className="metric-label flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" /> Location
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-slate-900">{project.address || 'Not specified'}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Progress</CardTitle>
          <span className="text-2xl font-bold text-indigo-600">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>{completedMs} of {milestones.length} milestones complete</span>
          <span>{milestones.filter(m => m.status === 'delayed').length} delayed</span>
        </div>
      </Card>

      {/* Quick Nav */}
      <div className="surface-panel grid grid-cols-2 gap-px overflow-hidden bg-slate-100 sm:grid-cols-3 lg:grid-cols-5">
        {navCards.map(card => {
          const Icon = card.icon;
          return (
            <button key={card.page} onClick={() => onNavigate(card.page, project.id)} className="group flex min-h-28 items-center gap-3 bg-white p-4 text-left hover:bg-slate-50">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.color}`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{card.label}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{card.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Team */}
      <Card>
        <CardTitle className="mb-4">Team</CardTitle>
        <div className="flex flex-wrap gap-3">
          {client && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
              <Avatar name={client.full_name} size="sm" />
              <div>
                <div className="text-sm font-medium text-slate-900">{client.full_name}</div>
                <div className="text-xs text-emerald-600">Client</div>
              </div>
            </div>
          )}
          {teamProfiles.map(member => member && (
            <div key={member.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <Avatar name={member.full_name} size="sm" />
              <div>
                <div className="text-sm font-medium text-slate-900">{member.full_name}</div>
                <div className="text-xs text-slate-500 capitalize">{member.role}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ═══ VENDORS SECTION ═══ */}
      {canViewVendors && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              Vendors & Contractors
              {isOwner && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <Lock className="w-3 h-3" /> restricted
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isOwner && (
                <Button variant="secondary" size="sm" onClick={() => setShowVendorAccess(true)}>
                  <ShieldCheck className="w-4 h-4" /> Manage access
                </Button>
              )}
              {can('projects', 'edit') && (
                <Button size="sm" onClick={() => setShowAddVendorModal(true)}>
                  <Plus className="w-4 h-4" /> Add Vendor
                </Button>
              )}
            </div>
          </div>

          {vendors.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No vendors added yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vendor summary bar */}
              <div className="flex items-center gap-4 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500">
                <span><b className="text-slate-700">{vendors.length}</b> total</span>
                <span>·</span>
                <span><b className="text-emerald-600">{vendors.filter(v => v.status === 'active').length}</b> active</span>
                <span>·</span>
                <span><b className="text-amber-600">{vendors.filter(v => v.status === 'on_hold').length}</b> on hold</span>
                {vendors.some(v => v.status === 'blacklisted') && (
                  <>
                    <span>·</span>
                    <span><b className="text-red-600">{vendors.filter(v => v.status === 'blacklisted').length}</b> blacklisted</span>
                  </>
                )}
              </div>

              {/* Grouped by category */}
              {Object.entries(vendorCategoryConfig).map(([catKey, catCfg]) => {
                const catVendors = vendorsByCategory[catKey];
                if (!catVendors || catVendors.length === 0) return null;
                return (
                  <div key={catKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn('rounded-md px-2 py-1 text-[10px] font-semibold', catCfg.bg, catCfg.color)}>
                        {catCfg.label}
                      </span>
                      <span className="text-xs text-slate-400">{catVendors.length} vendor{catVendors.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-2">
                      {catVendors.map(vendor => {
                        const stCfg = vendorStatusConfig[vendor.status];
                        return (
                          <div key={vendor.id} className={cn(
                            'rounded-lg p-4 transition-colors',
                            vendor.status === 'blacklisted' ? 'bg-red-50/60' : 'bg-slate-50/65 hover:bg-slate-100/80'
                          )}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className={cn('font-semibold text-sm', vendor.status === 'blacklisted' ? 'text-red-800 line-through' : 'text-slate-900')}>
                                    {vendor.company_name}
                                  </h4>
                                  <Badge variant={stCfg.variant} size="sm">{stCfg.label}</Badge>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{vendor.contact_person}</div>

                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{vendor.phone}</span>
                                  {vendor.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{vendor.email}</span>}
                                  {vendor.gstin && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />GST: {vendor.gstin}</span>}
                                </div>

                                <p className="text-xs text-slate-600 mt-2">{vendor.scope_of_work}</p>

                                <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                                  {vendor.contract_value && (
                                    <span className="font-medium text-slate-700">{formatINR(vendor.contract_value)}</span>
                                  )}
                                  {vendor.rating && renderStars(vendor.rating)}
                                  {vendor.start_date && (
                                    <span className="text-slate-400">{formatDate(vendor.start_date)}{vendor.end_date ? ` — ${formatDate(vendor.end_date)}` : ''}</span>
                                  )}
                                </div>

                                {vendor.notes && (
                                  <p className="mt-2 text-xs text-slate-400 italic">{vendor.notes}</p>
                                )}
                              </div>

                              {/* Actions */}
                              {can('projects', 'edit') && (
                                <div className="relative shrink-0">
                                  <button
                                    onClick={() => setVendorMenuOpen(vendorMenuOpen === vendor.id ? null : vendor.id)}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                  {vendorMenuOpen === vendor.id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setVendorMenuOpen(null)} />
                                      <div className="floating-panel absolute right-0 top-full z-20 mt-1 w-44 py-1">
                                        <button onClick={() => { setEditingVendor(vendor.id); setVendorMenuOpen(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                          <Edit2 className="w-4 h-4" /> Edit
                                        </button>
                                        {vendor.status !== 'blacklisted' && (
                                          <button onClick={() => { store.updateProjectVendor(vendor.id, { status: 'blacklisted' }); setVendorMenuOpen(null); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                                            <Ban className="w-4 h-4" /> Blacklist
                                          </button>
                                        )}
                                        {vendor.status === 'blacklisted' && (
                                          <button onClick={() => { store.updateProjectVendor(vendor.id, { status: 'active' }); setVendorMenuOpen(null); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50">
                                            ↩ Reinstate
                                          </button>
                                        )}
                                        <button onClick={() => { setDeleteConfirm(vendor.id); setVendorMenuOpen(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                                          <Trash2 className="w-4 h-4" /> Remove
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Latest Site Update */}
      {latestUpdate && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Latest Site Update</CardTitle>
            <span className="text-xs text-slate-500">{formatDate(latestUpdate.date)}</span>
          </div>
          <p className="text-sm text-slate-700 mb-3">{latestUpdate.note}</p>
          {latestUpdate.photo_urls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {latestUpdate.photo_urls.map((url, i) => (
                <img key={i} src={url} alt={`Site photo ${i + 1}`} className="w-32 h-24 object-cover rounded-lg shrink-0" />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Add Vendor Modal */}
      <AddVendorModal
        open={showAddVendorModal}
        onClose={() => setShowAddVendorModal(false)}
        firmId={firm.id}
        projectId={projectId}
        userId={user.id}
      />

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <EditVendorModal
          open={!!editingVendor}
          onClose={() => setEditingVendor(null)}
          vendorId={editingVendor}
        />
      )}

      {/* Delete Confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Remove Vendor" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Are you sure you want to remove this vendor from the project?</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteConfirm && handleDeleteVendor(deleteConfirm)}>
              <Trash2 className="w-4 h-4" /> Remove
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── PROJECT STATUS UPDATE MODAL ── */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Project Status" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Select the new status for <b>{project.name}</b>. This will update the project lifecycle stage.
          </p>
          <div className="space-y-2">
            {projectStatusConfig.map(stage => {
              const isCurrent = project.status === stage.key;
              return (
                <button
                  key={stage.key}
                  onClick={() => !isCurrent && handleStatusChange(stage.key)}
                  disabled={isCurrent}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
                    isCurrent
                      ? cn('ring-2 ring-offset-1', stage.borderCls, stage.bgCls, 'ring-current')
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    isCurrent ? 'bg-white shadow-sm' : stage.bgCls
                  )}>
                    <span className={stage.colorCls}>{stage.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-semibold text-sm', isCurrent ? stage.colorCls : 'text-slate-900')}>
                        {stage.label}
                      </span>
                      {isCurrent && (
                        <Badge variant={getStatusColor(project.status)} size="sm">Current</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{stage.desc}</p>
                  </div>
                  {!isCurrent && (
                    <span className="text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100">
                      Select →
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowStatusModal(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {showVendorAccess && isOwner && (
        <VendorAccessModal
          staff={data.profiles.filter(p => p.role === 'architect' || p.role === 'engineer')}
          viewers={vendorViewers ?? new Set()}
          grantedBy={user.id}
          onClose={() => setShowVendorAccess(false)}
          onChanged={loadVendorViewers}
        />
      )}
    </div>
  );
}

// ═══ VENDOR VISIBILITY (allow-list) MODAL ═══
function VendorAccessModal({ staff, viewers, grantedBy, onClose, onChanged }: {
  staff: { id: string; full_name: string; role: string }[];
  viewers: Set<string>; grantedBy: string; onClose: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (id: string, name: string, granted: boolean) => {
    setBusy(id);
    try { await setVendorViewer(id, name, granted, grantedBy); onChanged(); }
    catch (e) { alert('Failed: ' + (e as any).message); } finally { setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} title="Who can see vendors">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Project vendors & contractors are hidden from your team by default. Grant access to the people who need it —
          this applies across <b>all projects</b>. You (the owner) always have access.
        </p>
        <div className="border border-slate-100 rounded-lg divide-y divide-slate-50">
          {staff.map((s) => {
            const on = viewers.has(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-slate-800">{s.full_name}</div>
                  <div className="text-xs text-slate-400 capitalize">{s.role}</div>
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

// ═══ ADD VENDOR MODAL ═══
function AddVendorModal({ open, onClose, firmId, projectId, userId }: {
  open: boolean; onClose: () => void; firmId: string; projectId: string; userId: string;
}) {
  const store = useStore();
  const [form, setForm] = useState({
    company_name: '', contact_person: '', phone: '', email: '', gstin: '',
    category: 'civil' as VendorCategory,
    scope_of_work: '', contract_value: '', status: 'active' as ProjectVendor['status'],
    start_date: '', end_date: '', notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_person || !form.phone) return;
    store.addProjectVendor({
      firm_id: firmId, project_id: projectId,
      company_name: form.company_name, contact_person: form.contact_person,
      phone: form.phone, email: form.email || undefined, gstin: form.gstin || undefined,
      category: form.category, scope_of_work: form.scope_of_work,
      contract_value: form.contract_value ? parseFloat(form.contract_value) : undefined,
      status: form.status, start_date: form.start_date || undefined,
      end_date: form.end_date || undefined, notes: form.notes || undefined,
      added_by: userId,
    });
    setForm({ company_name: '', contact_person: '', phone: '', email: '', gstin: '', category: 'civil', scope_of_work: '', contract_value: '', status: 'active', start_date: '', end_date: '', notes: '' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Vendor" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Company Name *" required value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Patel Construction Co." />
          <Input label="Contact Person *" required value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="Mahesh Patel" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone *" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98211 22334" />
          <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="info@company.in" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="GSTIN" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} placeholder="27AADCP1234F1Z5" />
          <Select label="Category *" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as VendorCategory }))} options={[
            { value: 'civil', label: '🏗️ Civil' }, { value: 'materials', label: '🧱 Materials' },
            { value: 'mep', label: '⚡ MEP' }, { value: 'interior', label: '🛋️ Interior' },
            { value: 'labour', label: '👷 Labour' }, { value: 'landscaping', label: '🌿 Landscaping' },
            { value: 'consultant', label: '📋 Consultant' }, { value: 'other', label: '📎 Other' },
          ]} />
        </div>
        <Textarea label="Scope of Work *" required value={form.scope_of_work} onChange={e => setForm(f => ({ ...f, scope_of_work: e.target.value }))} placeholder="Describe the vendor's scope..." rows={3} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Contract Value (₹)" type="number" value={form.contract_value} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))} placeholder="500000" />
          <Input label="Start Date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          <Input label="End Date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
        </div>
        <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes..." rows={2} />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit"><Plus className="w-4 h-4" /> Add Vendor</Button>
        </div>
      </form>
    </Modal>
  );
}

// ═══ EDIT VENDOR MODAL ═══
function EditVendorModal({ open, onClose, vendorId }: {
  open: boolean; onClose: () => void; vendorId: string;
}) {
  const store = useStore();
  const vendor = store.projectVendors.find(v => v.id === vendorId);
  const [form, setForm] = useState({
    company_name: vendor?.company_name || '', contact_person: vendor?.contact_person || '',
    phone: vendor?.phone || '', email: vendor?.email || '', gstin: vendor?.gstin || '',
    category: vendor?.category || 'civil' as VendorCategory,
    scope_of_work: vendor?.scope_of_work || '',
    contract_value: vendor?.contract_value?.toString() || '',
    status: vendor?.status || 'active' as ProjectVendor['status'],
    start_date: vendor?.start_date || '', end_date: vendor?.end_date || '',
    notes: vendor?.notes || '',
  });

  if (!vendor) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateProjectVendor(vendorId, {
      company_name: form.company_name, contact_person: form.contact_person,
      phone: form.phone, email: form.email || undefined, gstin: form.gstin || undefined,
      category: form.category, scope_of_work: form.scope_of_work,
      contract_value: form.contract_value ? parseFloat(form.contract_value) : undefined,
      status: form.status, start_date: form.start_date || undefined,
      end_date: form.end_date || undefined, notes: form.notes || undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Vendor" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Company Name" required value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
          <Input label="Contact Person" required value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="GSTIN" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as VendorCategory }))} options={[
            { value: 'civil', label: 'Civil' }, { value: 'materials', label: 'Materials' },
            { value: 'mep', label: 'MEP' }, { value: 'interior', label: 'Interior' },
            { value: 'labour', label: 'Labour' }, { value: 'landscaping', label: 'Landscaping' },
            { value: 'consultant', label: 'Consultant' }, { value: 'other', label: 'Other' },
          ]} />
        </div>
        <Textarea label="Scope of Work" required value={form.scope_of_work} onChange={e => setForm(f => ({ ...f, scope_of_work: e.target.value }))} rows={3} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="Contract Value (₹)" type="number" value={form.contract_value} onChange={e => setForm(f => ({ ...f, contract_value: e.target.value }))} />
          <Input label="Start Date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          <Input label="End Date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
        </div>
        <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectVendor['status'] }))} options={[
          { value: 'active', label: '✅ Active' }, { value: 'on_hold', label: '⏸️ On Hold' },
          { value: 'completed', label: '✅ Completed' }, { value: 'blacklisted', label: '🚫 Blacklisted' },
        ]} />
        <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
