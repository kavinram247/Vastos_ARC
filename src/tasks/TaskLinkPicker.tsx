import { useMemo, useState } from 'react';
import { Popover } from './Popover';
import { cn } from '../utils/cn';
import { Link2, Search, X, Check } from 'lucide-react';
import type { store } from '../data/store';
import type { TaskLinkType } from '../lib/taskApi';
import { LINK_META } from './taskLogic';
import { linkOptions, PICKABLE_LINK_TYPES } from './taskLinks';

export interface LinkValue { link_type: TaskLinkType | null; link_id: string | null; link_label: string | null; }

const ALL_TYPES: TaskLinkType[] = ['project', 'lead', 'client', 'vendor', 'quotation', 'boq', 'site_visit', 'purchase', 'invoice', 'general'];

export function TaskLinkPicker({ value, store: storeRef, firmId, onChange, compact }: {
  value: LinkValue;
  store: typeof store;
  firmId: string;
  onChange: (v: LinkValue) => void;
  compact?: boolean;
}) {
  const [type, setType] = useState<TaskLinkType>(value.link_type ?? 'project');
  const [q, setQ] = useState('');
  const [freeLabel, setFreeLabel] = useState('');

  const pickable = PICKABLE_LINK_TYPES.includes(type);
  const options = useMemo(() => {
    if (!pickable) return [];
    const all = linkOptions(storeRef, type, firmId);
    const s = q.trim().toLowerCase();
    return (s ? all.filter((o) => o.label.toLowerCase().includes(s) || (o.sub ?? '').toLowerCase().includes(s)) : all).slice(0, 40);
  }, [type, q, pickable, storeRef, firmId]);

  const Current = value.link_type ? LINK_META[value.link_type].icon : Link2;

  return (
    <Popover
      width={300}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref as any}
          type="button"
          onClick={toggle}
          className={cn(
            'inline-flex items-center gap-2 rounded-[9px] border px-2.5 text-left text-[13px] transition-colors',
            compact ? 'h-8' : 'h-10 w-full',
            open ? 'border-indigo-600 ring-3 ring-indigo-600/12' : 'border-slate-200 hover:border-slate-300',
          )}
        >
          <Current className={cn('h-4 w-4 shrink-0', value.link_type ? LINK_META[value.link_type].tone : 'text-slate-400')} />
          {value.link_label ? (
            <span className="min-w-0 flex-1 truncate text-slate-800">
              <span className="text-slate-400">{value.link_type && LINK_META[value.link_type].label}: </span>{value.link_label}
            </span>
          ) : (
            <span className="flex-1 text-slate-500">Link a record</span>
          )}
          {value.link_type && (
            <span role="button" onClick={(e) => { e.stopPropagation(); onChange({ link_type: null, link_id: null, link_label: null }); }}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-3.5 w-3.5" /></span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="p-1">
          <div className="flex flex-wrap gap-1 px-1 pb-1.5 pt-1">
            {ALL_TYPES.map((tt) => {
              const I = LINK_META[tt].icon;
              return (
                <button key={tt} onClick={() => { setType(tt); setQ(''); setFreeLabel(''); }}
                  className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors',
                    type === tt ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100')}>
                  <I className={cn('h-3 w-3', type === tt ? LINK_META[tt].tone : 'text-slate-400')} />{LINK_META[tt].label}
                </button>
              );
            })}
          </div>

          {pickable ? (
            <>
              <div className="relative px-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${LINK_META[type].label.toLowerCase()}s…`}
                  className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-2 text-[13px] focus:border-indigo-600 focus:outline-none" />
              </div>
              <div className="mt-1 max-h-52 overflow-y-auto">
                {options.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-slate-400">No {LINK_META[type].label.toLowerCase()}s found</div>}
                {options.map((o) => (
                  <button key={o.id} onClick={() => { onChange({ link_type: type, link_id: o.id, link_label: o.label }); close(); }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-slate-100">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-800">{o.label}</span>
                      {o.sub && <span className="block truncate text-[11px] capitalize text-slate-400">{o.sub}</span>}
                    </span>
                    {value.link_id === o.id && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="px-1 py-1">
              <p className="px-1.5 pb-1.5 text-[11px] text-slate-400">Reference label for this {LINK_META[type].label.toLowerCase()}</p>
              <div className="flex gap-1.5 px-1">
                <input autoFocus value={freeLabel} onChange={(e) => setFreeLabel(e.target.value)}
                  placeholder={`e.g. ${type === 'invoice' ? 'INV-2025-014' : type === 'quotation' ? 'QT-2025-009' : 'Reference'}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' && freeLabel.trim()) { onChange({ link_type: type, link_id: null, link_label: freeLabel.trim() }); close(); } }}
                  className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-[13px] focus:border-indigo-600 focus:outline-none" />
                <button disabled={!freeLabel.trim()} onClick={() => { onChange({ link_type: type, link_id: null, link_label: freeLabel.trim() }); close(); }}
                  className="h-8 rounded-md bg-indigo-600 px-3 text-[12px] font-semibold text-white disabled:opacity-40">Link</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
