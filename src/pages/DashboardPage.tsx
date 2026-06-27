import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatINR, formatINRCompact, formatDate, getStatusColor, statusLabel } from '../utils/format';
import type { Page } from '../types';
import {
  TrendingUp, AlertTriangle, Clock, IndianRupee,
  FolderKanban, CheckCircle2, ArrowRight, UserPlus, FolderPlus, Receipt, Target,
} from 'lucide-react';

interface Props {
  onNavigate: (page: Page, projectId?: string) => void;
}

export function DashboardPage({ onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const myProjects = store.getProjectsForUser(user.id, firm.id, user.role);
  const activeProjects = myProjects.filter(p => ['planning', 'in_progress', 'on_hold'].includes(p.status));
  const completedProjects = myProjects.filter(p => p.status === 'completed');

  // Metrics
  const ongoingProjects = myProjects.filter(p => p.status === 'in_progress');
  const delayedMilestones = data.milestones.filter(m =>
    m.status === 'delayed' && myProjects.some(p => p.id === m.project_id)
  );
  const overduePayments = data.paymentSplits.filter(s =>
    (s.status === 'overdue' || s.status === 'due') && myProjects.some(p => p.id === s.project_id)
  );
  const today = new Date().toISOString().split('T')[0];
  const overdueFollowups = (user.role === 'owner' || user.role === 'architect')
    ? data.leads.filter(l => l.next_follow_up && l.next_follow_up < today && !['won', 'lost', 'junk'].includes(l.status))
    : [];

  // Financial summary per project
  const projectFinancials = myProjects.map(project => {
    const received = data.paymentsReceived
      .filter(p => p.project_id === project.id)
      .reduce((sum, p) => sum + p.amount, 0);
    const costs = data.costEntries
      .filter(c => c.project_id === project.id)
      .reduce((sum, c) => sum + c.amount, 0);
    const profit = received - costs;
    const outstanding = project.project_value - received;
    return { project, received, costs, profit, outstanding };
  });

  const totalValue = myProjects.reduce((s, p) => s + p.project_value, 0);
  const totalReceived = projectFinancials.reduce((s, pf) => s + pf.received, 0);
  const totalOutstanding = projectFinancials.reduce((s, pf) => s + pf.outstanding, 0);
  const totalProfit = projectFinancials.reduce((s, pf) => s + pf.profit, 0);

  // Clients with outstanding
  const clientOutstanding = new Map<string, number>();
  projectFinancials.forEach(pf => {
    const clientId = pf.project.client_id;
    clientOutstanding.set(clientId, (clientOutstanding.get(clientId) || 0) + pf.outstanding);
  });

  const clientProfile = (id: string) => data.profiles.find(p => p.id === id);

  // Sales pipeline snapshot (owner/architect) — connects the funnel into the command center
  const showPipeline = user.role === 'owner' || user.role === 'architect';
  const activeLeads = data.leads.filter(l => !['won', 'lost', 'junk'].includes(l.status));
  const pipelineValue = activeLeads.reduce((s, l) => s + (l.estimated_budget || 0), 0);
  const newLeads = data.leads.filter(l => l.status === 'new');
  const dueFollowups = data.leads.filter(l => l.next_follow_up === today && !['won', 'lost', 'junk'].includes(l.status));
  const wonLeads = data.leads.filter(l => l.status === 'won');
  const winRate = data.leads.length ? Math.round((wonLeads.length / data.leads.length) * 100) : 0;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="page-header border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-900">Dashboard</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Welcome back, {user.full_name}. Here’s the current state of the practice.
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-xs font-semibold text-slate-600">{firm.name}</div>
          <div className="mt-1 text-xs text-slate-400">{activeProjects.length} active projects</div>
        </div>
      </div>

      {/* Quick actions — launchpad into the workflow */}
      {showPipeline && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate('leads')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
            <UserPlus className="w-4 h-4" /> Leads
          </button>
          <button onClick={() => onNavigate('projects')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
            <FolderPlus className="w-4 h-4" /> Projects
          </button>
          <button onClick={() => onNavigate('quotations')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
            <Receipt className="w-4 h-4" /> Quotations
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div className="metric-strip">
        <div className="metric-cell">
          <div className="flex items-center justify-between">
            <span className="metric-label">Active projects</span>
            <FolderKanban className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="metric-value">{ongoingProjects.length}</div>
          <div className="metric-note">{activeProjects.length} active · {completedProjects.length} completed</div>
        </div>

        <div className="metric-cell">
          <div className="flex items-center justify-between">
            <span className="metric-label">Portfolio value</span>
            <IndianRupee className="h-4 w-4 text-slate-400" />
          </div>
          <div className="metric-value">{formatINRCompact(totalValue)}</div>
          <div className="metric-note text-emerald-700">{formatINRCompact(totalReceived)} received</div>
        </div>

        <div className="metric-cell">
          <div className="flex items-center justify-between">
            <span className="metric-label">Outstanding</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="metric-value text-amber-700">{formatINRCompact(totalOutstanding)}</div>
          <div className="metric-note">{overduePayments.length} overdue splits</div>
        </div>

        <div className="metric-cell">
          <div className="flex items-center justify-between">
            <span className="metric-label">Net profit</span>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </div>
          <div className={`metric-value ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatINRCompact(totalProfit)}
          </div>
          <div className="metric-note">Received less recorded costs</div>
        </div>
      </div>

      {/* Needs attention — actionable, deep-linked */}
      {(delayedMilestones.length > 0 || overduePayments.length > 0 || overdueFollowups.length > 0) && (
        <Card className="border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-800">Needs attention</span>
          </div>
          <div className="space-y-1">
            {delayedMilestones.map(m => {
              const project = myProjects.find(p => p.id === m.project_id);
              return (
                <button key={m.id} onClick={() => onNavigate('milestones', m.project_id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-amber-800 hover:bg-amber-100/60">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                  <span className="flex-1"><b>{project?.name}</b>: "{m.name}" milestone is delayed — {m.delay_reason}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </button>
              );
            })}
            {overduePayments.map(s => {
              const project = myProjects.find(p => p.id === s.project_id);
              return (
                <button key={s.id} onClick={() => onNavigate('payments', s.project_id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-amber-800 hover:bg-amber-100/60">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                  <span className="flex-1"><b>{project?.name}</b>: Split #{s.split_number} ({formatINR(s.total_with_gst)}) is {s.status === 'overdue' ? 'overdue' : 'due'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </button>
              );
            })}
            {overdueFollowups.map(l => (
              <button key={l.id} onClick={() => onNavigate('leads')}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-amber-800 hover:bg-amber-100/60">
                <span className="w-1.5 h-1.5 bg-sky-500 rounded-full shrink-0" />
                <span className="flex-1"><b>{l.client_name}</b>: follow-up overdue since {formatDate(l.next_follow_up!)}</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sales pipeline — the top of the funnel, on the command center */}
        {showPipeline && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-indigo-600" /> Sales Pipeline</CardTitle>
              <button onClick={() => onNavigate('leads')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                View pipeline <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">Active leads</div>
                <div className="text-2xl font-bold text-slate-900">{activeLeads.length}</div>
                <div className="text-xs text-slate-500 mt-0.5">{formatINRCompact(pipelineValue)} in pipeline</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Win rate</div>
                <div className="text-2xl font-bold text-emerald-600">{winRate}%</div>
                <div className="text-xs text-slate-500 mt-0.5">{wonLeads.length} won all-time</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {newLeads.length > 0 && (
                <button onClick={() => onNavigate('leads')} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100">
                  <span className="font-bold">{newLeads.length}</span> new {newLeads.length === 1 ? 'inquiry' : 'inquiries'}
                </button>
              )}
              {dueFollowups.length > 0 && (
                <button onClick={() => onNavigate('leads')} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                  <Clock className="w-3 h-3" /> {dueFollowups.length} due today
                </button>
              )}
              {overdueFollowups.length > 0 && (
                <button onClick={() => onNavigate('leads')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                  <AlertTriangle className="w-3 h-3" /> {overdueFollowups.length} overdue
                </button>
              )}
              {newLeads.length === 0 && dueFollowups.length === 0 && overdueFollowups.length === 0 && (
                <span className="text-xs text-slate-400">No pending follow-ups 🎉</span>
              )}
            </div>
          </Card>
        )}

        {/* Active Project Status */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Active Project Status</CardTitle>
            <button
              onClick={() => onNavigate('projects')}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {activeProjects.length > 0 ? activeProjects.map(project => {
              const projectMs = data.milestones.filter(m => m.project_id === project.id);
              const completedMs = projectMs.filter(m => m.status === 'completed').length;
              const progress = projectMs.length > 0 ? Math.round((completedMs / projectMs.length) * 100) : 0;
              const clientName = clientProfile(project.client_id)?.full_name || 'Unknown';

              return (
                <button
                  key={project.id}
                  onClick={() => onNavigate('project-detail', project.id)}
                  className="flex w-full items-center gap-4 border-b border-slate-100 px-2 py-3 text-left last:border-b-0 hover:rounded-lg hover:border-transparent hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">{project.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{clientName} · {formatINRCompact(project.project_value)}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-20">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>{progress}%</span>
                        <span>{completedMs}/{projectMs.length}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <Badge variant={getStatusColor(project.status)} size="sm">
                      {statusLabel(project.status)}
                    </Badge>
                  </div>
                </button>
              );
            }) : (
              <div className="text-center py-8 text-sm text-slate-400">No active projects.</div>
            )}
          </div>
        </Card>

        {/* Profit per Project */}
        <Card>
          <CardTitle className="mb-4">Profit by Project</CardTitle>
          <div className="space-y-3">
            {projectFinancials.map(pf => (
              <div key={pf.project.id} className="border-b border-slate-100 px-1 py-3 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-slate-900 truncate">{pf.project.name}</span>
                  <span className={`text-sm font-semibold ${pf.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatINR(pf.profit)}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>Received: <b className="text-slate-700">{formatINRCompact(pf.received)}</b></span>
                  <span>Costs: <b className="text-slate-700">{formatINRCompact(pf.costs)}</b></span>
                  <span>Outstanding: <b className="text-amber-600">{formatINRCompact(pf.outstanding)}</b></span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Outstanding by Client */}
        {(user.role === 'owner' || user.role === 'architect') && (
          <Card>
            <CardTitle className="mb-4">Outstanding by Client</CardTitle>
            <div className="space-y-3">
              {Array.from(clientOutstanding.entries()).map(([clientId, amount]) => {
                const client = clientProfile(clientId);
                return (
                  <div key={clientId} className="flex items-center justify-between border-b border-slate-100 px-1 py-3 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                        {client?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-slate-900">{client?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{client?.phone}</div>
                      </div>
                    </div>
                    <span className={`font-semibold text-sm ${amount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatINR(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Completed Projects */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Completed Projects</CardTitle>
            <span className="text-xs text-emerald-600 font-medium">{completedProjects.length} completed</span>
          </div>
          <div className="space-y-3">
            {completedProjects.length > 0 ? completedProjects.map(project => {
              const clientName = clientProfile(project.client_id)?.full_name || 'Unknown';
              return (
                <button
                  key={project.id}
                  onClick={() => onNavigate('project-detail', project.id)}
                  className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-2 py-3 text-left last:border-b-0 hover:rounded-lg hover:border-transparent hover:bg-emerald-50/70"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">{project.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{clientName} · {formatINRCompact(project.project_value)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="success" size="sm">Completed</Badge>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {project.actual_end_date ? `Closed ${new Date(project.actual_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Closed'}
                    </div>
                  </div>
                </button>
              );
            }) : (
              <div className="text-center py-8 text-sm text-slate-400">No completed projects yet.</div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardTitle className="mb-4">Recent Activity</CardTitle>
          <div className="space-y-3">
            {data.activityLog
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 6)
              .map(log => {
                const actor = data.profiles.find(p => p.id === log.user_id);
                return (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-slate-700">
                        <b>{actor?.full_name || 'System'}</b> {log.details || log.action.replace(/_/g, ' ')}
                      </span>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(log.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}
