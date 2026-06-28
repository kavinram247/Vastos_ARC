import { useState } from 'react';
import { Popover, MenuItem, MenuDivider } from './Popover';
import { COLOR_HEX } from './TaskRow';
import { cn } from '../utils/cn';
import { Plus, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react';
import type { TaskList } from '../lib/taskApi';
import { SMART_VIEWS, type SmartViewId } from './taskLogic';

export type Selection = { kind: 'smart'; id: SmartViewId } | { kind: 'list'; id: string };

const SWATCHES = ['emerald', 'amber', 'sky', 'violet', 'rose', 'indigo', 'teal', 'orange', 'slate'];

export function TaskSidebar({
  selected, onSelect, smartCounts, lists, listCounts, canManageLists,
  onCreateList, onRenameList, onRecolorList, onDeleteList,
}: {
  selected: Selection;
  onSelect: (s: Selection) => void;
  smartCounts: Record<string, number>;
  lists: TaskList[];
  listCounts: Record<string, number>;
  canManageLists: boolean;
  onCreateList: (name: string, color: string) => void;
  onRenameList: (id: string, name: string) => void;
  onRecolorList: (id: string, color: string) => void;
  onDeleteList: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('emerald');

  const submitNew = () => { if (newName.trim()) { onCreateList(newName.trim(), newColor); setNewName(''); setCreating(false); } };

  return (
    <div className="flex h-full flex-col">
      {/* smart views */}
      <div className="px-2 pt-1">
        <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Smart views</div>
        <div className="space-y-0.5">
          {SMART_VIEWS.map((v) => {
            const active = selected.kind === 'smart' && selected.id === v.id;
            const count = smartCounts[v.id] ?? 0;
            const Icon = v.icon;
            return (
              <button key={v.id} onClick={() => onSelect({ kind: 'smart', id: v.id })}
                className={cn('flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium transition-colors',
                  active ? 'bg-white text-slate-900 shadow-[var(--shadow-surface)]' : 'text-slate-600 hover:bg-white/60')}>
                <Icon className={cn('h-4 w-4 shrink-0', active ? v.accent : 'text-slate-400')} />
                <span className="flex-1 text-left">{v.label}</span>
                {count > 0 && (
                  <span className={cn('text-[11px] font-semibold tabular-nums',
                    v.id === 'overdue' && count > 0 ? 'text-red-600' : active ? 'text-slate-500' : 'text-slate-400')}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* lists */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col px-2">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Lists</span>
          {canManageLists && (
            <button onClick={() => setCreating((v) => !v)} aria-label="New list" className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700">
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {creating && (
          <div className="mb-1 rounded-lg bg-white p-2 shadow-[var(--shadow-surface)]">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX[newColor] }} />
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
                placeholder="List name" className="h-7 flex-1 bg-transparent text-[13px] focus:outline-none" />
              <button onClick={submitNew} className="rounded p-1 text-emerald-600 hover:bg-emerald-50"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => { setCreating(false); setNewName(''); }} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-1.5 flex gap-1 pl-4">
              {SWATCHES.map((c) => (
                <button key={c} onClick={() => setNewColor(c)} aria-label={c}
                  className={cn('h-4 w-4 rounded-full ring-offset-1 transition-all', newColor === c && 'ring-2 ring-slate-400')}
                  style={{ backgroundColor: COLOR_HEX[c] }} />
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {lists.length === 0 && !creating && (
            <div className="px-2 py-3 text-[12px] text-slate-400">No lists yet. Create one to organise work.</div>
          )}
          {lists.map((l) => {
            const active = selected.kind === 'list' && selected.id === l.id;
            const count = listCounts[l.id] ?? 0;
            return (
              <div key={l.id} className={cn('group flex h-8 items-center gap-2.5 rounded-lg px-2 transition-colors',
                active ? 'bg-white shadow-[var(--shadow-surface)]' : 'hover:bg-white/60')}>
                <button onClick={() => onSelect({ kind: 'list', id: l.id })} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX[l.color] ?? COLOR_HEX.slate }} />
                  <span className={cn('flex-1 truncate text-[13px] font-medium', active ? 'text-slate-900' : 'text-slate-600')}>{l.name}</span>
                </button>
                {count > 0 && <span className="text-[11px] font-semibold tabular-nums text-slate-400">{count}</span>}
                {canManageLists && (
                  <Popover align="end" width={180}
                    trigger={({ toggle, ref }) => (
                      <button ref={ref as any} onClick={toggle} aria-label="List options"
                        className="rounded p-0.5 text-slate-300 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    )}>
                    {(close) => <ListMenu list={l} onRename={onRenameList} onRecolor={onRecolorList} onDelete={onDeleteList} close={close} />}
                  </Popover>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ListMenu({ list, onRename, onRecolor, onDelete, close }: {
  list: TaskList; onRename: (id: string, name: string) => void; onRecolor: (id: string, c: string) => void; onDelete: (id: string) => void; close: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  if (renaming) {
    return (
      <div className="p-1.5">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onRename(list.id, name.trim()); close(); } if (e.key === 'Escape') setRenaming(false); }}
          className="h-8 w-full rounded-md border border-slate-200 px-2 text-[13px] focus:border-indigo-600 focus:outline-none" />
        <div className="mt-1.5 flex justify-end gap-1">
          <button onClick={() => setRenaming(false)} className="rounded px-2 py-1 text-[12px] text-slate-500 hover:bg-slate-100">Cancel</button>
          <button onClick={() => { if (name.trim()) { onRename(list.id, name.trim()); close(); } }} className="rounded bg-indigo-600 px-2 py-1 text-[12px] font-semibold text-white">Save</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <MenuItem icon={<Pencil />} label="Rename" onClick={() => setRenaming(true)} />
      <div className="flex items-center gap-1 px-2.5 py-1.5">
        {SWATCHES.map((c) => (
          <button key={c} onClick={() => { onRecolor(list.id, c); close(); }} aria-label={c}
            className={cn('h-4 w-4 rounded-full transition-all', list.color === c && 'ring-2 ring-slate-400 ring-offset-1')}
            style={{ backgroundColor: COLOR_HEX[c] }} />
        ))}
      </div>
      <MenuDivider />
      <MenuItem icon={<Trash2 />} label="Delete list" danger onClick={() => { onDelete(list.id); close(); }} />
    </>
  );
}
