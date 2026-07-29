// Deployed source as retrieved from the Supabase dashboard (project ref
// weckowkvqpamnlcqwvfh) on 29 Jul 2026 and committed VERBATIM, so that the
// audit has a fixed reference point. Do not "tidy" this file — audit W1a
// describes defects that are still live in production exactly as written here.
//
// Audit W1 — authorization reviewed and sound:
//   · the service-role key is read from the environment, not baked in, so
//     rotating it will not break invite acceptance;
//   · expires_at and accepted_at are both enforced server-side, not just in
//     the UI (validate_invite() is advisory — this is the function that mints
//     the account);
//   · firm_id comes from the invite row, never the request body;
//   · role_id is never read from the request, so C6 is not reopened here.
//
// Audit W1a — NOT sound, and unfixed at time of commit:
//   · both writes below discard their {error} and no rowcount is checked,
//     while the function returns {success:true} unconditionally. A profiles
//     UPDATE that matches zero rows yields a confirmed auth user, a burnt
//     invite, a success screen — and a permanently locked-out invitee;
//   · the accepted_at guard is check-then-act. The UPDATE is not conditional
//     on `accepted_at is null`; single-redemption is presently enforced by the
//     auth layer's unique-email constraint, i.e. by accident;
//   · no server-side password policy — AcceptInvitePage's 8-character rule is
//     decorative against a direct POST;
//   · raw error text is returned to an unauthenticated caller;
//   · Access-Control-Allow-Origin is '*' on a token-redemption endpoint.
//
// Note this function must be deployed with verify_jwt = false: the client
// sends no Authorization header (AcceptInvitePage.tsx).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { token, password } = await req.json()
    if (!token || !password) {
      return new Response(JSON.stringify({ error: 'Missing token or password' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Validate invite token
    const { data: invite, error: ie } = await supabase
      .from('user_invites')
      .select('id,firm_id,email,full_name,expires_at,accepted_at')
      .eq('token', token)
      .maybeSingle()

    if (ie || !invite) {
      return new Response(JSON.stringify({ error: 'invalid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (invite.accepted_at) {
      return new Response(JSON.stringify({ error: 'already_used' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'expired' }), {
        status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create auth user with confirmed email — admin API, NO email sent
    const { data: userData, error: ue } = await supabase.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: invite.full_name ?? invite.email.split('@')[0],
        firm_id: invite.firm_id,
      },
    })

    if (ue) {
      return new Response(JSON.stringify({ error: ue.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authUid = userData.user.id

    // Link auth_uid to the profiles row created by the admin when inviting
    await supabase
      .from('profiles')
      .update({ auth_uid: authUid })
      .eq('email', invite.email)
      .eq('firm_id', invite.firm_id)

    // Mark invite accepted
    await supabase
      .from('user_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
