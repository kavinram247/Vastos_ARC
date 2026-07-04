// Purchase Order form — Details / Approval / Payments, with the approval,
// payment-record and receive-into-stock actions wired in.
import { useMemo, useState } from 'react';
import { Loader2, Check, Send, ThumbsUp, ThumbsDown, PackageCheck, Plus, IndianRupee } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { formatINR, formatDate } from '../utils/format';
import { usePurchase } from './PurchaseManagementPage';
import { LineItemsEditor, ProjectSelect, VendorSelect, StaffSelect, StatusChip } from './shared';
import { PO_APPROVAL_STATUS, PO_PAYMENT_STATUS, PO_STATUS } from './types';
import { computePoTotals, blankLine, todayStr } from './logic';
import type { PurchaseOrder, LineItem } from './types';
import { savePurchaseOrder, submitForApproval, decidePoApproval, addPayment, receivePurchaseOrder, type PoInput } from './poApi';

type Tab = 'details' | 'approval' | 'payments';

export function PurchaseOrderForm({ po, onClose, onSaved }: { po: PurchaseOrder | null; onClose: () => void; onSaved: () => void }) {
  const { vendors, materials, can, firmId, userId } = usePurchase();
  const [tab, setTab] = useState<Tab>('details');
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const [projectId, setProjectId] = useState<string | null>(po?.project_id ?? null);
  const [vendorId, setVendorId] = useState<string | null>(po?.vendor_id ?? null);
  const [materialType, setMaterialType] = useState(po?.material_type ?? '');
  const [requiredBy, setRequiredBy] = useState(po?.required_by ?? '');
  const [deliveryDate, setDeliveryDate] = useState(po?.delivery_date ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState(po?.delivery_address ?? '');
  const [creditDays, setCreditDays] = useState<string>(po?.credit_days != null ? String(po.credit_days) : '');
  const [sqRef, setSqRef] = useState(po?.supplier_quotation_ref ?? '');
  const [gstRate, setGstRate] = useState<number>(po?.gst_rate ?? 18);
  const [gstType, setGstType] = useState<'inclusive' | 'exclusive'>(po?.gst_type ?? 'inclusive');
  const [freight, setFreight] = useState<number>(po?.freight_charges ?? 0);
  const [orderContact, setOrderContact] = useState<string | null>(po?.order_contact_id ?? (po ? null : userId));
  const [orderPhone, setOrderPhone] = useState(po?.order_contact_phone ?? '');
  const [deliveryContact, setDeliveryContact] = useState<string | null>(po?.delivery_contact_id ?? null);
  const [deliveryPhone, setDeliveryPhone] = useState(po?.delivery_contact_phone ?? '');
  const [additionalTerms, setAdditionalTerms] = useState(po?.additional_terms ?? '');
  const [notes, setNotes] = useState(po?.notes ?? '');
  const [adminNotes, setAdminNotes] = useState(po?.admin_notes ?? '');
  const [items, setItems] = useState<LineItem[]>(
    po?.items.map(i => ({ key: i.id, material_id: i.material_id, material_name: i.description, description: i.description, quantity: i.quantity, uom: i.uom, rate: i.rate })) ?? [blankLine()]
  );

  const totals = useMemo(() => computePoTotals(items, gstRate, gstType, freight), [items, gstRate, gstType, freight]);
  const paid = (po?.payments ?? []).reduce((a, p) => a + p.amount, 0);

  const buildInput = (submit = false): PoInput => ({
    id: po?.id, project_id: projectId, vendor_id: vendorId, rfq_id: po?.rfq_id ?? null, material_request_id: po?.material_request_id ?? null,
    material_type: materialType, required_by: requiredBy || null, delivery_date: deliveryDate || null, delivery_address: deliveryAddress,
    credit_days: creditDays === '' ? null : parseInt(creditDays), supplier_quotation_ref: sqRef,
    gst_rate: gstRate, gst_type: gstType, freight_charges: freight,
    order_contact_id: orderContact, order_contact_phone: orderPhone, delivery_contact_id: deliveryContact, delivery_contact_phone: deliveryPhone,
    additional_terms: additionalTerms, notes, items, submitForApproval: submit,
  });

  const doSave = async (submit = false) => {
    setSaving(true);
    try { await savePurchaseOrder(buildInput(submit), firmId, userId); onSaved(); }
    catch (e: any) { alert('Save failed: ' + e.message); } finally { setSaving(false); }
  };

  const runAction = async (fn: () => Promise<void>) => {
    setActing(true);
    try { await fn(); onSaved(); } catch (e: any) { alert('Action failed: ' + e.message); } finally { setActing(false); }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' }, { id: 'approval', label: 'Approval' },
    ...(po ? [{ id: 'payments' as Tab, label: 'Payments' }] : []),
  ];

  return (
    <Modal open onClose={onClose} title={po ? `${po.po_number}` : 'New purchase order'} size="xl">
      <div className="space-y-4">
        {po && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip map={PO_STATUS} value={po.status} />
            <StatusChip map={PO_APPROVAL_STATUS} value={po.approval_status} />
            <StatusChip map={PO_PAYMENT_STATUS} value={po.payment_status} />
            <span className="ml-auto text-xs text-slate-400">Raised {formatDate(po.po_date)}</span>
          </div>
        )}

        <div className="flex gap-1 border-b border-slate-200">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t.label}</button>
          ))}
        </div>

        {tab === 'details' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ProjectSelect value={projectId} onChange={setProjectId} />
              <VendorSelect value={vendorId} onChange={setVendorId} vendors={vendors} />
              <Input label="Material type" value={materialType} onChange={e => setMaterialType(e.target.value)} />
              <Input label="Required by" type="date" value={requiredBy} onChange={e => setRequiredBy(e.target.value)} />
              <Input label="Delivery date" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              <Input label="Credit days" type="number" value={creditDays} onChange={e => setCreditDays(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Supplier quotation ref" value={sqRef} onChange={e => setSqRef(e.target.value)} />
              <Input label="Delivery address" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Items</label>
              <LineItemsEditor items={items} onChange={setItems} materials={materials} mode="po" />
            </div>

            {/* totals */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Input label="GST %" type="number" value={gstRate} onChange={e => setGstRate(parseFloat(e.target.value) || 0)} />
                  <Select label="GST type" value={gstType} onChange={e => setGstType(e.target.value as any)} options={[{ value: 'inclusive', label: 'Inclusive' }, { value: 'exclusive', label: 'Exclusive' }]} />
                  <Input label="Freight ₹" type="number" value={freight} onChange={e => setFreight(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="surface-panel space-y-1 self-end p-4 text-sm">
                <Row label="Subtotal" value={formatINR(totals.subtotal)} />
                <Row label={`GST (${gstType})`} value={formatINR(totals.gst)} />
                <Row label="Freight" value={formatINR(totals.freight)} />
                <div className="my-1 h-px bg-slate-200" />
                <Row label="Total" value={formatINR(totals.total)} strong />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-500">Order contact (purchase)</p>
                <StaffSelect label="Contact" value={orderContact} onChange={setOrderContact} />
                <Input label="Phone" value={orderPhone} onChange={e => setOrderPhone(e.target.value)} />
              </div>
              <div className="space-y-3 rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-500">Delivery contact (site)</p>
                <StaffSelect label="Contact" value={deliveryContact} onChange={setDeliveryContact} />
                <Input label="Phone" value={deliveryPhone} onChange={e => setDeliveryPhone(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Textarea label="Additional terms" rows={2} value={additionalTerms} onChange={e => setAdditionalTerms(e.target.value)} />
              <Textarea label="Notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        {tab === 'approval' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Approval status</span>
              <StatusChip map={PO_APPROVAL_STATUS} value={po?.approval_status ?? 'draft'} />
            </div>
            <Textarea label="Admin notes / comments" rows={4} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
              disabled={!can.approve} placeholder={can.approve ? 'Approval notes…' : 'Only approvers can add notes'} />
            {po && can.approve && po.approval_status === 'pending' && (
              <div className="flex gap-2">
                <Button variant="success" onClick={() => runAction(() => decidePoApproval(po, 'approved', adminNotes, firmId, userId))} disabled={acting}>
                  <ThumbsUp className="h-4 w-4" /> Approve
                </Button>
                <Button variant="danger" onClick={() => runAction(() => decidePoApproval(po, 'rejected', adminNotes, firmId, userId))} disabled={acting}>
                  <ThumbsDown className="h-4 w-4" /> Reject
                </Button>
              </div>
            )}
            {po && po.approval_status !== 'pending' && po.approval_status !== 'approved' && (
              <Button variant="secondary" onClick={() => runAction(() => submitForApproval(po, firmId, userId))} disabled={acting}>
                <Send className="h-4 w-4" /> Submit for approval
              </Button>
            )}
          </div>
        )}

        {tab === 'payments' && po && (
          <PaymentsPanel po={po} firmId={firmId} userId={userId} paid={paid} onDone={onSaved} />
        )}

        {/* footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex gap-2">
            {po && po.approval_status === 'approved' && po.status !== 'received' && po.status !== 'cancelled' && (
              <Button variant="secondary" onClick={() => runAction(() => receivePurchaseOrder(po, firmId, userId))} disabled={acting}>
                <PackageCheck className="h-4 w-4" /> Mark received
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {!po && can.create && (
              <Button variant="secondary" onClick={() => doSave(true)} disabled={saving}>
                <Send className="h-4 w-4" /> Save & submit
              </Button>
            )}
            {(can.edit || (!po && can.create)) && (
              <Button onClick={() => doSave(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {po ? 'Save changes' : 'Save draft'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-semibold text-slate-800' : 'text-slate-500'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-base font-bold text-slate-900' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}

function PaymentsPanel({ po, firmId, userId, paid, onDone }: {
  po: PurchaseOrder; firmId: string; userId: string; paid: number; onDone: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('bank_transfer');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const outstanding = Math.max(0, po.total_amount - paid);

  const add = async () => {
    const amt = parseFloat(amount);
    if (!(amt > 0)) return;
    setBusy(true);
    try {
      await addPayment(po, { payment_date: date, amount: amt, payment_mode: mode, reference_no: ref || null }, firmId, userId);
      onDone();
    } catch (e: any) { alert('Failed: ' + e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="surface-panel p-3"><div className="text-xs text-slate-500">Total</div><div className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{formatINR(po.total_amount)}</div></div>
        <div className="surface-panel p-3"><div className="text-xs text-slate-500">Paid</div><div className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600">{formatINR(paid)}</div></div>
        <div className="surface-panel p-3"><div className="text-xs text-slate-500">Outstanding</div><div className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{formatINR(outstanding)}</div></div>
      </div>

      {po.payments.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-xs text-slate-500"><th className="px-3 py-2 text-left font-medium">Date</th><th className="px-3 py-2 text-left font-medium">Mode</th><th className="px-3 py-2 text-left font-medium">Reference</th><th className="px-3 py-2 text-right font-medium">Amount</th></tr></thead>
            <tbody>
              {po.payments.map(p => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-1.5 text-slate-600">{formatDate(p.payment_date)}</td>
                  <td className="px-3 py-1.5 capitalize text-slate-600">{(p.payment_mode || '').replace(/_/g, ' ') || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500">{p.reference_no || '—'}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatINR(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-slate-100 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><IndianRupee className="h-3.5 w-3.5" /> Record a payment</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Amount ₹" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          <Select label="Mode" value={mode} onChange={e => setMode(e.target.value)}
            options={[{ value: 'bank_transfer', label: 'Bank transfer' }, { value: 'upi', label: 'UPI' }, { value: 'cheque', label: 'Cheque' }, { value: 'cash', label: 'Cash' }]} />
          <Input label="Reference" value={ref} onChange={e => setRef(e.target.value)} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={add} disabled={busy || !(parseFloat(amount) > 0)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add payment
          </Button>
        </div>
      </div>
    </div>
  );
}
