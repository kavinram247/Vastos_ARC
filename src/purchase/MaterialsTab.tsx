// Materials tab — material master (reuses the shared `catalog_products` catalog).
import { useEffect, useMemo, useState } from 'react';
import { Package, Loader2, Check } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { formatINR } from '../utils/format';
import { usePurchase } from './PurchaseManagementPage';
import { Toolbar, TableCard, Th, Td, RowActions, EmptyState, exportCsv } from './shared';
import { UOMS, UOM_LABEL } from './types';
import type { PurchaseMaterial } from './types';
import { saveMaterial, deactivateMaterial, listCatalogCategories, type MaterialInput, type CatalogCategory } from './masterApi';

export function MaterialsTab() {
  const { materials, can, firmId, reload } = usePurchase();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<PurchaseMaterial | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter(m => m.is_active && (!q || `${m.name} ${m.category ?? ''} ${m.hsn_code ?? ''}`.toLowerCase().includes(q)));
  }, [materials, query]);

  const onDelete = async (m: PurchaseMaterial) => {
    if (!confirm(`Remove "${m.name}" from the active catalog?`)) return;
    try { await deactivateMaterial(m.id); await reload(); }
    catch (e: any) { alert('Failed: ' + e.message); }
  };

  const doExport = () => exportCsv('materials', [
    { key: 'name', label: 'Material Name' }, { key: 'category', label: 'Category' },
    { key: 'base_uom', label: 'UOM' }, { key: 'hsn_code', label: 'HSN' }, { key: 'last_price', label: 'Last Price' },
  ], rows);

  return (
    <div className="space-y-4">
      <Toolbar query={query} onQuery={setQuery} onExport={can.export ? doExport : undefined}
        onAdd={can.create ? () => setAdding(true) : undefined} addLabel="Add material" />

      {rows.length === 0 ? (
        <EmptyState icon={Package} title="No materials yet" hint="Materials live in the shared catalog used by the BOQ engine too."
          action={can.create ? <Button size="sm" onClick={() => setAdding(true)}>Add material</Button> : undefined} />
      ) : (
        <TableCard>
          <thead>
            <tr className="border-b border-slate-200">
              <Th>Material</Th><Th>Category</Th><Th>UOM</Th><Th>HSN</Th>
              <Th className="text-right">Last price</Th><Th className="text-right">GST %</Th><Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <Td className="font-medium text-slate-900">{m.name}</Td>
                <Td className="text-slate-600">{m.category || '—'}</Td>
                <Td className="text-slate-500">{UOM_LABEL[m.base_uom] || m.base_uom}</Td>
                <Td className="text-slate-500">{m.hsn_code || '—'}</Td>
                <Td className="text-right tabular-nums text-slate-700">{m.last_price != null ? formatINR(m.last_price) : '—'}</Td>
                <Td className="text-right tabular-nums text-slate-500">{m.gst_rate}%</Td>
                <Td><RowActions onEdit={can.edit ? () => setEditing(m) : undefined} onDelete={can.delete ? () => onDelete(m) : undefined} /></Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {(adding || editing) && (
        <MaterialForm material={editing} firmId={firmId}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={async () => { setAdding(false); setEditing(null); await reload(); }} />
      )}
    </div>
  );
}

function MaterialForm({ material, firmId, onClose, onSaved }: {
  material: PurchaseMaterial | null; firmId: string; onClose: () => void; onSaved: () => void;
}) {
  const [cats, setCats] = useState<CatalogCategory[]>([]);
  const [f, setF] = useState<MaterialInput>({
    id: material?.id, name: material?.name ?? '', category_id: material?.category_id ?? '',
    base_uom: material?.base_uom ?? 'nos', hsn_code: material?.hsn_code ?? '', gst_rate: material?.gst_rate ?? 18, description: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<MaterialInput>) => setF(prev => ({ ...prev, ...p }));

  useEffect(() => {
    listCatalogCategories().then(cs => {
      setCats(cs);
      if (!material && cs[0]) setF(prev => ({ ...prev, category_id: prev.category_id || cs[0].id }));
    }).catch(console.error);
  }, [material]);

  const submit = async () => {
    if (!f.name.trim() || !f.category_id) return;
    setSaving(true);
    try { await saveMaterial(f, firmId); onSaved(); }
    catch (e: any) { alert('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={material ? 'Edit material' : 'Add material'}>
      <div className="space-y-4">
        <Input label="Material name *" value={f.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. 710 BWP Plywood 18mm" />
        <Select label="Category *" value={f.category_id} onChange={e => set({ category_id: e.target.value })}
          options={cats.length ? cats.map(c => ({ value: c.id, label: c.name })) : [{ value: '', label: 'Loading…' }]} />
        <div className="grid grid-cols-3 gap-3">
          <Select label="Unit of measure" value={f.base_uom} onChange={e => set({ base_uom: e.target.value })}
            options={UOMS.map(u => ({ value: u, label: UOM_LABEL[u] }))} />
          <Input label="HSN code" value={f.hsn_code ?? ''} onChange={e => set({ hsn_code: e.target.value })} />
          <Input label="GST %" type="number" value={f.gst_rate} onChange={e => set({ gst_rate: parseFloat(e.target.value) || 0 })} />
        </div>
        <Textarea label="Description / specifications" rows={3} value={f.description ?? ''} onChange={e => set({ description: e.target.value })} />
        <p className="text-xs text-slate-400">This material joins the shared catalog, so it's available to the BOQ estimator and vendor SKU links too.</p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !f.name.trim() || !f.category_id}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {material ? 'Save changes' : 'Add material'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
