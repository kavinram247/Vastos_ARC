import { useMemo, useRef } from 'react';
import { TaskRow, type RowActions } from './TaskRow';
import { Avatar } from '../components/ui/Avatar';
import { cn } from '../utils/cn';
import {
  CalendarDays, AlertTriangle, Flag, PhoneCall, CalendarClock, Plus, Check,
  CheckCircle2, ArrowRight, Sun,
} from 'lucide-react';
import type { Task, TaskList } from '../lib/taskApi';
import { isOverdue, isDueToday, todayStr, addDays, dueMeta, PRIORITY_META } from './taskLogic';
import type { SmartViewId } from './taskLogic';

export function TodayView({
  tasks, me, meName, subtaskProgress, rowActionsFor, listFor, navigableFor, onQuickAdd, canQuickAdd, onOpen, onJump,
}: {
  tasks: Task[];                      // all firm tasks (active + done)
  me?: string;
  meName: string;
  subtaskProgress: Map<string, { done: number; total: number }>;
  rowActionsFor: (t: Task) => RowActions;
  listFor: (t: Task) => TaskList | undefined;
  navigableFor: (t: Task) => boolean;
  onQuickAdd: (title: string) => void;
  canQuickAdd: boolean;
  onOpen: (t: Task) => void;
  onJump: (v: SmartViewId) => void;
}) {
  const quickRef = useRef<HTMLInputElement>(null);
  const active = (t: Task) => t.status !== 'completed' && t.status !== 'cancelled';

  const { overdue, today, important, followups, upcoming, completedToday } = useMemo(() => {
    const mine = tasks.filter((t) => !me || t.assignee_id === me || t.created_by_id === me);
    const today = todayStr(); const weekEnd = addDays(today, 7);
    return {
      overdue: mine.filter(isOverdue),
      today: mine.filter((t) => isDueToday(t)),
      important: mine.filter((t) => active(t) && (t.priority === 'critical' || t.priority === 'high') && !isOverdue(t) && !isDueToday(t)),
      followups: mine.filter((t) => active(t) && t.is_followup && !isOverdue(t)),
      upcoming: mine.filter((t) => active(t) && t.due_date && t.due_date > today && t.due_date <= weekEnd),
      completedToday: mine.filter((t) => t.completed_at && t.completed_at.slice(0, 10) === today),
    };
  }, [tasks, me]);

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })();
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const focus = [...overdue, ...today];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        {/* greeting */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-medium text-slate-400"><Sun className="h-4 w-4 text-amber-500" />{dateLabel}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-slate-900">{greeting}, {meName.split(' ')[0]}</h1>
            <p className="mt-1 text-[13.5px] text-slate-500">
              {focus.length === 0 ? 'You’re all caught up for today. Nice work.' :
                `${focus.length} task${focus.length === 1 ? '' : 's'} need your attention today${overdue.length ? ` · ${overdue.length} overdue` : ''}.`}
            </p>
          </div>
        </div>

        {/* stat tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={CalendarDays} tone="text-indigo-600" bg="bg-indigo-50" label="Due today" value={today.length} onClick={() => onJump('today')} />
          <Stat icon={AlertTriangle} tone="text-red-600" bg="bg-red-50" label="Overdue" value={overdue.length} onClick={() => onJump('overdue')} />
          <Stat icon={PhoneCall} tone="text-rose-600" bg="bg-rose-50" label="Follow-ups" value={followups.length} onClick={() => onJump('followups')} />
          <Stat icon={CheckCircle2} tone="text-emerald-600" bg="bg-emerald-50" label="Done today" value={completedToday.length} />
        </div>

        {/* quick add */}
        {canQuickAdd && (
          <div className="mt-5 flex items-center gap-2.5 rounded-[12px] bg-white px-4 py-3 shadow-[var(--shadow-surface)]">
            <Plus className="h-4 w-4 text-indigo-500" />
            <input ref={quickRef} onKeyDown={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (e.key === 'Enter' && v) { onQuickAdd(v); (e.target as HTMLInputElement).value = ''; } }}
              placeholder="Add a task for today…" className="h-7 flex-1 bg-transparent text-[14px] placeholder:text-slate-400 focus:outline-none" />
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* focus column */}
          <div className="lg:col-span-2">
            <SectionHead icon={CalendarClock} accent="text-indigo-600" title="Your focus" count={focus.length} />
            <div className="overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-surface)]">
              {focus.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50"><Check className="h-6 w-6 text-emerald-500" /></div>
                  <p className="mt-3 text-[14px] font-semibold text-slate-700">Inbox zero for today</p>
                  <p className="mt-1 text-[13px] text-slate-400">Nothing overdue or due today.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {overdue.length > 0 && <GroupLabel tone="bg-red-500" label="Overdue" count={overdue.length} />}
                  {overdue.map((t) => <li key={t.id}><TaskRow t={t} list={listFor(t)} progress={subtaskProgress.get(t.id)} me={me} selected={false} selecting={false} navigable={navigableFor(t)} actions={{ ...rowActionsFor(t), onSelect: () => {} }} /></li>)}
                  {today.length > 0 && <GroupLabel tone="bg-indigo-500" label="Today" count={today.length} />}
                  {today.map((t) => <li key={t.id}><TaskRow t={t} list={listFor(t)} progress={subtaskProgress.get(t.id)} me={me} selected={false} selecting={false} navigable={navigableFor(t)} actions={{ ...rowActionsFor(t), onSelect: () => {} }} /></li>)}
                </ul>
              )}
            </div>
          </div>

          {/* side column */}
          <div className="space-y-6">
            <MiniList icon={Flag} accent="text-amber-600" title="Important" tasks={important} onOpen={onOpen} onJump={() => onJump('important')} empty="No high-priority work pending." />
            <MiniList icon={PhoneCall} accent="text-rose-600" title="Follow-ups" tasks={followups} onOpen={onOpen} onJump={() => onJump('followups')} empty="No follow-ups scheduled." />
            <MiniList icon={CalendarClock} accent="text-sky-600" title="Next 7 days" tasks={upcoming} onOpen={onOpen} onJump={() => onJump('upcoming')} empty="Nothing coming up this week." />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, bg, label, value, onClick }: { icon: any; tone: string; bg: string; label: string; value: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={cn('flex items-center gap-3 rounded-[12px] bg-white p-3.5 text-left shadow-[var(--shadow-surface)] transition-all', onClick && 'hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(16,32,26,0.08)]')}>
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]', bg)}><Icon className={cn('h-4.5 w-4.5', tone)} /></span>
      <span>
        <span className="block text-[22px] font-semibold leading-none tabular-nums text-slate-900">{value}</span>
        <span className="mt-1 block text-[11.5px] font-medium text-slate-500">{label}</span>
      </span>
    </button>
  );
}

function SectionHead({ icon: Icon, accent, title, count }: { icon: any; accent: string; title: string; count: number }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 px-0.5">
      <Icon className={cn('h-4 w-4', accent)} />
      <h3 className="text-[14px] font-semibold text-slate-800">{title}</h3>
      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">{count}</span>
    </div>
  );
}
function GroupLabel({ tone, label, count }: { tone: string; label: string; count: number }) {
  return (
    <li className="flex items-center gap-2 bg-slate-50/70 px-4 py-1.5">
      <span className={cn('h-2 w-2 rounded-full', tone)} />
      <span className="text-[12px] font-semibold text-slate-600">{label}</span>
      <span className="text-[11px] tabular-nums text-slate-400">{count}</span>
    </li>
  );
}

function MiniList({ icon: Icon, accent, title, tasks, onOpen, onJump, empty }: {
  icon: any; accent: string; title: string; tasks: Task[]; onOpen: (t: Task) => void; onJump: () => void; empty: string;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 px-0.5">
        <Icon className={cn('h-4 w-4', accent)} />
        <h3 className="flex-1 text-[14px] font-semibold text-slate-800">{title}</h3>
        {tasks.length > 0 && (
          <button onClick={onJump} className="inline-flex items-center gap-0.5 text-[12px] font-medium text-slate-400 hover:text-indigo-600">
            All <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-surface)]">
        {tasks.length === 0 ? (
          <p className="px-4 py-5 text-[12.5px] text-slate-400">{empty}</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {tasks.slice(0, 5).map((t) => {
              const due = dueMeta(t.due_date, t.status);
              return (
                <li key={t.id}>
                  <button onClick={() => onOpen(t)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50">
                    <Flag className={cn('h-3 w-3 shrink-0', t.priority === 'low' ? 'text-slate-300' : PRIORITY_META[t.priority].flag)} fill={t.priority === 'low' ? 'none' : 'currentColor'} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{t.title}</span>
                    {due && <span className={cn('shrink-0 text-[11px]', due.tone === 'overdue' ? 'text-red-600 font-semibold' : 'text-slate-400')}>{due.label}</span>}
                    <Avatar name={t.assignee_name || '—'} size="sm" className="h-5 w-5 shrink-0 text-[9px]" />
                  </button>
                </li>
              );
            })}
            {tasks.length > 5 && <li><button onClick={onJump} className="w-full px-4 py-2 text-left text-[12px] font-medium text-indigo-600 hover:bg-slate-50">+{tasks.length - 5} more</button></li>}
          </ul>
        )}
      </div>
    </div>
  );
}
