// ─────────────────────────────────────────────────────────────
// Purchase Management — module shell. Fetches every purchase dataset once,
// shares them through a small context (so tab counts + the overview stay in
// sync), and renders the active tab. Reuses vendors / materials / POs from the
// existing commercial layer; adds requests / RFQ / stock / work orders.
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ShoppingBag, LayoutDashboard, ClipboardList, FileText, ShoppingCart, Boxes, Hammer, Truck, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { cn } from '../utils/cn';
import { Loading, PurchaseError } from './shared';
import { listVendors, listMaterials } from './masterApi';
import { listRequests, listRfqs, listStock, listWorkOrders } from './docsApi';
import { listPurchaseOrders } from './poApi';
import { isLowStock } from './logic';
import type { PurchaseVendor, PurchaseMaterial, MaterialRequest, Rfq, PurchaseOrder, ProjectStock, WorkOrder } from './types';
import { OverviewTab } from './OverviewTab';
import { RequestsTab } from './RequestsTab';
import { RfqTab } from './RfqTab';
import { PurchaseOrdersTab } from './PurchaseOrdersTab';
import { StockTab } from './StockTab';
import { WorkOrdersTab } from './WorkOrdersTab';
import { VendorsTab } from './VendorsTab';
import { MaterialsTab } from './MaterialsTab';

export type PurchaseTabId = 'overview' | 'requests' | 'rfq' | 'orders' | 'stock' | 'work-orders' | 'vendors' | 'materials';

interface PurchaseContextValue {
  firmId: string; userId: string;
  can: { create: boolean; edit: boolean; delete: boolean; approve: boolean; export: boolean };
  vendors: PurchaseVendor[]; materials: PurchaseMaterial[];
  requests: MaterialRequest[]; rfqs: Rfq[]; pos: PurchaseOrder[]; stock: ProjectStock[]; workOrders: WorkOrder[];
  reload: () => Promise<void>;
  goTab: (t: PurchaseTabId) => void;
}
const PurchaseContext = createContext<PurchaseContextValue | null>(null);
export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error('usePurchase must be used within PurchaseManagementPage');
  return ctx;
}

export function PurchaseManagementPage() {
  const { firm, user } = useAuth();
  const { can } = usePermissions();
  const firmId = firm!.id;
  const userId = user!.id;

  const [tab, setTab] = useState<PurchaseTabId>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    vendors: PurchaseVendor[]; materials: PurchaseMaterial[]; requests: MaterialRequest[];
    rfqs: Rfq[]; pos: PurchaseOrder[]; stock: ProjectStock[]; workOrders: WorkOrder[];
  }>({ vendors: [], materials: [], requests: [], rfqs: [], pos: [], stock: [], workOrders: [] });

  const reload = useCallback(async () => {
    try {
      const [vendors, materials, requests, rfqs, pos, stock, workOrders] = await Promise.all([
        listVendors(firmId), listMaterials(firmId), listRequests(firmId),
        listRfqs(firmId), listPurchaseOrders(firmId), listStock(firmId), listWorkOrders(firmId),
      ]);
      setData({ vendors, materials, requests, rfqs, pos, stock, workOrders });
      setError(null);
    } catch (e: any) {
      console.error('purchase reload failed', e);
      setError(e?.message || 'Failed to load purchase data');
    } finally {
      setLoading(false);
    }
  }, [firmId]);

  useEffect(() => { reload(); }, [reload]);

  const ctx = useMemo<PurchaseContextValue>(() => ({
    firmId, userId,
    can: {
      create: can('purchase', 'create'), edit: can('purchase', 'edit'), delete: can('purchase', 'delete'),
      approve: can('purchase', 'approve'), export: can('purchase', 'export'),
    },
    ...data, reload, goTab: setTab,
  }), [firmId, userId, can, data, reload]);

  const lowStockCount = data.stock.filter(isLowStock).length;
  const groups: { label: string; tabs: { id: PurchaseTabId; label: string; icon: React.ElementType; count?: number; alert?: number }[] }[] = [
    { label: '', tabs: [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }] },
    { label: 'Procure', tabs: [
      { id: 'requests', label: 'Requests', icon: ClipboardList, count: data.requests.filter(r => r.status === 'open').length },
      { id: 'rfq', label: 'RFQ', icon: FileText, count: data.rfqs.length },
      { id: 'orders', label: 'Purchase Orders', icon: ShoppingCart, count: data.pos.length, alert: data.pos.filter(p => p.approval_status === 'pending').length },
    ] },
    { label: 'Inventory', tabs: [
      { id: 'stock', label: 'Stock', icon: Boxes, count: data.stock.length, alert: lowStockCount },
      { id: 'work-orders', label: 'Work Orders', icon: Hammer, count: data.workOrders.length },
    ] },
    { label: 'Masters', tabs: [
      { id: 'vendors', label: 'Vendors', icon: Truck, count: data.vendors.length },
      { id: 'materials', label: 'Materials', icon: Package, count: data.materials.length },
    ] },
  ];

  return (
    <PurchaseContext.Provider value={ctx}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <ShoppingBag className="h-6 w-6 text-indigo-600" /> Purchase Management
            </h1>
            <p className="page-kicker mt-1">
              Requests to receipts — one procurement pipeline wired to your projects, vendors, materials and stock.
            </p>
          </div>
        </div>

        {/* grouped tab strip */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-slate-200">
          {groups.map((g, gi) => (
            <div key={gi} className="flex items-center gap-1">
              {gi > 0 && <span className="mx-2 hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />}
              {g.label && <span className="hidden pr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 lg:block">{g.label}</span>}
              {g.tabs.map(t => {
                const active = tab === t.id;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} aria-current={active ? 'page' : undefined}
                    className={cn('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium',
                      active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                    <t.icon className="h-4 w-4" />
                    {t.label}
                    {t.alert ? <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-amber-100 px-1 text-[10px] font-bold text-amber-700">{t.alert}</span>
                      : t.count ? <span className="ml-0.5 text-xs text-slate-400">{t.count}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {loading ? <Loading />
          : error ? <PurchaseError message={error} />
          : (
            <>
              {tab === 'overview' && <OverviewTab />}
              {tab === 'requests' && <RequestsTab />}
              {tab === 'rfq' && <RfqTab />}
              {tab === 'orders' && <PurchaseOrdersTab />}
              {tab === 'stock' && <StockTab />}
              {tab === 'work-orders' && <WorkOrdersTab />}
              {tab === 'vendors' && <VendorsTab />}
              {tab === 'materials' && <MaterialsTab />}
            </>
          )}
      </div>
    </PurchaseContext.Provider>
  );
}
