// Deployed source as retrieved from the Supabase dashboard (project ref
// weckowkvqpamnlcqwvfh — production) on 29 Jul 2026 and committed VERBATIM.
// Do not "tidy" this file: audit H7 describes defects live in production
// exactly as written here.
//
// Audit H7 — latent rather than live: the function short-circuits with
// configured:false unless FB_APP_ID / FB_APP_SECRET / FB_REDIRECT_URI are set,
// and the app currently ships a mock connector. Everything below therefore
// arms the moment someone completes the Meta setup the UI invites them to.
//
//   · NO OAuth `state` PARAMETER, anywhere. The consent URL built below omits
//     it and the callback never validates one. That is textbook OAuth CSRF.
//   · The endpoint is unauthenticated and answers GET, so there is no binding
//     whatsoever between an OAuth flow and a CRM session. Anyone who presents
//     a ?code has it exchanged and the resulting ad accounts upserted into the
//     CRM — attacker-controlled ad accounts land in the firm's dashboard.
//   · FIRM_ID is hardcoded to the demo tenant, the same defect as C9, so every
//     firm's Meta connection would be written to firm 11111111-… .
//   · Token storage silently no-ops. supabase-js .rpc() issues
//     POST /rest/v1/rpc/<name>; PostgREST resolves that against its exposed
//     schema, where no function literally named `vault.create_secret` exists —
//     the vault schema is not exposed. The trailing `.catch(() => {})` then
//     swallows the failure, so the comment's promise that the token never
//     touches a client-readable table is kept only by accident: it is not
//     stored at all, and nothing reports that.
//   · The access token is passed in query strings to graph.facebook.com, where
//     it is liable to end up in logs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Meta OAuth callback (SCAFFOLD). Exchanges ?code for a long-lived token, stores it
// in Supabase Vault, and upserts a crm_ad_accounts row. Dormant until FB_APP_ID /
// FB_APP_SECRET are configured. Production should switch the app's mock connector
// to the live connector that calls meta-sync.
const FIRM_ID = '11111111-1111-4111-8111-111111111111';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const appId = Deno.env.get('FB_APP_ID');
  const appSecret = Deno.env.get('FB_APP_SECRET');
  const redirectUri = Deno.env.get('FB_REDIRECT_URI');
  if (!appId || !appSecret || !redirectUri) {
    return json({ ok: false, configured: false, error: 'Meta OAuth not configured. Set FB_APP_ID, FB_APP_SECRET, FB_REDIRECT_URI.' }, 200);
  }
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  // No code yet → return the consent URL the app should redirect to.
  if (!code) {
    const scope = 'ads_read,leads_retrieval,business_management';
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
    return json({ ok: true, configured: true, authUrl });
  }
  try {
    // Exchange code → short-lived token → long-lived token
    const tokRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`);
    const tok = await tokRes.json();
    if (!tok.access_token) return json({ ok: false, error: tok.error?.message || 'token exchange failed' }, 400);
    const llRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tok.access_token}`);
    const ll = await llRes.json();
    const accessToken = ll.access_token || tok.access_token;

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Store the token in Vault (never in a client-readable table).
    await sb.rpc('vault.create_secret', { secret: accessToken, name: `meta_token_${FIRM_ID}` }).catch(() => {});
    // Discover ad accounts and upsert.
    const actRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,currency&access_token=${accessToken}`);
    const acts = await actRes.json();
    for (const a of acts.data ?? []) {
      await sb.from('crm_ad_accounts').upsert({ firm_id: FIRM_ID, provider: 'meta', external_account_id: a.account_id, name: a.name, currency: a.currency || 'INR', status: 'connected', connected_by: 'meta-oauth' }, { onConflict: 'firm_id,provider,external_account_id' });
    }
    return json({ ok: true, connected: (acts.data ?? []).length });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
