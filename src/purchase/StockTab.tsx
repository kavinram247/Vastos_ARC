// Stock tab — per-project inventory. Auto-updated when a PO is received.
import { useMemo, useState } from 'react';
import { Boxes, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatDate } from '../utils/format';
import { usePurchase } from './PurchaseManagementPage';
import { Toolbar, TableCard, Th, Td, RowActions, EmptyState, ProjectSelect, exportCsv } from './shared';
import { UOM_LABEL } from './types';
import { projectName, isLowStock } from './logic';
import type { ProjectStock, PurchaseMaterial } from './types';
import { saveStock, deleteStock, type StockInput } from './docsApi';

export function StockTab() {
  const { stock, materials, can, firmId, reload } = usePurchase();
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<ProjectStock | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stock.filter(s => {
      if (lowOnly && !isLowStock(s)) return false;
      return !q || `${s.material_name} ${projectName(s.project_id) ?? ''}`.toLowerCase().includes(q);
    });
  }, [stock, query, lowOnly]);

  const onDelete = async (s: ProjectStock) => {
    if (!confirm(`Remove stock row for "${s.material_name}"?`)) return;
    try { await deleteStock(s.id); await reload(); } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const doExport = () => exportCsv('project-stock', [
    { key: 'project', label: 'Project' }, { key: 'material_name', label: 'Material' },
    { key: 'current_stock', label: 'Current Stock' }, { key: 'uom', label: 'Unit' },
    { key: 'reorder_level', label: 'Reorder Level' }, { key: 'last_updated', label: 'Last Updated' },
  ], rows.map(s => ({ ...s, project: projectName(s.project_id) ?? '' })));

  return (
    <div className="space-y-4">
      <Toolbar query={query} onQuery={setQuery} onExport={can.export ? doExport : undefined}
        onAdd={can.create ? () => setAdding(true) : undefined} addLabel="Add stock"
        right={
          <button onClick={() => setLowOnly(v => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${lowOnly ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>
            <AlertTriangle className="h-3.5 w-3.5" /> Low stock
          </button>
        } />

      {rows.length === 0 ? (
        <EmptyState icon={Boxes} title="No stock tracked yet" hint="Add opening stock, or receive a purchase order — received quantities flow here automatically." />
      ) : (
        <TableCard>
          <thead>
            <tr className="border-b border-slate-200">
              <Th>Project</Th><Th>Material</Th><Th className="text-right">Current</Th><Th>Unit</Th>
              <Th className="text-right">Reorder</Th><Th>Last updated</Th><Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => {
              const low = isLowStock(s);
              return (
                <tr key={s.id} className={`border-b border-slate-100 last:border-0 ${low ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}`}>
                  <Td className="text-slate-600">{projectName(s.project_id) || '—'}</Td>
                  <Td className="font-medium text-slate-900">{s.material_name}</Td>
                  <Td className="text-right tabular-nums">
                    <span className={low ? 'font-semibold text-amber-700' : 'text-slate-700'}>{s.current_stock}</span>
                    {low && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" />}
                  </Td>
                  <Td className="text-slate-500">{s.uom ? (UOM_LABEL[s.uom] || s.uom) : '—'}</Td>
                  <Td className="text-right tabular-nums text-slate-500">{s.reorder_level || '—'}</Td>
                  <Td className="text-slate-500">{s.last_updated ? formatDate(s.last_updated) : '—'}</Td>
                  <Td><RowActions onEdit={can.edit ? () => setEditing(s) : undefined} onDelete={can.delete ? () => onDelete(s) : undefined} /></Td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}

      {(adding || editing) && (
        <StockForm stock={editing} materials={materials} firmId={firmId}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={async () => { setAdding(false); setEditing(null); await reload(); }} />
      )}
    </div>
  );
}

function StockForm({ stock, materials, firmId, onClose, onSaved }: {
  stock: ProjectStock | null; materials: PurchaseMaterial[]; firmId: string; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<StockInput>({
    id: stock?.id, project_id: stock?.project_id ?? null, material_id: stock?.material_id ?? null,
    material_name: stock?.material_name ?? '', uom: stock?.uom ?? 'nos',
    current_stock: stock?.current_stock ?? 0, reorder_level: stock?.reorder_level ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<StockInput>) => setF(prev => ({ ...prev, ...p }));

  const pickMaterial = (id: string) => {
    const m = materials.find(x => x.id === id);
    if (!m) { set({ material_id: null }); return; }
    set({ material_id: m.id, material_name: m.name, uom: m.base_uom });
  };

  const submit = async () => {
    if (!f.material_name.trim()) return;
    setSaving(true);
    try { await saveStock(f, firmId); onSaved(); }
    catch (e: any) { alert('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={stock ? 'Edit stock' : 'Add stock'}>
      <div className="space-y-4">
        <ProjectSelect value={f.project_id} onChange={v => set({ project_id: v })} />
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Material *</label>
          <select value={f.material_id ?? ''} onChange={e => pickMaterial(e.target.value)}
            className="h-10 w-full rounded-[9px] border border-slate-200 px-3 text-sm focus:border-indigo-600 focus:outline-none">
            <option value="">— Custom (type name) —</option>
            {materials.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {!f.material_id && <Input label="Material name" value={f.material_name} onChange={e => set({ material_name: e.target.value })} placeholder="Custom material name" />}
        <div className="grid grid-cols-3 gap-3">
          <Input label="Current stock" type="number" value={f.current_stock} onChange={e => set({ current_stock: parseFloat(e.target.value) || 0 })} />
          <Input label="Reorder level" type="number" value={f.reorder_level} onChange={e => set({ reorder_level: parseFloat(e.target.value) || 0 })} />
          <Input label="Unit" value={f.uom ?? ''} onChange={e => set({ uom: e.target.value })} />
        </div>
        <p className="text-xs text-slate-400">Alerts appear when current stock is at or below the reorder level.</p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !f.material_name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {stock ? 'Save' : 'Add stock'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
