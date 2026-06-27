import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { AccessDenied } from '../components/AccessDenied';
import type { Page } from '../types';
import { fetchMarketingData, setAccountStatus, setSyncInterval } from './marketingApi';
import { getConnector, AVAILABLE_PROVIDERS } from './connectors';
import { mapAdLeadToCrm } from './attribution';
import { logAdminAction } from '../lib/events';
import type { MarketingDataset } from './types';
import {
  Plug, ArrowLeft, RefreshCw, Loader2, CheckCircle2, XCircle, Link2, Users, Clock,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props { onNavigate: (page: Page, projectId?: string) => void; }
const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'never';

export function MarketingConnectPage({ onNavigate }: Props) {
  const { user, firm } = useAuth();
  const { can } = usePermissions();
  const [data, setData] = useState<MarketingDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = () => fetchMarketingData(firm?.id).then(d => { setData(d); setLoading(false); });
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [firm?.id]);

  if (!user || !firm) return null;
  if (!can('marketing', 'view')) return <AccessDenied module="Marketing" />;
  if (loading || !data) return <div className="flex items-center justify-center py-32 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>;

  const canManage = can('marketing', 'edit');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const syncNow = async (accountId: string) => {
    setBusy(accountId);
    try {
      const rows = await getConnector('meta')!.sync(firm.id, accountId);
      logAdminAction({ firmId: firm.id, actorId: user.id, action: 'updated', actionLabel: 'Synced Meta ad account', module: 'marketing', entityId: accountId, details: `${rows} insight rows` });
      await reload(); flash(`Synced — ${rows} rows refreshed.`);
    } finally { setBusy(null); }
  };

  const toggleConnect = async (accountId: string, status: string) => {
    const next = status === 'disconnected' ? 'mock' : 'disconnected';
    await setAccountStatus(accountId, next);
    logAdminAction({ firmId: firm.id, actorId: user.id, action: next === 'disconnected' ? 'deleted' : 'created', actionLabel: `${next === 'disconnected' ? 'Disconnected' : 'Reconnected'} ad account`, module: 'marketing', entityId: accountId });
    await reload();
  };

  const changeInterval = async (accountId: string, minutes: number) => {
    await setSyncInterval(accountId, minutes);
    logAdminAction({ firmId: firm.id, actorId: user.id, action: 'updated', actionLabel: 'Changed sync interval', module: 'marketing', entityId: accountId, details: `${minutes} min` });
    await reload();
  };

  const mapLead = async (adLeadId: string) => {
    const adLead = data.adLeads.find(l => l.id === adLeadId);
    if (!adLead) return;
    setBusy(adLeadId);
    try {
      const res = await mapAdLeadToCrm(adLead, firm.id);
      logAdminAction({ firmId: firm.id, actorId: user.id, action: 'created', actionLabel: `Mapped Meta lead to CRM (${res.status})`, module: 'marketing', entityId: adLeadId, entityName: adLead.full_name || undefined });
      await reload();
      flash(res.status === 'duplicate' ? `Returning customer — linked to existing lead (no duplicate created).` : `Lead created in CRM${res.returning ? ' (returning contact)' : ''}.`);
    } finally { setBusy(null); }
  };

  const unmapped = data.adLeads.filter(l => l.status === 'unmapped');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
        <button onClick={() => onNavigate('marketing')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><ArrowLeft className="h-5 w-5" /></button>
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900"><Plug className="h-5 w-5 text-indigo-600" /> Ad Account Connections</h1>
          <p className="mt-1 text-sm text-slate-500">Connect ad platforms, control sync, and map incoming leads into the CRM.</p>
        </div>
      </div>

      {toast && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{toast}</div>}

      {/* Connected accounts */}
      <div className="space-y-3">
        {data.accounts.map(acc => (
          <div key={acc.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Link2 className="h-5 w-5" /></div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">{acc.name}
                    <StatusBadge status={acc.status} />
                  </div>
                  <div className="text-[11px] text-slate-400">{acc.provider} · {acc.external_account_id} · last synced {fmtTime(acc.last_synced_at)}</div>
                </div>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" />
                    <select value={acc.sync_interval_minutes} onChange={e => changeInterval(acc.id, Number(e.target.value))} className="rounded-md border border-slate-200 px-2 py-1 text-xs">
                      {[60, 180, 360, 720, 1440].map(m => <option key={m} value={m}>every {m < 60 ? `${m}m` : `${m / 60}h`}</option>)}
                    </select>
                  </label>
                  <button disabled={busy === acc.id || acc.status === 'disconnected'} onClick={() => syncNow(acc.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50">
                    {busy === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync now
                  </button>
                  <button onClick={() => toggleConnect(acc.id, acc.status)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300">
                    {acc.status === 'disconnected' ? 'Reconnect' : 'Disconnect'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Connect new */}
      {can('marketing', 'create') && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-slate-800">Connect a new platform</div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_PROVIDERS.map(p => (
              <button key={p.provider} disabled className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 disabled:opacity-70" title={p.live ? 'Live' : 'Requires API credentials (scaffolded)'}>
                {p.label}<span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500">{p.provider === 'meta' ? 'mock connected' : 'soon'}</span>
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-slate-400">Live OAuth flows through the <code>meta-oauth</code> edge function and stores tokens in Supabase Vault; activate by configuring <code>FB_APP_ID</code> / <code>FB_APP_SECRET</code>. The seeded Meta account is in mock mode for demonstration.</p>
        </div>
      )}

      {/* Unmapped leads */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Users className="h-4 w-4" /> Unmapped ad leads <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-500">{unmapped.length}</span></div>
        </div>
        {unmapped.length === 0 ? <p className="text-sm text-slate-400">All incoming leads are mapped to the CRM.</p> : (
          <div className="divide-y divide-slate-50">
            {unmapped.slice(0, 12).map(l => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-700">{l.full_name}</div>
                  <div className="text-[11px] text-slate-400">{l.email} · {l.phone} · {String(l.raw_fields?.campaign || '')}</div>
                </div>
                {canManage && (
                  <button disabled={busy === l.id} onClick={() => mapLead(l.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                    {busy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Map to CRM
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync history */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-800">Sync history</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400"><th className="py-1.5">When</th><th>Trigger</th><th>Status</th><th className="text-right">Rows</th></tr></thead>
          <tbody>
            {data.syncRuns.slice(0, 10).map(r => (
              <tr key={r.id} className="border-t border-slate-50">
                <td className="py-2 text-slate-600">{fmtTime(r.started_at)}</td>
                <td className="capitalize text-slate-500">{r.trigger}</td>
                <td><span className={cn('inline-flex items-center gap-1 text-xs', r.status === 'success' ? 'text-emerald-600' : 'text-red-500')}>{r.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{r.status}</span></td>
                <td className="text-right tabular-nums text-slate-600">{r.rows_upserted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    mock: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    disconnected: 'bg-slate-100 text-slate-500 border-slate-200',
    error: 'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize', map[status] || map.disconnected)}>{status === 'mock' ? 'mock data' : status}</span>;
}
