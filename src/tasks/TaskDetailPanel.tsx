import { useEffect, useState } from 'react';
import { Avatar } from '../components/ui/Avatar';
import { Popover, MenuItem } from './Popover';
import { TaskLinkPicker } from './TaskLinkPicker';
import { COLOR_HEX } from './TaskRow';
import { cn } from '../utils/cn';
import { timeAgo, formatDateTime } from '../utils/format';
import {
  X, Check, Flag, CalendarClock, CalendarPlus, Bell, Repeat2, User as UserIcon, ListPlus,
  Plus, Trash2, Archive, CornerUpRight, ExternalLink, Tag as TagIcon,
  GripVertical, ChevronDown, Circle,
} from 'lucide-react';
import type { Task, TaskInput, TaskList, Subtask, TaskActivity, TaskRepeat } from '../lib/taskApi';
import { STATUS_META, STATUSES, PRIORITY_META, PRIORITIES, LINK_META } from './taskLogic';

interface Staff { id: string; full_name: string; role: string; }

export function TaskDetailPanel({
  task, list, lists, subtasks, activity, staff, store, firmId, me, canManage, canStatus, navigable,
  onClose, onUpdate, onSubtaskAdd, onSubtaskToggle, onSubtaskRename, onSubtaskDelete, onComment, onDelete, onArchive, onOpenLink,
}: {
  task: Task;
  list?: TaskList;
  lists: TaskList[];
  subtasks: Subtask[];
  activity: TaskActivity[] | null;
  staff: Staff[];
  store: typeof import('../data/store').store;
  firmId: string;
  me: { id: string; name: string };
  canManage: boolean;
  canStatus: boolean;
  navigable: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<TaskInput>) => void;
  onSubtaskAdd: (title: string) => void;
  onSubtaskToggle: (id: string, done: boolean) => void;
  onSubtaskRename: (id: string, title: string) => void;
  onSubtaskDelete: (id: string) => void;
  onComment: (text: string) => void;
  onDelete: () => void;
  onArchive: () => void;
  onOpenLink: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');
  const [newSub, setNewSub] = useState('');
  const [comment, setComment] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  useEffect(() => { setTitle(task.title); setDescription(task.description ?? ''); setNotes(task.notes ?? ''); }, [task.id]);

  const done = task.status === 'completed';
  const ro = !canManage; // read-only fields when not allowed to manage
  const subDone = subtasks.filter((s) => s.done).length;
  const pct = subtasks.length ? Math.round((subDone / subtasks.length) * 100) : (done ? 100 : task.progress);

  const commit = (patch: Partial<TaskInput>) => { if (!ro) onUpdate(patch); };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/20 lg:bg-transparent" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[460px] flex-col bg-white shadow-[0_0_40px_rgba(10,24,18,0.16)] ring-1 ring-slate-200/70 animate-[slidein_.18s_ease-out]">
        {/* header */}
        <div className="flex items-start gap-2.5 border-b border-slate-100 px-5 py-4">
          <button
            onClick={() => canStatus && onUpdate({ status: done ? 'not_started' : 'completed' })}
            disabled={!canStatus}
            className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-all',
              done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500',
              !canStatus && 'cursor-not-allowed opacity-60')}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          <textarea
            value={title} disabled={ro} rows={1}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { const v = title.trim(); if (v && v !== task.title) commit({ title: v }); else if (!v) setTitle(task.title); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
            className={cn('mt-0 min-h-[28px] flex-1 resize-none bg-transparent text-[16px] font-semibold leading-snug text-slate-900 focus:outline-none disabled:text-slate-700',
              done && 'text-slate-400 line-through')}
          />
          <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* properties */}
          <div className="space-y-1 px-5 py-4">
            <PropRow icon={<Circle className={cn('h-4 w-4', STATUS_META[task.status].dot.replace('bg-', 'text-'))} fill="currentColor" />} label="Status">
              <Picker disabled={!canStatus} value={STATUS_META[task.status].label} width={190}>
                {(close) => STATUSES.map((s) => (
                  <MenuItem key={s} active={task.status === s} onClick={() => { onUpdate({ status: s }); close(); }}
                    icon={<span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} />} label={STATUS_META[s].label} />
                ))}
              </Picker>
            </PropRow>

            <PropRow icon={<Flag className={cn('h-4 w-4', PRIORITY_META[task.priority].flag)} fill={task.priority === 'low' ? 'none' : 'currentColor'} />} label="Priority">
              <Picker disabled={ro} value={PRIORITY_META[task.priority].label} width={170}>
                {(close) => PRIORITIES.map((p) => (
                  <MenuItem key={p} active={task.priority === p} onClick={() => { commit({ priority: p }); close(); }}
                    icon={<Flag className={PRIORITY_META[p].flag} fill={p === 'low' ? 'none' : 'currentColor'} />} label={PRIORITY_META[p].label} />
                ))}
              </Picker>
            </PropRow>

            <PropRow icon={<UserIcon className="h-4 w-4 text-slate-400" />} label="Assignee">
              <Picker disabled={ro} value={<span className="inline-flex items-center gap-1.5"><Avatar name={task.assignee_name || '—'} size="sm" className="h-4 w-4 text-[8px]" />{task.assignee_name || 'Unassigned'}</span>} width={230}>
                {(close) => staff.map((s) => (
                  <MenuItem key={s.id} active={task.assignee_id === s.id} onClick={() => { commit({ assignee_id: s.id, assignee_name: s.full_name }); close(); }}
                    icon={<Avatar name={s.full_name} size="sm" className="h-4 w-4 text-[8px]" />} label={<span>{s.full_name}<span className="ml-1 text-[11px] capitalize text-slate-400">{s.role}</span></span>} />
                ))}
              </Picker>
            </PropRow>

            <PropRow icon={<ListPlus className="h-4 w-4 text-slate-400" />} label="List">
              <Picker disabled={ro} value={list ? <span className="inline-flex items-center gap-1.5"><Dot color={list.color} />{list.name}</span> : 'No list'} width={210}>
                {(close) => (<>
                  <MenuItem active={!task.list_id} onClick={() => { commit({ list_id: null }); close(); }} label="No list" />
                  {lists.map((l) => (
                    <MenuItem key={l.id} active={task.list_id === l.id} onClick={() => { commit({ list_id: l.id }); close(); }}
                      icon={<Dot color={l.color} />} label={l.name} />
                  ))}
                </>)}
              </Picker>
            </PropRow>

            <PropRow icon={<CalendarClock className="h-4 w-4 text-slate-400" />} label="Due">
              <DateField value={task.due_date} disabled={ro} onChange={(v) => commit({ due_date: v })} />
            </PropRow>
            <PropRow icon={<CalendarPlus className="h-4 w-4 text-slate-400" />} label="Start">
              <DateField value={task.start_date} disabled={ro} onChange={(v) => commit({ start_date: v })} />
            </PropRow>
            <PropRow icon={<Bell className="h-4 w-4 text-slate-400" />} label="Reminder">
              <DateTimeField value={task.reminder_at} disabled={ro} onChange={(v) => commit({ reminder_at: v })} />
            </PropRow>
            <PropRow icon={<Repeat2 className="h-4 w-4 text-slate-400" />} label="Repeat">
              <Picker disabled={ro} value={REPEAT_LABEL[task.repeat]} width={170}>
                {(close) => (Object.keys(REPEAT_LABEL) as TaskRepeat[]).map((r) => (
                  <MenuItem key={r} active={task.repeat === r} onClick={() => { commit({ repeat: r }); close(); }} label={REPEAT_LABEL[r]} />
                ))}
              </Picker>
            </PropRow>

            <PropRow icon={<CornerUpRight className="h-4 w-4 text-slate-400" />} label="Follow-up">
              <Toggle on={task.is_followup} disabled={ro} onChange={(v) => commit({ is_followup: v })} />
            </PropRow>

            <div className="pt-1.5">
              <TaskLinkPicker value={{ link_type: task.link_type, link_id: task.link_id, link_label: task.link_label }}
                store={store} firmId={firmId} onChange={(v) => commit(v)} />
              {navigable && task.link_type && (
                <button onClick={onOpenLink} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-700">
                  <ExternalLink className="h-3 w-3" /> Open {LINK_META[task.link_type].label.toLowerCase()} record
                </button>
              )}
            </div>
          </div>

          <Divider />

          {/* description */}
          <Section title="Description">
            <textarea value={description} disabled={ro} onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (task.description ?? '') && commit({ description: description || null })}
              placeholder="Add more detail…" rows={3}
              className="w-full resize-none rounded-[9px] border border-slate-200 px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12" />
          </Section>

          {/* checklist */}
          <Section title="Checklist" trailing={subtasks.length > 0 ? <span className="text-[11px] font-medium text-slate-400">{subDone}/{subtasks.length}</span> : undefined}>
            {subtasks.length > 0 && (
              <div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            <div className="space-y-0.5">
              {subtasks.map((s) => (
                <SubtaskRow key={s.id} s={s} ro={ro} onToggle={() => onSubtaskToggle(s.id, !s.done)} onRename={(v) => onSubtaskRename(s.id, v)} onDelete={() => onSubtaskDelete(s.id)} />
              ))}
            </div>
            {!ro && (
              <div className="mt-1 flex items-center gap-2 px-0.5">
                <Plus className="h-4 w-4 text-slate-300" />
                <input value={newSub} onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newSub.trim()) { onSubtaskAdd(newSub.trim()); setNewSub(''); } }}
                  placeholder="Add a step" className="h-7 flex-1 bg-transparent text-[13px] placeholder:text-slate-400 focus:outline-none" />
              </div>
            )}
          </Section>

          {/* notes */}
          <Section title="Notes">
            <textarea value={notes} disabled={ro} onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (task.notes ?? '') && commit({ notes: notes || null })}
              placeholder="Internal notes…" rows={3}
              className="w-full resize-none rounded-[9px] border border-slate-200 px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12" />
          </Section>

          {/* attachments */}
          <Section title="Attachments">
            <AttachmentList task={task} ro={ro} onChange={(att) => commit({ attachments: att })} />
          </Section>

          {/* tags */}
          <Section title="Tags">
            <div className="flex flex-wrap items-center gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                  <TagIcon className="h-2.5 w-2.5 text-slate-400" />{tag}
                  {!ro && <button onClick={() => commit({ tags: task.tags.filter((x) => x !== tag) })} className="text-slate-400 hover:text-red-500"><X className="h-2.5 w-2.5" /></button>}
                </span>
              ))}
              {!ro && (
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { const v = tagInput.trim().toLowerCase(); if (e.key === 'Enter' && v && !task.tags.includes(v)) { commit({ tags: [...task.tags, v] }); setTagInput(''); } }}
                  placeholder="Add tag" className="h-7 w-24 rounded-md border border-dashed border-slate-200 px-2 text-[12px] focus:border-indigo-500 focus:outline-none" />
              )}
            </div>
          </Section>

          <Divider />

          {/* activity */}
          <Section title="Activity">
            <div className="flex items-start gap-2">
              <Avatar name={me.name} size="sm" className="h-6 w-6 text-[10px]" />
              <div className="flex-1">
                <input value={comment} onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) { onComment(comment.trim()); setComment(''); } }}
                  placeholder="Write a comment…" className="h-8 w-full rounded-[9px] border border-slate-200 px-2.5 text-[13px] focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-600/12" />
              </div>
            </div>
            <ol className="mt-3 space-y-2.5">
              {activity === null && <li className="text-[12px] text-slate-400">Loading activity…</li>}
              {activity?.map((a) => (
                <li key={a.id} className="flex gap-2.5 text-[12px]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <div className="min-w-0">
                    {a.kind === 'comment' ? (
                      <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-700"><span className="font-semibold">{a.actor_name}</span>: {a.detail}</p>
                    ) : (
                      <p className="text-slate-500"><span className="font-medium text-slate-700">{a.actor_name}</span> {ACTIVITY_VERB[a.kind] ?? a.kind}{a.detail ? <> · <span className="text-slate-600">{a.detail}</span></> : null}</p>
                    )}
                    <span className="text-[11px] text-slate-400">{timeAgo(a.created_at)}</span>
                  </div>
                </li>
              ))}
              {activity && activity.length === 0 && <li className="text-[12px] text-slate-400">No activity yet.</li>}
            </ol>
          </Section>

          {/* meta + danger */}
          <div className="space-y-1 border-t border-slate-100 px-5 py-4 text-[11px] text-slate-400">
            <div>Created by <span className="text-slate-500">{task.created_by_name}</span> · {formatDateTime(task.created_at)}</div>
            <div>Updated {timeAgo(task.updated_at)}{task.completed_at ? <> · Completed {formatDateTime(task.completed_at)}</> : null}</div>
          </div>
        </div>

        {/* footer actions */}
        {canManage && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
            <button onClick={onArchive} className="inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <Archive className="h-4 w-4" />{task.archived_at ? 'Unarchive' : 'Archive'}
            </button>
            {showCancel ? (
              <span className="inline-flex items-center gap-2 text-[12px]">
                <span className="text-slate-500">Delete?</span>
                <button onClick={onDelete} className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700">Delete</button>
                <button onClick={() => setShowCancel(false)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">No</button>
              </span>
            ) : (
              <button onClick={() => setShowCancel(true)} className="inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        )}
      </aside>
      <style>{`@keyframes slidein{from{transform:translateX(16px);opacity:.4}to{transform:translateX(0);opacity:1}}`}</style>
    </>
  );
}

// ── small building blocks ──
const REPEAT_LABEL: Record<TaskRepeat, string> = { none: 'Does not repeat', daily: 'Daily', weekdays: 'Every weekday', weekly: 'Weekly', monthly: 'Monthly' };
const ACTIVITY_VERB: Record<string, string> = {
  created: 'created this task', completed: 'completed it', reopened: 'reopened it',
  status: 'changed status', assigned: 'reassigned it', linked: 'linked a record', scheduled: 'set a date', updated: 'updated it',
};

function PropRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex w-[104px] shrink-0 items-center gap-2 text-[12px] font-medium text-slate-500">{icon}{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Picker({ value, children, width, disabled }: { value: React.ReactNode; children: (close: () => void) => React.ReactNode; width: number; disabled?: boolean }) {
  if (disabled) return <div className="inline-flex items-center px-1.5 py-1 text-[13px] text-slate-600">{value}</div>;
  return (
    <Popover width={width} trigger={({ toggle, ref, open }) => (
      <button ref={ref as any} onClick={toggle}
        className={cn('inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-slate-700 transition-colors hover:bg-slate-100', open && 'bg-slate-100')}>
        <span className="truncate">{value}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
    )}>
      {(close) => <>{children(close)}</>}
    </Popover>
  );
}

function DateField({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  return (
    <input type="date" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}
      className={cn('h-7 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] text-slate-700 hover:border-slate-200 focus:border-indigo-600 focus:outline-none', !value && 'text-slate-400')} />
  );
}
function DateTimeField({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const local = value ? new Date(value).toISOString().slice(0, 16) : '';
  return (
    <input type="datetime-local" value={local} disabled={disabled} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
      className={cn('h-7 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] text-slate-700 hover:border-slate-200 focus:border-indigo-600 focus:outline-none', !value && 'text-slate-400')} />
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={() => onChange(!on)}
      className={cn('relative h-5 w-9 rounded-full transition-colors', on ? 'bg-indigo-600' : 'bg-slate-200', disabled && 'opacity-50')}>
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_HEX[color] ?? COLOR_HEX.slate }} />;
}

function Section({ title, trailing, children }: { title: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">{title}</h4>
        {trailing}
      </div>
      {children}
    </div>
  );
}
function Divider() { return <div className="mx-5 h-px bg-slate-100" />; }

function SubtaskRow({ s, ro, onToggle, onRename, onDelete }: { s: Subtask; ro: boolean; onToggle: () => void; onRename: (v: string) => void; onDelete: () => void }) {
  const [val, setVal] = useState(s.title);
  useEffect(() => setVal(s.title), [s.title]);
  return (
    <div className="group/sub flex items-center gap-2 rounded-md px-0.5 py-0.5 hover:bg-slate-50">
      {!ro && <GripVertical className="h-3.5 w-3.5 shrink-0 text-transparent group-hover/sub:text-slate-300" />}
      <button onClick={onToggle} disabled={ro}
        className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px] transition-all',
          s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-emerald-500')}>
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </button>
      <input value={val} disabled={ro} onChange={(e) => setVal(e.target.value)}
        onBlur={() => { const v = val.trim(); if (v && v !== s.title) onRename(v); else if (!v) setVal(s.title); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={cn('h-6 flex-1 bg-transparent text-[13px] focus:outline-none', s.done ? 'text-slate-400 line-through' : 'text-slate-700')} />
      {!ro && <button onClick={onDelete} className="shrink-0 text-transparent group-hover/sub:text-slate-300 hover:!text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

function AttachmentList({ task, ro, onChange }: { task: Task; ro: boolean; onChange: (att: Task['attachments']) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const add = () => {
    if (!url.trim()) return;
    onChange([...task.attachments, { name: name.trim() || url.trim(), url: url.trim(), added_at: new Date().toISOString() }]);
    setName(''); setUrl('');
  };
  return (
    <div className="space-y-1.5">
      {task.attachments.map((a, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-[12px]">
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-indigo-600 hover:underline">{a.name}</a>
          {!ro && <button onClick={() => onChange(task.attachments.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X className="h-3 w-3" /></button>}
        </div>
      ))}
      {!ro && (
        <div className="flex gap-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Label" className="h-7 w-24 rounded-md border border-slate-200 px-2 text-[12px] focus:border-indigo-600 focus:outline-none" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Paste link (URL)" className="h-7 flex-1 rounded-md border border-slate-200 px-2 text-[12px] focus:border-indigo-600 focus:outline-none" />
          <button onClick={add} disabled={!url.trim()} className="h-7 rounded-md bg-slate-900 px-2.5 text-[12px] font-semibold text-white disabled:opacity-30">Add</button>
        </div>
      )}
      {ro && task.attachments.length === 0 && <p className="text-[12px] text-slate-400">No attachments.</p>}
    </div>
  );
}
