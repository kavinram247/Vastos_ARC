// ─────────────────────────────────────────────────────────────
// Purchase Management — pure helpers (numbering, totals, UOM mapping,
// overview metrics) plus the activity-log / notification wiring that keeps
// the module connected to the rest of the workspace.
// ─────────────────────────────────────────────────────────────
import { store } from '../data/store';
import type { AuditAction } from '../types';
import type {
  LineItem, Uom, PurchaseOrder, MaterialRequest, Rfq, ProjectStock, WorkOrder,
} from './types';
import { UOMS } from './types';

export const todayStr = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

// ── document numbering (MR-2026-001, RFQ-2026-004, PO-2026-012, WO-2026-002) ──
export function formatDocNumber(prefix: string, seq: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;
}

// ── UOM: map a free-text unit onto the DB `uom` enum for PO line items ──
const UOM_ALIASES: Record<string, Uom> = {
  no: 'nos', number: 'nos', mtr: 'rmt', meter: 'rmt', metre: 'rmt', m: 'rmt',
  ltr: 'litre', l: 'litre', length: 'rmt', roll: 'nos',
};
export function uomToEnum(value?: string | null): Uom {
  const v = (value || '').trim().toLowerCase();
  if ((UOMS as readonly string[]).includes(v)) return v as Uom;
  return UOM_ALIASES[v] || 'nos';
}

// ── line-item + PO totals ──
export const lineAmount = (l: Pick<LineItem, 'quantity' | 'rate'>) =>
  Math.round((l.quantity || 0) * (l.rate || 0) * 100) / 100;

export interface PoTotals { subtotal: number; gst: number; freight: number; total: number }
export function computePoTotals(
  lines: { quantity: number; rate: number }[], gstRatePct: number, gstType: 'inclusive' | 'exclusive', freight: number,
): PoTotals {
  const round = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round(lines.reduce((a, l) => a + (l.quantity || 0) * (l.rate || 0), 0));
  const f = freight || 0;
  const rate = (gstRatePct || 0) / 100;
  if (gstType === 'inclusive') {
    // subtotal already contains GST → back it out for display
    const gst = round((subtotal * rate) / (1 + rate));
    return { subtotal, gst, freight: f, total: round(subtotal + f) };
  }
  const gst = round(subtotal * rate);
  return { subtotal, gst, freight: f, total: round(subtotal + gst + f) };
}

export function paymentStatusFor(total: number, paid: number): PurchaseOrder['payment_status'] {
  if (paid <= 0) return 'outstanding';
  if (paid + 0.01 >= total) return 'paid';
  return 'partial';
}

export const blankLine = (over: Partial<LineItem> = {}): LineItem => ({
  key: Math.random().toString(36).slice(2),
  material_id: null, material_name: '', description: '',
  quantity: 1, uom: 'nos', rate: 0, ...over,
});

// ── overview metrics (the module's at-a-glance dashboard) ──
export interface OverviewMetrics {
  openRequests: number;
  rfqAwaiting: number;      // sent, quotes not yet closed
  poPendingApproval: number;
  poOutstanding: number;    // count with unpaid balance
  outstandingValue: number; // ₹ still owed to vendors
  lowStock: number;         // stock rows at/below reorder level
  committedThisFy: number;  // ₹ of approved/issued POs this financial year
}
export function overviewMetrics(
  requests: MaterialRequest[], rfqs: Rfq[], pos: PurchaseOrder[], stock: ProjectStock[],
): OverviewMetrics {
  const paidOf = (po: PurchaseOrder) => po.payments.reduce((a, p) => a + p.amount, 0);
  return {
    openRequests: requests.filter(r => r.status === 'open').length,
    rfqAwaiting: rfqs.filter(r => r.status === 'sent' || r.status === 'quotes_received').length,
    poPendingApproval: pos.filter(p => p.approval_status === 'pending').length,
    poOutstanding: pos.filter(p => p.payment_status !== 'paid' && p.status !== 'cancelled').length,
    outstandingValue: pos
      .filter(p => p.status !== 'cancelled')
      .reduce((a, p) => a + Math.max(0, p.total_amount - paidOf(p)), 0),
    lowStock: stock.filter(s => s.reorder_level > 0 && s.current_stock <= s.reorder_level).length,
    committedThisFy: pos
      .filter(p => p.approval_status === 'approved' && p.status !== 'cancelled')
      .reduce((a, p) => a + p.total_amount, 0),
  };
}

// ── workspace wiring: activity timeline + admin notifications ──
/** Append a Purchase event to the shared activity log (visible in Activity Log module). */
export function logPurchaseActivity(args: {
  firmId: string; actorId: string; action: AuditAction; label: string;
  entityId?: string; entityName?: string; details?: string;
}) {
  store.addActivityLog({
    firm_id: args.firmId,
    user_id: args.actorId,
    action: args.action,
    action_label: args.label,
    module: 'purchase',
    entity_type: 'purchase',
    entity_id: args.entityId || '',
    entity_name: args.entityName,
    details: args.details,
  });
}

/** Notify every admin user (e.g. a PO needs approval). Actor is excluded. */
export function notifyAdmins(args: {
  firmId: string; actorId: string; title: string; message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
}) {
  for (const uid of store.adminUserIds(args.firmId)) {
    if (uid === args.actorId) continue;
    store.addNotification({
      firm_id: args.firmId, user_id: uid, title: args.title, message: args.message,
      type: args.type || 'info', read: false, link: 'purchase',
    });
  }
}

// ── small display helpers ──
export const projectName = (projectId?: string | null) =>
  (projectId && store.projects.find(p => p.id === projectId)?.name) || null;

export const profileName = (userId?: string | null) =>
  (userId && store.profiles.find(p => p.id === userId)?.full_name) || null;

export function isLowStock(s: ProjectStock): boolean {
  return s.reorder_level > 0 && s.current_stock <= s.reorder_level;
}

export function workOrderTouched(_wo: WorkOrder): void { /* reserved for future WO events */ }

export { nowISO };
