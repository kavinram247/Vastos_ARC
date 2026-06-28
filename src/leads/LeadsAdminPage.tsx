import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { stageColor } from './logic';
import { TELEPHONY_PROVIDERS, type TelephonyConfig } from './telephony';
import type { Page } from '../types';
import {
  ArrowLeft, Settings, ToggleLeft, GitBranch, Radio, Globe, Plus, Trash2,
  ChevronUp, ChevronDown, Check, Link2, Copy, Phone, Sliders,
} from 'lucide-react';
import { cn } from '../utils/cn';

const FLAG_LABELS: Record<string, { label: string; desc: string }> = {
  quotations: { label: 'Quotations', desc: 'Create & track versioned quotes on a lead' },
  website_capture: { label: 'Website capture', desc: 'Auto-create leads from your website enquiry form' },
  comm_email: { label: 'Email', desc: 'Email channel in the communication hub' },
  comm_telephony: { label: 'Telephony', desc: 'Make/receive calls from lead records' },
  comm_sms: { label: 'SMS', desc: 'SMS channel in the communication hub' },
  comm_meta: { label: 'Meta Business', desc: 'WhatsApp / Messenger via Meta Business' },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function LeadsAdminPage({ onNavigate }: { onNavigate?: (page: Page, projectId?: string) => void }) {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [configId, setConfigId] = useState<string | null>(null);
  if (!user || !firm) return null;
  if (!can('leads', 'edit')) {
    return <div className="py-24 text-center text-slate-400">You don't have permission to configure leads.</div>;
  }
  const firmId = firm.id;
  const flags = store.featureFlags.filter(f => f.firm_id === firmId);
  const stages = store.pipelineStages.filter(s => s.firm_id === firmId).sort((a, b) => a.order_index - b.order_index);
  const channels = store.commChannels.filter(c => c.firm_id === firmId);
  const webhookUrl = `https://weckowkvqpamnlcqwvfh.supabase.co/functions/v1/lead-intake`;

  const moveStage = (id: string, dir: -1 | 1) => {
    const i = stages.findIndex(s => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const a = stages[i], b = stages[j];
    store.updatePipelineStage(a.id, { order_index: b.order_index });
    store.updatePipelineStage(b.id, { order_index: a.order_index });
  };
  const addStage = () => {
    const label = prompt('New stage name?');
    if (!label?.trim()) return;
    const key = slug(label);
    if (stages.some(s => s.key === key)) { alert('A stage with that key already exists.'); return; }
    store.addPipelineStage({ firm_id: firmId, key, label: label.trim(), order_index: Math.max(0, ...stages.map(s => s.order_index)) + 1, category: 'active', is_won: false, is_lost: false, color: 'slate', enabled: true } as any);
  };
  const delStage = (id: string, key: string) => {
    if (store.leads.some(l => l.firm_id === firmId && l.status === key)) { alert("Can't delete — leads are currently in this stage."); return; }
    if (confirm('Delete this stage?')) store.deletePipelineStage(id);
  };
  const toggleChannel = (id: string, connected: boolean) => {
    store.updateCommChannel(id, connected
      ? { status: 'disconnected', connected_by: null, connected_at: null }
      : { status: 'connected', connected_by: user.id, connected_at: new Date().toISOString() });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <button onClick={() => onNavigate?.('leads')} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Settings className="w-6 h-6 text-indigo-600" /> Leads Admin</h1>
          <p className="text-sm text-slate-500">Configure the pipeline, features and communication channels.</p>
        </div>
      </div>

      {/* Feature toggles */}
      <Card>
        <CardTitle className="mb-3 flex items-center gap-2"><ToggleLeft className="w-5 h-5 text-indigo-500" /> Features</CardTitle>
        <div className="divide-y divide-slate-100">
          {flags.map(flag => {
            const meta = FLAG_LABELS[flag.key] || { label: flag.key, desc: '' };
            return (
              <div key={flag.id} className="flex items-center justify-between py-2.5">
                <div><div className="text-sm font-medium text-slate-800">{meta.label}</div><div className="text-xs text-slate-400">{meta.desc}</div></div>
                <button onClick={() => store.setFeatureFlag(firmId, flag.key, !flag.enabled)} className={cn('relative h-6 w-11 rounded-full transition-colors', flag.enabled ? 'bg-indigo-600' : 'bg-slate-200')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', flag.enabled ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Pipeline editor */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5 text-indigo-500" /> Pipeline stages</CardTitle>
          <Button size="sm" variant="secondary" onClick={addStage}><Plus className="w-4 h-4" /> Add stage</Button>
        </div>
        <div className="space-y-1.5">
          {stages.map((s, i) => {
            const c = stageColor(s.color);
            const count = store.leads.filter(l => l.firm_id === firmId && l.status === s.key).length;
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                <div className="flex flex-col">
                  <button onClick={() => moveStage(s.id, -1)} disabled={i === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveStage(s.id, 1)} disabled={i === stages.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <span className={cn('h-2.5 w-2.5 rounded-full', c.dot)} />
                <input defaultValue={s.label} onBlur={e => e.target.value.trim() && e.target.value !== s.label && store.updatePipelineStage(s.id, { label: e.target.value.trim() })}
                  className="flex-1 rounded-md bg-transparent px-1 text-sm font-medium text-slate-800 focus:bg-slate-50 focus:outline-none" />
                <Badge variant={s.category === 'terminal' ? 'warning' : 'default'} size="sm">{s.category}</Badge>
                {s.is_won && <Badge variant="success" size="sm">won</Badge>}
                {s.is_lost && <Badge variant="error" size="sm">lost</Badge>}
                <span className="w-14 text-right text-xs text-slate-400">{count} lead{count === 1 ? '' : 's'}</span>
                <button onClick={() => store.updatePipelineStage(s.id, { enabled: !s.enabled })} className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', s.enabled ? 'text-emerald-600' : 'text-slate-400')}>{s.enabled ? 'On' : 'Off'}</button>
                <button onClick={() => delStage(s.id, s.key)} className="text-slate-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Renaming is safe (the underlying key is preserved). A stage can only be deleted when no leads are in it.</p>
      </Card>

      {/* Communication channels */}
      <Card>
        <CardTitle className="mb-1 flex items-center gap-2"><Radio className="w-5 h-5 text-indigo-500" /> Communication channels</CardTitle>
        <p className="mb-3 text-xs text-slate-400">Connect your providers (email, telephony, SMS, Meta Business). Connections here are scaffolding — real OAuth/API wiring is added server-side once credentials are supplied.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {channels.map(ch => {
            const connected = ch.status === 'connected';
            const isTelephony = ch.category === 'telephony';
            return (
              <div key={ch.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">{isTelephony && <Phone className="w-3.5 h-3.5 text-indigo-500" />}{ch.display_name || ch.provider}</div>
                  <div className="text-xs capitalize text-slate-400">{ch.category}{isTelephony && connected ? ` · ${(ch.config as any)?.provider || 'configured'}` : ''}</div>
                </div>
                {isTelephony ? (
                  <div className="flex items-center gap-2">
                    {connected && <Badge variant="success" size="sm"><Check className="w-3 h-3 mr-1" /> Active</Badge>}
                    <Button size="sm" variant="secondary" onClick={() => setConfigId(ch.id)}><Sliders className="w-3.5 h-3.5" /> {connected ? 'Edit' : 'Set up'}</Button>
                  </div>
                ) : connected ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="success" size="sm"><Check className="w-3 h-3 mr-1" /> Connected</Badge>
                    <button onClick={() => toggleChannel(ch.id, true)} className="text-xs text-slate-400 hover:text-red-600">Disconnect</button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => toggleChannel(ch.id, false)}><Link2 className="w-3.5 h-3.5" /> Connect</Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Telephony powers the <b>Call</b> button on every lead — pick your partner and the agent number, or use the device dialer.</p>
      </Card>

      {/* Website capture */}
      <Card>
        <CardTitle className="mb-1 flex items-center gap-2"><Globe className="w-5 h-5 text-indigo-500" /> Website enquiry capture</CardTitle>
        <p className="mb-3 text-xs text-slate-400">Point your website's enquiry form at this endpoint to auto-create leads (returning customers are matched automatically). Fields: <code className="rounded bg-slate-100 px-1">name, email, phone, project_type, message</code>.</p>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <code className="flex-1 truncate text-xs text-slate-600">{webhookUrl}</code>
          <button onClick={() => navigator.clipboard?.writeText(webhookUrl)} className="text-slate-400 hover:text-indigo-600"><Copy className="w-4 h-4" /></button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">New website leads default to the first pipeline stage and stay unassigned until an owner picks them up.</p>
      </Card>

      {configId && <TelephonyConfigModal channelId={configId} userId={user.id} onClose={() => setConfigId(null)} />}
    </div>
  );
}

const TELEPHONY_FN_URL = 'https://weckowkvqpamnlcqwvfh.supabase.co/functions/v1/telephony-call';

function TelephonyConfigModal({ channelId, userId, onClose }: { channelId: string; userId: string; onClose: () => void }) {
  const store = useStore();
  const channel = store.commChannels.find(c => c.id === channelId);
  const existing = (channel?.config || {}) as TelephonyConfig;
  const [provider, setProvider] = useState(existing.provider || 'manual');
  const [agentNumber, setAgentNumber] = useState(existing.agent_number || '');
  const [callerId, setCallerId] = useState(existing.caller_id || '');
  const [webhookUrl, setWebhookUrl] = useState(existing.click_to_call_url || TELEPHONY_FN_URL);
  if (!channel) return null;
  const def = TELEPHONY_PROVIDERS.find(p => p.value === provider) || TELEPHONY_PROVIDERS[0];

  const save = () => {
    const config: TelephonyConfig = { provider, agent_number: agentNumber.trim() || undefined, caller_id: callerId.trim() || undefined, click_to_call_url: def.webhook ? (webhookUrl.trim() || undefined) : undefined };
    store.updateCommChannel(channelId, {
      provider: `telephony_${provider}`,
      display_name: def.label,
      config: config as any,
      status: 'connected',
      connected_by: userId,
      connected_at: new Date().toISOString(),
    });
    onClose();
  };
  const disable = () => { store.updateCommChannel(channelId, { status: 'disconnected', connected_by: null, connected_at: null }); onClose(); };

  return (
    <Modal open onClose={onClose} title="Telephony partner" size="md">
      <div className="space-y-4">
        <Select label="Telephone partner" value={provider} onChange={e => setProvider(e.target.value)}
          options={TELEPHONY_PROVIDERS.map(p => ({ value: p.value, label: p.label }))} />
        <p className="-mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{def.hint}</p>

        {def.webhook ? (
          <>
            <Input label="Agent number (rings first)" value={agentNumber} onChange={e => setAgentNumber(e.target.value)} placeholder="+91 98xxxxxx00" />
            <Input label={provider === 'exotel' ? 'Caller ID — your ExoPhone' : 'Caller ID (shown to the lead)'} value={callerId} onChange={e => setCallerId(e.target.value)} placeholder="+91 80xxxxxx00" />
            <Input label="Click-to-call endpoint (your telephony-call function)" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder={TELEPHONY_FN_URL} />
            <div className="-mt-1 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-800">
              <b>Where do the API Key &amp; Token go?</b> Not here — they're <b>secrets</b> set on the <code className="rounded bg-amber-100 px-1">telephony-call</code> edge function, never in the browser. For Exotel set:
              <code className="mt-1 block rounded bg-amber-100 px-1 py-0.5">EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_ACCOUNT_SID, EXOTEL_SUBDOMAIN, EXOTEL_CALLER_ID</code>
              in Supabase → Edge Functions → Secrets. This field just points the app at that function; leave it as-is unless you self-host the bridge.
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">The Call button opens your device or softphone with the lead's number pre-filled — no setup required.</p>
        )}

        <div className="flex items-center justify-between pt-1">
          {channel.status === 'connected'
            ? <button onClick={disable} className="text-xs font-medium text-slate-400 hover:text-red-600">Turn off telephony</button>
            : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save}><Check className="w-4 h-4" /> Save partner</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
