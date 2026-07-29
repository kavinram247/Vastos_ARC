// Public website enquiry webhook → creates a CRM lead.
//
// SECURITY (audit C9, W1c). The previous deployed version of this file
// hardcoded FIRM_ID to the demo tenant, so every enquiry from every customer's
// website landed in one firm's pipeline; and it interpolated the caller's
// `email` and `phone` straight into a PostgREST .or() filter, which gave an
// unauthenticated attacker a boolean oracle over crm_contacts. See
// supabase/migrations/20260729020000_security_phase3_c9_w1c_lead_intake.sql.
//
// This file is now deliberately almost empty. Identifying the firm, validating
// the fields, matching the returning customer and rate-limiting all happen
// inside lead_intake_capture(), in one transaction, with every value passed as
// a parameter. Logic that lives here is logic that can drift away from the
// database's guarantees — so it doesn't live here.
//
// The firm is identified by a per-firm bearer token, minted in Leads Admin and
// sent as X-Webhook-Token. The URL is the same for every customer; the token is
// what distinguishes them, and it is the authentication this endpoint has never
// had. Only its SHA-256 is stored.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// '*' is correct here: this endpoint is meant to be posted to from any
// customer's website, and the token — not the origin — is what authorizes.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-webhook-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

// A bad token and a disabled firm must look the same from outside, or the
// response becomes a probe for which tokens are live.
const STATUS_FOR: Record<string, number> = {
  '28000': 401, // unknown or revoked token
  '42501': 403, // website capture disabled for this firm
  '22023': 400, // validation
  '54000': 429, // rate limit
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  try {
    // Accept the token from a header, or from `Authorization: Bearer` for form
    // builders that only expose that one. Never from the body or the query
    // string, where it would be logged by every hop in between.
    const auth = req.headers.get('Authorization') || '';
    const token = req.headers.get('x-webhook-token')
      || (auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '');
    if (!token) return json({ ok: false, error: 'webhook token required' }, 401);

    const body = await req.json().catch(() => ({}));

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await sb.rpc('lead_intake_capture', {
      p_token: token,
      p_name: String(body.name || body.full_name || ''),
      p_email: body.email == null ? null : String(body.email),
      p_phone: body.phone == null ? null : String(body.phone),
      p_project_type: body.project_type == null && body.project == null
        ? null : String(body.project_type ?? body.project),
      p_message: body.message == null && body.requirements == null
        ? null : String(body.message ?? body.requirements),
    });

    if (error) {
      const status = STATUS_FOR[error.code ?? ''] ?? 500;
      if (status === 500) console.error('[lead-intake]', error.code, error.message);
      return json({ ok: false, error: status === 500 ? 'could not record enquiry' : error.message }, status);
    }

    // Returns the lead id only. The old response also said whether the contact
    // already existed, and that boolean was the oracle W1c read one character
    // at a time — it answers "is this person a customer of yours" for anyone
    // who can reach the endpoint.
    return json(data);
  } catch (e) {
    console.error('[lead-intake]', (e as Error)?.message || e);
    return json({ ok: false, error: 'internal error' }, 500);
  }
});
