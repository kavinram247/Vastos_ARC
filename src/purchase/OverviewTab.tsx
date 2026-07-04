// Overview tab — the module's at-a-glance operations dashboard.
import { ClipboardList, FileText, ShoppingCart, Boxes, IndianRupee, ArrowRight, TrendingUp } from 'lucide-react';
import { formatINR, formatINRCompact, timeAgo } from '../utils/format';
import { useStore } from '../hooks/useStore';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from './PurchaseManagementPage';
import { overviewMetrics, projectName } from './logic';
import type { PurchaseTabId } from './PurchaseManagementPage';

export function OverviewTab() {
  const { requests, rfqs, pos, stock, vendors, materials, goTab } = usePurchase();
  const store = useStore();
  const { firm } = useAuth();
  const m = overviewMetrics(requests, rfqs, pos, stock);

  const recent = store.activityLog
    .filter(a => a.firm_id === firm?.id && a.module === 'purchase')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  const attentionCards: { label: string; count: number; tab: PurchaseTabId; tone: string }[] = [
    { label: 'Requests awaiting action', count: m.openRequests, tab: 'requests', tone: 'text-sky-600' },
    { label: 'RFQs out for quotes', count: m.rfqAwaiting, tab: 'rfq', tone: 'text-violet-600' },
    { label: 'POs pending approval', count: m.poPendingApproval, tab: 'orders', tone: 'text-amber-600' },
    { label: 'Materials below reorder', count: m.lowStock, tab: 'stock', tone: 'text-red-600' },
  ];
  const attention = attentionCards.filter(a => a.count > 0);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="metric-strip metric-strip--four">
        <Metric label="Outstanding to vendors" value={formatINRCompact(m.outstandingValue)} note={`${m.poOutstanding} unpaid PO${m.poOutstanding === 1 ? '' : 's'}`} />
        <Metric label="Committed this year" value={formatINRCompact(m.committedThisFy)} note="Approved purchase orders" />
        <Metric label="Active vendors" value={String(vendors.filter(v => v.status !== 'inactive' && v.status !== 'blacklisted').length)} note={`${materials.filter(x => x.is_active).length} materials`} />
        <Metric label="Low-stock alerts" value={String(m.lowStock)} note="At or below reorder level" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Needs attention */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Needs attention</h3>
          {attention.length === 0 ? (
            <div className="surface-panel p-6 text-center text-sm text-slate-400">Nothing needs attention — the pipeline is clear.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {attention.map(a => (
                <button key={a.tab + a.label} onClick={() => goTab(a.tab)}
                  className="surface-panel flex items-center justify-between p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(16,32,26,0.08)]">
                  <div>
                    <div className={`text-2xl font-bold tabular-nums ${a.tone}`}>{a.count}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{a.label}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </button>
              ))}
            </div>
          )}

          {/* pipeline quick-links */}
          <h3 className="pt-2 text-sm font-semibold text-slate-700">Procurement pipeline</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PipelineCard icon={ClipboardList} label="Requests" count={requests.length} onClick={() => goTab('requests')} />
            <PipelineCard icon={FileText} label="RFQ" count={rfqs.length} onClick={() => goTab('rfq')} />
            <PipelineCard icon={ShoppingCart} label="Purchase Orders" count={pos.length} onClick={() => goTab('orders')} />
            <PipelineCard icon={Boxes} label="Stock" count={stock.length} onClick={() => goTab('stock')} />
          </div>
        </div>

        {/* Recent activity */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Recent activity</h3>
          <div className="surface-panel divide-y divide-slate-100">
            {recent.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400"><TrendingUp className="mx-auto mb-2 h-6 w-6 text-slate-300" />No purchase activity yet.</div>
            ) : recent.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50"><IndianRupee className="h-3.5 w-3.5 text-indigo-600" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">{a.action_label}</p>
                  <p className="text-xs text-slate-400">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Outstanding POs table */}
      {pos.some(p => p.payment_status !== 'paid' && p.status !== 'cancelled') && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Outstanding purchase orders</h3>
          <div className="surface-panel overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-4 py-2.5 text-left font-medium">PO</th><th className="px-4 py-2.5 text-left font-medium">Project</th><th className="px-4 py-2.5 text-right font-medium">Total</th><th className="px-4 py-2.5 text-right font-medium">Outstanding</th></tr></thead>
              <tbody>
                {pos.filter(p => p.payment_status !== 'paid' && p.status !== 'cancelled').slice(0, 6).map(p => {
                  const out = p.total_amount - p.payments.reduce((a, x) => a + x.amount, 0);
                  return (
                    <tr key={p.id} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/60" onClick={() => goTab('orders')}>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{p.po_number}</td>
                      <td className="px-4 py-2.5 text-slate-600">{projectName(p.project_id) || '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{formatINR(p.total_amount)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900">{formatINR(Math.max(0, out))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="metric-cell">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {note && <div className="metric-note">{note}</div>}
    </div>
  );
}

function PipelineCard({ icon: Icon, label, count, onClick }: { icon: React.ElementType; label: string; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="surface-panel flex flex-col items-start gap-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(16,32,26,0.08)]">
      <Icon className="h-5 w-5 text-indigo-600" />
      <div><div className="text-xl font-bold tabular-nums text-slate-900">{count}</div><div className="text-xs text-slate-500">{label}</div></div>
    </button>
  );
}
