import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Loader2, Plus, Copy, Check, Building2, Crown, ChevronDown, ChevronUp,
  Send, Search, Ban, Trash2, Users, AlertTriangle, X, Edit2,
  ShieldCheck, ShieldOff, History, RefreshCw,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan { id: string; name: string; price_monthly: number; max_users: number | null; }

interface FirmRow {
  id: string; name: string; created_at: string;
  plan_name: string | null;
  plan_status: 'trial' | 'active' | 'suspended' | 'cancelled' | null;
  plan_max_users: number | null;
  seats_purchased: number | null;
  owner_email: string | null;
  user_count: number;
  blacklisted_at: string | null;
  blacklist_reason: string | null;
  deleted_at: string | null;
}

type FirmStatus = 'active' | 'trial' | 'suspended' | 'blacklisted' | 'deleted';
type ModalKind = 'suspend' | 'unsuspend' | 'blacklist' | 'unblacklist' | 'delete';

interface AdminLogRow { id: string; action: string; firm_name: string | null; details: any; created_at: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function effectiveLimit(f: FirmRow): number | null {
  return f.seats_purchased ?? f.plan_max_users;
}

function firmStatus(f: FirmRow): FirmStatus {
  if (f.deleted_at) return 'deleted';
  if (f.blacklisted_at) return 'blacklisted';
  if (f.plan_status === 'suspended') return 'suspended';
  if (f.plan_status === 'trial') return 'trial';
  return 'active';
}

async function adminLog(action: string, firmId: string, firmName: string, details: Record<string, unknown> = {}) {
  await (supabase as any).from('vastos_admin_log').insert({ action, firm_id: firmId, firm_name: firmName, details });
}

// ── UsersBar ──────────────────────────────────────────────────────────────────
function UsersBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Users className="w-3.5 h-3.5" />{used} users · unlimited
      </div>
    );
  }
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const labelColor = pct >= 100 ? 'text-red-600 font-semibold' : pct >= 80 ? 'text-amber-600' : 'text-slate-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-500"><Users className="w-3.5 h-3.5" />{used} / {limit} users</span>
        {pct >= 80 && (
          <span className={labelColor}>{pct >= 100 ? 'Limit reached' : `${Math.round(pct)}% used`}</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<FirmStatus, string> = {
  active:      'bg-emerald-100 text-emerald-700',
  trial:       'bg-amber-100 text-amber-700',
  suspended:   'bg-red-100 text-red-700',
  blacklisted: 'bg-slate-900 text-white',
  deleted:     'bg-slate-200 text-slate-500 line-through',
};

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function VastosAdminPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [firms, setFirms] = useState<FirmRow[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Provision form
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ firmName: '', ownerName: '', ownerEmail: '', planId: '', trialDays: '30' });
  const [saving, setSaving] = useState(false);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Invite per-firm
  const [selectedFirmId, setSelectedFirmId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Search / filter
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // User-limit editing
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  // Modals
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [modalFirm, setModalFirm] = useState<FirmRow | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [modalWorking, setModalWorking] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const [{ data: planRows }, { data: firmRows }, { data: logRows }] = await Promise.all([
      (supabase as any).from('subscription_plans').select('id,name,price_monthly,max_users').eq('is_active', true).order('price_monthly'),
      (supabase as any).from('firms').select('id,name,created_at,blacklisted_at,blacklist_reason,deleted_at').order('created_at', { ascending: false }),
      (supabase as any).from('vastos_admin_log').select('id,action,firm_name,details,created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    setPlans((planRows ?? []) as Plan[]);
    setAdminLogs((logRows ?? []) as AdminLogRow[]);

    const enriched: FirmRow[] = await Promise.all(
      ((firmRows ?? []) as any[]).map(async (f) => {
        const [{ data: sub }, { data: owner }, { count: userCount }] = await Promise.all([
          (supabase as any).from('firm_subscriptions')
            .select('status,seats_purchased,subscription_plans(name,max_users)')
            .eq('firm_id', f.id).maybeSingle(),
          (supabase as any).from('profiles').select('email').eq('firm_id', f.id).eq('role', 'owner').maybeSingle(),
          (supabase as any).from('crm_profiles').select('id', { count: 'exact', head: true }).eq('firm_id', f.id),
        ]);
        return {
          id: f.id, name: f.name, created_at: f.created_at,
          plan_name: sub?.subscription_plans?.name ?? null,
          plan_status: sub?.status ?? null,
          plan_max_users: sub?.subscription_plans?.max_users ?? null,
          seats_purchased: sub?.seats_purchased ?? null,
          owner_email: owner?.email ?? null,
          user_count: userCount ?? 0,
          blacklisted_at: f.blacklisted_at ?? null,
          blacklist_reason: f.blacklist_reason ?? null,
          deleted_at: f.deleted_at ?? null,
        } as FirmRow;
      })
    );
    setFirms(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => firms.filter(f => {
    if (!showDeleted && f.deleted_at) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.name.toLowerCase().includes(q) && !(f.owner_email?.toLowerCase().includes(q))) return false;
    }
    if (planFilter && f.plan_name !== planFilter) return false;
    if (statusFilter && firmStatus(f) !== statusFilter) return false;
    return true;
  }), [firms, search, planFilter, statusFilter, showDeleted]);

  const stats = useMemo(() => ({
    total:       firms.filter(f => !f.deleted_at).length,
    active:      firms.filter(f => firmStatus(f) === 'active').length,
    trial:       firms.filter(f => firmStatus(f) === 'trial').length,
    suspended:   firms.filter(f => firmStatus(f) === 'suspended').length,
    blacklisted: firms.filter(f => firmStatus(f) === 'blacklisted').length,
    deleted:     firms.filter(f => !!f.deleted_at).length,
  }), [firms]);

  const uniquePlans = useMemo(() => [...new Set(firms.map(f => f.plan_name).filter(Boolean))], [firms]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const copyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const openModal = (kind: ModalKind, f: FirmRow) => {
    setModal(kind); setModalFirm(f);
    setBlacklistReason(''); setDeleteConfirm(''); setModalWorking(false);
  };
  const closeModal = () => { setModal(null); setModalFirm(null); setModalWorking(false); };

  // ── Firm actions ─────────────────────────────────────────────────────────────
  const doSuspend = async () => {
    if (!modalFirm) return;
    setModalWorking(true);
    await (supabase as any).from('firm_subscriptions').update({ status: 'suspended' }).eq('firm_id', modalFirm.id);
    await adminLog('suspend', modalFirm.id, modalFirm.name);
    closeModal(); await load();
  };

  const doUnsuspend = async () => {
    if (!modalFirm) return;
    setModalWorking(true);
    const restore = modalFirm.plan_status === 'trial' ? 'trial' : 'active';
    await (supabase as any).from('firm_subscriptions').update({ status: restore }).eq('firm_id', modalFirm.id);
    await adminLog('unsuspend', modalFirm.id, modalFirm.name, { restored_to: restore });
    closeModal(); await load();
  };

  const doBlacklist = async () => {
    if (!modalFirm || !blacklistReason.trim()) return;
    setModalWorking(true);
    await (supabase as any).from('firms')
      .update({ blacklisted_at: new Date().toISOString(), blacklist_reason: blacklistReason.trim() })
      .eq('id', modalFirm.id);
    await (supabase as any).from('firm_subscriptions').update({ status: 'suspended' }).eq('firm_id', modalFirm.id);
    await adminLog('blacklist', modalFirm.id, modalFirm.name, { reason: blacklistReason.trim() });
    closeModal(); await load();
  };

  const doUnblacklist = async () => {
    if (!modalFirm) return;
    setModalWorking(true);
    await (supabase as any).from('firms')
      .update({ blacklisted_at: null, blacklist_reason: null })
      .eq('id', modalFirm.id);
    await (supabase as any).from('firm_subscriptions').update({ status: 'active' }).eq('firm_id', modalFirm.id);
    await adminLog('unblacklist', modalFirm.id, modalFirm.name);
    closeModal(); await load();
  };

  const doDelete = async () => {
    if (!modalFirm || deleteConfirm !== modalFirm.name) return;
    setModalWorking(true);
    await (supabase as any).from('firms')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', modalFirm.id);
    await (supabase as any).from('firm_subscriptions').update({ status: 'cancelled' }).eq('firm_id', modalFirm.id);
    await adminLog('delete', modalFirm.id, modalFirm.name);
    closeModal(); await load();
  };

  const doSaveLimit = async (f: FirmRow) => {
    setSavingLimit(true);
    const seats = limitDraft.trim() === '' ? null : Math.max(1, parseInt(limitDraft));
    await (supabase as any).from('firm_subscriptions').update({ seats_purchased: seats }).eq('firm_id', f.id);
    await adminLog('set_user_limit', f.id, f.name, { seats: seats ?? 'unlimited' });
    setEditingLimitId(null);
    setSavingLimit(false);
    await load();
  };

  // ── Provision ────────────────────────────────────────────────────────────────
  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firmName.trim() || !form.ownerEmail.trim() || !form.planId) {
      setFormError('Firm name, owner email and plan are required.'); return;
    }
    setFormError(''); setSaving(true);
    try {
      const { data: firmData, error: fe } = await (supabase as any)
        .from('firms').insert({ name: form.firmName.trim(), address: '' }).select('id').single();
      if (fe) throw fe;
      const firmId = firmData.id;

      const { error: pe } = await (supabase as any).from('profiles').insert({
        firm_id: firmId, email: form.ownerEmail.trim().toLowerCase(),
        full_name: form.ownerName.trim() || form.ownerEmail.split('@')[0], role: 'owner',
      });
      if (pe) throw pe;

      const crmProfileId = crypto.randomUUID();
      const { error: cpe } = await (supabase as any).from('crm_profiles').insert({
        id: crmProfileId, firm_id: firmId, email: form.ownerEmail.trim().toLowerCase(),
        full_name: form.ownerName.trim() || form.ownerEmail.split('@')[0], role: 'owner',
      });
      if (cpe) throw cpe;

      const trialEndsAt = form.trialDays
        ? new Date(Date.now() + parseInt(form.trialDays) * 86_400_000).toISOString()
        : null;
      const { error: se } = await (supabase as any).from('firm_subscriptions').insert({
        firm_id: firmId, plan_id: form.planId,
        status: parseInt(form.trialDays) > 0 ? 'trial' : 'active',
        trial_ends_at: trialEndsAt,
      });
      if (se) throw se;

      const defaultRoles = [
        { id: crypto.randomUUID(), firm_id: firmId, key: 'admin',     name: 'Admin',     is_admin: true,  enabled: true, color: '#6366f1' },
        { id: crypto.randomUUID(), firm_id: firmId, key: 'architect', name: 'Architect', is_admin: false, enabled: true, color: '#0ea5e9' },
        { id: crypto.randomUUID(), firm_id: firmId, key: 'engineer',  name: 'Engineer',  is_admin: false, enabled: true, color: '#f59e0b' },
        { id: crypto.randomUUID(), firm_id: firmId, key: 'client',    name: 'Client',    is_admin: false, enabled: true, color: '#10b981' },
      ];
      const { data: roleRows, error: re } = await (supabase as any).from('crm_roles').insert(defaultRoles).select('id,name');
      if (re) throw re;
      const adminRole = (roleRows as any[])?.find((r: any) => r.name === 'Admin');
      if (adminRole) {
        await (supabase as any).from('crm_profiles').update({ role_id: adminRole.id }).eq('id', crmProfileId);
      }

      const { data: inviteData } = await (supabase as any).from('user_invites')
        .insert({ firm_id: firmId, email: form.ownerEmail.trim().toLowerCase(), full_name: form.ownerName.trim() || null })
        .select('token').single();
      await adminLog('provision', firmId, form.firmName.trim(), { owner_email: form.ownerEmail.trim() });

      setNewInviteLink(`${window.location.origin}?invite=${inviteData.token}`);
      setForm({ firmName: '', ownerName: '', ownerEmail: '', planId: '', trialDays: '30' });
      await load();
    } catch (err: any) {
      setFormError(err.message ?? 'Provisioning failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async (firmId: string) => {
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    const { data } = await (supabase as any).from('user_invites')
      .insert({ firm_id: firmId, email: inviteEmail.trim().toLowerCase(), full_name: inviteName.trim() || null })
      .select('token').single();
    setInviteLink(`${window.location.origin}?invite=${data.token}`);
    setInviteEmail(''); setInviteName('');
    setSendingInvite(false);
  };

  // ── Action label helpers ──────────────────────────────────────────────────────
  const ACTION_LABEL: Record<string, string> = {
    provision: 'Provisioned', suspend: 'Suspended', unsuspend: 'Unsuspended',
    blacklist: 'Blacklisted', unblacklist: 'Unblacklisted', delete: 'Deleted',
    set_user_limit: 'User limit changed',
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center gap-3 shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-600 text-xs font-bold text-white">VA</div>
        <div>
          <h1 className="text-base font-bold text-slate-900">VASTOS Admin</h1>
          <p className="text-xs text-slate-400">Internal firm management — not visible to clients</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 border border-red-200">Internal only</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* Stats strip */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Total firms', value: stats.total, color: 'text-slate-900' },
            { label: 'Active', value: stats.active, color: 'text-emerald-600' },
            { label: 'Trial', value: stats.trial, color: 'text-amber-600' },
            { label: 'Suspended', value: stats.suspended, color: 'text-red-600' },
            { label: 'Blacklisted', value: stats.blacklisted, color: 'text-slate-700' },
            { label: 'Deleted', value: stats.deleted, color: 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{s.label}</div>
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Provision new firm */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => { setShowNew(!showNew); setNewInviteLink(null); setFormError(''); }}
            className="flex w-full items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-slate-900">Provision new firm</span>
            </div>
            {showNew ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showNew && (
            <div className="border-t border-slate-100 px-5 py-5">
              {newInviteLink ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                    <Check className="w-4 h-4" /> Firm provisioned successfully
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-medium">Owner invite link — share with the client:</p>
                    <div className="flex items-center gap-2">
                      <input readOnly value={newInviteLink}
                        className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none" />
                      <button onClick={() => copyLink(newInviteLink, 'new')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">
                        {copiedToken === 'new' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedToken === 'new' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-amber-600">⚠ Link expires in 7 days.</p>
                  </div>
                  <button onClick={() => { setNewInviteLink(null); setShowNew(false); }} className="text-xs text-slate-500 hover:text-slate-700">Done</button>
                </div>
              ) : (
                <form onSubmit={handleProvision} className="space-y-4">
                  {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div>}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Firm name *', key: 'firmName', placeholder: 'Studio Horizon Architects', type: 'text' },
                      { label: 'Owner name', key: 'ownerName', placeholder: 'Rajiv Sharma', type: 'text' },
                      { label: 'Owner email *', key: 'ownerEmail', placeholder: 'owner@firm.com', type: 'email' },
                    ].map(({ label, key, placeholder, type }) => (
                      <div key={key}>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
                        <input type={type} value={(form as any)[key]}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Plan *</label>
                      <select value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">— select plan —</option>
                        {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.price_monthly}/mo</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Trial period (days)</label>
                      <input type="number" min="0" max="90" value={form.trialDays}
                        onChange={e => setForm({ ...form, trialDays: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <p className="mt-1 text-[10px] text-slate-400">0 = immediate active</p>
                    </div>
                  </div>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Provision firm &amp; generate invite
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search firm name or owner email…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All plans</option>
            {uniquePlans.map(p => <option key={p!} value={p!}>{p}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All statuses</option>
            {(['active', 'trial', 'suspended', 'blacklisted', 'deleted'] as FirmStatus[]).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)}
              className="rounded border-slate-300" />
            Show deleted
          </label>
        </div>

        {/* Firm list */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              {filtered.length === firms.length ? `All Firms (${firms.length})` : `${filtered.length} of ${firms.length} firms`}
            </h2>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No firms match your filters.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(f => {
                const status = firmStatus(f);
                const limit = effectiveLimit(f);
                const isOpen = selectedFirmId === f.id;
                const isEditingLimit = editingLimitId === f.id;

                return (
                  <div key={f.id} className={cn(f.deleted_at && 'opacity-60')}>
                    {/* Firm row */}
                    <button
                      onClick={() => setSelectedFirmId(isOpen ? null : f.id)}
                      className="flex w-full items-start gap-4 px-5 py-4 hover:bg-slate-50 text-left"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 text-xs font-bold mt-0.5">
                        {f.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{f.name}</span>
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', STATUS_STYLE[status])}>{status}</span>
                          {f.blacklisted_at && <span className="text-[10px] text-red-600 font-medium">⚠ Blacklisted</span>}
                        </div>
                        <div className="text-xs text-slate-400">
                          {f.owner_email ?? 'No owner'} · Created {new Date(f.created_at).toLocaleDateString('en-IN')}
                        </div>
                        <div className="flex items-center gap-4">
                          {f.plan_name && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Crown className="w-3 h-3" />{f.plan_name}
                            </span>
                          )}
                          <div className="flex-1 max-w-xs">
                            <UsersBar used={f.user_count} limit={limit} />
                          </div>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 mt-1 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 mt-1 shrink-0" />}
                    </button>

                    {/* Expanded panel */}
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 space-y-5">

                        {/* User limit editor */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">User Limit</h4>
                          {isEditingLimit ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number" min="1" value={limitDraft}
                                onChange={e => setLimitDraft(e.target.value)}
                                placeholder="e.g. 25  (leave empty = unlimited)"
                                className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                onClick={() => doSaveLimit(f)}
                                disabled={savingLimit}
                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                              >
                                {savingLimit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Save
                              </button>
                              <button onClick={() => setEditingLimitId(null)} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-700">
                                {limit === null ? 'Unlimited' : `${limit} seats`}
                                {f.seats_purchased !== null && <span className="ml-1.5 text-xs text-indigo-600 font-medium">(custom override)</span>}
                                {f.seats_purchased === null && f.plan_max_users !== null && <span className="ml-1.5 text-xs text-slate-400">(from plan)</span>}
                              </span>
                              <button
                                onClick={() => { setEditingLimitId(f.id); setLimitDraft(limit?.toString() ?? ''); }}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                              >
                                <Edit2 className="w-3 h-3" /> Edit
                              </button>
                              {f.seats_purchased !== null && (
                                <button
                                  onClick={async () => {
                                    await (supabase as any).from('firm_subscriptions').update({ seats_purchased: null }).eq('firm_id', f.id);
                                    await adminLog('set_user_limit', f.id, f.name, { seats: 'reset to plan default' });
                                    await load();
                                  }}
                                  className="text-xs text-slate-400 hover:text-slate-600"
                                >
                                  Reset to plan default
                                </button>
                              )}
                            </div>
                          )}
                          <p className="mt-1.5 text-[11px] text-slate-400">
                            Currently <strong className="text-slate-600">{f.user_count}</strong> users registered.
                            {limit !== null && f.user_count >= limit && (
                              <span className="ml-1 text-red-600 font-medium">Limit reached — client cannot add more users.</span>
                            )}
                          </p>
                        </div>

                        {/* Send invite */}
                        {!f.deleted_at && (
                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Send Invite</h4>
                            <div className="flex gap-2">
                              <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Name (optional)"
                                className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@firm.com" type="email"
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <button onClick={() => handleSendInvite(f.id)} disabled={sendingInvite || !inviteEmail.trim()}
                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                                {sendingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Generate link
                              </button>
                            </div>
                            {inviteLink && selectedFirmId === f.id && (
                              <div className="flex items-center gap-2 mt-2">
                                <input readOnly value={inviteLink}
                                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none" />
                                <button onClick={() => copyLink(inviteLink, f.id)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-800">
                                  {copiedToken === f.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  {copiedToken === f.id ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Firm actions */}
                        {!f.deleted_at && (
                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Actions</h4>
                            <div className="flex flex-wrap gap-2">
                              {/* Suspend / Unsuspend */}
                              {status === 'suspended' && !f.blacklisted_at ? (
                                <button onClick={() => openModal('unsuspend', f)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Unsuspend
                                </button>
                              ) : !f.blacklisted_at && status !== 'blacklisted' ? (
                                <button onClick={() => openModal('suspend', f)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100">
                                  <ShieldOff className="w-3.5 h-3.5" /> Suspend
                                </button>
                              ) : null}

                              {/* Blacklist / Unblacklist */}
                              {f.blacklisted_at ? (
                                <button onClick={() => openModal('unblacklist', f)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Remove Blacklist
                                </button>
                              ) : (
                                <button onClick={() => openModal('blacklist', f)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                                  <Ban className="w-3.5 h-3.5" /> Blacklist
                                </button>
                              )}

                              {/* Delete */}
                              <button onClick={() => openModal('delete', f)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 ml-auto">
                                <Trash2 className="w-3.5 h-3.5" /> Delete firm
                              </button>
                            </div>

                            {f.blacklisted_at && (
                              <p className="mt-2 text-xs text-slate-500">
                                <span className="font-medium text-slate-700">Blacklist reason:</span> {f.blacklist_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin audit log */}
        {adminLogs.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
              <History className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Recent Admin Actions</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {adminLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-700 w-32 shrink-0">
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                    <span className="text-xs text-slate-500">{log.firm_name ?? '—'}</span>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Access via <code className="bg-slate-100 px-1 rounded">?vastos-admin=true</code> · Keep private
        </p>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}

      {modal === 'suspend' && modalFirm && (
        <Modal title="Suspend firm" onClose={closeModal}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                Suspending <strong>{modalFirm.name}</strong> will immediately block all users from logging in. You can unsuspend at any time.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={doSuspend} disabled={modalWorking}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-60">
                {modalWorking && <Loader2 className="w-4 h-4 animate-spin" />} Suspend firm
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'unsuspend' && modalFirm && (
        <Modal title="Unsuspend firm" onClose={closeModal}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Restore access for <strong>{modalFirm.name}</strong>? Their subscription will be set back to <strong>{modalFirm.plan_status === 'trial' ? 'trial' : 'active'}</strong>.</p>
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={doUnsuspend} disabled={modalWorking}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
                {modalWorking && <Loader2 className="w-4 h-4 animate-spin" />} Restore access
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'blacklist' && modalFirm && (
        <Modal title="Blacklist firm" onClose={closeModal}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
              <Ban className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-800">
                Blacklisting <strong>{modalFirm.name}</strong> suspends all access and flags the account. Reason is recorded in the audit log.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Reason <span className="text-red-500">*</span></label>
              <textarea value={blacklistReason} onChange={e => setBlacklistReason(e.target.value)} rows={3}
                placeholder="e.g. Payment fraud, Terms of service violation…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={doBlacklist} disabled={modalWorking || !blacklistReason.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
                {modalWorking && <Loader2 className="w-4 h-4 animate-spin" />} Blacklist firm
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'unblacklist' && modalFirm && (
        <Modal title="Remove blacklist" onClose={closeModal}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Remove the blacklist flag from <strong>{modalFirm.name}</strong> and restore their subscription to active?</p>
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={doUnblacklist} disabled={modalWorking}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                {modalWorking && <Loader2 className="w-4 h-4 animate-spin" />} Remove blacklist
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'delete' && modalFirm && (
        <Modal title="Delete firm" onClose={closeModal}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm text-red-800 space-y-1">
                <p>This marks <strong>{modalFirm.name}</strong> as deleted. All users will immediately lose access and cannot be recovered through the UI.</p>
                <p className="text-xs">Data is soft-deleted and can only be restored via the database.</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Type the firm name to confirm</label>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={modalFirm.name}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={doDelete} disabled={modalWorking || deleteConfirm !== modalFirm.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {modalWorking && <Loader2 className="w-4 h-4 animate-spin" />} Delete firm
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
