// Click-to-call bridge — Exotel.
//
// SECURITY (audit C8). The previous deployed version of this file was an
// unauthenticated open telephony relay: it read `to` and `from` from the request
// body and placed a real, billed call carrying the firm's ExoPhone as CallerId,
// with no JWT, no membership check and no rate limit. Anyone with the URL — which
// the admin UI prints — could bill calls to the firm, spoof its caller ID at its
// own clients, or flood an arbitrary number. See
// supabase/migrations/20260729010000_security_phase3_c8_telephony_authz.sql.
//
// The rule this file now follows: THE CALLER NAMES A LEAD, NEVER A NUMBER.
// `lead_id` is the only field read from the body. Everything that decides
// whether the call may happen, and which handset it reaches, is decided inside
// telephony_request_call() from auth.uid() — firm binding, leads:edit, the
// feature flag, the destination number, the agent number, and the per-firm and
// per-user rate limits. This function is a pipe to Exotel after that returns.
//
// Deploy with verify_jwt = true (supabase/config.toml). The Authorization header
// is also forwarded to PostgREST below, so the RPC re-derives the identity
// itself: if the platform flag is ever flipped off, the authorization still
// holds rather than silently evaporating.
//
// Credentials come ONLY from edge-function secrets (Supabase → Edge Functions →
// Secrets): EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_ACCOUNT_SID,
// EXOTEL_SUBDOMAIN, EXOTEL_CALLER_ID. Never hardcode them here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Browser callers must send a JWT, so an attacker's page cannot use a victim's
// session here — it has no way to read the token. ALLOWED_ORIGINS narrows this
// further when set (comma-separated); leave it unset only in development.
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const corsFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin':
    ALLOWED.length === 0 ? '*' : (origin && ALLOWED.includes(origin) ? origin : ALLOWED[0]),
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

// SQLSTATEs raised by telephony_request_call(), mapped to their HTTP meaning,
// plus PostgREST's own codes for a token it would not accept — a malformed or
// expired JWT never reaches the function body, so without these a bad token
// would surface as a 500 and read like a server bug rather than a refusal.
// Anything else is a bug and must not describe itself to the caller.
const STATUS_FOR: Record<string, number> = {
  '28000': 401, // not authenticated
  'PGRST301': 401, // JWT malformed / expired
  'PGRST302': 401, // anonymous request rejected
  '42501': 403, // permission denied / feature off / telephony not connected
  '42704': 404, // lead not found (or not in the caller's firm — same answer)
  '22023': 400, // unusable phone number, or no agent number configured
  '54000': 429, // rate limit reached
};

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get('origin'));
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  try {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return json({ ok: false, error: 'authentication required' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const leadId = String(body.lead_id || '').trim();
    if (!leadId) return json({ ok: false, error: 'lead_id required' }, 400);

    // Acts as the calling user: the RPC is security definer but resolves
    // auth.uid(), so it sees the real session and its own RLS-scoped view.
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
    );

    // ── Authorize. This is the whole security boundary. ────────────────────
    const { data: authz, error: authzErr } = await sb.rpc('telephony_request_call', { p_lead_id: leadId });
    if (authzErr) {
      const status = STATUS_FOR[authzErr.code ?? ''] ?? 500;
      // A rejected token gets a flat answer: the reason it failed to parse is
      // the caller's business, not something to narrate back to them.
      const message = status === 500 ? 'call could not be authorized'
        : status === 401 ? 'authentication required'
        : authzErr.message;
      if (status === 500) console.error('[telephony-call] authz', authzErr.code, authzErr.message);
      return json({ ok: false, error: message }, status);
    }

    const requestId = authz.call_request_id as string;
    const to = authz.to as string;
    const from = authz.from as string;

    const settle = (status: 'placed' | 'failed', callSid: string | null, error: string | null) =>
      sb.rpc('telephony_settle_call', {
        p_id: requestId, p_status: status, p_call_sid: callSid, p_error: error,
      });

    const API_KEY = Deno.env.get('EXOTEL_API_KEY');
    const API_TOKEN = Deno.env.get('EXOTEL_API_TOKEN');
    const SID = Deno.env.get('EXOTEL_ACCOUNT_SID');
    const SUB = Deno.env.get('EXOTEL_SUBDOMAIN') || 'api.exotel.com';
    const CALLER = Deno.env.get('EXOTEL_CALLER_ID');
    if (!API_KEY || !API_TOKEN || !SID || !CALLER) {
      await settle('failed', null, 'Exotel secrets not set');
      return json({ ok: false, error: 'Exotel secrets not set on the telephony-call function (EXOTEL_API_KEY/TOKEN/ACCOUNT_SID/CALLER_ID).' }, 503);
    }

    // ── Place the call. Both numbers came from the database, not the body. ──
    const url = `https://${SUB}/v1/Accounts/${SID}/Calls/connect.json`;
    const form = new URLSearchParams({ From: from, To: to, CallerId: CALLER, CallType: 'trans' });
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${API_KEY}:${API_TOKEN}`), 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const text = await res.text();
    let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      const msg = String(data?.RestException?.Message || data?.message || data?.raw || `Exotel HTTP ${res.status}`).slice(0, 300);
      await settle('failed', null, msg);
      return json({ ok: false, error: msg, status: res.status }, 502);
    }

    const callSid = data?.Call?.Sid ?? null;
    await settle('placed', callSid, null);
    return json({ ok: true, call_sid: callSid, status: data?.Call?.Status ?? null });
  } catch (e) {
    // Never hand an internal message to the caller; the detail goes to the logs.
    console.error('[telephony-call]', (e as Error)?.message || e);
    return json({ ok: false, error: 'internal error' }, 500);
  }
});
