import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatINR, formatINRCompact, formatDate, statusLabel } from '../utils/format';
import {
  Clock, AlertTriangle, Camera, Calendar,
  IndianRupee, MessageSquare, Milestone, ArrowRight,
} from 'lucide-react';
import { cn } from '../utils/cn';
import type { Page } from '../types';

interface Props {
  onNavigate: (page: Page, projectId?: string) => void;
}

export function ClientPortalPage({ onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const myProjects = data.projects.filter(p => p.client_id === user.id);

  if (myProjects.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome, {user.full_name}</h1>
        <p className="text-slate-500">No projects assigned to you yet.</p>
      </div>
    );
  }

  // For now, show the first project (most clients have one project)
  const project = myProjects[0];
  
  const milestones = data.milestones
    .filter(m => m.project_id === project.id)
    .sort((a, b) => a.order_index - b.order_index);
  const completedMs = milestones.filter(m => m.status === 'completed').length;
  const progress = milestones.length > 0 ? Math.round((completedMs / milestones.length) * 100) : 0;
  const delayedMs = milestones.filter(m => m.status === 'delayed');
  const inProgressMs = milestones.find(m => m.status === 'in_progress');

  const updates = data.siteUpdates
    .filter(u => u.project_id === project.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestUpdate = updates[0];

  const splits = data.paymentSplits
    .filter(s => s.project_id === project.id)
    .sort((a, b) => a.split_number - b.split_number);

  const totalReceived = data.paymentsReceived
    .filter(p => p.project_id === project.id)
    .reduce((s, p) => s + p.amount, 0);

  const outstanding = project.project_value - totalReceived;
  const nextDueSplit = splits.find(s => s.status === 'due' || s.status === 'upcoming' || s.status === 'overdue');

  const comments = data.comments.filter(c => c.project_id === project.id);
  const pinnedComments = comments.filter(c => c.is_pinned);

  return (
    <div className="space-y-7">
      {/* Welcome Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-[28px] font-semibold leading-tight text-slate-900">Welcome, {user.full_name}</h1>
        <p className="mt-1.5 text-sm text-slate-500">Your project overview at {firm.name}</p>
      </div>

      {/* Project Card */}
      <Card className="relative overflow-hidden bg-[#15201c] text-white">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/[0.055]" />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="relative flex-1">
            <Badge variant="outline" size="sm" className="mb-3 border-white/12 bg-white/8 text-white/82">
              {statusLabel(project.status)}
            </Badge>
            <h2 className="text-2xl font-semibold tracking-[-0.025em]">{project.name}</h2>
            <p className="mt-2 max-w-[64ch] text-sm leading-6 text-white/52 line-clamp-2">{project.description}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-white/48">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(project.estimated_end_date)}
              </span>
              <span className="flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5" />
                {formatINRCompact(project.project_value)}
              </span>
            </div>
          </div>
          <div className="relative shrink-0 text-left sm:text-right">
            <div className="text-4xl font-semibold tracking-[-0.04em]">{progress}%</div>
            <div className="mt-1 text-sm text-white/44">Complete</div>
          </div>
        </div>
        <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="relative mt-2 flex justify-between text-xs text-white/42">
          <span>{completedMs} of {milestones.length} milestones</span>
          {delayedMs.length > 0 && (
            <span className="text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {delayedMs.length} delayed
            </span>
          )}
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="metric-strip">
        <div className="metric-cell">
          <div className="metric-label flex items-center gap-2"><IndianRupee className="h-4 w-4 text-emerald-600" /> Paid</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-emerald-700">{formatINRCompact(totalReceived)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600" /> Outstanding</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-amber-700">{formatINRCompact(outstanding)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label flex items-center gap-2"><Camera className="h-4 w-4 text-sky-600" /> Site updates</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900">{updates.length}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label flex items-center gap-2"><MessageSquare className="h-4 w-4 text-indigo-600" /> Comments</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900">{comments.length}</div>
        </div>
      </div>

      {/* Current Milestone */}
      {inProgressMs && (
        <Card className="bg-indigo-50/60">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-indigo-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100"><Clock className="w-3.5 h-3.5" /></span>
            Current milestone
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">{inProgressMs.name}</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Started {formatDate(inProgressMs.actual_start || inProgressMs.planned_start)} · 
                Target {formatDate(inProgressMs.planned_end)}
              </p>
            </div>
            <button
              onClick={() => onNavigate('milestones', project.id)}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </Card>
      )}

      {/* Next Payment Due */}
      {nextDueSplit && (
        <Card className={cn(
          nextDueSplit.status === 'overdue' ? 'bg-red-50/70' : 'bg-amber-50/70'
        )}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{
            color: nextDueSplit.status === 'overdue' ? '#dc2626' : '#d97706'
          }}>
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', nextDueSplit.status === 'overdue' ? 'bg-red-100' : 'bg-amber-100')}>
              <IndianRupee className="w-3.5 h-3.5" />
            </span>
            {nextDueSplit.status === 'overdue' ? 'Payment overdue' : 'Next payment due'}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">
                Split #{nextDueSplit.split_number} — {formatINR(nextDueSplit.total_with_gst)}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {nextDueSplit.trigger_type === 'date'
                  ? `Due ${formatDate(nextDueSplit.trigger_date!)}`
                  : 'Milestone-triggered'
                }
              </p>
            </div>
            <button
              onClick={() => onNavigate('payments', project.id)}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
            >
              View Schedule <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </Card>
      )}

      {/* Latest Site Update */}
      {latestUpdate && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-500" />
              Latest Site Update
            </CardTitle>
            <button
              onClick={() => onNavigate('site-updates', project.id)}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-2">{formatDate(latestUpdate.date)}</p>
          <p className="text-sm text-slate-700 mb-3">{latestUpdate.note}</p>
          {latestUpdate.photo_urls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {latestUpdate.photo_urls.map((url, i) => (
                <img key={i} src={url} alt="" className="w-36 h-24 object-cover rounded-lg shrink-0" />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Pinned Discussions */}
      {pinnedComments.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Pinned Discussions
            </CardTitle>
            <button
              onClick={() => onNavigate('comments', project.id)}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {pinnedComments.slice(0, 2).map(comment => {
              const author = data.profiles.find(p => p.id === comment.author_id);
              return (
                <div key={comment.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-slate-900">{author?.full_name}</span>
                    <Badge variant="outline" size="sm">{author?.role}</Badge>
                  </div>
                  <p className="text-sm text-slate-700">{comment.content}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Quick Links Grid */}
      <div className="surface-panel grid grid-cols-1 gap-px overflow-hidden bg-slate-100 sm:grid-cols-2">
        <button onClick={() => onNavigate('milestones', project.id)} className="flex items-center gap-3 bg-white p-4 text-left hover:bg-slate-50">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
            <Milestone className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-slate-900">Milestones</div>
            <div className="text-xs text-slate-500">{completedMs}/{milestones.length} done</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </button>

        <button onClick={() => onNavigate('site-updates', project.id)} className="flex items-center gap-3 bg-white p-4 text-left hover:bg-slate-50">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <Camera className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-slate-900">Site Photos</div>
            <div className="text-xs text-slate-500">{updates.length} updates</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </button>

        <button onClick={() => onNavigate('payments', project.id)} className="flex items-center gap-3 bg-white p-4 text-left hover:bg-slate-50">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
            <IndianRupee className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-slate-900">Payments</div>
            <div className="text-xs text-slate-500">{formatINRCompact(outstanding)} due</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </button>

        <button onClick={() => onNavigate('comments', project.id)} className="flex items-center gap-3 bg-white p-4 text-left hover:bg-slate-50">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-slate-900">Discussions</div>
            <div className="text-xs text-slate-500">{comments.length} messages</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
