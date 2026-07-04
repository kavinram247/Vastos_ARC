import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useStore } from '../../hooks/useStore';
import { Button } from '../../components/ui/Button';
import { formatINR } from '../../utils/format';
import { parseLink } from '../../lib/events';
import type { Page } from '../../types';
import { AlertTriangle, ArrowRight, RefreshCw, ShoppingCart, ClipboardList, PackageCheck } from 'lucide-react';
import { InvHeader, Metric, AsyncState, EmptyState, AccessNotice } from '../ui';
import {
  listStockPositions, listPurchaseOrders, listMaterialRequests, listAlerts, listMovements,
  refreshAlerts,
} from '../inventoryApi';
import type { StockPosition, PurchaseOrder, MaterialRequest, InventoryAlert, StockMovement } from '../types';

const today = () => new Date().toISOString().slice(0, 10);

export function InventoryOverviewPage({ onNavigate }: { onNavigate: (p: Page, projectId?: string) => void }) {
  const { firm } = useAuth();
  const { canAccess } = usePermissions();
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [mrs, setMrs] = useState<MaterialRequest[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);

  const firmId = firm?.id;

  const load = async () => {
    if (!firmId) return;
    setLoading(true); setError(null);
    try {
      await refreshAlerts().catch(() => {}); // regenerate exceptions (no-op without an auth session)
      const [p, o, m, a, mv] = await Promise.all([
        listStockPositions(firmId), listPurchaseOrders(firmId), listMaterialRequests(firmId),
        listAlerts(firmId), listMovements(firmId, { limit: 500 }),
      ]);
      setPositions(p); setPos(o); setMrs(m); setAlerts(a); setMoves(mv);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [firmId]);

  const projectName = (id?: string | null) => store.projects.find(p => p.id === id)?.name ?? id ?? '—';

  const metrics = useMemo(() => {
    // last accepted unit cost per sku (from purchase receipts) for on-hand valuation
    const lastCost = new Map<string, number>();
    for (const mv of moves) {
      if (mv.movement_type === 'purchase_receipt' && mv.unit_cost != null && !lastCost.has(mv.sku_id))
        lastCost.set(mv.sku_id, mv.unit_cost);
    }
    const onHandValue = positions.reduce((s, p) => s + p.on_hand * (lastCost.get(p.sku_id) ?? 0), 0);
    const onOrderValue = pos.filter(p => ['approved', 'issued', 'partially_received'].includes(p.status))
      .reduce((s, p) => s + p.total_amount, 0);
    const t = today();
    return {
      onHandValue,
      onOrderValue,
      belowReorder: alerts.filter(a => a.alert_type === 'reorder').length,
      shortages: alerts.filter(a => a.alert_type === 'shortage').length,
      mrPending: mrs.filter(m => m.status === 'submitted').length,
      poPending: pos.filter(p => p.status === 'pending_approval').length,
      lateDeliveries: pos.filter(p => ['issued', 'partially_received'].includes(p.status) && p.required_by && p.required_by < t).length,
      partialReceipts: pos.filter(p => p.status === 'partially_received').length,
      skuOnHand: positions.filter(p => p.on_hand > 0).length,
      openExceptions: alerts.length,
    };
  }, [positions, pos, mrs, alerts, moves]);

  if (!canAccess('inventory')) return (<div className="space-y-6"><InvHeader title="Inventory" /><AccessNotice label="Inventory" /></div>);

  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  const sortedAlerts = [...alerts].sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3));

  return (
    <div className="space-y-6">
      <InvHeader
        title="Inventory & Procurement"
        subtitle="Live, ledger-derived stock and the procurement exceptions that need action first."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            {canAccess('material_requests') && (
              <Button size="sm" onClick={() => onNavigate('material-requests')}><ClipboardList className="h-4 w-4" /> New request</Button>
            )}
          </>
        }
      />

      <AsyncState loading={loading} error={error}>
        {/* Exception-first metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Metric label="On-hand value" value={formatINR(metrics.onHandValue)} hint={`${metrics.skuOnHand} SKUs in stock`} />
          <Metric label="On-order value" value={formatINR(metrics.onOrderValue)} hint="Approved & issued POs" />
          <Metric label="Requests to approve" value={metrics.mrPending} tone={metrics.mrPending ? 'warning' : 'default'} />
          <Metric label="POs to approve" value={metrics.poPending} tone={metrics.poPending ? 'warning' : 'default'} />
          <Metric label="Projected shortages" value={metrics.shortages} tone={metrics.shortages ? 'danger' : 'success'} />
          <Metric label="Below reorder" value={metrics.belowReorder} tone={metrics.belowReorder ? 'warning' : 'default'} />
          <Metric label="Late deliveries" value={metrics.lateDeliveries} tone={metrics.lateDeliveries ? 'danger' : 'default'} />
          <Metric label="Partial receipts" value={metrics.partialReceipts} tone={metrics.partialReceipts ? 'warning' : 'default'} />
          <Metric label="Open exceptions" value={metrics.openExceptions} tone={metrics.openExceptions ? 'warning' : 'success'} />
        </div>

        {/* Alerts feed */}
        <div className="surface-panel">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">Exceptions & alerts</h2>
            <span className="text-xs text-slate-500">{alerts.length} open</span>
          </div>
          {sortedAlerts.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState icon={<PackageCheck className="h-8 w-8" />} title="All clear"
                message="No open inventory exceptions. New shortages, approvals and late deliveries will surface here." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedAlerts.slice(0, 25).map(a => {
                const dot = a.severity === 'critical' ? 'bg-red-500' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-sky-500';
                const link = parseLink(a.link);
                return (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{a.title}</div>
                      {a.message && <div className="truncate text-xs text-slate-500">{a.message}</div>}
                    </div>
                    <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{projectName(a.project_id)}</span>
                    {link && (
                      <button onClick={() => onNavigate(link.page, link.projectId)}
                        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick lanes */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <QuickLane icon={<ClipboardList className="h-4 w-4" />} title="Material requests"
            count={mrs.filter(m => ['submitted', 'approved', 'in_procurement'].includes(m.status)).length}
            hint="in progress" onClick={() => onNavigate('material-requests')} show={canAccess('material_requests')} />
          <QuickLane icon={<ShoppingCart className="h-4 w-4" />} title="Purchase orders"
            count={pos.filter(p => !['received', 'closed', 'cancelled'].includes(p.status)).length}
            hint="open" onClick={() => onNavigate('purchase-orders')} show={canAccess('purchasing')} />
          <QuickLane icon={<AlertTriangle className="h-4 w-4" />} title="Goods receipts"
            count={pos.filter(p => ['issued', 'partially_received'].includes(p.status)).length}
            hint="awaiting delivery" onClick={() => onNavigate('goods-receipts')} show={canAccess('goods_receipts')} />
        </div>
      </AsyncState>
    </div>
  );
}

function QuickLane({ icon, title, count, hint, onClick, show }: {
  icon: React.ReactNode; title: string; count: number; hint: string; onClick: () => void; show: boolean;
}) {
  if (!show) return null;
  return (
    <button onClick={onClick}
      className="surface-panel flex items-center justify-between p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(16,32,26,0.08)]">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-indigo-50 text-indigo-700">{icon}</span>
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{count} {hint}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-300" />
    </button>
  );
}
