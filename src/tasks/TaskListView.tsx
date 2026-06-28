import { useEffect, useMemo, useRef, useState } from 'react';
import { TaskRow, type RowActions } from './TaskRow';
import { Popover, MenuItem, MenuLabel, MenuDivider } from './Popover';
import { cn } from '../utils/cn';
import {
  Search, ArrowUpDown, Group, SlidersHorizontal, Plus, ChevronRight, X,
  CheckCircle2, Archive, Trash2, Flag, ListPlus, Eye, EyeOff, type LucideIcon,
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskList } from '../lib/taskApi';
import {
  filterTasks, sortTasks, groupTasks, EMPTY_FILTERS, STATUS_META, STATUSES,
  PRIORITY_META, PRIORITIES, type TaskFilters, type SortKey, type GroupKey,
} from './taskLogic';

interface Staff { id: string; full_name: string; role: string; }

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'manual', label: 'Manual' }, { key: 'due', label: 'Due date' }, { key: 'priority', label: 'Priority' },
  { key: 'created', label: 'Recently created' }, { key: 'title', label: 'Title (A–Z)' }, { key: 'status', label: 'Status' },
];
const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'none', label: 'None' }, { key: 'status', label: 'Status' }, { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due date' }, { key: 'assignee', label: 'Assignee' }, { key: 'list', label: 'List' },
];

export interface ListViewProps {
  view: { label: string; Icon: LucideIcon; accent: string; id: string; supportsCompleted: boolean; emptyHint: string };
  tasks: Task[];
  lists: TaskList[];
  staff: Staff[];
  subtaskProgress: Map<string, { done: number; total: number }>;
  me?: string;
  rowActionsFor: (t: Task) => RowActions;
  listFor: (t: Task) => TaskList | undefined;
  navigableFor: (t: Task) => boolean;
  onQuickAdd: (title: string) => void;
  canQuickAdd: boolean;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  onBulk: (ids: string[], patch: Partial<{ status: TaskStatus; priority: TaskPriority; list_id: string | null; archived_at: string | null }>) => void;
  onBulkDelete: (ids: string[]) => void;
}

export function TaskListView(props: ListViewProps) {
  const { view, tasks, lists, staff, subtaskProgress, me, rowActionsFor, listFor, navigableFor, onQuickAdd, canQuickAdd, showCompleted, onToggleCompleted, onBulk, onBulkDelete } = props;
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('manual');
  const [group, setGroup] = useState<GroupKey>('none');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [quick, setQuick] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);

  // reset transient state when the view changes
  useEffect(() => { setSelected(new Set()); setFilters(EMPTY_FILTERS); }, [view.id]);

  // global "n" to focus quick-add
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'n' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.metaKey && !e.ctrlKey && canQuickAdd) { e.preventDefault(); quickRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canQuickAdd]);

  const activeFilterCount = useMemo(
    () => ['status', 'priority', 'assignee', 'linkType', 'tag'].filter((k) => (filters as any)[k]).length,
    [filters],
  );

  const visible = useMemo(() => sortTasks(filterTasks(tasks, filters), sort), [tasks, filters, sort]);
  const groups = useMemo(
    () => groupTasks(visible, group, { lists, staffName: (id) => staff.find((s) => s.id === id)?.full_name ?? '' }),
    [visible, group, lists, staff],
  );

  const allTags = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags))].sort(), [tasks]);

  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());
  const selectedIds = [...selected];

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <view.Icon className={cn('h-5 w-5 shrink-0', view.accent)} />
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">{view.label}</h2>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">{visible.length}</span>
        <div className="ml-auto flex items-center gap-1">
          {/* search */}
          <div className={cn('flex items-center overflow-hidden rounded-[9px] border transition-all', searchOpen || filters.search ? 'w-44 border-slate-200 bg-white sm:w-56' : 'w-8 border-transparent')}>
            <button onClick={() => { setSearchOpen(true); }} aria-label="Search" className="grid h-8 w-8 shrink-0 place-items-center text-slate-400 hover:text-slate-600"><Search className="h-4 w-4" /></button>
            <input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              onBlur={() => !filters.search && setSearchOpen(false)} placeholder="Search tasks…"
              className={cn('h-8 min-w-0 flex-1 bg-transparent pr-2 text-[13px] focus:outline-none', !searchOpen && !filters.search && 'hidden')} />
            {filters.search && <button onClick={() => setFilters((f) => ({ ...f, search: '' }))} className="px-1.5 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
          </div>

          {/* filter */}
          <Popover align="end" width={240} trigger={({ toggle, ref, open }) => (
            <ToolBtn ref2={ref} onClick={toggle} active={open || activeFilterCount > 0} icon={SlidersHorizontal} badge={activeFilterCount || undefined} />
          )}>
            {() => (
              <FilterMenu filters={filters} setFilters={setFilters} staff={staff} tags={allTags} />
            )}
          </Popover>

          {/* group */}
          <Popover align="end" width={170} trigger={({ toggle, ref, open }) => (
            <ToolBtn ref2={ref} onClick={toggle} active={open || group !== 'none'} icon={Group} />
          )}>
            {(close) => (<>
              <MenuLabel>Group by</MenuLabel>
              {GROUPS.map((g) => <MenuItem key={g.key} active={group === g.key} onClick={() => { setGroup(g.key); close(); }} label={g.label} />)}
            </>)}
          </Popover>

          {/* sort */}
          <Popover align="end" width={190} trigger={({ toggle, ref, open }) => (
            <ToolBtn ref2={ref} onClick={toggle} active={open || sort !== 'manual'} icon={ArrowUpDown} />
          )}>
            {(close) => (<>
              <MenuLabel>Sort by</MenuLabel>
              {SORTS.map((s) => <MenuItem key={s.key} active={sort === s.key} onClick={() => { setSort(s.key); close(); }} label={s.label} />)}
            </>)}
          </Popover>

          {view.supportsCompleted && (
            <button onClick={onToggleCompleted} title={showCompleted ? 'Hide completed' : 'Show completed'}
              className={cn('grid h-8 w-8 place-items-center rounded-[9px] border transition-colors',
                showCompleted ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-transparent text-slate-400 hover:bg-slate-100')}>
              {showCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* quick add */}
      {canQuickAdd && (
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <Plus className="h-4 w-4 text-slate-300" />
          <input ref={quickRef} value={quick} onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && quick.trim()) { onQuickAdd(quick.trim()); setQuick(''); } if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
            placeholder="Add a task — press Enter to save"
            className="h-7 flex-1 bg-transparent text-[13.5px] placeholder:text-slate-400 focus:outline-none" />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">N</kbd>
        </div>
      )}

      {/* list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <EmptyState view={view} hasTasks={tasks.length > 0} filtered={filters.search !== '' || activeFilterCount > 0} onClear={() => setFilters(EMPTY_FILTERS)} />
        ) : (
          groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            return (
              <div key={g.key}>
                {group !== 'none' && (
                  <button onClick={() => setCollapsed((p) => { const n = new Set(p); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n; })}
                    className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-1.5 backdrop-blur sm:px-5">
                    <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', !isCollapsed && 'rotate-90')} />
                    {g.tone && <span className={cn('h-2 w-2 rounded-full', g.tone)} />}
                    <span className="text-[12px] font-semibold text-slate-600">{g.label}</span>
                    <span className="text-[11px] tabular-nums text-slate-400">{g.tasks.length}</span>
                  </button>
                )}
                {!isCollapsed && (
                  <ul className="divide-y divide-slate-50">
                    {g.tasks.map((t) => (
                      <li key={t.id}>
                        <TaskRow t={t} list={listFor(t)} progress={subtaskProgress.get(t.id)} me={me}
                          selected={selected.has(t.id)} selecting={selected.size > 0} navigable={navigableFor(t)}
                          actions={{ ...rowActionsFor(t), onSelect: () => toggleSel(t.id) }} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* bulk bar */}
      {selected.size > 0 && (
        <BulkBar count={selected.size} lists={lists} onClear={clearSel}
          onComplete={() => { onBulk(selectedIds, { status: 'completed' }); clearSel(); }}
          onStatus={(s) => { onBulk(selectedIds, { status: s }); clearSel(); }}
          onPriority={(p) => { onBulk(selectedIds, { priority: p }); clearSel(); }}
          onList={(id) => { onBulk(selectedIds, { list_id: id }); clearSel(); }}
          onArchive={() => { onBulk(selectedIds, { archived_at: new Date().toISOString() }); clearSel(); }}
          onDelete={() => { onBulkDelete(selectedIds); clearSel(); }} />
      )}
    </div>
  );
}

// ── toolbar button ──
function ToolBtn({ onClick, active, icon: Icon, badge, ref2 }: { onClick: () => void; active?: boolean; icon: LucideIcon; badge?: number; ref2: (el: HTMLElement | null) => void }) {
  return (
    <button ref={ref2 as any} onClick={onClick}
      className={cn('relative grid h-8 w-8 place-items-center rounded-[9px] border transition-colors',
        active ? 'border-slate-200 bg-slate-100 text-slate-700' : 'border-transparent text-slate-400 hover:bg-slate-100')}>
      <Icon className="h-4 w-4" />
      {badge ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">{badge}</span> : null}
    </button>
  );
}

function FilterMenu({ filters, setFilters, staff, tags }: { filters: TaskFilters; setFilters: (f: (p: TaskFilters) => TaskFilters) => void; staff: Staff[]; tags: string[] }) {
  const set = (k: keyof TaskFilters, v: string) => setFilters((f) => ({ ...f, [k]: f[k] === v ? '' : v }));
  return (
    <div className="p-1.5">
      <FilterGroup label="Status">
        {STATUSES.map((s) => <Chip key={s} active={filters.status === s} onClick={() => set('status', s)} dot={STATUS_META[s].dot}>{STATUS_META[s].label}</Chip>)}
      </FilterGroup>
      <FilterGroup label="Priority">
        {PRIORITIES.map((p) => <Chip key={p} active={filters.priority === p} onClick={() => set('priority', p)} dot={PRIORITY_META[p].bar}>{PRIORITY_META[p].label}</Chip>)}
      </FilterGroup>
      <FilterGroup label="Assignee">
        {staff.slice(0, 8).map((s) => <Chip key={s.id} active={filters.assignee === s.id} onClick={() => set('assignee', s.id)}>{s.full_name.split(' ')[0]}</Chip>)}
      </FilterGroup>
      {tags.length > 0 && (
        <FilterGroup label="Tags">
          {tags.slice(0, 12).map((t) => <Chip key={t} active={filters.tag === t} onClick={() => set('tag', t)}>{t}</Chip>)}
        </FilterGroup>
      )}
      {(filters.status || filters.priority || filters.assignee || filters.tag || filters.linkType) && (
        <button onClick={() => setFilters(() => EMPTY_FILTERS)} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-red-600 hover:bg-red-50">Clear filters</button>
      )}
    </div>
  );
}
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="mb-1.5"><div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</div><div className="flex flex-wrap gap-1">{children}</div></div>);
}
function Chip({ active, onClick, dot, children }: { active: boolean; onClick: () => void; dot?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors',
      active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white/80' : dot)} />}{children}
    </button>
  );
}

function BulkBar({ count, lists, onClear, onComplete, onStatus, onPriority, onList, onArchive, onDelete }: {
  count: number; lists: TaskList[]; onClear: () => void; onComplete: () => void;
  onStatus: (s: TaskStatus) => void; onPriority: (p: TaskPriority) => void; onList: (id: string | null) => void; onArchive: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 border-t border-slate-200 bg-white px-4 py-2.5 shadow-[0_-4px_16px_rgba(16,32,26,0.06)] sm:px-5">
      <span className="mr-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
        <span className="grid h-5 min-w-5 place-items-center rounded-md bg-indigo-600 px-1 text-[11px] text-white">{count}</span>selected
      </span>
      <BulkBtn icon={CheckCircle2} label="Complete" onClick={onComplete} />
      <Popover width={180} trigger={({ toggle, ref }) => <BulkBtn ref2={ref} icon={Flag} label="Priority" onClick={toggle} />}>
        {(close) => PRIORITIES.map((p) => <MenuItem key={p} onClick={() => { onPriority(p); close(); }} icon={<Flag className={PRIORITY_META[p].flag} fill={p === 'low' ? 'none' : 'currentColor'} />} label={PRIORITY_META[p].label} />)}
      </Popover>
      <Popover width={180} trigger={({ toggle, ref }) => <BulkBtn ref2={ref} icon={ArrowUpDown} label="Status" onClick={toggle} />}>
        {(close) => STATUSES.map((s) => <MenuItem key={s} onClick={() => { onStatus(s); close(); }} icon={<span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} />} label={STATUS_META[s].label} />)}
      </Popover>
      <Popover width={200} trigger={({ toggle, ref }) => <BulkBtn ref2={ref} icon={ListPlus} label="Move" onClick={toggle} />}>
        {(close) => (<><MenuItem onClick={() => { onList(null); close(); }} label="No list" /><MenuDivider />{lists.map((l) => <MenuItem key={l.id} onClick={() => { onList(l.id); close(); }} label={l.name} />)}</>)}
      </Popover>
      <BulkBtn icon={Archive} label="Archive" onClick={onArchive} />
      <BulkBtn icon={Trash2} label="Delete" onClick={onDelete} danger />
      <button onClick={onClear} className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
    </div>
  );
}
function BulkBtn({ icon: Icon, label, onClick, danger, ref2 }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean; ref2?: (el: HTMLElement | null) => void }) {
  return (
    <button ref={ref2 as any} onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 rounded-[9px] px-2 py-1.5 text-[12.5px] font-medium transition-colors',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-100')}>
      <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// (EmptyState below)
function EmptyState({ view, hasTasks, filtered, onClear }: { view: ListViewProps['view']; hasTasks: boolean; filtered: boolean; onClear: () => void }) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <Search className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-[14px] font-medium text-slate-600">No tasks match your filters</p>
        <button onClick={onClear} className="mt-3 rounded-[9px] bg-slate-100 px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-200">Clear filters</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className={cn('grid h-14 w-14 place-items-center rounded-2xl bg-slate-50', view.accent)}><view.Icon className="h-7 w-7" /></div>
      <p className="mt-4 text-[15px] font-semibold text-slate-700">{hasTasks ? 'All clear here' : `Nothing in ${view.label} yet`}</p>
      <p className="mt-1 max-w-xs text-[13px] text-slate-400">{view.emptyHint}</p>
    </div>
  );
}
