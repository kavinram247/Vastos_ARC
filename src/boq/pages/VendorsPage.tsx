import { useState, useEffect, useMemo } from 'react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select, Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { formatINR } from '../../utils/format';
import { listBoqs } from '../api';
import {
  fetchVendorsWithScores, recomputeAndPersistScores, listVendorSkus, fetchCandidatesForSku,
  fetchCandidateMap, fetchProcurementForBoq, generatePO, fetchVendorDirectory, saveVendor,
  fetchVendorSkuLinks, fetchAllSkus, addVendorSku, updateVendorSku, removeVendorSku,
  type VendorWithScore, type VendorDirectoryEntry, type VendorInput, type VendorSkuLink, type SkuOption,
} from '../vendorApi';
import { rankVendors, type Priority, type RankedVendor } from '../engine/vendorScore';
import {
  Truck, RefreshCw, Loader2, Trophy, Scale, ShoppingCart, Check, Star,
  BookUser, Plus, Pencil, Search, Mail, Phone, Building2, Package, Boxes, Trash2,
} from 'lucide-react';

type Tab = 'directory' | 'vendors' | 'compare' | 'po';

export function VendorsPage() {
  const [tab, setTab] = useState<Tab>('directory');
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'directory', label: 'Directory', icon: <BookUser className="w-4 h-4" /> },
    { id: 'vendors', label: 'Vendors & Scores', icon: <Trophy className="w-4 h-4" /> },
    { id: 'compare', label: 'Compare Suppliers', icon: <Scale className="w-4 h-4" /> },
    { id: 'po', label: 'Generate Purchase Orders', icon: <ShoppingCart className="w-4 h-4" /> },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Truck className="w-6 h-6 text-indigo-600" /> Vendor Intelligence</h1>
        <p className="text-sm text-slate-500">Scored on cost, delivery, quality & reliability from order history. Recommendations adapt to project priority.</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'directory' && <DirectoryTab />}
      {tab === 'vendors' && <VendorsTab />}
      {tab === 'compare' && <CompareTab />}
      {tab === 'po' && <POTab />}
    </div>
  );
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'probation', label: 'Probation' },
  { value: 'blacklisted', label: 'Blacklisted' },
  { value: 'inactive', label: 'Inactive' },
];
const statusVariant = (s: string) =>
  s === 'preferred' ? 'success' : s === 'probation' ? 'warning' : s === 'blacklisted' ? 'error' : 'default';

const UNCATEGORIZED = 'Unlisted — no materials linked';

function DirectoryTab() {
  const [entries, setEntries] = useState<VendorDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<VendorDirectoryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<VendorDirectoryEntry | null>(null);

  const load = () => fetchVendorDirectory().then((e) => { setEntries(e); setLoading(false); }).catch((err) => { console.error(err); setLoading(false); });
  useEffect(() => { load(); }, []);

  // group vendors by the service they provide (derived). A vendor that supplies across
  // categories appears under each heading; vendors with nothing linked fall back to
  // their type tag, else an "Unlisted" bucket.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, VendorDirectoryEntry[]>();
    for (const v of entries) {
      if (statusFilter !== 'all' && v.status !== statusFilter) continue;
      if (q && !(`${v.company_name} ${v.contact_person ?? ''} ${v.services.join(' ')} ${v.category ?? ''}`.toLowerCase().includes(q))) continue;
      const headings = v.groups.length ? v.groups : [v.category ? titleCase(v.category) : UNCATEGORIZED];
      for (const h of headings) {
        const arr = map.get(h) || [];
        arr.push(v);
        map.set(h, arr);
      }
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === UNCATEGORIZED) return 1;
      if (b[0] === UNCATEGORIZED) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [entries, query, statusFilter]);

  const totalShown = useMemo(() => new Set(grouped.flatMap(([, vs]) => vs.map((v) => v.id))).size, [grouped]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input aria-label="Search vendors" placeholder="Search vendors or services…" value={query}
              onChange={(e) => setQuery(e.target.value)} className="pl-9 w-64" />
          </div>
          <Select label="" aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS]} />
        </div>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add vendor</Button>
      </div>

      <p className="text-xs text-slate-500">
        {totalShown} vendor{totalShown === 1 ? '' : 's'} across {grouped.length} service group{grouped.length === 1 ? '' : 's'} ·
        categorized by what each vendor actually supplies.
      </p>

      {grouped.length === 0 ? (
        <Card><div className="text-center py-12 text-slate-400"><BookUser className="w-10 h-10 mx-auto mb-3 text-slate-300" /><p>No vendors match.</p></div></Card>
      ) : grouped.map(([heading, vs]) => (
        <div key={heading} className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-slate-800">{heading}</h3>
            <span className="text-xs text-slate-400">{vs.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {vs.map((v) => <VendorCard key={`${heading}-${v.id}`} v={v} onEdit={() => setEditing(v)} onManage={() => setManaging(v)} />)}
          </div>
        </div>
      ))}

      {(adding || editing) && (
        <VendorFormModal
          vendor={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); load(); }}
        />
      )}

      {managing && (
        <ManageMaterialsModal
          vendor={managing}
          onClose={() => setManaging(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function VendorCard({ v, onEdit, onManage }: { v: VendorDirectoryEntry; onEdit: () => void; onManage: () => void }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{v.company_name}</div>
          {v.contact_person && <div className="text-xs text-slate-500">{v.contact_person}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={statusVariant(v.status) as any} size="sm">{v.status}</Badge>
          <button onClick={onEdit} title="Edit vendor" className="text-slate-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="space-y-1 text-xs text-slate-500">
        {v.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> {v.phone}</div>}
        {v.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> {v.email}</div>}
        {v.gstin && <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {v.gstin}</div>}
      </div>

      {v.services.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {v.services.map((s) => <Badge key={s} variant="default" size="sm">{s}</Badge>)}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No materials linked yet{v.category ? ` · ${titleCase(v.category)}` : ''}.</p>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
        <span className="text-slate-400">{v.sku_count} SKU{v.sku_count === 1 ? '' : 's'} on file</span>
        {v.score
          ? <span className="text-slate-500">Score <span className="font-semibold text-indigo-600">{v.score.overall}</span> · {v.score.samples} orders</span>
          : <span className="text-slate-400">No order history</span>}
      </div>

      <Button variant="secondary" size="sm" className="w-full" onClick={onManage}><Boxes className="w-4 h-4" /> Manage materials</Button>
    </Card>
  );
}

function ManageMaterialsModal({ vendor, onClose, onChanged }: { vendor: VendorDirectoryEntry; onClose: () => void; onChanged: () => void }) {
  const [links, setLinks] = useState<VendorSkuLink[]>([]);
  const [allSkus, setAllSkus] = useState<SkuOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // add-row form
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newMoq, setNewMoq] = useState('');
  const [newLead, setNewLead] = useState('7');

  const reload = async () => {
    const ls = await fetchVendorSkuLinks(vendor.id);
    setLinks(ls);
    onChanged(); // refresh the directory grouping/chips behind the modal
  };

  useEffect(() => {
    Promise.all([fetchVendorSkuLinks(vendor.id), fetchAllSkus()])
      .then(([ls, skus]) => { setLinks(ls); setAllSkus(skus); setLoading(false); })
      .catch((e) => { console.error(e); setLoading(false); });
  }, [vendor.id]);

  const linkedIds = new Set(links.map((l) => l.sku_id));
  const available = allSkus.filter((s) => !linkedIds.has(s.sku_id));

  const onAdd = async () => {
    const price = parseFloat(newPrice);
    if (!newSku || !(price >= 0)) return;
    setBusy(true);
    try {
      await addVendorSku(vendor.id, newSku, {
        price, moq: newMoq.trim() ? parseFloat(newMoq) : null, lead_time_days: parseInt(newLead) || 7,
      });
      setNewSku(''); setNewPrice(''); setNewMoq(''); setNewLead('7');
      await reload();
    } catch (e) { alert('Add failed: ' + (e as any).message); } finally { setBusy(false); }
  };

  const onRemove = async (skuId: string) => {
    setBusy(true);
    try { await removeVendorSku(vendor.id, skuId); await reload(); }
    catch (e) { alert('Remove failed: ' + (e as any).message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Materials — ${vendor.company_name}`} size="lg">
      {loading ? <Loading /> : (
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">Supplies ({links.length})</div>
            {links.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No materials linked yet. Add one below — this is what places the vendor under a service heading.</p>
            ) : (
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-xs text-slate-500 border-b border-slate-100">
                    <th className="text-left px-3 py-2 font-medium">Material</th>
                    <th className="text-right px-2 py-2 font-medium w-28">Price (₹)</th>
                    <th className="text-right px-2 py-2 font-medium w-20">MOQ</th>
                    <th className="text-right px-2 py-2 font-medium w-20">Lead (d)</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr></thead>
                  <tbody>
                    {links.map((l) => (
                      <LinkRow key={l.id} link={l} onSaved={reload} onRemove={() => onRemove(l.sku_id)} disabled={busy} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">Add a material</div>
            <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
              <div className="col-span-2 sm:col-span-5">
                <Select label="Material" value={newSku} onChange={(e) => setNewSku(e.target.value)}
                  options={[{ value: '', label: available.length ? 'Select a SKU…' : 'All catalog SKUs already linked' },
                    ...available.map((s) => ({ value: s.sku_id, label: `${s.category} · ${s.product}${s.brand ? ` — ${s.brand}` : ''}` }))]} />
              </div>
              <div className="sm:col-span-3"><Input label="Price (₹)" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0" /></div>
              <div className="sm:col-span-2"><Input label="MOQ" type="number" value={newMoq} onChange={(e) => setNewMoq(e.target.value)} placeholder="—" /></div>
              <div className="sm:col-span-2"><Input label="Lead (d)" type="number" value={newLead} onChange={(e) => setNewLead(e.target.value)} /></div>
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={onAdd} disabled={busy || !newSku || newPrice === ''}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add material
              </Button>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-3">
            <Button variant="secondary" onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function LinkRow({ link, onSaved, onRemove, disabled }: { link: VendorSkuLink; onSaved: () => Promise<void>; onRemove: () => void; disabled: boolean }) {
  const [price, setPrice] = useState(String(link.price));
  const [moq, setMoq] = useState(link.moq == null ? '' : String(link.moq));
  const [lead, setLead] = useState(String(link.lead_time_days));
  const [saving, setSaving] = useState(false);

  const dirty = price !== String(link.price) || moq !== (link.moq == null ? '' : String(link.moq)) || lead !== String(link.lead_time_days);

  const save = async () => {
    const p = parseFloat(price);
    if (!(p >= 0)) return;
    setSaving(true);
    try {
      await updateVendorSku(link.id, { price: p, moq: moq.trim() ? parseFloat(moq) : null, lead_time_days: parseInt(lead) || link.lead_time_days });
      await onSaved();
    } catch (e) { alert('Save failed: ' + (e as any).message); } finally { setSaving(false); }
  };

  const cell = 'w-full text-right tabular-nums bg-transparent px-1.5 py-1 rounded border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none focus:bg-white';
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="px-3 py-1.5">
        <div className="text-slate-800">{link.product}</div>
        <div className="text-[11px] text-slate-400">{link.category}{link.brand ? ` · ${link.brand}` : ''}</div>
      </td>
      <td className="px-2 py-1.5"><input type="number" className={cell} value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => dirty && save()} /></td>
      <td className="px-2 py-1.5"><input type="number" className={cell} value={moq} onChange={(e) => setMoq(e.target.value)} onBlur={() => dirty && save()} placeholder="—" /></td>
      <td className="px-2 py-1.5"><input type="number" className={cell} value={lead} onChange={(e) => setLead(e.target.value)} onBlur={() => dirty && save()} /></td>
      <td className="px-2 py-1.5 text-right">
        {saving ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 inline" />
          : dirty ? <button onClick={save} title="Save" className="text-indigo-500 hover:text-indigo-700"><Check className="w-4 h-4" /></button>
          : <button onClick={onRemove} disabled={disabled} title="Unlink" className="text-slate-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
      </td>
    </tr>
  );
}

function VendorFormModal({ vendor, onClose, onSaved }: { vendor: VendorDirectoryEntry | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<VendorInput>({
    id: vendor?.id,
    company_name: vendor?.company_name ?? '',
    contact_person: vendor?.contact_person ?? '',
    phone: vendor?.phone ?? '',
    email: vendor?.email ?? '',
    gstin: vendor?.gstin ?? '',
    category: vendor?.category ?? '',
    status: vendor?.status ?? 'active',
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<VendorInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    try { await saveVendor(form); onSaved(); }
    catch (e) { alert('Save failed: ' + (e as any).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={vendor ? 'Edit vendor' : 'Add vendor'}>
      <div className="space-y-4">
        <Input label="Company name *" value={form.company_name} onChange={(e) => set({ company_name: e.target.value })} placeholder="e.g. Sai Plywood & Boards" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact person" value={form.contact_person ?? ''} onChange={(e) => set({ contact_person: e.target.value })} />
          <Input label="Phone" value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
          <Input label="GSTIN" value={form.gstin ?? ''} onChange={(e) => set({ gstin: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Vendor type" value={form.category ?? ''} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Materials, MEP" />
          <Select label="Status" value={form.status} onChange={(e) => set({ status: e.target.value })} options={STATUS_OPTIONS} />
        </div>
        <p className="text-xs text-slate-400">
          Vendors are grouped by the materials they supply. Link SKUs to a vendor to place it under the right service heading;
          the type tag above is used only until materials are linked.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.company_name.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {vendor ? 'Save changes' : 'Add vendor'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function titleCase(s: string) { return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 55 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-20">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${value}%` }} /></div>
      <span className="text-xs font-medium text-slate-700 w-9 text-right tabular-nums">{value}</span>
    </div>
  );
}

function VendorsTab() {
  const [vendors, setVendors] = useState<VendorWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const load = () => fetchVendorsWithScores().then((v) => { setVendors(v.sort((a, b) => (b.score?.overall || 0) - (a.score?.overall || 0))); setLoading(false); }).catch(console.error);
  useEffect(() => { load(); }, []);
  const recompute = async () => { setRecomputing(true); try { await recomputeAndPersistScores(); await load(); } finally { setRecomputing(false); } };
  if (loading) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={recompute} disabled={recomputing}>
          {recomputing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Recompute & persist scores
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vendors.map((v, i) => (
          <Card key={v.id} className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  {i === 0 && v.score && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}{v.company_name}
                </div>
                <div className="text-xs text-slate-500">{v.contact_person} · {v.phone}</div>
              </div>
              <div className="text-right">
                <Badge variant={v.status === 'preferred' ? 'success' : v.status === 'probation' ? 'warning' : 'default'} size="sm">{v.status}</Badge>
                {v.score && <div className="text-2xl font-bold text-indigo-600 mt-1">{v.score.overall}</div>}
              </div>
            </div>
            {v.score ? (
              <div className="space-y-1.5">
                <ScoreBar label="Cost" value={v.score.cost} />
                <ScoreBar label="Delivery" value={v.score.delivery} />
                <ScoreBar label="Quality" value={v.score.quality} />
                <ScoreBar label="Reliability" value={v.score.reliability} />
                <p className="text-[11px] text-slate-400 pt-1">{v.score.samples} orders · {v.category}</p>
              </div>
            ) : <p className="text-sm text-slate-400">No order history yet.</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function CompareTab() {
  const [skus, setSkus] = useState<{ sku_id: string; label: string }[]>([]);
  const [skuId, setSkuId] = useState('');
  const [priority, setPriority] = useState<Priority>('balanced');
  const [ranked, setRanked] = useState<RankedVendor[]>([]);
  useEffect(() => { listVendorSkus().then((s) => { setSkus(s); if (s[0]) setSkuId(s[0].sku_id); }).catch(console.error); }, []);
  useEffect(() => {
    if (!skuId) return;
    fetchCandidatesForSku(skuId).then((c) => setRanked(rankVendors(c, priority, 100, null))).catch(console.error);
  }, [skuId, priority]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select label="Material (SKU)" value={skuId} onChange={(e) => setSkuId(e.target.value)} options={skus.map((s) => ({ value: s.sku_id, label: s.label }))} />
        <Select label="Optimize for" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}
          options={[{ value: 'balanced', label: 'Balanced' }, { value: 'speed', label: 'Speed' }, { value: 'margin', label: 'Lowest cost' }, { value: 'quality', label: 'Quality' }]} />
      </div>
      <Card padding="none">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <th className="text-left px-4 py-2.5 font-medium">Rank</th><th className="text-left px-2 py-2.5 font-medium">Vendor</th>
            <th className="text-right px-2 py-2.5 font-medium">Price</th><th className="text-right px-2 py-2.5 font-medium">Lead</th>
            <th className="text-right px-2 py-2.5 font-medium">Quality</th><th className="text-right px-4 py-2.5 font-medium">Match</th></tr></thead>
          <tbody>
            {ranked.map((v, i) => (
              <tr key={v.vendor_id} className={`border-b border-slate-100 ${i === 0 ? 'bg-emerald-50/50' : ''}`}>
                <td className="px-4 py-2">{i === 0 ? <Badge variant="success" size="sm"><Trophy className="w-3 h-3 mr-1" />Best</Badge> : <span className="text-slate-400">#{i + 1}</span>}</td>
                <td className="px-2 py-2 font-medium text-slate-900">{v.company_name}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatINR(v.price)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{v.lead_time_days}d</td>
                <td className="px-2 py-2 text-right tabular-nums">{v.score?.quality ?? '—'}</td>
                <td className="px-4 py-2 text-right font-semibold text-indigo-600 tabular-nums">{v.weighted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function POTab() {
  const [boqs, setBoqs] = useState<any[]>([]);
  const [boqId, setBoqId] = useState('');
  const [priority, setPriority] = useState<Priority>('balanced');
  const [groups, setGroups] = useState<{ vendor_id: string; company_name: string; lines: any[]; total: number }[]>([]);
  const [unmatched, setUnmatched] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<Record<string, string>>({});

  useEffect(() => { listBoqs().then((b) => { setBoqs(b); if (b[0]) setBoqId((b[0] as any).id); }).catch(console.error); }, []);

  useEffect(() => {
    if (!boqId) return;
    setLoading(true); setGenerated({});
    (async () => {
      const [rows, candMap] = await Promise.all([fetchProcurementForBoq(boqId), fetchCandidateMap()]);
      const byVendor = new Map<string, { vendor_id: string; company_name: string; lines: any[]; total: number }>();
      const noVendor: any[] = [];
      for (const r of rows) {
        const cands = r.sku_id ? candMap.get(r.sku_id) : undefined;
        if (!cands || cands.length === 0) { noVendor.push(r); continue; }
        const best = rankVendors(cands, priority, r.quantity, null).find((v) => v.feasible) || rankVendors(cands, priority, r.quantity, null)[0];
        const amount = Math.round(r.quantity * best.price * 100) / 100;
        const line = { sku_id: r.sku_id, description: r.description, uom: r.uom, quantity: r.quantity, rate: best.price, amount };
        const g = byVendor.get(best.vendor_id) || { vendor_id: best.vendor_id, company_name: best.company_name, lines: [], total: 0 };
        g.lines.push(line); g.total = Math.round((g.total + amount) * 100) / 100;
        byVendor.set(best.vendor_id, g);
      }
      setGroups([...byVendor.values()].sort((a, b) => b.total - a.total));
      setUnmatched(noVendor);
      setLoading(false);
    })().catch((e) => { console.error(e); setLoading(false); });
  }, [boqId, priority]);

  const createPO = async (g: any) => {
    try { const no = await generatePO(boqId, g.vendor_id, g.lines); setGenerated((p) => ({ ...p, [g.vendor_id]: no })); }
    catch (e) { alert('PO failed: ' + (e as any).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select label="From BOQ" value={boqId} onChange={(e) => setBoqId(e.target.value)} options={boqs.map((b) => ({ value: b.id, label: `${b.title} · ${formatINR(Number(b.grand_total))}` }))} />
        <Select label="Procurement priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}
          options={[{ value: 'balanced', label: 'Balanced' }, { value: 'speed', label: 'Speed' }, { value: 'margin', label: 'Lowest cost' }, { value: 'quality', label: 'Quality' }]} />
      </div>
      {loading ? <Loading /> : (
        <>
          <p className="text-sm text-slate-500">Materials auto-assigned to the best vendor per line ({priority}). One PO per vendor.</p>
          {groups.map((g) => (
            <Card key={g.vendor_id} padding="none">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                <CardTitle>{g.company_name} <span className="text-sm font-normal text-slate-400">· {g.lines.length} items · {formatINR(g.total)}</span></CardTitle>
                {generated[g.vendor_id] ? <Badge variant="success" size="sm"><Check className="w-3 h-3 mr-1" />{generated[g.vendor_id]}</Badge>
                  : <Button size="sm" onClick={() => createPO(g)}>Create PO</Button>}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {g.lines.map((l: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="px-3 py-1.5 text-slate-800">{l.description}</td>
                      <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">{l.quantity.toFixed(2)} {l.uom}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">@{formatINR(l.rate)}</td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatINR(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
          {unmatched.length > 0 && (
            <Card className="border-amber-200">
              <CardTitle className="text-amber-700">No vendor on file ({unmatched.length})</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Add a vendor SKU for these to enable auto-PO: {unmatched.map((u) => u.description).join(', ')}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Loading() { return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>; }
