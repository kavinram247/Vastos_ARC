import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { formatINR, formatDate } from '../../utils/format';
import { listBoqs } from '../api';
import { fetchBoqDetail, saveQuotation } from '../quotationApi';
import { customerView, costingView, procurementView, rfqView, type BoqDetail } from '../engine/documents';
import { FileText, Printer, Save, Loader2, Check, FileSpreadsheet, ShoppingCart, Send, Receipt, Share2, Copy } from 'lucide-react';

type DocTab = 'customer' | 'costing' | 'procurement' | 'rfq';

export function QuotationsPage() {
  const { firm } = useAuth();
  const [boqs, setBoqs] = useState<any[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BoqDetail | null>(null);
  const [tab, setTab] = useState<DocTab>('customer');
  const [charges, setCharges] = useState({ design_fees: 0, supervision_fees: 0, other_charges: 0, discount_pct: 0 });
  const [saving, setSaving] = useState(false);
  const [savedNo, setSavedNo] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => { listBoqs().then((b) => { setBoqs(b); if (b[0]) setSelId((b[0] as any).id); }).catch(console.error); }, []);
  useEffect(() => {
    if (!selId) return;
    setLoadingDetail(true); setSavedNo(null);
    fetchBoqDetail(selId).then(setDetail).catch(console.error).finally(() => setLoadingDetail(false));
  }, [selId]);

  const cust = useMemo(() => detail ? customerView(detail, charges) : null, [detail, charges]);
  const cost = useMemo(() => detail ? costingView(detail) : null, [detail]);
  const proc = useMemo(() => detail ? procurementView(detail) : null, [detail]);
  const rfq = useMemo(() => detail ? rfqView(detail) : [], [detail]);

  const docTabs: { id: DocTab; label: string; icon: React.ReactNode }[] = [
    { id: 'customer', label: 'Customer Quote', icon: <FileText className="w-4 h-4" /> },
    { id: 'costing', label: 'Internal Costing', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'procurement', label: 'Procurement', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'rfq', label: 'Vendor RFQ', icon: <Send className="w-4 h-4" /> },
  ];

  const onSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      let payload: any;
      if (tab === 'customer' && cust) payload = { docType: 'customer', design_fees: charges.design_fees, supervision_fees: charges.supervision_fees, other_charges: charges.other_charges, discount_pct: charges.discount_pct, subtotal: cust.taxable, gst_amount: cust.gst, total_amount: cust.grand_total, snapshot: cust };
      else if (tab === 'costing' && cost) payload = { docType: 'internal_costing', subtotal: cost.sell, gst_amount: 0, total_amount: cost.sell, snapshot: cost };
      else if (tab === 'procurement' && proc) payload = { docType: 'procurement', subtotal: proc.total, gst_amount: 0, total_amount: proc.total, snapshot: proc };
      else payload = { docType: 'vendor_rfq', subtotal: 0, gst_amount: 0, total_amount: 0, snapshot: { rows: rfq } };
      const res = await saveQuotation({ boqId: detail.id, ...payload });
      setSavedNo(res.quotation_number);
    } catch (e) { alert('Save failed: ' + (e as any).message); } finally { setSaving(false); }
  };

  const shareWithClient = async () => {
    if (!detail || !cust) return;
    setSharing(true);
    try {
      const res = await saveQuotation({
        boqId: detail.id, docType: 'customer',
        design_fees: charges.design_fees, supervision_fees: charges.supervision_fees,
        other_charges: charges.other_charges, discount_pct: charges.discount_pct,
        subtotal: cust.taxable, gst_amount: cust.gst, total_amount: cust.grand_total, snapshot: cust,
      });
      const url = `${window.location.origin}${window.location.pathname}?quote=${res.share_token}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked */ }
    } catch (e) { alert('Share failed: ' + (e as any).message); } finally { setSharing(false); }
  };

  return (
    <div className="space-y-6">
      <style>{`@media print { body * { visibility: hidden !important; } #quote-doc, #quote-doc * { visibility: visible !important; } #quote-doc { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; } .no-print { display: none !important; } }`}</style>

      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Receipt className="w-6 h-6 text-indigo-600" /> Quotations & Documents</h1>
        <p className="text-sm text-slate-500">One BOQ → customer quote, internal costing, procurement sheet & vendor RFQ.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* saved BOQ list */}
        <Card padding="none" className="no-print lg:col-span-1 h-fit">
          <div className="p-3 border-b border-slate-200"><CardTitle>Saved BOQs</CardTitle></div>
          <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {boqs.length === 0 && <p className="p-4 text-sm text-slate-400">No saved BOQs yet. Create one in the BOQ Estimator.</p>}
            {boqs.map((b) => (
              <button key={b.id} onClick={() => setSelId(b.id)}
                className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${selId === b.id ? 'bg-indigo-50' : ''}`}>
                <div className="font-medium text-slate-900 text-sm truncate">{b.title}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{formatDate(b.created_at)}</span>
                  <span className="text-xs font-semibold text-slate-700">{formatINR(Number(b.grand_total))}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* document area */}
        <div className="lg:col-span-3 space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 border-b border-slate-200">
              {docTabs.map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); setSavedNo(null); }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {savedNo && <Badge variant="success" size="sm"><Check className="w-3 h-3 mr-1" /> {savedNo}</Badge>}
              {tab === 'customer' && (
                <Button variant="secondary" size="sm" onClick={shareWithClient} disabled={sharing || !detail}>
                  {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share with client
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={!detail}><Printer className="w-4 h-4" /> Print / PDF</Button>
              <Button size="sm" onClick={onSave} disabled={saving || !detail}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</Button>
            </div>
          </div>

          {/* share link banner */}
          {tab === 'customer' && shareUrl && (
            <div className="no-print flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm">
              <Share2 className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-slate-500 shrink-0">Client link (copied):</span>
              <a href={shareUrl} target="_blank" rel="noreferrer" className="text-indigo-600 truncate flex-1 hover:underline">{shareUrl}</a>
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} className="text-slate-400 hover:text-indigo-600 shrink-0"><Copy className="w-4 h-4" /></button>
            </div>
          )}

          {/* customer charges */}
          {tab === 'customer' && (
            <Card className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Design fees (₹)" type="number" value={charges.design_fees} onChange={(e) => setCharges((c) => ({ ...c, design_fees: parseFloat(e.target.value) || 0 }))} />
              <Input label="Supervision (₹)" type="number" value={charges.supervision_fees} onChange={(e) => setCharges((c) => ({ ...c, supervision_fees: parseFloat(e.target.value) || 0 }))} />
              <Input label="Other (₹)" type="number" value={charges.other_charges} onChange={(e) => setCharges((c) => ({ ...c, other_charges: parseFloat(e.target.value) || 0 }))} />
              <Input label="Discount (%)" type="number" value={charges.discount_pct} onChange={(e) => setCharges((c) => ({ ...c, discount_pct: parseFloat(e.target.value) || 0 }))} />
            </Card>
          )}

          <div id="quote-doc">
            {loadingDetail || !detail ? (
              <Card><div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div></Card>
            ) : (
              <Card className="space-y-5">
                <Letterhead firm={firm} title={docTitle(tab)} boqTitle={detail.title} />
                {tab === 'customer' && cust && <CustomerDoc view={cust} charges={charges} />}
                {tab === 'costing' && cost && <CostingDoc view={cost} />}
                {tab === 'procurement' && proc && <ProcurementDoc view={proc} />}
                {tab === 'rfq' && <RfqDoc rows={rfq} />}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Letterhead({ firm, title, boqTitle }: { firm: any; title: string; boqTitle: string }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-200 pb-4">
      <div>
        <div className="text-xl font-bold text-slate-900">{firm?.name || 'Studio Horizon Architects'}</div>
        <div className="text-xs text-slate-500 mt-0.5 max-w-xs">{firm?.address}</div>
        {firm?.gstin && <div className="text-xs text-slate-500">GSTIN: {firm.gstin}</div>}
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold text-indigo-700">{title}</div>
        <div className="text-xs text-slate-500">{boqTitle}</div>
        <div className="text-xs text-slate-400 mt-0.5">{formatDate(new Date().toISOString())}</div>
      </div>
    </div>
  );
}

function th(extra = '') { return `text-left px-3 py-2 font-medium text-slate-500 text-xs ${extra}`; }

function CustomerDoc({ view, charges }: { view: ReturnType<typeof customerView>; charges: any }) {
  return (
    <div className="space-y-4">
      {view.sections.map((s, i) => (
        <div key={i}>
          <h3 className="font-semibold text-slate-800 mb-1">{s.name}</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100"><th className={th()}>Item</th><th className={th('text-right')}>Qty</th><th className={th()}>Unit</th><th className={th('text-right')}>Amount</th></tr></thead>
            <tbody>
              {s.lines.map((l, j) => (
                <tr key={j} className="border-b border-slate-50"><td className="px-3 py-1.5 text-slate-800">{l.description}</td><td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">{l.qty.toFixed(2)}</td><td className="px-3 py-1.5 text-slate-400">{l.uom}</td><td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatINR(l.amount)}</td></tr>
              ))}
              <tr className="bg-slate-50"><td colSpan={3} className="px-3 py-1.5 text-right text-xs text-slate-500">Subtotal</td><td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatINR(s.subtotal)}</td></tr>
            </tbody>
          </table>
        </div>
      ))}
      <div className="flex justify-end">
        <table className="text-sm w-72">
          <tbody>
            <SumRow label="Items subtotal" value={view.lineSubtotal} />
            {charges.design_fees > 0 && <SumRow label="Design fees" value={charges.design_fees} />}
            {charges.supervision_fees > 0 && <SumRow label="Supervision" value={charges.supervision_fees} />}
            {charges.other_charges > 0 && <SumRow label="Other charges" value={charges.other_charges} />}
            {view.discount > 0 && <SumRow label={`Discount (${charges.discount_pct}%)`} value={-view.discount} />}
            <SumRow label="Taxable value" value={view.taxable} />
            <SumRow label="GST" value={view.gst} />
            <SumRow label="Grand total" value={view.grand_total} bold />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">Inclusive of materials, hardware, labour & installation as specified. Validity 15 days. Taxes as applicable.</p>
    </div>
  );
}

function CostingDoc({ view }: { view: ReturnType<typeof costingView> }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-6 text-sm">
        <Stat label="Total cost" value={formatINR(view.cost)} />
        <Stat label="Selling" value={formatINR(view.sell)} />
        <Stat label="Gross margin" value={formatINR(view.gross_margin)} accent />
        <Stat label="Margin %" value={`${view.margin_pct}%`} accent />
      </div>
      {view.sections.map((s, i) => (
        <div key={i}>
          <h3 className="font-semibold text-slate-800 mb-1">{s.name} <span className="text-xs text-slate-400 font-normal">cost {formatINR(s.cost)} · sell {formatINR(s.sell)}</span></h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100"><th className={th()}>Item</th><th className={th('text-right')}>Qty</th><th className={th('text-right')}>Cost rate</th><th className={th('text-right')}>Cost</th><th className={th('text-right')}>Selling</th><th className={th('text-right')}>Margin</th></tr></thead>
            <tbody>
              {s.lines.map((l, j) => (
                <tr key={j} className="border-b border-slate-50">
                  <td className="px-3 py-1.5 text-slate-800">{l.description} {l.is_labour && <Badge variant="warning" size="sm">labour</Badge>}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">{l.qty.toFixed(2)} {l.uom}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">{formatINR(l.cost_rate)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">{formatINR(l.cost)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-900 tabular-nums">{formatINR(l.sell)}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-600 tabular-nums">{l.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function ProcurementDoc({ view }: { view: ReturnType<typeof procurementView> }) {
  return (
    <div>
      <p className="text-sm text-slate-500 mb-2">Materials aggregated across all rooms/modules. Labour excluded.</p>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200"><th className={th()}>Material</th><th className={th('text-right')}>Qty (incl. waste)</th><th className={th()}>Unit</th><th className={th('text-right')}>Cost rate</th><th className={th('text-right')}>Amount</th></tr></thead>
        <tbody>
          {view.rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-50"><td className="px-3 py-1.5 text-slate-800">{r.description}</td><td className="px-3 py-1.5 text-right tabular-nums">{r.quantity.toFixed(2)}</td><td className="px-3 py-1.5 text-slate-400">{r.uom}</td><td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">{formatINR(r.rate)}</td><td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatINR(r.amount)}</td></tr>
          ))}
          <tr className="bg-slate-50 font-semibold"><td colSpan={4} className="px-3 py-2 text-right">Total procurement value</td><td className="px-3 py-2 text-right tabular-nums">{formatINR(view.total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function RfqDoc({ rows }: { rows: { description: string; uom: string; quantity: number }[] }) {
  return (
    <div>
      <p className="text-sm text-slate-500 mb-2">Request for Quotation — please fill your rate against each item. (Prices intentionally omitted.)</p>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200"><th className={th()}>#</th><th className={th()}>Material</th><th className={th('text-right')}>Qty</th><th className={th()}>Unit</th><th className={th('text-right')}>Your rate</th><th className={th('text-right')}>Amount</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-50"><td className="px-3 py-2 text-slate-400">{i + 1}</td><td className="px-3 py-2 text-slate-800">{r.description}</td><td className="px-3 py-2 text-right tabular-nums">{r.quantity}</td><td className="px-3 py-2 text-slate-400">{r.uom}</td><td className="px-3 py-2 text-right text-slate-300">__________</td><td className="px-3 py-2 text-right text-slate-300">__________</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SumRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return <tr className={bold ? 'border-t border-slate-200' : ''}><td className={`px-3 py-1 ${bold ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{label}</td><td className={`px-3 py-1 text-right tabular-nums ${bold ? 'text-lg font-bold text-slate-900' : 'text-slate-700'}`}>{formatINR(value)}</td></tr>;
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div><div className="text-xs text-slate-400">{label}</div><div className={`font-semibold ${accent ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</div></div>;
}
function docTitle(t: DocTab) { return t === 'customer' ? 'QUOTATION' : t === 'costing' ? 'INTERNAL COSTING SHEET' : t === 'procurement' ? 'PROCUREMENT SHEET' : 'VENDOR RFQ'; }
