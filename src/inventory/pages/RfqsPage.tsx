import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useStore } from '../../hooks/useStore';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { formatINR, formatDate } from '../../utils/format';
import { Plus, Trash2, Send, Award } from 'lucide-react';
import { InvHeader, StatusBadge, AsyncState, EmptyState, AccessNotice, ActionBanner, fmtQty } from '../ui';
import { takePendingOpen } from '../nav';
import {
  listRfqs, getRfqDetail, listMaterials, saveRfq, sendRfq, recordQuote, awardRfq,
} from '../inventoryApi';
import { fetchVendorsWithScores, type VendorWithScore } from '../../boq/vendorApi';
import { rankVendors, type VendorCandidate, type Priority } from '../../boq/engine/vendorScore';
import type { Rfq, Material } from '../types';
import type { Page } from '../../types';

const PRIORITIES = ['balanced', 'speed', 'margin', 'quality'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

export function RfqsPage({ onNavigate }: { onNavigate: (p: Page, projectId?: string) => void }) {
  const { firm } = useAuth();
  const { can, canAccess } = usePermissions();
  const store = useStore();
  const firmId = firm?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<VendorWithScore[]>([]);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  const matBySku = useMemo(() => new Map(materials.map(m => [m.sku_id, m])), [materials]);

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      const [r, m, v] = await Promise.all([listRfqs(firmId), listMaterials(firmId), fetchVendorsWithScores(firmId)]);
      setRfqs(r); setMaterials(m); setVendors(v);
      const openId = takePendingOpen('rfqs');
      if (openId) { const rfq = r.find(x => x.id === openId); if (rfq) await openEdit(rfq); }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const projectName = (id?: string | null) => store.projects.find(p => p.id === id)?.name ?? id ?? '—';
  const projectOptions = [{ value: '', label: 'Select project…' }, ...store.projects.map(p => ({ value: p.id, label: p.name }))];
  const materialOptions = [{ value: '', label: 'Material…' }, ...materials.map(m => ({ value: m.sku_id, label: `${m.name} (${m.base_uom})` }))];

  const openNew = () => setEditor({ project: '', priority: 'balanced', required_by: '', notes: '', rows: [{ sku_id: '', material_name: '', uom: '', quantity: '' }], vendorIds: [] as string[] });
  const openEdit = async (rfq: Rfq) => {
    const d = await getRfqDetail(rfq.id);
    if (rfq.status !== 'draft') { setDetail({ rfq, ...d }); return; }
    setEditor({
      id: rfq.id, project: rfq.project_id ?? '', priority: rfq.priority, required_by: rfq.required_by ?? '', notes: rfq.notes ?? '',
      material_request_id: rfq.material_request_id,
      rows: (d.items as any[]).map(i => ({ sku_id: i.sku_id ?? '', material_name: i.material_name, uom: i.uom ?? '', quantity: String(i.quantity) })),
      vendorIds: (d.vendors as any[]).map(v => v.vendor_id).filter(Boolean),
    });
  };

  const setRow = (i: number, patch: any) => setEditor((e: any) => ({ ...e, rows: e.rows.map((r: any, idx: number) => idx === i ? { ...r, ...patch } : r) }));
  const onPick = (i: number, sku: string) => { const m = matBySku.get(sku); setRow(i, { sku_id: sku, material_name: m?.name ?? '', uom: m?.base_uom ?? '' }); };
  const toggleVendor = (id: string) => setEditor((e: any) => ({ ...e, vendorIds: e.vendorIds.includes(id) ? e.vendorIds.filter((x: string) => x !== id) : [...e.vendorIds, id] }));

  const save = async (sendAfter: boolean) => {
    if (!editor.project) { setBanner({ kind: 'error', message: 'Choose a project.' }); return; }
    const items = editor.rows.filter((r: any) => r.sku_id || r.material_name.trim());
    if (!items.length) { setBanner({ kind: 'error', message: 'Add at least one material.' }); return; }
    if (sendAfter && editor.vendorIds.length === 0) { setBanner({ kind: 'error', message: 'Add at least one vendor before sending.' }); return; }
    setBusy(true);
    try {
      const id = await saveRfq(
        { id: editor.id, project_id: editor.project, priority: editor.priority, required_by: editor.required_by || null, notes: editor.notes || null, material_request_id: editor.material_request_id },
        items.map((r: any) => ({ sku_id: r.sku_id || null, material_name: r.material_name, uom: r.uom || null, quantity: Number(r.quantity || 0) })),
        editor.vendorIds.map((vid: string) => ({ vendor_id: vid, vendor_name: vendors.find(v => v.id === vid)?.company_name ?? '' })),
      );
      if (sendAfter) await sendRfq(id);
      setEditor(null); setBanner({ kind: 'success', message: sendAfter ? 'RFQ sent to vendors.' : 'RFQ saved.' }); await load();
    } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); }
  };

  const reloadDetail = async (rfq: Rfq) => { const d = await getRfqDetail(rfq.id); setDetail({ rfq, ...d }); };

  if (!canAccess('rfqs')) return (<div className="space-y-6"><InvHeader title="RFQs & Quotes" /><AccessNotice label="RFQs" /></div>);

  return (
    <div className="space-y-5">
      <InvHeader title="RFQs & Quotes" subtitle="One RFQ to many vendors. Compare on landed cost, delivery feasibility and vendor score, then split the award."
        actions={can('rfqs', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New RFQ</Button>} />
      {banner && <ActionBanner kind={banner.kind} message={banner.message} onClose={() => setBanner(null)} />}

      <AsyncState loading={loading} error={error}>
        {rfqs.length === 0 ? (
          <EmptyState title="No RFQs yet" message="Raise an RFQ from an approved material request or directly, then invite vendors to quote."
            action={can('rfqs', 'create') && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New RFQ</Button>} />
        ) : (
          <div className="surface-panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-[0.04em] text-slate-500">
                <th className="px-4 py-2.5 font-semibold">RFQ</th><th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold">Priority</th><th className="px-4 py-2.5 font-semibold">Required</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {rfqs.map(r => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => openEdit(r)}>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.rfq_number}</td>
                    <td className="px-4 py-3 text-slate-600">{projectName(r.project_id)}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{r.priority}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{r.required_by ? formatDate(r.required_by) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncState>

      {editor && (
        <Modal open onClose={() => setEditor(null)} title={editor.id ? 'Edit RFQ' : 'New RFQ'} size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Project" value={editor.project} onChange={e => setEditor({ ...editor, project: e.target.value })} options={projectOptions} />
              <Select label="Priority" value={editor.priority} onChange={e => setEditor({ ...editor, priority: e.target.value })} options={PRIORITIES} />
              <Input label="Required by" type="date" value={editor.required_by} onChange={e => setEditor({ ...editor, required_by: e.target.value })} />
            </div>
            <div className="rounded-[10px] border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.03em] text-slate-500">Materials</div>
              {editor.rows.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2">
                  <div className="flex-1"><Select value={r.sku_id} onChange={e => onPick(i, e.target.value)} options={materialOptions} /></div>
                  <Input type="number" value={r.quantity} onChange={e => setRow(i, { quantity: e.target.value })} placeholder="qty" className="w-24" />
                  <span className="w-12 text-xs text-slate-400">{r.uom}</span>
                  <button aria-label="Remove" onClick={() => setEditor({ ...editor, rows: editor.rows.filter((_: any, idx: number) => idx !== i) })} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button onClick={() => setEditor({ ...editor, rows: [...editor.rows, { sku_id: '', material_name: '', uom: '', quantity: '' }] })} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50/50"><Plus className="h-4 w-4" /> Add material</button>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-700">Vendors to invite</div>
              <div className="flex flex-wrap gap-2">
                {vendors.length === 0 && <span className="text-sm text-slate-500">No vendors yet — add them in the Vendors module.</span>}
                {vendors.map(v => (
                  <button key={v.id} onClick={() => toggleVendor(v.id)}
                    className={`rounded-[9px] border px-3 py-1.5 text-sm ${editor.vendorIds.includes(v.id) ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                    {v.company_name}{v.score ? ` · ${v.score.overall}` : ''}
                  </button>
                ))}
              </div>
            </div>
            <Textarea label="Notes" value={editor.notes} onChange={e => setEditor({ ...editor, notes: e.target.value })} rows={2} />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>Cancel</Button>
              <Button variant="secondary" onClick={() => save(false)} disabled={busy}>Save draft</Button>
              <Button onClick={() => save(true)} disabled={busy}><Send className="h-4 w-4" /> Save &amp; send</Button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <RfqDetail detail={detail} vendors={vendors} matBySku={matBySku} projectName={projectName} busy={busy} can={can}
          onClose={() => setDetail(null)}
          onRecordQuote={async (rvId: string, terms: any, items: any[]) => { setBusy(true); try { await recordQuote(rvId, terms, items); await reloadDetail(detail.rfq); setBanner({ kind: 'success', message: 'Quote recorded.' }); } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); } }}
          onAward={async (awards: any[]) => { setBusy(true); try { await awardRfq(detail.rfq.id, awards); setDetail(null); setBanner({ kind: 'success', message: 'RFQ awarded — draft PO(s) created.' }); await load(); onNavigate('purchase-orders'); } catch (e: any) { setBanner({ kind: 'error', message: e.message }); } finally { setBusy(false); } }}
        />
      )}
    </div>
  );
}

function RfqDetail({ detail, vendors, matBySku, projectName, busy, can, onClose, onRecordQuote, onAward }: any) {
  const { rfq, items, vendors: rvs, quotes } = detail;
  const [quoting, setQuoting] = useState<any | null>(null);
  const [awardSel, setAwardSel] = useState<Record<string, string>>({}); // rfq_item_id -> rfq_vendor_id

  const scoreByVendor = new Map(vendors.map((v: VendorWithScore) => [v.id, v.score]));
  const landedUnit = (rvId: string, itemId: string) => {
    const q = quotes.find((x: any) => x.rfq_vendor_id === rvId && x.rfq_item_id === itemId);
    if (!q || q.unit_price == null) return null;
    return Number(q.unit_price) * (1 + Number(q.tax_pct || 0) / 100);
  };

  // rank invited vendors overall for the project priority (reuses vendor intelligence)
  const ranked = useMemo(() => {
    const candidates: (VendorCandidate & { rvId: string })[] = rvs.map((rv: any) => {
      const total = items.reduce((s: number, it: any) => { const lu = landedUnit(rv.id, it.id); return s + (lu ?? 0) * Number(it.quantity || 0); }, 0) + Number(rv.freight || 0);
      return { rvId: rv.id, vendor_id: rv.vendor_id ?? rv.id, company_name: rv.vendor_name, price: total, lead_time_days: rv.lead_time_days ?? 999, moq: null, score: scoreByVendor.get(rv.vendor_id) ?? null };
    });
    const daysUntil = rfq.required_by ? Math.ceil((new Date(rfq.required_by).getTime() - Date.now()) / 86400000) : null;
    return rankVendors(candidates as any, rfq.priority as Priority, 1, daysUntil).map((r: any) => ({ ...r, rvId: (candidates.find(c => c.vendor_id === r.vendor_id) || {}).rvId }));
  }, [rvs, quotes, items, rfq.priority, rfq.required_by]);

  const hasQuotes = quotes.length > 0;
  const buildAwards = () => {
    const byVendor: Record<string, any[]> = {};
    for (const it of items) {
      const rvId = awardSel[it.id];
      if (!rvId) continue;
      (byVendor[rvId] ||= []).push({ rfq_item_id: it.id, qty: Number(it.quantity || 0) });
    }
    return Object.entries(byVendor).map(([rfq_vendor_id, its]) => ({ rfq_vendor_id, items: its }));
  };

  return (
    <Modal open onClose={onClose} title={`${rfq.rfq_number} · ${projectName(rfq.project_id)}`} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <StatusBadge status={rfq.status} /><span className="capitalize">{rfq.priority} priority</span>
          {rfq.required_by && <span>· required {formatDate(rfq.required_by)}</span>}
        </div>

        {/* Vendors + record quote */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">Vendors</div>
          <div className="flex flex-wrap gap-2">
            {rvs.map((rv: any) => (
              <div key={rv.id} className="flex items-center gap-2 rounded-[9px] border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <span className="font-medium text-slate-800">{rv.vendor_name}</span>
                <StatusBadge status={rv.status} />
                {['sent', 'pending', 'quoted'].includes(rv.status) && can('rfqs', 'edit') && rfq.status !== 'awarded' && (
                  <button onClick={() => setQuoting({ rv, terms: { lead_time_days: rv.lead_time_days ?? '', freight: rv.freight ?? 0, promised_date: rv.promised_date ?? '' }, prices: Object.fromEntries(items.map((it: any) => { const q = quotes.find((x: any) => x.rfq_vendor_id === rv.id && x.rfq_item_id === it.id); return [it.id, { unit_price: q?.unit_price ?? '', tax_pct: q?.tax_pct ?? 18 }]; })) })}
                    className="text-xs font-semibold text-indigo-700 hover:underline">Record quote</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Comparison matrix */}
        {hasQuotes && (
          <div className="overflow-x-auto rounded-[10px] border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-[0.03em] text-slate-500">
                <th className="px-3 py-2 font-semibold">Material · qty</th>
                {rvs.map((rv: any) => <th key={rv.id} className="px-3 py-2 text-right font-semibold">{rv.vendor_name}</th>)}
                <th className="px-3 py-2 font-semibold">Award to</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((it: any) => {
                  const best = Math.min(...rvs.map((rv: any) => landedUnit(rv.id, it.id) ?? Infinity));
                  return (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-slate-800">{matBySku.get(it.sku_id)?.name ?? it.material_name}<div className="text-xs text-slate-400">{fmtQty(it.quantity, it.uom)}</div></td>
                      {rvs.map((rv: any) => { const lu = landedUnit(rv.id, it.id); return (
                        <td key={rv.id} className={`px-3 py-2 text-right tabular-nums ${lu != null && lu === best ? 'font-semibold text-emerald-700' : 'text-slate-600'}`}>{lu != null ? formatINR(lu) : '—'}</td>
                      ); })}
                      <td className="px-3 py-2">
                        <select value={awardSel[it.id] ?? ''} onChange={e => setAwardSel({ ...awardSel, [it.id]: e.target.value })} className="h-8 rounded-md border border-slate-200 px-2 text-sm">
                          <option value="">—</option>
                          {rvs.filter((rv: any) => landedUnit(rv.id, it.id) != null).map((rv: any) => <option key={rv.id} value={rv.id}>{rv.vendor_name}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Vendor ranking */}
        {hasQuotes && ranked.length > 0 && (
          <div className="rounded-[10px] border border-slate-200 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">Recommendation ({rfq.priority})</div>
            <ol className="space-y-1 text-sm">
              {ranked.map((r: any, i: number) => (
                <li key={r.rvId ?? i} className="flex items-center justify-between">
                  <span className="text-slate-700">{i + 1}. {r.company_name} {!r.feasible && <span className="text-xs text-amber-600">({r.reason})</span>}</span>
                  <span className="tabular-nums text-slate-500">{formatINR(r.price)} · score {r.weighted}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          {hasQuotes && can('rfqs', 'approve') && rfq.status !== 'awarded' && (
            <Button onClick={() => onAward(buildAwards())} disabled={busy || Object.keys(awardSel).length === 0}><Award className="h-4 w-4" /> Award &amp; create PO</Button>
          )}
        </div>
      </div>

      {quoting && (
        <Modal open onClose={() => setQuoting(null)} title={`Record quote · ${quoting.rv.vendor_name}`} size="lg">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Input label="Lead time (days)" type="number" value={quoting.terms.lead_time_days} onChange={e => setQuoting({ ...quoting, terms: { ...quoting.terms, lead_time_days: e.target.value } })} />
              <Input label="Freight (₹)" type="number" value={quoting.terms.freight} onChange={e => setQuoting({ ...quoting, terms: { ...quoting.terms, freight: e.target.value } })} />
              <Input label="Promised date" type="date" value={quoting.terms.promised_date} onChange={e => setQuoting({ ...quoting, terms: { ...quoting.terms, promised_date: e.target.value } })} />
            </div>
            <div className="overflow-hidden rounded-[10px] border border-slate-200">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-[0.03em] text-slate-500"><th className="px-3 py-2 font-semibold">Material</th><th className="px-3 py-2 font-semibold">Unit price</th><th className="px-3 py-2 font-semibold">Tax %</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-slate-800">{matBySku.get(it.sku_id)?.name ?? it.material_name}<div className="text-xs text-slate-400">{fmtQty(it.quantity, it.uom)}</div></td>
                      <td className="px-3 py-2"><input type="number" value={quoting.prices[it.id]?.unit_price ?? ''} onChange={e => setQuoting({ ...quoting, prices: { ...quoting.prices, [it.id]: { ...quoting.prices[it.id], unit_price: e.target.value } } })} className="h-8 w-28 rounded-md border border-slate-200 px-2 text-sm tabular-nums" /></td>
                      <td className="px-3 py-2"><input type="number" value={quoting.prices[it.id]?.tax_pct ?? 18} onChange={e => setQuoting({ ...quoting, prices: { ...quoting.prices, [it.id]: { ...quoting.prices[it.id], tax_pct: e.target.value } } })} className="h-8 w-20 rounded-md border border-slate-200 px-2 text-sm tabular-nums" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="ghost" onClick={() => setQuoting(null)} disabled={busy}>Cancel</Button>
              <Button disabled={busy} onClick={() => {
                const quoteItems = items.filter((it: any) => quoting.prices[it.id]?.unit_price !== '' && quoting.prices[it.id]?.unit_price != null)
                  .map((it: any) => ({ rfq_item_id: it.id, unit_price: Number(quoting.prices[it.id].unit_price), tax_pct: Number(quoting.prices[it.id].tax_pct || 0) }));
                onRecordQuote(quoting.rv.id, { lead_time_days: quoting.terms.lead_time_days || null, freight: Number(quoting.terms.freight || 0), promised_date: quoting.terms.promised_date || null }, quoteItems);
                setQuoting(null);
              }}>Save quote</Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
