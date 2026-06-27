import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { formatINR, formatDate, getStatusColor, statusLabel } from '../utils/format';
import type { Page } from '../types';
import {
  Plus, MapPin, Calendar, Users, Search, Filter,
  MoreVertical, PlayCircle, PauseCircle, CheckCircle2, XCircle, Settings2, FolderOpen,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  onNavigate: (page: Page, projectId?: string) => void;
}

export function ProjectsPage({ onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const myProjects = store.getProjectsForUser(user.id, firm.id, user.role);

  const filteredProjects = myProjects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const projectsByStatus = {
    planning: filteredProjects.filter(p => p.status === 'planning'),
    in_progress: filteredProjects.filter(p => p.status === 'in_progress'),
    on_hold: filteredProjects.filter(p => p.status === 'on_hold'),
    completed: filteredProjects.filter(p => p.status === 'completed'),
    cancelled: filteredProjects.filter(p => p.status === 'cancelled'),
  };

  const completedProjects = projectsByStatus.completed;
  const cancelledProjects = projectsByStatus.cancelled;

  const getClient = (id: string) => data.profiles.find(p => p.id === id);
  const getTeam = (projectId: string) => data.assignments.filter(a => a.project_id === projectId);

  const sectionMeta = {
    planning: {
      title: 'Planning Projects',
      subtitle: 'Pre-construction and design stage',
      badgeCls: 'bg-slate-50 text-slate-700 border-slate-200',
    },
    in_progress: {
      title: 'In Progress Projects',
      subtitle: 'Currently active execution projects',
      badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    on_hold: {
      title: 'On Hold Projects',
      subtitle: 'Temporarily paused projects',
      badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    completed: {
      title: 'Completed Projects',
      subtitle: 'Closed and finished projects',
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    cancelled: {
      title: 'Cancelled Projects',
      subtitle: 'Stopped or cancelled projects',
      badgeCls: 'bg-red-50 text-red-700 border-red-200',
    },
  } as const;

  const renderProjectCard = (project: typeof myProjects[number]) => {
    const client = getClient(project.client_id);
    const team = getTeam(project.id);
    const milestones = data.milestones.filter(m => m.project_id === project.id);
    const completed = milestones.filter(m => m.status === 'completed').length;
    const progress = milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0;

    const canEdit = can('projects', 'edit');
    const isMenuOpen = statusMenuOpen === project.id;
    const statusOptions: { key: typeof project.status; label: string; icon: React.ReactNode; cls: string }[] = [
      { key: 'planning', label: 'Planning', icon: <Settings2 className="w-3.5 h-3.5" />, cls: 'text-slate-600 hover:bg-slate-50' },
      { key: 'in_progress', label: 'In Progress', icon: <PlayCircle className="w-3.5 h-3.5" />, cls: 'text-blue-600 hover:bg-blue-50' },
      { key: 'on_hold', label: 'On Hold', icon: <PauseCircle className="w-3.5 h-3.5" />, cls: 'text-amber-600 hover:bg-amber-50' },
      { key: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'text-emerald-600 hover:bg-emerald-50' },
      { key: 'cancelled', label: 'Cancelled', icon: <XCircle className="w-3.5 h-3.5" />, cls: 'text-red-600 hover:bg-red-50' },
    ];

    return (
      <Card
        key={project.id}
        hover
        onClick={() => onNavigate('project-detail', project.id)}
        className="flex flex-col relative"
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight pr-2">{project.name}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={getStatusColor(project.status)} size="sm">
              {statusLabel(project.status)}
            </Badge>
            {canEdit && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setStatusMenuOpen(isMenuOpen ? null : project.id); }}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Change status"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setStatusMenuOpen(null); }} />
                    <div className="floating-panel absolute right-0 top-full z-20 mt-1 w-40 py-1">
                      <div className="px-3 py-1.5 text-[10px] text-slate-400 uppercase font-bold tracking-wider">Set Status</div>
                      {statusOptions.map(opt => (
                        <button
                          key={opt.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            store.updateProject(project.id, {
                              status: opt.key,
                              ...(opt.key === 'completed' ? { actual_end_date: new Date().toISOString().split('T')[0] } : {}),
                            });
                            setStatusMenuOpen(null);
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors',
                            project.status === opt.key ? 'bg-indigo-50 text-indigo-700 font-bold' : opt.cls
                          )}
                        >
                          {opt.icon} {opt.label}
                          {project.status === opt.key && <span className="ml-auto text-[10px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Client: <b>{client?.full_name || 'Unassigned'}</b></span>
          </div>
          {project.address && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{project.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(project.start_date)} — {formatDate(project.estimated_end_date)}</span>
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-900">{formatINR(project.project_value)}</span>
            <span className="text-xs text-slate-500">{team.length} team member{team.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">{progress}%</span>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-sm mt-1">{myProjects.length} project{myProjects.length !== 1 ? 's' : ''}</p>
        </div>
        {can('projects', 'create') && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" /> New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No projects found.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(statusFilter === 'all' || statusFilter === 'planning') && projectsByStatus.planning.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{sectionMeta.planning.title}</h2>
                  <p className="text-sm text-slate-500">{sectionMeta.planning.subtitle}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', sectionMeta.planning.badgeCls)}>
                  {projectsByStatus.planning.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectsByStatus.planning.map(renderProjectCard)}
              </div>
            </section>
          )}

          {(statusFilter === 'all' || statusFilter === 'in_progress') && projectsByStatus.in_progress.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{sectionMeta.in_progress.title}</h2>
                  <p className="text-sm text-slate-500">{sectionMeta.in_progress.subtitle}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', sectionMeta.in_progress.badgeCls)}>
                  {projectsByStatus.in_progress.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectsByStatus.in_progress.map(renderProjectCard)}
              </div>
            </section>
          )}

          {(statusFilter === 'all' || statusFilter === 'on_hold') && projectsByStatus.on_hold.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{sectionMeta.on_hold.title}</h2>
                  <p className="text-sm text-slate-500">{sectionMeta.on_hold.subtitle}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', sectionMeta.on_hold.badgeCls)}>
                  {projectsByStatus.on_hold.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectsByStatus.on_hold.map(renderProjectCard)}
              </div>
            </section>
          )}

          {(statusFilter === 'all' || statusFilter === 'completed') && completedProjects.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-emerald-900">{sectionMeta.completed.title}</h2>
                  <p className="text-sm text-slate-500">{sectionMeta.completed.subtitle}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', sectionMeta.completed.badgeCls)}>
                  {completedProjects.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedProjects.map(renderProjectCard)}
              </div>
            </section>
          )}

          {(statusFilter === 'all' || statusFilter === 'cancelled') && cancelledProjects.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-red-900">{sectionMeta.cancelled.title}</h2>
                  <p className="text-sm text-slate-500">{sectionMeta.cancelled.subtitle}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border', sectionMeta.cancelled.badgeCls)}>
                  {cancelledProjects.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cancelledProjects.map(renderProjectCard)}
              </div>
            </section>
          )}
        </div>
      )}

      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        firmId={firm.id}
        clients={data.profiles.filter(p => p.role === 'client')}
      />
    </div>
  );
}

function CreateProjectModal({
  open, onClose, firmId, clients
}: {
  open: boolean;
  onClose: () => void;
  firmId: string;
  clients: { id: string; full_name: string }[];
}) {
  const store = useStore();
  const [form, setForm] = useState({
    name: '',
    client_id: clients[0]?.id || '',
    project_value: '',
    start_date: '',
    estimated_end_date: '',
    description: '',
    address: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.client_id || !form.project_value || !form.start_date || !form.estimated_end_date) return;
    store.addProject({
      firm_id: firmId,
      name: form.name,
      client_id: form.client_id,
      project_value: parseFloat(form.project_value),
      start_date: form.start_date,
      estimated_end_date: form.estimated_end_date,
      status: 'planning',
      description: form.description,
      address: form.address,
    });
    setForm({ name: '', client_id: clients[0]?.id || '', project_value: '', start_date: '', estimated_end_date: '', description: '', address: '' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Project" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Project Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Kumar Villa – Pune" />
        <Select
          label="Client"
          value={form.client_id}
          onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
          options={clients.map(c => ({ value: c.id, label: c.full_name }))}
        />
        <Input label="Project Value (₹)" required type="number" value={form.project_value} onChange={e => setForm(f => ({ ...f, project_value: e.target.value }))} placeholder="4500000" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" required type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          <Input label="Estimated End Date" required type="date" value={form.estimated_end_date} onChange={e => setForm(f => ({ ...f, estimated_end_date: e.target.value }))} />
        </div>
        <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief project description..." rows={3} />
        <Input label="Site Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create Project</Button>
        </div>
      </form>
    </Modal>
  );
}
