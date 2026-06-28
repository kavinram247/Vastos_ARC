import { Avatar } from '../components/ui/Avatar';
import { Popover, MenuItem, MenuLabel, MenuDivider } from './Popover';
import { cn } from '../utils/cn';
import {
  Check, Flag, MoreHorizontal, Bell, Repeat2, ListChecks, CalendarClock,
  Pencil, Trash2, Archive, CornerUpRight, ExternalLink, Tag as TagIcon,
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskList } from '../lib/taskApi';
import {
  STATUS_META, STATUSES, PRIORITY_META, PRIORITIES, LINK_META, dueMeta,
} from './taskLogic';

export interface RowActions {
  onOpen: () => void;
  onToggleComplete: () => void;
  onStatus: (s: TaskStatus) => void;
  onPriority: (p: TaskPriority) => void;
  onSelect: (additive: boolean) => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onOpenLink: () => void;
  canManage: boolean;
  canStatus: boolean;
}

export function TaskRow({ t, list, progress, selected, selecting, me, navigable, actions }: {
  t: Task;
  list?: TaskList;
  progress?: { done: number; total: number };
  selected: boolean;
  selecting: boolean;
  me?: string;
  navigable: boolean;
  actions: RowActions;
}) {
  const done = t.status === 'completed';
  const cancelled = t.status === 'cancelled';
  const pr = PRIORITY_META[t.priority];
  const due = dueMeta(t.due_date, t.status);
  const dueTone =
    due?.tone === 'overdue' ? 'text-red-600 font-semibold' :
    due?.tone === 'today' ? 'text-indigo-700 font-semibold' :
    due?.tone === 'soon' ? 'text-sky-700' : 'text-slate-500';

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={(e) => { if (selecting) actions.onSelect(e.metaKey || e.ctrlKey || e.shiftKey); else actions.onOpen(); }}
      className={cn(
        'group relative flex items-center gap-2.5 px-3 sm:px-4 py-2.5 cursor-pointer transition-colors',
        selected ? 'bg-indigo-50/70' : 'hover:bg-slate-50',
      )}
    >
      {/* selection checkbox — visible on hover or when selecting */}
      <button
        onClick={(e) => { stop(e); actions.onSelect(e.metaKey || e.ctrlKey || e.shiftKey); }}
        aria-label={selected ? 'Deselect' : 'Select'}
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-all',
          selected ? 'border-indigo-600 bg-indigo-600 text-white opacity-100'
            : 'border-slate-300 text-transparent opacity-0 group-hover:opacity-100',
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      {/* completion toggle */}
      <button
        onClick={(e) => { stop(e); if (actions.canStatus) actions.onToggleComplete(); }}
        disabled={!actions.canStatus}
        aria-label={done ? 'Mark not started' : 'Complete task'}
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition-all',
          done ? 'border-emerald-500 bg-emerald-500 text-white'
            : cancelled ? 'border-slate-200 text-transparent'
            : 'border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500',
          actions.canStatus ? '' : 'cursor-not-allowed opacity-60',
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      {/* priority flag (quick popover) */}
      {actions.canManage ? (
        <Popover
          width={170}
          trigger={({ toggle, ref }) => (
            <button ref={ref as any} onClick={(e) => { stop(e); toggle(); }} title={`${pr.label} priority`}
              className="shrink-0 rounded p-0.5 hover:bg-slate-100">
              <Flag className={cn('h-3.5 w-3.5', t.priority === 'low' ? 'text-slate-300' : pr.flag)}
                fill={t.priority === 'low' ? 'none' : 'currentColor'} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>Priority</MenuLabel>
              {PRIORITIES.map((p) => (
                <MenuItem key={p} active={t.priority === p} onClick={() => { actions.onPriority(p); close(); }}
                  icon={<Flag className={PRIORITY_META[p].flag} fill={p === 'low' ? 'none' : 'currentColor'} />}
                  label={PRIORITY_META[p].label} />
              ))}
            </>
          )}
        </Popover>
      ) : (
        <Flag className={cn('h-3.5 w-3.5 shrink-0', t.priority === 'low' ? 'text-slate-300' : pr.flag)}
          fill={t.priority === 'low' ? 'none' : 'currentColor'} />
      )}

      {/* title + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-[13.5px] font-medium', done || cancelled ? 'text-slate-400 line-through' : 'text-slate-900')}>
            {t.title}
          </span>
          {t.is_followup && (
            <span className="hidden shrink-0 items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 sm:inline-flex">
              <CornerUpRight className="h-2.5 w-2.5" /> Follow-up
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] empty:hidden">
          {/* status dot/label (quick popover) */}
          {actions.canStatus ? (
            <Popover
              width={180}
              trigger={({ toggle, ref }) => (
                <button ref={ref as any} onClick={(e) => { stop(e); toggle(); }}
                  className="inline-flex items-center gap-1.5 rounded hover:opacity-80">
                  <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[t.status].dot)} />
                  <span className="font-medium text-slate-500">{STATUS_META[t.status].label}</span>
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>Status</MenuLabel>
                  {STATUSES.map((s) => (
                    <MenuItem key={s} active={t.status === s} onClick={() => { actions.onStatus(s); close(); }}
                      icon={<span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} />}
                      label={STATUS_META[s].label} />
                  ))}
                </>
              )}
            </Popover>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[t.status].dot)} />
              <span className="font-medium text-slate-500">{STATUS_META[t.status].label}</span>
            </span>
          )}

          {due && (
            <span className={cn('inline-flex items-center gap-1', dueTone)}>
              <CalendarClock className="h-3 w-3" />{due.label}
            </span>
          )}
          {t.reminder_at && <Bell className="h-3 w-3 text-slate-400" />}
          {t.repeat !== 'none' && <Repeat2 className="h-3 w-3 text-slate-400" />}
          {progress && progress.total > 0 && (
            <span className={cn('inline-flex items-center gap-1', progress.done === progress.total ? 'text-emerald-600' : 'text-slate-500')}>
              <ListChecks className="h-3 w-3" />{progress.done}/{progress.total}
            </span>
          )}
          {list && (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className={cn('h-1.5 w-1.5 rounded-full', `bg-${list.color}-500`)} style={dotStyle(list.color)} />
              {list.name}
            </span>
          )}
          {t.link_type && t.link_label && (
            <button onClick={(e) => { stop(e); if (navigable) actions.onOpenLink(); }}
              className={cn('inline-flex max-w-[180px] items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600',
                navigable && 'hover:bg-slate-200')}>
              {(() => { const I = LINK_META[t.link_type].icon; return <I className={cn('h-3 w-3', LINK_META[t.link_type].tone)} />; })()}
              <span className="truncate">{t.link_label}</span>
              {navigable && <ExternalLink className="h-2.5 w-2.5 text-slate-400" />}
            </button>
          )}
          {t.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-0.5 text-slate-400"><TagIcon className="h-2.5 w-2.5" />{tag}</span>
          ))}
        </div>
      </div>

      {/* assignee */}
      <div className="hidden shrink-0 sm:block" title={t.assignee_name}>
        <Avatar name={t.assignee_name || '—'} size="sm" className={cn('h-6 w-6 text-[10px]', t.assignee_id === me && 'ring-2 ring-indigo-200')} />
      </div>

      {/* context menu */}
      {actions.canManage && (
        <Popover
          align="end"
          width={190}
          trigger={({ toggle, ref }) => (
            <button ref={ref as any} onClick={(e) => { stop(e); toggle(); }} aria-label="Task actions"
              className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition-colors hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<Pencil />} label="Edit details" onClick={() => { actions.onEdit(); close(); }} />
              {navigable && <MenuItem icon={<ExternalLink />} label="Open linked record" onClick={() => { actions.onOpenLink(); close(); }} />}
              <MenuItem icon={<Archive />} label={t.archived_at ? 'Unarchive' : 'Archive'} onClick={() => { actions.onArchive(); close(); }} />
              <MenuDivider />
              <MenuItem icon={<Trash2 />} label="Delete" danger onClick={() => { actions.onDelete(); close(); }} />
            </>
          )}
        </Popover>
      )}
    </div>
  );
}

// list colours are dynamic → inline style avoids Tailwind purge gaps
const COLOR_HEX: Record<string, string> = {
  slate: '#64716b', emerald: '#23845f', amber: '#b7791f', sky: '#3c6e9d',
  violet: '#7c5cff', rose: '#c44c6e', indigo: '#1b6a59', teal: '#0f766e', orange: '#c2620a',
};
function dotStyle(color: string): React.CSSProperties {
  return { backgroundColor: COLOR_HEX[color] ?? COLOR_HEX.slate };
}
export { COLOR_HEX };
