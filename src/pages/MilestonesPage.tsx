import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { ProjectSubPageHeader } from '../components/ProjectSubPageHeader';
import { formatDate, formatINR, getStatusColor, statusLabel } from '../utils/format';
import { emitEvent, linkTo } from '../lib/events';
import type { Page } from '../types';
import {
  AlertTriangle, CheckCircle2, Clock, CircleDot, Plus,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  projectId: string;
  onNavigate: (page: Page, projectId?: string) => void;
}

export function MilestonesPage({ projectId, onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [delayReason, setDelayReason] = useState('');

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const selectedProject = projectId;

  const project = data.projects.find(p => p.id === selectedProject);
  const milestones = data.milestones
    .filter(m => m.project_id === selectedProject)
    .sort((a, b) => a.order_index - b.order_index);

  // Gantt chart calculations
  const ganttData = (() => {
    if (milestones.length === 0) return null;
    const allDates = milestones.flatMap(m => [m.planned_start, m.planned_end, m.actual_start, m.actual_end].filter(Boolean) as string[]);
    const minDate = new Date(Math.min(...allDates.map(d => new Date(d).getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => new Date(d).getTime())));
    const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000));

    const getPos = (dateStr: string) => {
      const d = new Date(dateStr);
      return ((d.getTime() - minDate.getTime()) / (totalDays * 86400000)) * 100;
    };

    const getWidth = (start: string, end: string) => {
      return Math.max(2, getPos(end) - getPos(start));
    };

    // Generate month markers
    const months: { label: string; pos: number }[] = [];
    const cursor = new Date(minDate);
    cursor.setDate(1);
    while (cursor <= maxDate) {
      const pos = Math.max(0, getPos(cursor.toISOString().split('T')[0]));
      months.push({
        label: cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        pos,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { minDate, maxDate, totalDays, getPos, getWidth, months };
  })();

  const statusIcons = {
    not_started: <CircleDot className="w-4 h-4 text-slate-400" />,
    in_progress: <Clock className="w-4 h-4 text-blue-500" />,
    completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    delayed: <AlertTriangle className="w-4 h-4 text-red-500" />,
  };

  const handleStatusUpdate = (msId: string, newStatus: string) => {
    if (newStatus === 'delayed') {
      setEditingId(msId);
      setDelayReason('');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const ms = store.milestones.find(m => m.id === msId);
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'in_progress' && !ms?.actual_start) updates.actual_start = today;
    if (newStatus === 'completed') updates.actual_end = today;
    store.updateMilestone(msId, updates as any);

    // Automation: completing a milestone makes its linked payment split due + notifies.
    if (newStatus === 'completed' && ms) {
      const linked = store.paymentSplits.filter(s => s.trigger_milestone_id === msId && s.status !== 'paid' && s.status !== 'partially_paid');
      linked.forEach(s => {
        store.updatePaymentSplit(s.id, { status: 'due' });
        emitEvent({
          type: 'payment_due', firmId: firm.id, actorId: user.id, projectId: selectedProject,
          title: `Payment due — ${project?.name || 'Project'}`,
          message: `Split #${s.split_number} of ${formatINR(s.total_with_gst)} is now due (milestone "${ms.name}" completed)`,
          module: 'payment', action: 'status_changed', entityType: 'payment', entityId: s.id,
          link: linkTo('payments', selectedProject),
        });
      });
      emitEvent({
        type: 'milestone_completed', firmId: firm.id, actorId: user.id, projectId: selectedProject,
        title: `Milestone completed — ${ms.name}`,
        message: `${project?.name || 'Project'}: "${ms.name}" marked complete`,
        module: 'milestone', action: 'status_changed', entityType: 'milestone', entityId: msId, entityName: ms.name,
        link: linkTo('milestones', selectedProject),
      });
    }
  };

  const confirmDelay = () => {
    if (!editingId || !delayReason.trim()) return;
    const ms = store.milestones.find(m => m.id === editingId);
    store.updateMilestone(editingId, { status: 'delayed', delay_reason: delayReason.trim() });
    if (ms) emitEvent({
      type: 'milestone_delayed', firmId: firm.id, actorId: user.id, projectId: selectedProject,
      title: `Milestone delayed — ${ms.name}`,
      message: `${project?.name || 'Project'}: "${ms.name}" delayed — ${delayReason.trim()}`,
      module: 'milestone', action: 'status_changed', entityType: 'milestone', entityId: editingId, entityName: ms.name,
      link: linkTo('milestones', selectedProject),
    });
    setEditingId(null);
    setDelayReason('');
  };

  return (
    <div className="space-y-6">
      <ProjectSubPageHeader projectId={projectId} title="Milestones" subtitle="Track planned vs. actual progress" onNavigate={onNavigate}>
        {can('milestones', 'create') && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        )}
      </ProjectSubPageHeader>

      {/* Gantt Chart */}
      {ganttData && milestones.length > 0 && (
        <Card padding="none">
          <div className="p-4 pb-2">
            <CardTitle>Timeline (Gantt View)</CardTitle>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 bg-indigo-400 rounded-sm" /> Planned
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 bg-emerald-500 rounded-sm" /> Actual
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 bg-red-400 rounded-sm" /> Delayed
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Month headers */}
              <div className="relative h-6 border-b border-slate-200 mx-4">
                {ganttData.months.map((m, i) => (
                  <div
                    key={i}
                    className="absolute text-[10px] text-slate-400 font-medium"
                    style={{ left: `${m.pos}%` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Bars */}
              <div className="px-4 py-2 space-y-1">
                {milestones.map(ms => {
                  const plannedLeft = ganttData.getPos(ms.planned_start);
                  const plannedWidth = ganttData.getWidth(ms.planned_start, ms.planned_end);
                  const hasActual = ms.actual_start;
                  const actualEnd = ms.actual_end || new Date().toISOString().split('T')[0];
                  const actualLeft = hasActual ? ganttData.getPos(ms.actual_start!) : 0;
                  const actualWidth = hasActual ? ganttData.getWidth(ms.actual_start!, actualEnd) : 0;

                  return (
                    <div key={ms.id} className="flex items-center gap-2">
                      <div className="w-36 shrink-0 text-xs text-slate-700 font-medium truncate pr-2">
                        {ms.name}
                      </div>
                      <div className="flex-1 relative h-8">
                        {/* Planned bar */}
                        <div
                          className="absolute top-1 h-3 bg-indigo-200 rounded-sm"
                          style={{ left: `${plannedLeft}%`, width: `${plannedWidth}%` }}
                        />
                        {/* Actual bar */}
                        {hasActual && (
                          <div
                            className={cn(
                              'absolute top-4 h-3 rounded-sm',
                              ms.status === 'delayed' ? 'bg-red-400' : 'bg-emerald-500'
                            )}
                            style={{ left: `${actualLeft}%`, width: `${actualWidth}%` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Milestone List */}
      <div className="space-y-3">
        {milestones.map((ms, idx) => (
          <Card key={ms.id} className="relative">
            {/* Timeline connector */}
            {idx < milestones.length - 1 && (
              <div className="absolute left-7 top-full w-0.5 h-3 bg-slate-200 hidden sm:block" />
            )}

            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                  {ms.order_index}
                </div>
                {statusIcons[ms.status]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-slate-900">{ms.name}</h3>
                    {ms.description && <p className="text-sm text-slate-500 mt-0.5">{ms.description}</p>}
                  </div>
                  <Badge variant={getStatusColor(ms.status)} size="sm">
                    {statusLabel(ms.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Planned Start</span>
                    <span className="text-slate-700 font-medium">{formatDate(ms.planned_start)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Planned End</span>
                    <span className="text-slate-700 font-medium">{formatDate(ms.planned_end)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Actual Start</span>
                    <span className={cn('font-medium', ms.actual_start ? 'text-slate-700' : 'text-slate-300')}>
                      {ms.actual_start ? formatDate(ms.actual_start) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Actual End</span>
                    <span className={cn('font-medium', ms.actual_end ? 'text-slate-700' : 'text-slate-300')}>
                      {ms.actual_end ? formatDate(ms.actual_end) : '—'}
                    </span>
                  </div>
                </div>

                {ms.delay_reason && (
                  <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-red-700">Delay Reason:</span>
                      <p className="text-xs text-red-600">{ms.delay_reason}</p>
                    </div>
                  </div>
                )}

                {/* Status update buttons */}
                {can('milestones', 'edit') && ms.status !== 'completed' && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {ms.status === 'not_started' && (
                      <Button size="sm" variant="secondary" onClick={() => handleStatusUpdate(ms.id, 'in_progress')}>
                        Start
                      </Button>
                    )}
                    {(ms.status === 'in_progress' || ms.status === 'delayed') && (
                      <Button size="sm" variant="success" onClick={() => handleStatusUpdate(ms.id, 'completed')}>
                        <CheckCircle2 className="w-3 h-3" /> Complete
                      </Button>
                    )}
                    {ms.status !== 'delayed' && (
                      <Button size="sm" variant="danger" onClick={() => handleStatusUpdate(ms.id, 'delayed')}>
                        <AlertTriangle className="w-3 h-3" /> Mark Delayed
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {milestones.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No milestones yet for {project?.name || 'this project'}.</p>
        </div>
      )}

      {/* Delay Reason Modal */}
      <Modal open={!!editingId} onClose={() => setEditingId(null)} title="Delay Reason Required">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Please provide a mandatory reason for marking this milestone as delayed.
          </p>
          <Textarea
            label="Delay Reason"
            required
            value={delayReason}
            onChange={e => setDelayReason(e.target.value)}
            placeholder="e.g., Material delivery delayed by vendor..."
            rows={3}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelay} disabled={!delayReason.trim()}>
              Confirm Delay
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Milestone Modal */}
      <AddMilestoneModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        firmId={firm.id}
        projectId={selectedProject}
        nextIndex={milestones.length + 1}
      />
    </div>
  );
}

function AddMilestoneModal({
  open, onClose, firmId, projectId, nextIndex
}: {
  open: boolean;
  onClose: () => void;
  firmId: string;
  projectId: string;
  nextIndex: number;
}) {
  const store = useStore();
  const [form, setForm] = useState({
    name: '',
    description: '',
    planned_start: '',
    planned_end: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.planned_start || !form.planned_end) return;
    store.addMilestone({
      firm_id: firmId,
      project_id: projectId,
      name: form.name,
      description: form.description || undefined,
      planned_start: form.planned_start,
      planned_end: form.planned_end,
      status: 'not_started',
      order_index: nextIndex,
    });
    setForm({ name: '', description: '', planned_start: '', planned_end: '' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Milestone">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Milestone Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Foundation Complete" />
        <Textarea label="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Planned Start" required type="date" value={form.planned_start} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))} />
          <Input label="Planned End" required type="date" value={form.planned_end} onChange={e => setForm(f => ({ ...f, planned_end: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add Milestone</Button>
        </div>
      </form>
    </Modal>
  );
}
