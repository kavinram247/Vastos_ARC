// ─────────────────────────────────────────────────────────────
// Purchase Management — shared UI kit: listing toolbar, table shell + row
// actions, status chips, entity pickers, the editable line-items grid, and
// CSV export. Reuses the app's Button / Badge / Input primitives.
// ─────────────────────────────────────────────────────────────
import { Loader2, Search, Plus, Download, Eye, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Select } from '../components/ui/Input';
import { useStore } from '../hooks/useStore';
import { useAuth } from '../context/AuthContext';
import { UOMS, UOM_LABEL } from './types';
import type { LineItem, PurchaseVendor, PurchaseMaterial } from './types';

export function Loading() {
  return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
}

/** Shown when a table read fails — almost always the migration hasn't been run yet. */
export function PurchaseError({ message }: { message: string }) {
  const missing = /relation|does not exist|schema cache|column/i.test(message);
  return (
    <div className="empty-state gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50"><AlertTriangle className="h-6 w-6 text-amber-500" /></div>
      <p className="text-base font-semibold text-slate-700">Purchase tables aren't set up yet</p>
      <p className="max-w-md text-sm text-slate-500">
        {missing
          ? 'Run supabase/migrations/28_purchase_management.sql in the Supabase SQL editor, then reload. That one migration creates every Purchase Management table.'
          : message}
      </p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: React.ElementType; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state gap-2 py-16">
      <Icon className="h-9 w-9 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint && <p className="max-w-sm text-xs text-slate-400">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Search + Export + Add — the shared listing toolbar on every tab. */
export function Toolbar({ query, onQuery, onAdd, addLabel, onExport, right }: {
  query: string; onQuery: (v: string) => void; onAdd?: () => void; addLabel?: string; onExport?: () => void; right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input aria-label="Search" placeholder="Search…" value={query} onChange={(e) => onQuery(e.target.value)} className="w-64 pl-9" />
      </div>
      <div className="flex items-center gap-2">
        {right}
        {onExport && <Button variant="secondary" size="sm" onClick={onExport}><Download className="h-4 w-4" /> Export</Button>}
        {onAdd && <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" /> {addLabel ?? 'Add'}</Button>}
      </div>
    </div>
  );
}

/** Card-wrapped semantic table. Pass <thead>/<tbody> as children. */
export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export const Th = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) =>
  <th className={`whitespace-nowrap px-4 py-2.5 text-left font-medium ${className}`}>{children}</th>;
export const Td = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) =>
  <td className={`px-4 py-2.5 align-middle ${className}`}>{children}</td>;

export function RowActions({ onView, onEdit, onDelete, extra }: { onView?: () => void; onEdit?: () => void; onDelete?: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {extra}
      {onView && <IconBtn label="View" onClick={onView}><Eye className="h-4 w-4" /></IconBtn>}
      {onEdit && <IconBtn label="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></IconBtn>}
      {onDelete && <IconBtn label="Delete" onClick={onDelete} danger><Trash2 className="h-4 w-4" /></IconBtn>}
    </div>
  );
}

export function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button aria-label={label} title={label} onClick={onClick}
      className={`rounded-md p-1.5 text-slate-400 transition-colors ${danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-indigo-600'}`}>
      {children}
    </button>
  );
}

export function StatusChip({ map, value }: { map: Record<string, { label: string; variant: any }>; value: string }) {
  const cfg = map[value] || { label: value, variant: 'default' };
  return <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>;
}

// ── entity pickers ───────────────────────────────────────────
/** Project select fed from the hydrated store (firm-scoped). */
export function ProjectSelect({ value, onChange, label = 'Project', required, allowNone = true }: {
  value: string | null; onChange: (v: string | null) => void; label?: string; required?: boolean; allowNone?: boolean;
}) {
  const store = useStore();
  const { firm } = useAuth();
  const projects = store.projects.filter(p => p.firm_id === firm?.id);
  return (
    <Select label={required ? `${label} *` : label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
      options={[{ value: '', label: allowNone ? '— None —' : 'Select a project…' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
  );
}

/** Staff select (non-client) fed from the store — for engineers / contacts. */
export function StaffSelect({ value, onChange, label, allowNone = true }: {
  value: string | null; onChange: (v: string | null) => void; label: string; allowNone?: boolean;
}) {
  const store = useStore();
  const { firm } = useAuth();
  const staff = store.profiles.filter(p => p.firm_id === firm?.id && p.role !== 'client');
  return (
    <Select label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
      options={[{ value: '', label: allowNone ? '— None —' : 'Select…' }, ...staff.map(p => ({ value: p.id, label: p.full_name }))]} />
  );
}

export function VendorSelect({ value, onChange, vendors, label = 'Vendor', required, allowNone = true }: {
  value: string | null; onChange: (v: string | null) => void; vendors: PurchaseVendor[]; label?: string; required?: boolean; allowNone?: boolean;
}) {
  return (
    <Select label={required ? `${label} *` : label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
      options={[{ value: '', label: allowNone ? '— None —' : 'Select a vendor…' }, ...vendors.map(v => ({ value: v.id, label: v.company_name }))]} />
  );
}

export function UomSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select label="" aria-label="Unit" value={value} onChange={(e) => onChange(e.target.value)}
      options={UOMS.map(u => ({ value: u, label: UOM_LABEL[u] }))} />
  );
}

// ── editable line-items grid (shared by Request / RFQ / PO forms) ──
export function LineItemsEditor({ items, onChange, materials, mode }: {
  items: LineItem[]; onChange: (items: LineItem[]) => void; materials: PurchaseMaterial[]; mode: 'request' | 'rfq' | 'po';
}) {
  const showRate = mode !== 'request';
  const showRequiredBy = mode === 'request';
  const rateLabel = mode === 'rfq' ? 'Unit price' : 'Rate';

  const update = (key: string, patch: Partial<LineItem>) => onChange(items.map(i => (i.key === key ? { ...i, ...patch } : i)));
  const remove = (key: string) => onChange(items.filter(i => i.key !== key));
  const add = () => onChange([...items, { key: Math.random().toString(36).slice(2), material_id: null, material_name: '', description: '', quantity: 1, uom: 'nos', rate: 0 }]);

  const pickMaterial = (key: string, materialId: string) => {
    const m = materials.find(x => x.id === materialId);
    if (!m) { update(key, { material_id: null }); return; }
    update(key, { material_id: m.id, material_name: m.name, uom: m.base_uom, rate: m.last_price ?? items.find(i => i.key === key)?.rate ?? 0 });
  };

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="px-2 py-2 text-left font-medium">Material</th>
              <th className="px-2 py-2 text-left font-medium">Name / spec</th>
              <th className="px-2 py-2 text-right font-medium w-20">Qty</th>
              <th className="px-2 py-2 text-left font-medium w-24">Unit</th>
              {showRate && <th className="px-2 py-2 text-right font-medium w-28">{rateLabel} (₹)</th>}
              {showRequiredBy && <th className="px-2 py-2 text-left font-medium w-36">Required by</th>}
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={showRate || showRequiredBy ? 6 : 5} className="px-3 py-4 text-center text-xs text-slate-400">No items yet — add a row.</td></tr>
            )}
            {items.map((i) => (
              <tr key={i.key} className="border-b border-slate-50 last:border-0">
                <td className="px-2 py-1.5">
                  <select aria-label="Material" value={i.material_id ?? ''} onChange={(e) => pickMaterial(i.key, e.target.value)}
                    className="w-full min-w-36 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="">— Custom —</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label="Name" value={i.material_name} onChange={(e) => update(i.key, { material_name: e.target.value })}
                    placeholder="Item name" className="w-full min-w-36 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label="Quantity" type="number" min="0" value={i.quantity} onChange={(e) => update(i.key, { quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none" />
                </td>
                <td className="px-2 py-1.5">
                  <select aria-label="Unit" value={i.uom} onChange={(e) => update(i.key, { uom: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none">
                    {UOMS.map(u => <option key={u} value={u}>{UOM_LABEL[u]}</option>)}
                  </select>
                </td>
                {showRate && (
                  <td className="px-2 py-1.5">
                    <input aria-label={rateLabel} type="number" min="0" value={i.rate} onChange={(e) => update(i.key, { rate: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none" />
                  </td>
                )}
                {showRequiredBy && (
                  <td className="px-2 py-1.5">
                    <input aria-label="Required by" type="date" value={i.required_by ?? ''} onChange={(e) => update(i.key, { required_by: e.target.value })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
                  </td>
                )}
                <td className="px-1 py-1.5 text-right">
                  <button aria-label="Remove row" onClick={() => remove(i.key)} className="rounded p-1 text-slate-300 hover:text-red-600"><X className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" size="sm" onClick={add}><Plus className="h-4 w-4" /> Add row</Button>
    </div>
  );
}

// ── CSV export (the toolbar Export action) ──
export function exportCsv(filename: string, columns: { key: string; label: string }[], rows: Record<string, any>[]) {
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map(c => esc(c.label)).join(',');
  const body = rows.map(r => columns.map(c => esc(r[c.key])).join(',')).join('\n');
  const blob = new Blob([`${head}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}
