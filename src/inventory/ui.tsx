// ─────────────────────────────────────────────────────────────
// Shared Inventory UI primitives — Studio Ledger design language (slate canvas,
// indigo action accent, flat surfaces, dense tables, explicit states).
// ─────────────────────────────────────────────────────────────
import { Loader2, AlertTriangle, Inbox, Lock } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { statusLabel } from '../utils/format';

/** Map any inventory document status to a semantic badge tone. */
export function invStatusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'draft': return 'default';
    case 'submitted': case 'pending_approval': case 'sent': case 'counting':
    case 'partially_ordered': case 'partially_received': case 'in_procurement':
    case 'dispatched': case 'quotes_received': case 'needs_changes': return 'warning';
    case 'approved': case 'posted': case 'received': case 'fulfilled': case 'ordered':
    case 'awarded': case 'closed': return 'success';
    case 'issued': case 'evaluated': return 'info';
    case 'rejected': case 'cancelled': return 'error';
    default: return 'default';
  }
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={invStatusVariant(status)} size="sm">{statusLabel(status)}</Badge>;
}

export function InvHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[70ch] text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Metric({ label, value, hint, tone = 'default' }: {
  label: string; value: React.ReactNode; hint?: string;
  tone?: 'default' | 'danger' | 'warning' | 'success';
}) {
  const toneCls = {
    default: 'text-slate-900', danger: 'text-red-600', warning: 'text-amber-600', success: 'text-emerald-600',
  }[tone];
  return (
    <div className="surface-panel p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.02em] ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: {
  icon?: React.ReactNode; title: string; message?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
      <div className="text-slate-300">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {message && <div className="max-w-sm text-sm text-slate-500">{message}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Wrap async page bodies: renders loading / error / permission / empty consistently. */
export function AsyncState({ loading, error, children }: { loading: boolean; error?: string | null; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-red-100 bg-red-50/60 px-6 py-14 text-center">
        <AlertTriangle className="h-7 w-7 text-red-400" />
        <div className="text-sm font-semibold text-red-700">Something went wrong</div>
        <div className="max-w-md text-sm text-red-600">{error}</div>
      </div>
    );
  }
  return <>{children}</>;
}

export function AccessNotice({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
      <Lock className="h-7 w-7 text-slate-300" />
      <div className="text-sm font-semibold text-slate-700">No access to {label}</div>
      <div className="max-w-sm text-sm text-slate-500">Ask a workspace admin to grant you this permission.</div>
    </div>
  );
}

/** Inline result banner (success / error) for workflow actions. */
export function ActionBanner({ kind, message, onClose }: { kind: 'success' | 'error'; message: string; onClose?: () => void }) {
  const cls = kind === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-red-200 bg-red-50 text-red-800';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-[9px] border px-4 py-2.5 text-sm ${cls}`}>
      <span>{message}</span>
      {onClose && <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">✕</button>}
    </div>
  );
}

/** Format a quantity with its UOM (tabular, trimmed). */
export function fmtQty(qty: number, uom?: string | null): string {
  const n = Number(qty);
  const s = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '');
  return uom ? `${s} ${uom}` : s;
}
