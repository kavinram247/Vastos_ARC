// Deployed source as retrieved from the Supabase dashboard (project ref
// weckowkvqpamnlcqwvfh — production) on 29 Jul 2026 and committed VERBATIM.
// Do not "tidy" this file: audit C8 describes defects live in production
// exactly as written here.
//
// Audit W1b — the hypothesised SSRF is NOT here, and that reading is withdrawn.
// The Exotel URL is assembled entirely from environment variables (EXOTEL_
// SUBDOMAIN, EXOTEL_ACCOUNT_SID); no caller-supplied URL is ever fetched
// server-side. Credentials are read from function secrets, not hardcoded.
//
// Audit C8 — what is actually wrong is far worse: this function performs NO
// authentication of any kind. No JWT is verified, no API key is checked, no
// firm membership is established. `to` and `from` are taken straight from the
// request body and turned into a real, billed telephone call carrying the
// firm's own ExoPhone as CallerId. Access-Control-Allow-Origin is '*' and
// there is no rate limit. The `lead_id`, `firm_id` and `provider` the client
// sends are read by nothing here — there is no tenant scoping at all.
//
// That makes the endpoint an open telephony relay for anyone who knows the
// URL, which the application displays in its own admin UI:
//   · unmetered outbound calls billed to the firm (toll fraud);
//   · caller-ID spoofing — the callee sees the architecture firm's number,
//     which is a ready-made vishing platform aimed at that firm's own clients;
//   · telephony DoS against an arbitrary number.
//
// This holds only if the function is deployed with verify_jwt = false. The
// client at src/leads/telephony.ts:75 sends no Authorization header, so it
// must be, or click-to-call could never have worked. Confirm in the dashboard.
// If verify_jwt is in fact true, the finding inverts: the feature has never
// worked and silently falls back to the device dialer on every call.

// Click-to-call bridge. The app POSTs { to, from } (lead number + agent number);
// Exotel rings the agent first, then connects the lead, showing your ExoPhone.
// Credentials come ONLY from edge-function secrets (Supabase → Edge Functions →
// Secrets): EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_ACCOUNT_SID,
// EXOTEL_SUBDOMAIN, EXOTEL_CALLER_ID. Never hardcode them here.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const to = String(body.to || '').replace(/\s+/g, '');
    const from = String(body.from || '').replace(/\s+/g, '');
    if (!to) return json({ ok: false, error: 'no lead number' }, 400);
    if (!from) return json({ ok: false, error: 'no agent number configured — set it in Leads Admin → Telephony' }, 400);

    const API_KEY = Deno.env.get('EXOTEL_API_KEY');
    const API_TOKEN = Deno.env.get('EXOTEL_API_TOKEN');
    const SID = Deno.env.get('EXOTEL_ACCOUNT_SID');
    const SUB = Deno.env.get('EXOTEL_SUBDOMAIN') || 'api.exotel.com';
    const CALLER = Deno.env.get('EXOTEL_CALLER_ID');
    if (!API_KEY || !API_TOKEN || !SID || !CALLER) {
      return json({ ok: false, error: 'Exotel secrets not set on the telephony-call function (EXOTEL_API_KEY/TOKEN/ACCOUNT_SID/CALLER_ID).' }, 503);
    }

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
      const msg = data?.RestException?.Message || data?.message || data?.raw || `Exotel HTTP ${res.status}`;
      return json({ ok: false, error: String(msg).slice(0, 300), status: res.status }, 502);
    }
    return json({ ok: true, call_sid: data?.Call?.Sid ?? null, status: data?.Call?.Status ?? null });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
