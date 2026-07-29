// Deployed source as retrieved from the Supabase dashboard (project ref
// weckowkvqpamnlcqwvfh — production) on 29 Jul 2026 and committed VERBATIM.
// Do not "tidy" this file: audit C9 / W1c describe defects live in production
// exactly as written here.
//
// Audit C9 — FIRM_ID is hardcoded to the demo tenant. This is H3 surviving in
// a place H3 never looked: Phase 1 closed H3 by deleting demo-firm constants
// from the client, and this constant was invisible because the function was
// not in the repository. Every website enquiry from every customer's site is
// therefore written into firm 11111111-…, regardless of whose website sent it.
// For a multi-tenant product that is a tenant-isolation failure in the write
// direction: tenant B's prospects — name, email, phone, project requirements —
// become rows tenant A can read. The audit asked "can a caller write into an
// arbitrary firm_id"; the answer is that every caller writes into exactly one,
// and it is the wrong one for everybody except the demo firm.
//
// Audit W1c — additionally, and all unfixed:
//   · no authentication (by design, it is a public webhook) and no rate limit,
//     so the CRM's lead pipeline can be flooded by anyone with the URL, which
//     the admin UI publishes;
//   · no length bound on any field — client_name, project_requirements and the
//     rest are unbounded strings written straight to the database;
//   · no format validation on email or phone;
//   · PostgREST filter injection in the .or() below: `email` and `phone` are
//     interpolated raw into a filter expression whose delimiters are exactly
//     the characters an attacker controls. Because the response returns
//     `returning: !!contactId`, that yields a boolean oracle over the demo
//     firm's contact table — blind enumeration of stored contacts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Public website enquiry webhook → creates a CRM lead, matching returning customers.
const FIRM_ID = '11111111-1111-4111-8111-111111111111';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || body.full_name || '').trim();
    const email = (String(body.email || '').trim()) || null;
    const phone = (String(body.phone || '').trim()) || null;
    const project_type = String(body.project_type || body.project || 'Website enquiry').trim();
    const message = (String(body.message || body.requirements || '').trim()) || null;
    if (!name || (!email && !phone)) return json({ ok: false, error: 'name and (email or phone) required' }, 400);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // feature flag gate
    const { data: flag } = await sb.from('crm_feature_flags').select('enabled').eq('firm_id', FIRM_ID).eq('key', 'website_capture').maybeSingle();
    if (flag && flag.enabled === false) return json({ ok: false, error: 'website capture disabled' }, 403);

    // returning-customer match → reuse contact, else create
    let contactId: string | null = null;
    const ors: string[] = [];
    if (email) ors.push(`email.eq.${email}`);
    if (phone) ors.push(`phone.eq.${phone}`);
    if (ors.length) {
      const { data: existing } = await sb.from('crm_contacts').select('id').eq('firm_id', FIRM_ID).or(ors.join(',')).limit(1);
      if (existing && existing.length) contactId = existing[0].id;
    }
    if (!contactId) {
      const { data: c } = await sb.from('crm_contacts').insert({ id: crypto.randomUUID(), firm_id: FIRM_ID, full_name: name, email, phone }).select('id').single();
      contactId = c?.id ?? null;
    }

    // first active pipeline stage
    const { data: stage } = await sb.from('crm_pipeline_stages').select('key').eq('firm_id', FIRM_ID).eq('category', 'active').order('order_index').limit(1).maybeSingle();
    const status = stage?.key || 'new';

    const { data: lead, error } = await sb.from('crm_leads').insert({
      id: crypto.randomUUID(), firm_id: FIRM_ID, client_name: name, client_email: email, client_phone: phone,
      project_type, project_requirements: message, status, source: 'website', priority: 'medium',
      inquiry_date: new Date().toISOString().slice(0, 10), contact_id: contactId, created_by: 'website',
    }).select('id').single();
    if (error) throw error;

    return json({ ok: true, lead_id: lead.id, returning: !!contactId });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
