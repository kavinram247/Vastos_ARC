// Invite redemption. Rewritten to close audit W1a.
//
// What W1a was: both writes discarded their {error}, no rowcount was ever
// inspected, and {success:true} returned unconditionally. A profiles UPDATE
// matching zero rows produced a confirmed auth user, a burnt invite token, a
// success screen — and an invitee locked out for good, because current_firm_id()
// reads profiles.auth_uid and resolves NULL without that row. Re-inviting could
// not fix it either: the address was registered, so createUser refused.
//
// The redemption itself now lives in the database (invite_claim →
// invite_finalize → invite_release), following C8 and C9. This file is reduced
// to what genuinely cannot go in a transaction — GoTrue's admin API — plus the
// compensation for it, because GoTrue is not in that transaction and so this
// function can still fail between the two halves:
//
//   claim (spends the token atomically)
//     → createUser        · failure ⇒ release the token, nothing else happened
//       → finalize        · failure ⇒ delete the user, release the token
//         → success       · only now, and only because finalize proved the
//                           profile resolves to a firm
//
// Also closed here, from the same finding:
//   · the accepted_at guard was check-then-act — invite_claim() now makes the
//     guard and the write one statement, so single redemption no longer rests
//     on the auth layer happening to reject a duplicate email;
//   · there was no server-side password policy, leaving AcceptInvitePage's
//     8-character rule decorative against a direct POST;
//   · raw ue.message / err.message went back to an unauthenticated caller —
//     replies are now fixed codes, with detail kept in the function log;
//   · Access-Control-Allow-Origin was '*' on a token-redemption endpoint — it
//     is now an allow-list read from ALLOWED_ORIGINS.
//
// Deployment: verify_jwt = false. The caller is redeeming an invite and by
// definition has no session yet. ALLOWED_ORIGINS must be set to the app's
// origin(s), comma-separated, or browsers will be refused.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((o) => o.trim()).filter(Boolean)

// An Origin we do not know gets no CORS headers, so the browser refuses the
// response. Requests with no Origin at all (curl, server-to-server) are not
// a CORS concern and are left alone.
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  const base = {
    'Access-Control-Allow-Headers': 'x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (!origin) return base
  if (ALLOWED_ORIGINS.includes(origin)) {
    return { ...base, 'Access-Control-Allow-Origin': origin }
  }
  return base
}

// Fixed codes only. The client maps these to copy; nothing derived from an
// internal error reaches an unauthenticated caller.
type Code =
  | 'invalid' | 'already_used' | 'expired' | 'bad_request'
  | 'weak_password' | 'email_registered' | 'server_error'

function reply(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })
}
const fail = (req: Request, status: number, error: Code) => reply(req, status, { error })

// Server-side password policy. AcceptInvitePage enforces the same rule for the
// error message, but this is the one that counts — the page is not in the trust
// boundary and a direct POST skips it entirely.
const MIN_PASSWORD = 10
const MAX_PASSWORD = 200
function passwordRejected(password: string, email: string): string | null {
  if (typeof password !== 'string') return 'not a string'
  if (password.length < MIN_PASSWORD) return `shorter than ${MIN_PASSWORD}`
  if (password.length > MAX_PASSWORD) return `longer than ${MAX_PASSWORD}`
  if (/^(.)\1+$/.test(password)) return 'a single repeated character'
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  const lower = password.toLowerCase()
  if (local.length >= 3 && lower.includes(local)) return 'contains the email name'
  if (['password', 'qwerty', '1234567890', 'letmein'].some((w) => lower.includes(w))) {
    return 'contains a common word'
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(req) })
  if (req.method !== 'POST') return fail(req, 405, 'bad_request')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let inviteId: string | null = null
  try {
    let body: { token?: unknown; password?: unknown }
    try {
      body = await req.json()
    } catch {
      return fail(req, 400, 'bad_request')
    }
    const token = typeof body.token === 'string' ? body.token : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!token || !password) return fail(req, 400, 'bad_request')

    // ── 1 · spend the token ────────────────────────────────────────────────
    // Atomic: the invite is validated and marked accepted by one statement.
    const { data: claim, error: ce } = await supabase.rpc('invite_claim', { p_token: token })
    if (ce) {
      console.error('invite_claim failed:', ce.message)
      return fail(req, 500, 'server_error')
    }
    switch (claim?.status) {
      case 'claimed': break
      case 'used':    return fail(req, 409, 'already_used')
      case 'expired': return fail(req, 410, 'expired')
      default:        return fail(req, 400, 'invalid')
    }
    inviteId = claim.invite_id as string
    const email = claim.email as string

    // Checked only after the token proves valid, so this is not an oracle for
    // guessing tokens, and the invitee sees the rule rather than a generic 400.
    const why = passwordRejected(password, email)
    if (why) {
      await supabase.rpc('invite_release', { p_invite_id: inviteId })
      inviteId = null
      return reply(req, 400, { error: 'weak_password' as Code, min: MIN_PASSWORD })
    }

    // ── 2 · create the auth identity ───────────────────────────────────────
    const { data: userData, error: ue } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: claim.full_name ?? email.split('@')[0],
        firm_id: claim.firm_id,
      },
    })

    let authUid = userData?.user?.id ?? null

    if (ue) {
      // The address may already be registered — including as the orphan that
      // W1a itself produced: a confirmed account with no profile linked to it.
      // That user is stranded and cannot be recovered by re-inviting, so adopt
      // it here rather than making an operator do database surgery.
      //
      // Strictly an orphan: if ANY profile already points at that identity it
      // is a live account, and resetting its password from an unauthenticated
      // endpoint would be a takeover. invite_finalize re-checks this too.
      const orphan = await adoptableOrphan(supabase, email)
      if (!orphan) {
        console.error('createUser failed:', ue.message)
        await supabase.rpc('invite_release', { p_invite_id: inviteId })
        inviteId = null
        return fail(req, 409, 'email_registered')
      }
      const { error: pe } = await supabase.auth.admin.updateUserById(orphan, {
        password, email_confirm: true,
      })
      if (pe) {
        console.error('adopting orphaned auth user failed:', pe.message)
        await supabase.rpc('invite_release', { p_invite_id: inviteId })
        inviteId = null
        return fail(req, 409, 'email_registered')
      }
      authUid = orphan
      console.log('adopted orphaned auth user for', email)
    }

    if (!authUid) {
      console.error('no auth uid after createUser')
      await supabase.rpc('invite_release', { p_invite_id: inviteId })
      inviteId = null
      return fail(req, 500, 'server_error')
    }

    // ── 3 · bind the identity to the firm ──────────────────────────────────
    // This is the write W1a discarded. It raises on a zero rowcount and proves
    // the profile resolves before anything reports success.
    const { error: fe } = await supabase.rpc('invite_finalize', {
      p_invite_id: inviteId,
      p_auth_uid: authUid,
    })

    if (fe) {
      // Undo everything. A locked-out invitee was the whole of W1a's damage,
      // so leaving a half-redeemed state behind is not an option.
      console.error('invite_finalize failed, rolling back:', fe.message)
      if (!ue) {
        const { error: de } = await supabase.auth.admin.deleteUser(authUid)
        if (de) console.error('could not delete auth user after rollback:', de.message)
      }
      await supabase.rpc('invite_release', { p_invite_id: inviteId })
      inviteId = null
      return fail(req, 500, 'server_error')
    }

    inviteId = null
    return reply(req, 200, { success: true })
  } catch (err: unknown) {
    console.error('accept-invite:', err instanceof Error ? err.stack : err)
    // Never strand a token because of an unexpected throw.
    if (inviteId) {
      try { await supabase.rpc('invite_release', { p_invite_id: inviteId }) } catch { /* logged above */ }
    }
    return fail(req, 500, 'server_error')
  }
})

// Returns the auth uid for `email` only when no profile is linked to it — the
// signature of a redemption that died half-way. Anything else returns null and
// the caller reports email_registered.
async function adoptableOrphan(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) { console.error('listUsers failed:', error.message); return null }
    const want = email.toLowerCase()
    const user = data.users.find((u) => (u.email ?? '').toLowerCase() === want)
    if (!user) return null

    const { data: linked, error: pe } = await supabase
      .from('profiles').select('id').eq('auth_uid', user.id).limit(1)
    if (pe) { console.error('orphan profile lookup failed:', pe.message); return null }
    return (linked?.length ?? 0) === 0 ? user.id : null
  } catch (e) {
    console.error('orphan check threw:', e instanceof Error ? e.message : e)
    return null
  }
}
