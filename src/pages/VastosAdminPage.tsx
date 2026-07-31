// ─────────────────────────────────────────────────────────────
// Platform operator console — Vasto's own staff managing customer firms.
//
// Every read and write here goes through a `vastos_*` SECURITY DEFINER RPC
// (20260731030000_platform_c_operator_console.sql). This file previously made
// 25 direct PostgREST table calls and every write among them was already dead
// under RLS — user_invites deny-all (C3), vastos_admin_log deny-all (C2b),
// crm_roles no write policy (C6b), firm_subscriptions SELECT-only, and the
// firms INSERT structurally impossible (`with check (id = current_firm_id())`
// can never match a firm that does not exist yet).
//
// NEVER route this page through crmApi. hydrateAll() calls setActiveFirm(), a
// module-level singleton that scopes writes to ONE firm; a cross-tenant console
// driving it would silently retarget the logged-in operator's own session.
//
// The gate is App.tsx's `isVastosOperator` override, not RBAC — canAccess()
// fails open for any firm admin whose firm has no subscription row. The server
// gate is the real one; this page simply is not reachable without it.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Loader2, Plus, Copy, Check, Building2, Crown, ChevronDown, ChevronUp,
  Send, Search, Ban, Trash2, Users, AlertTriangle, X, Edit2,
  ShieldCheck, ShieldOff, History, RefreshCw, UserPlus, Clock,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan { id: string; name: string; price_monthly: number; max_users: number | null; }

/** Exactly the shape vastos_list_firms returns. */
interface FirmRow {
  id: string; name: string; created_at: string;
  plan_id: string | null;
  plan_name: string | null;
  plan_status: 'trial' | 'active' | 'suspended' | 'cancelled' | null;
  plan_max_users: number | null;
  seats_purchased: number | null;
  owner_email: string | null;
  owner_activated: boolean | null;
  user_count: number;
  pending_invite_count: number;
  blacklisted_at: string | null;
  blacklist_reason: string | null;
  deleted_at: string | null;
}

interface FirmRole { id: string; key: string; name: string; is_admin: boolean; enabled: boolean; }

type FirmStatus = 'active' | 'trial' | 'suspended' | 'blacklisted' | 'deleted';
type ModalKind = 'suspend' | 'unsuspend' | 'blacklist' | 'unblacklist' | 'delete';

interface AdminLogRow {
  id: string; action: string; firm_id: string | null; firm_name: string | null;
  details: Record<string, unknown> | null; actor_email: string | null; created_at: string;
}

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

/**
 * Every RPC error surfaces its real message. A 403 is not automatically "the
 * gate working" — it could equally be a signature mismatch (PostgREST binds
 * arguments by NAME) or a revoked operator, and those need different fixes.
 */
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(error.message || `${fn} failed`);
  return data as T;
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
  const [loadError, setLoadError] = useState('');

  // Provision form
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ firmName: '', ownerName: '', ownerEmail: '', planId: '', trialDays: '30' });
  const [saving, setSaving] = useState(false);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Invite per-firm
  const [selectedFirmId, setSelectedFirmId] = useState<string | null>(null);
  const [firmRoles, setFirmRoles] = useState<FirmRole[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState('');
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
  const [modalError, setModalError] = useState('');

  // ── Load ────────────────────────────────────────────────────────────────────
  // Three calls total. The old version issued 1 + 3N — one query per firm for
  // its subscription, its owner and its user count.
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [planRows, firmRows, logRows] = await Promise.all([
        (async () => {
          const { data, error } = await (supabase as any)
            .from('subscription_plans')
            .select('id,name,price_monthly,max_users')
            .eq('is_active', true)
            .order('price_monthly');
          if (error) throw new Error(error.message);
          return (data ?? []) as Plan[];
        })(),
        rpc<FirmRow[]>('vastos_list_firms', { p_include_deleted: showDeleted }),
        rpc<AdminLogRow[]>('vastos_list_admin_log', { p_limit: 20 }),
      ]);
      setPlans(planRows);
      setFirms(firmRows ?? []);
      setAdminLogs(logRows ?? []);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not load the operator console.');
      setFirms([]);
      setAdminLogs([]);
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => { load(); }, [load]);

  // The role picker for the per-firm invite. crm_roles is RLS-scoped to
  // current_firm_id(), so this has to come from an operator RPC.
  useEffect(() => {
    if (!selectedFirmId) { setFirmRoles([]); setInviteRoleId(''); return; }
    let cancelled = false;
    rpc<FirmRole[]>('vastos_list_firm_roles', { p_firm_id: selectedFirmId })
      .then(rows => { if (!cancelled) setFirmRoles((rows ?? []).filter(r => r.enabled)); })
      .catch(() => { if (!cancelled) setFirmRoles([]); });
    return () => { cancelled = true; };
  }, [selectedFirmId]);

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
    setBlacklistReason(''); setDeleteConfirm(''); setModalWorking(false); setModalError('');
  };
  const closeModal = () => { setModal(null); setModalFirm(null); setModalWorking(false); setModalError(''); };

  /** Every modal action funnels through here so failures are shown, not swallowed. */
  const runModalAction = async (work: () => Promise<void>) => {
    setModalWorking(true);
    setModalError('');
    try {
      await work();
      closeModal();
      await load();
    } catch (e: any) {
      setModalError(e?.message ?? 'That action failed.');
      setModalWorking(false);
    }
  };

  // ── Firm actions ─────────────────────────────────────────────────────────────
  const doSuspend = () => modalFirm && runModalAction(() =>
    rpc('vastos_suspend_firm', { p_firm_id: modalFirm.id }));

  const doUnsuspend = () => modalFirm && runModalAction(() =>
    rpc('vastos_unsuspend_firm', { p_firm_id: modalFirm.id }));

  const doBlacklist = () => modalFirm && runModalAction(() =>
    rpc('vastos_blacklist_firm', { p_firm_id: modalFirm.id, p_reason: blacklistReason.trim() }));

  const doUnblacklist = () => modalFirm && runModalAction(() =>
    rpc('vastos_unblacklist_firm', { p_firm_id: modalFirm.id }));

  // The confirmation name is re-checked server-side against firms.name. The
  // input below is a convenience, not the control.
  const doDelete = () => modalFirm && runModalAction(() =>
    rpc('vastos_delete_firm', { p_firm_id: modalFirm.id, p_confirm_name: deleteConfirm }));

  const doSaveLimit = async (f: FirmRow) => {
    setSavingLimit(true);
    try {
      const seats = limitDraft.trim() === '' ? null : Math.max(1, parseInt(limitDraft, 10));
      await rpc('vastos_set_firm_seats', { p_firm_id: f.id, p_seats: seats });
      setEditingLimitId(null);
      await load();
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not update the seat limit.');
    } finally {
      setSavingLimit(false);
    }
  };

  const doResetLimit = async (f: FirmRow) => {
    try {
      await rpc('vastos_set_firm_seats', { p_firm_id: f.id, p_seats: null });
      await load();
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not reset the seat limit.');
    }
  };

  // ── Provision ────────────────────────────────────────────────────────────────
  // One call. It creates firm + subscription + 4 roles + defaults + the owner
  // invite, and deliberately creates NO identity — invite_finalize does that
  // when the owner redeems, which is the only hardened path that exists.
  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firmName.trim() || !form.ownerEmail.trim() || !form.planId) {
      setFormError('Firm name, owner email and plan are required.'); return;
    }
    setFormError(''); setSaving(true);
    try {
      const res = await rpc<{ token: string }>('vastos_provision_firm', {
        p_firm_name:   form.firmName.trim(),
        p_owner_email: form.ownerEmail.trim().toLowerCase(),
        p_owner_name:  form.ownerName.trim() || null,
        p_plan_id:     form.planId,
        p_trial_days:  parseInt(form.trialDays || '0', 10) || 0,
      });
      setNewInviteLink(`${window.location.origin}?invite=${res.token}`);
      setForm({ firmName: '', ownerName: '', ownerEmail: '', planId: '', trialDays: '30' });
      await load();
    } catch (err: any) {
      setFormError(err?.message ?? 'Provisioning failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async (firmId: string) => {
    if (!inviteEmail.trim()) return;
    setSendingInvite(true); setInviteError(''); setInviteLink(null);
    try {
      const res = await rpc<{ token: string }>('vastos_invite_firm_user', {
        p_firm_id:   firmId,
        p_email:     inviteEmail.trim().toLowerCase(),
        p_full_name: inviteName.trim() || null,
        p_role_id:   inviteRoleId || null,
      });
      setInviteLink(`${window.location.origin}?invite=${res.token}`);
      setInviteEmail(''); setInviteName('');
      await load();
    } catch (e: any) {
      setInviteError(e?.message ?? 'Could not create the invite.');
    } finally {
      setSendingInvite(false);
    }
  };

  // ── Action label helpers ──────────────────────────────────────────────────────
  const ACTION_LABEL: Record<string, string> = {
    provision: 'Provisioned', suspend: 'Suspended', unsuspend: 'Unsuspended',
    blacklist: 'Blacklisted', unblacklist: 'Unblacklisted', delete: 'Deleted',
    set_user_limit: 'User limit changed', invite_user: 'Invited user',
    add_operator: 'Operator added', revoke_operator: 'Operator revoked',
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  // No min-h-screen wrapper and no header bar of its own: this renders inside
  // Layout's <main>, which already supplies the page shell and padding.
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-600 text-xs font-bold text-white">VA</div>
        <div>
          <h1 className="text-base font-bold text-slate-900">Platform Admin</h1>
          <p className="text-xs text-slate-400">Vasto staff only — every action here is audited across all tenants</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 border border-red-200">Internal only</span>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{loadError}</div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
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
                  <p className="mt-2 text-xs text-amber-600">
                    ⚠ Link expires in 7 days. It is shown once and cannot be retrieved again — re-invite to issue a new one.
                  </p>
                </div>
                <button onClick={() => { setNewInviteLink(null); setShowNew(false); }} className="text-xs text-slate-500 hover:text-slate-700">Done</button>
              </div>
            ) : (
              <form onSubmit={handleProvision} className="space-y-4">
                {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <p className="text-[11px] text-slate-400">
                  Creates the firm, its subscription, four roles (Owner / Architect / Engineer / Client),
                  the lead pipeline and costing defaults, plus an owner invite. No account is created until
                  the owner redeems that link.
                </p>
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
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span>{f.owner_email ?? 'No owner'}</span>
                        {/* owner_activated distinguishes a live account from an
                            outstanding invite — the old page could not tell. */}
                        {f.owner_email && !f.owner_activated && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <Clock className="w-2.5 h-2.5" /> invited, not yet joined
                          </span>
                        )}
                        <span>· Created {new Date(f.created_at).toLocaleDateString('en-IN')}</span>
                        {f.pending_invite_count > 0 && (
                          <span className="text-slate-400">· {f.pending_invite_count} pending invite{f.pending_invite_count === 1 ? '' : 's'}</span>
                        )}
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
                              placeholder="e.g. 25  (leave empty = plan default)"
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
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm text-slate-700">
                              {limit === null ? 'Unlimited' : `${limit} seats`}
                              {f.seats_purchased !== null && <span className="ml-1.5 text-xs text-indigo-600 font-medium">(custom override)</span>}
                              {f.seats_purchased === null && f.plan_max_users !== null && <span className="ml-1.5 text-xs text-slate-400">(from plan)</span>}
                            </span>
                            <button
                              onClick={() => { setEditingLimitId(f.id); setLimitDraft(f.seats_purchased?.toString() ?? ''); }}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            {f.seats_purchased !== null && (
                              <button onClick={() => doResetLimit(f)} className="text-xs text-slate-400 hover:text-slate-600">
                                Reset to plan default
                              </button>
                            )}
                          </div>
                        )}
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          Currently <strong className="text-slate-600">{f.user_count}</strong> active user{f.user_count === 1 ? '' : 's'}.
                          {limit !== null && f.user_count >= limit && (
                            <span className="ml-1 text-red-600 font-medium">Limit reached.</span>
                          )}
                          {' '}Seat caps are advisory — they are not enforced server-side.
                        </p>
                      </div>

                      {/* Send invite */}
                      {!f.deleted_at && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Send Invite</h4>
                          <div className="flex flex-wrap gap-2">
                            <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Name (optional)"
                              className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@firm.com" type="email"
                              className="flex-1 min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <select value={inviteRoleId} onChange={e => setInviteRoleId(e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              <option value="">— no role —</option>
                              {firmRoles.map(r => <option key={r.id} value={r.id}>{r.name}{r.is_admin ? ' (admin)' : ''}</option>)}
                            </select>
                            <button onClick={() => handleSendInvite(f.id)} disabled={sendingInvite || !inviteEmail.trim()}
                              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                              {sendingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Generate link
                            </button>
                          </div>
                          {inviteError && (
                            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{inviteError}</div>
                          )}
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
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {adminLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-semibold text-slate-700 w-32 shrink-0">
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">{log.firm_name ?? '—'}</span>
                  {/* The actor. vastos_admin_log had no such column before
                      platform-A — it recorded what happened, never who. */}
                  {log.actor_email && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <UserPlus className="w-3 h-3" />{log.actor_email}
                    </span>
                  )}
                  {log.details && Object.keys(log.details).length > 0 && (
                    <span className="text-[11px] text-slate-400 font-mono truncate">
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

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}

      {modal === 'suspend' && modalFirm && (
        <Modal title="Suspend firm" onClose={closeModal}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                Suspending <strong>{modalFirm.name}</strong> sets its subscription to suspended, which blocks every module for all of its users. You can unsuspend at any time.
              </p>
            </div>
            {modalError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{modalError}</div>}
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
            <p className="text-sm text-slate-600">
              Restore access for <strong>{modalFirm.name}</strong>? The server restores it to <strong>trial</strong> or <strong>active</strong> depending on whether the trial window is still open.
            </p>
            {modalError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{modalError}</div>}
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
                Blacklisting <strong>{modalFirm.name}</strong> suspends its subscription and flags the account with a recorded reason. The suspension is what blocks access; the flag is a note for staff.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Reason <span className="text-red-500">*</span></label>
              <textarea value={blacklistReason} onChange={e => setBlacklistReason(e.target.value)} rows={3}
                placeholder="e.g. Payment fraud, Terms of service violation…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            </div>
            {modalError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{modalError}</div>}
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
            {modalError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{modalError}</div>}
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
                <p>This marks <strong>{modalFirm.name}</strong> as deleted. Every user loses access immediately — sessions refuse to resolve for a deleted firm.</p>
                <p className="text-xs">Data is soft-deleted and can only be restored from the database.</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Type the firm name to confirm</label>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={modalFirm.name}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              <p className="mt-1 text-[10px] text-slate-400">Re-checked on the server against the real firm name.</p>
            </div>
            {modalError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{modalError}</div>}
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
