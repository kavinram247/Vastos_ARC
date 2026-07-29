// Meta (Facebook) ad-account OAuth. Rewritten to close audit H7.
//
// What H7 was, in the deployed version this replaces:
//   · NO OAuth `state` parameter anywhere — the consent URL omitted it and the
//     callback validated none. Textbook OAuth CSRF.
//   · Unauthenticated, and it answered GET, so nothing bound an OAuth flow to a
//     CRM session: anyone who presented a ?code had it exchanged and the
//     resulting ad accounts upserted into the CRM.
//   · FIRM_ID hardcoded to the demo tenant — the same defect as C9, of which
//     lead-intake was only the first half. Every firm's Meta connection would
//     have been written to firm 11111111-… .
//   · Token storage silently did nothing. .rpc('vault.create_secret') issues
//     POST /rest/v1/rpc/vault.create_secret, which PostgREST resolves against
//     its exposed schema as public."vault.create_secret" — 404 PGRST202 — and
//     `.catch(() => {})` swallowed it. The token was never stored at all.
//   · The access token was passed in query strings to graph.facebook.com,
//     where it is liable to be logged by every hop in between.
//
// The flow now has two legs with different trust, and the browser names nothing
// that matters — the firm is recovered from the state row, never from the
// request:
//
//   POST ?action=begin   Authenticated. Requires a Bearer JWT, marketing:edit
//                        and the firm's comm_meta flag, all checked inside
//                        meta_oauth_begin(). Returns the consent URL, carrying
//                        a single-use state that expires in ten minutes.
//
//   GET  ?code=&state=   The callback. Necessarily unauthenticated — Meta
//                        redirects a browser here — and therefore carries no
//                        authority of its own. meta_oauth_consume() spends the
//                        state and hands back the firm it was minted for. No
//                        state, no firm, no work.
//
// Secrets come only from edge-function secrets: FB_APP_ID, FB_APP_SECRET,
// FB_REDIRECT_URI. Deploy with verify_jwt = false — the callback leg cannot
// carry a session — which is exactly why the begin leg checks the JWT itself
// rather than relying on the platform flag.
//
// See supabase/migrations/20260729040000_security_phase3_h7_meta_oauth.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v19.0';

const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

function corsFor(origin: string | null): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin && ALLOWED.includes(origin)) base['Access-Control-Allow-Origin'] = origin;
  return base;
}

// SQLSTATEs raised by the RPCs, mapped to their HTTP meaning. Anything else is
// a bug and must not describe itself to the caller.
const STATUS_FOR: Record<string, number> = {
  '28000': 401, // not authenticated
  'PGRST301': 401, // JWT malformed / expired
  'PGRST302': 401, // anonymous request rejected
  '42501': 403, // no marketing:edit, or comm_meta is off
  '22023': 400, // bad argument
  '25000': 500, // the token did not store
};

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get('origin'));
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const appId = Deno.env.get('FB_APP_ID');
  const appSecret = Deno.env.get('FB_APP_SECRET');
  const redirectUri = Deno.env.get('FB_REDIRECT_URI');
  if (!appId || !appSecret || !redirectUri) {
    return json({ ok: false, configured: false, error: 'Meta OAuth not configured. Set FB_APP_ID, FB_APP_SECRET, FB_REDIRECT_URI.' }, 200);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  try {
    // ── Leg 1 · begin ──────────────────────────────────────────────────────
    // No code means the app is asking where to send the user. This is the leg
    // that must prove a CRM session exists, because it is what mints the state
    // that later grants the callback a firm.
    if (!code) {
      if (req.method !== 'POST') {
        // The deployed version started flows on GET, which is half of why
        // nothing bound a flow to a session.
        return json({ ok: false, error: 'use POST to start an OAuth flow' }, 405);
      }
      const auth = req.headers.get('Authorization') || '';
      if (!auth.toLowerCase().startsWith('bearer ')) {
        return json({ ok: false, error: 'authentication required' }, 401);
      }

      // The header is forwarded to PostgREST so meta_oauth_begin() re-derives
      // the identity from auth.uid() itself. Authorization then does not depend
      // on verify_jwt being set correctly in the dashboard.
      const asUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: auth } } },
      );

      const { data, error } = await asUser.rpc('meta_oauth_begin', { p_redirect_uri: redirectUri });
      if (error) {
        const status = STATUS_FOR[error.code ?? ''] ?? 500;
        if (status === 500) console.error('meta_oauth_begin failed:', error.code, error.message);
        return json({ ok: false, error: status === 500 ? 'could not start the OAuth flow' : error.message }, status);
      }

      const scope = 'ads_read,leads_retrieval,business_management';
      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth`
        + `?client_id=${encodeURIComponent(appId)}`
        + `&redirect_uri=${encodeURIComponent(redirectUri)}`
        + `&scope=${encodeURIComponent(scope)}`
        + `&response_type=code`
        + `&state=${encodeURIComponent(data.state)}`;
      return json({ ok: true, configured: true, authUrl });
    }

    // ── Leg 2 · callback ───────────────────────────────────────────────────
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // The state is the ONLY thing that grants this leg a firm. Spent before
    // the code is exchanged, so a replayed callback does no work at all.
    if (!state) return json({ ok: false, error: 'missing state' }, 400);
    const { data: consumed, error: ce } = await sb.rpc('meta_oauth_consume', { p_state: state });
    if (ce) {
      console.error('meta_oauth_consume failed:', ce.code, ce.message);
      return json({ ok: false, error: 'could not complete the OAuth flow' }, 500);
    }
    if (consumed?.status !== 'ok') {
      // Undifferentiated by design: the only party who should present a state
      // is Meta, redirecting a browser that just came from the begin leg.
      return json({ ok: false, error: 'invalid or expired state' }, 400);
    }
    const firmId = consumed.firm_id as string;

    // ── Exchange the code ──────────────────────────────────────────────────
    // POST with a form body, not a query string: the app secret and the
    // resulting token stay out of URLs, and so out of access logs.
    const tokRes = await fetch(`${GRAPH}/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId, client_secret: appSecret,
        redirect_uri: redirectUri, code,
      }),
    });
    const tok = await tokRes.json();
    if (!tok.access_token) {
      console.error('token exchange failed:', tok?.error?.message ?? tokRes.status);
      return json({ ok: false, error: 'token exchange failed' }, 400);
    }

    const llRes = await fetch(`${GRAPH}/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'fb_exchange_token', client_id: appId,
        client_secret: appSecret, fb_exchange_token: tok.access_token,
      }),
    });
    const ll = await llRes.json();
    const accessToken: string = ll.access_token || tok.access_token;
    const expiresAt = ll.expires_in
      ? new Date(Date.now() + Number(ll.expires_in) * 1000).toISOString()
      : null;

    // ── Store it, and mean it ──────────────────────────────────────────────
    // A public wrapper around vault.create_secret, because .rpc() can only
    // reach PostgREST's exposed schema. The error is NOT swallowed — the whole
    // point of H7's last bullet is that the old `.catch(() => {})` meant a year
    // of nobody noticing the token was never stored.
    const { error: se } = await sb.rpc('meta_oauth_store_token', {
      p_firm_id: firmId, p_token: accessToken, p_expires_at: expiresAt,
    });
    if (se) {
      console.error('storing the Meta token failed:', se.code, se.message);
      return json({ ok: false, error: 'could not store the access token' }, 500);
    }

    // ── Discover ad accounts ───────────────────────────────────────────────
    // Bearer header, not ?access_token= — same reason as above.
    const actRes = await fetch(`${GRAPH}/me/adaccounts?fields=account_id,name,currency`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const acts = await actRes.json();
    if (!actRes.ok) {
      console.error('ad account discovery failed:', acts?.error?.message ?? actRes.status);
      return json({ ok: false, error: 'could not read ad accounts' }, 502);
    }

    const accounts = (acts.data ?? []).map((a: Record<string, unknown>) => ({
      external_account_id: String(a.account_id ?? ''),
      name: String(a.name ?? ''),
      currency: String(a.currency ?? 'INR'),
    }));

    // The firm comes from the consumed state. There is no longer any code path
    // in which a firm id can be typed by hand.
    const { data: linked, error: le } = await sb.rpc('meta_oauth_link_accounts', {
      p_firm_id: firmId, p_accounts: accounts,
    });
    if (le) {
      console.error('linking ad accounts failed:', le.code, le.message);
      return json({ ok: false, error: 'could not link the ad accounts' }, 500);
    }

    return json({ ok: true, connected: linked ?? 0 });
  } catch (e) {
    console.error('meta-oauth:', e instanceof Error ? e.stack : e);
    return json({ ok: false, error: 'internal error' }, 500);
  }
});
