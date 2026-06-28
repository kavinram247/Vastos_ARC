// Telephony — configurable click-to-call for leads. The chosen partner + settings
// live in the 'telephony' comm channel's config jsonb (set in Leads Admin). A call
// uses the partner's click-to-call webhook when configured, otherwise falls back to
// the device dialer (tel:). Every call is auto-logged to the lead timeline.
import { store } from '../data/store';
import type { Lead } from '../types';

export interface TelephonyProvider {
  value: string;
  label: string;
  /** Whether the provider uses a click-to-call webhook (vs. just the device dialer). */
  webhook: boolean;
  hint: string;
}

export const TELEPHONY_PROVIDERS: TelephonyProvider[] = [
  { value: 'manual', label: 'Manual dialer (device / softphone)', webhook: false, hint: 'Opens your device or softphone with the number pre-filled. No API needed.' },
  { value: 'twilio', label: 'Twilio Voice', webhook: true, hint: 'Bridges your agent number to the lead via Twilio click-to-call.' },
  { value: 'exotel', label: 'Exotel', webhook: true, hint: 'India-first cloud telephony; connects agent ↔ customer.' },
  { value: 'knowlarity', label: 'Knowlarity', webhook: true, hint: 'Cloud call-center click-to-call.' },
  { value: 'plivo', label: 'Plivo', webhook: true, hint: 'Programmable voice click-to-call.' },
];

export interface TelephonyConfig {
  provider: string;
  agent_number?: string;       // rings the agent first (click-to-call)
  caller_id?: string;          // outbound caller ID shown to the lead
  click_to_call_url?: string;  // provider/edge webhook that bridges the call
}

export interface TelephonyState {
  channelId: string | null;
  config: TelephonyConfig;
  provider: TelephonyProvider;
  connected: boolean;
  /** Whether the call feature is available at all (feature flag on). */
  enabled: boolean;
}

export function getTelephony(firmId: string): TelephonyState {
  const channel = store.commChannels.find(c => c.firm_id === firmId && c.category === 'telephony');
  const config = (channel?.config || {}) as TelephonyConfig;
  const providerKey = config.provider || (channel?.provider?.replace('telephony_', '')) || 'manual';
  const provider = TELEPHONY_PROVIDERS.find(p => p.value === providerKey) || TELEPHONY_PROVIDERS[0];
  return {
    channelId: channel?.id ?? null,
    config,
    provider,
    connected: channel?.status === 'connected',
    enabled: store.isFeatureEnabled(firmId, 'comm_telephony', true),
  };
}

export interface CallResult { ok: boolean; mode: 'click-to-call' | 'dialer'; error?: string; }

/** Place a call to a lead via the configured partner and log it to the timeline. */
export async function placeCall(lead: Lead, firmId: string, actorId: string): Promise<CallResult> {
  const phone = (lead.client_phone || '').trim();
  if (!phone) return { ok: false, mode: 'dialer', error: 'This lead has no phone number.' };

  const t = getTelephony(firmId);
  const useWebhook = t.provider.webhook && t.connected && !!t.config.click_to_call_url;
  const mode: CallResult['mode'] = useWebhook ? 'click-to-call' : 'dialer';

  // Auto-log the call on the lead timeline (updates last-contact date via the store).
  store.addLeadInteraction({
    firm_id: firmId, lead_id: lead.id, type: 'call', channel: 'call', direction: 'outbound',
    subject: `Call to ${lead.client_name}`,
    description: useWebhook ? `Outbound call placed via ${t.provider.label}.` : `Dialled ${phone} via device dialer.`,
    contact_id: lead.contact_id, logged_by: actorId,
  } as any);

  if (useWebhook) {
    try {
      const res = await fetch(t.config.click_to_call_url!, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: phone, from: t.config.agent_number || t.config.caller_id || '', lead_id: lead.id, firm_id: firmId, provider: t.provider.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) return { ok: true, mode };
      // Not fully configured / provider error → fall back to the device dialer so the call still happens.
      console.warn('[telephony] click-to-call failed, falling back to dialer:', data?.error || res.status);
    } catch (e) {
      console.warn('[telephony] click-to-call error, falling back to dialer:', (e as Error)?.message);
    }
  }

  // Device dialer fallback — works everywhere, no credentials.
  try { window.open(`tel:${phone.replace(/\s+/g, '')}`, '_self'); } catch { /* noop */ }
  return { ok: true, mode: 'dialer' };
}
