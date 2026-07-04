// Purchase Orders tab — the unified PO ledger (manual + BOQ-generated + from RFQ).
import { useMemo, useState } from 'react';
import { ShoppingCart, Package } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatINR, formatDate } from '../utils/format';
import { usePurchase } from './PurchaseManagementPage';
import { Toolbar, TableCard, Th, Td, RowActions, StatusChip, EmptyState, exportCsv } from './shared';
import { PO_STATUS, PO_PAYMENT_STATUS, PO_APPROVAL_STATUS } from './types';
import { projectName } from './logic';
import type { PurchaseOrder } from './types';
import { deletePurchaseOrder } from './poApi';
import { PurchaseOrderForm } from './PurchaseOrderForm';

export function PurchaseOrdersTab() {
  const { pos, vendors, can, reload } = usePurchase();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const vendorName = (id: string | null) => (id && vendors.find(v => v.id === id)?.company_name) || '—';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pos.filter(p => {
      if (statusFilter === 'pending' && p.approval_status !== 'pending') return false;
      if (statusFilter === 'unpaid' && p.payment_status === 'paid') return false;
      if (statusFilter === 'open' && (p.status === 'received' || p.status === 'closed' || p.status === 'cancelled')) return false;
      return !q || `${p.po_number} ${vendorName(p.vendor_id)} ${projectName(p.project_id) ?? ''}`.toLowerCase().includes(q);
    });
  }, [pos, query, statusFilter, vendors]);

  const onDelete = async (p: PurchaseOrder) => {
    if (!confirm(`Delete purchase order ${p.po_number}? Line items and payments will be removed.`)) return;
    try { await deletePurchaseOrder(p.id); await reload(); } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const originChip = (p: PurchaseOrder) =>
    p.boq_id ? <Badge variant="info" size="sm">BOQ</Badge>
      : p.rfq_id ? <Badge variant="info" size="sm">RFQ</Badge>
      : p.material_request_id ? <Badge variant="info" size="sm">Request</Badge> : null;

  const doExport = () => exportCsv('purchase-orders', [
    { key: 'po_number', label: 'PO No.' }, { key: 'date', label: 'PO Date' }, { key: 'project', label: 'Project' },
    { key: 'vendor', label: 'Vendor' }, { key: 'total_amount', label: 'Amount' }, { key: 'approval_status', label: 'Approval' },
    { key: 'status', label: 'Status' }, { key: 'payment_status', label: 'Payment' },
  ], rows.map(p => ({ ...p, date: formatDate(p.po_date), project: projectName(p.project_id) ?? '', vendor: vendorName(p.vendor_id) })));

  const filters = [
    { id: 'all', label: 'All' }, { id: 'open', label: 'Open' },
    { id: 'pending', label: 'Awaiting approval' }, { id: 'unpaid', label: 'Unpaid' },
  ];

  return (
    <div className="space-y-4">
      <Toolbar query={query} onQuery={setQuery} onExport={can.export ? doExport : undefined}
        onAdd={can.create ? () => setCreating(true) : undefined} addLabel="New PO"
        right={
          <div className="hidden items-center gap-1 sm:flex">
            {filters.map(fl => (
              <button key={fl.id} onClick={() => setStatusFilter(fl.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${statusFilter === fl.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>{fl.label}</button>
            ))}
          </div>
        } />

      {rows.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No purchase orders" hint="Raise a PO here, or convert an RFQ / request. BOQ-generated POs appear here too."
          action={can.create ? <Button size="sm" onClick={() => setCreating(true)}>New PO</Button> : undefined} />
      ) : (
        <TableCard>
          <thead>
            <tr className="border-b border-slate-200">
              <Th>PO</Th><Th>Date</Th><Th>Project</Th><Th>Vendor</Th>
              <Th className="text-right">Amount</Th><Th>Approval</Th><Th>Status</Th><Th>Payment</Th><Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <Td><div className="flex items-center gap-1.5 font-medium text-slate-900">{p.po_number} {originChip(p)}</div></Td>
                <Td className="text-slate-500">{formatDate(p.po_date)}</Td>
                <Td className="text-slate-600">{projectName(p.project_id) || '—'}</Td>
                <Td className="text-slate-600">{vendorName(p.vendor_id)}</Td>
                <Td className="text-right font-medium tabular-nums text-slate-800">{formatINR(p.total_amount)}</Td>
                <Td><StatusChip map={PO_APPROVAL_STATUS} value={p.approval_status} /></Td>
                <Td><StatusChip map={PO_STATUS} value={p.status} /></Td>
                <Td><StatusChip map={PO_PAYMENT_STATUS} value={p.payment_status} /></Td>
                <Td><RowActions onView={() => setEditing(p)} onEdit={can.edit ? () => setEditing(p) : undefined} onDelete={can.delete ? () => onDelete(p) : undefined} /></Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      {(creating || editing) && (
        <PurchaseOrderForm po={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(); }} />
      )}
    </div>
  );
}

// exported for the overview quick-link
export const PoIcon = Package;
