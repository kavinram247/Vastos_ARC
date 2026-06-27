import { useState, useEffect, useMemo } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatINR, formatDate } from '../../utils/format';
import { fetchPublicQuote, markViewed, acceptQuote, type PublicQuote, type ScheduleWithMilestones } from '../quoteShareApi';
import { clientQuoteView } from '../engine/documents';
import { Building2, Check, Loader2, Plus, ShieldCheck, CalendarClock, Sparkles } from 'lucide-react';

export function ClientQuotePage({ token }: { token: string }) {
  const [data, setData] = useState<PublicQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleWithMilestones | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetchPublicQuote(token).then((q) => {
      setData(q);
      setSelected(new Set(q.quotation.selected_options || []));
      if (q.quotation.status === 'accepted') { setAccepted(true); setSchedule(q.schedule); }
      markViewed(token).catch(() => {});
    }).catch((e) => setError(e.message || 'Quote not found'));
  }, [token]);

  const charges = data ? {
    design_fees: data.quotation.design_fees, supervision_fees: data.quotation.supervision_fees,
    other_charges: data.quotation.other_charges, discount_pct: data.quotation.discount_pct,
  } : { design_fees: 0, supervision_fees: 0, other_charges: 0, discount_pct: 0 };

  const view = useMemo(() => data ? clientQuoteView(data.boq, selected, charges) : null, [data, selected, charges]);

  const toggleOpt = (id: string) => {
    if (accepted) return;
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const onAccept = async () => {
    if (!data || !view || !name.trim()) return;
    setAccepting(true);
    try {
      const sched = await acceptQuote({
        quotationId: data.quotation.id, firmId: data.quotation.firm_id, boqId: data.quotation.boq_id,
        name: name.trim(), selectedOptionalIds: [...selected],
        taxable: view.taxable, gst: view.gst, grandTotal: view.grand_total,
      });
      setSchedule(sched); setAccepted(true);
    } catch (e) { alert('Could not accept: ' + (e as any).message); } finally { setAccepting(false); }
  };

  if (error) return <Centered><div className="text-center text-slate-500"><p className="text-lg font-semibold text-slate-700">Quote unavailable</p><p className="text-sm mt-1">{error}</p></div></Centered>;
  if (!data || !view) return <Centered><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></Centered>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* letterhead */}
        <div className="surface-panel flex items-start justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-indigo-600">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">{data.firm.name}</div>
              <div className="text-xs text-slate-500 max-w-xs">{data.firm.address}</div>
              {data.firm.gstin && <div className="text-xs text-slate-400">GSTIN: {data.firm.gstin}</div>}
            </div>
          </div>
          <div className="text-right">
            <Badge variant={accepted ? 'success' : 'info'} size="sm">{accepted ? 'Accepted' : 'Quotation'}</Badge>
            <div className="text-xs text-slate-500 mt-1">{data.quotation.quotation_number}</div>
            <div className="text-xs text-slate-400">{formatDate(new Date().toISOString())}</div>
          </div>
        </div>

        {accepted && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600"><Check className="w-5 h-5 text-white" /></div>
            <div>
              <div className="font-semibold text-emerald-800">Accepted by {schedule?.signed_name || data.quotation.accepted_by_name}</div>
              <div className="text-xs text-emerald-600">Your payment schedule is ready below. Our team will be in touch to begin.</div>
            </div>
          </div>
        )}

        {/* room sections */}
        {view.sections.map((s, i) => (
          <div key={i} className="surface-panel overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{s.name}</h3>
              <span className="text-sm font-semibold text-slate-900">{formatINR(s.subtotal)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {s.lines.map((l, j) => (
                  <tr key={j} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2 text-slate-700">{l.description}</td>
                    <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">{l.qty.toFixed(2)} {l.uom}</td>
                    <td className="px-5 py-2 text-right font-medium text-slate-900 whitespace-nowrap">{formatINR(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* optional add-ons */}
        {view.optionals.length > 0 && (
          <div className="surface-panel overflow-hidden">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-amber-800">Optional upgrades</h3>
              <span className="text-xs text-amber-600">{accepted ? '' : 'tap to add'}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {view.optionals.map((o) => (
                <button key={o.id} onClick={() => toggleOpt(o.id)} disabled={accepted}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${o.selected ? 'bg-indigo-50' : 'hover:bg-slate-50'} ${accepted ? 'cursor-default' : ''}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${o.selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {o.selected ? <Check className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-800 truncate">{o.description}</div>
                    <div className="text-xs text-slate-400">{o.section}</div>
                  </div>
                  <div className="font-medium text-slate-900 whitespace-nowrap">+{formatINR(o.amount)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* totals */}
        <div className="surface-panel space-y-1.5 p-5 text-sm">
          <SumRow label="Scope of work" value={view.itemsSubtotal} />
          {view.optionalsSubtotal > 0 && <SumRow label="Selected upgrades" value={view.optionalsSubtotal} />}
          {view.fees > 0 && <SumRow label="Design & supervision" value={view.fees} />}
          {view.discount > 0 && <SumRow label={`Discount (${charges.discount_pct}%)`} value={-view.discount} />}
          <SumRow label="GST" value={view.gst} muted />
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-base font-bold text-slate-900">Total</span>
            <span className="text-2xl font-bold text-indigo-600">{formatINR(view.grand_total)}</span>
          </div>
        </div>

        {/* accept / schedule */}
        {!accepted ? (
          <div className="surface-panel space-y-3 p-5">
            <div className="flex items-center gap-2 text-slate-700"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span className="font-semibold">Accept this quotation</span></div>
            <p className="text-xs text-slate-500">Type your full name to accept. This generates your milestone payment schedule — no payment is due now.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <Button className="w-full" size="lg" onClick={onAccept} disabled={accepting || !name.trim()}>
              {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Accept & sign — {formatINR(view.grand_total)}
            </Button>
          </div>
        ) : schedule ? (
          <div className="surface-panel overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-indigo-500" /><h3 className="font-semibold text-slate-800">Payment schedule</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-400 border-b border-slate-100"><th className="text-left px-5 py-2 font-medium">Milestone</th><th className="text-right px-3 py-2 font-medium">%</th><th className="text-right px-3 py-2 font-medium">Amount</th><th className="text-right px-5 py-2 font-medium">Incl. GST</th></tr></thead>
              <tbody>
                {schedule.milestones.map((m) => (
                  <tr key={m.split_number} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 text-slate-700">{m.split_number}. {m.label}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{m.percent}%</td>
                    <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">{formatINR(m.amount)}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-slate-900 whitespace-nowrap">{formatINR(m.total_with_gst)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold"><td colSpan={3} className="px-5 py-2.5 text-right">Total</td><td className="px-5 py-2.5 text-right whitespace-nowrap">{formatINR(schedule.total_amount)}</td></tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="text-center text-xs text-slate-400 py-2">Powered by Vasto Arch · Validity 15 days · Prices inclusive of materials, hardware, labour & installation as specified.</p>
      </div>
    </div>
  );
}

function SumRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return <div className="flex items-center justify-between"><span className={muted ? 'text-slate-400' : 'text-slate-500'}>{label}</span><span className={`tabular-nums ${value < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>{formatINR(value)}</span></div>;
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">{children}</div>;
}
