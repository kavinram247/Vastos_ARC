-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 3 — W1a · invite redemption becomes an invariant, not a hope
--
-- accept-invite discarded the {error} from both of its writes, inspected no
-- rowcount, and returned {success:true} unconditionally. A profiles UPDATE
-- matching zero rows therefore produced: a confirmed auth user, a burnt invite
-- token, a success screen — and an invitee locked out permanently, because
-- current_firm_id() reads profiles.auth_uid and returns NULL without that row.
-- Re-inviting could not recover it either: the email is registered, so
-- auth.admin.createUser rejects the second attempt. Only manual database
-- surgery got the user back.
--
-- The redemption moves here, following C8 and C9: the invariant belongs in the
-- database, where it is a transaction, not in Deno control flow, where it was
-- three unrelated statements whose failures were discarded.
--
-- Also closed here, and the reason the redemption is split into claim/finalize
-- rather than one call: the accepted_at guard was check-then-act. The UPDATE
-- was not conditional on `accepted_at is null`, so single redemption held only
-- because the auth layer happened to reject a duplicate email. invite_claim()
-- makes the guard and the write one statement.
--
-- ── A functional regression found while reproducing W1a, fixed here ────────
-- C3 (20260728070000) made create_invite() refuse when a profiles row already
-- exists for the address. UserManagementPage.handleCreate INSERTS exactly such
-- a row one step earlier — the placeholder that accept-invite later links an
-- auth_uid into. So create_invite() raised 23505 'that person is already a
-- member of this firm' on EVERY invite, and the feature has been completely
-- broken since Phase 2. Verified from a clean slate against the local stack.
--
-- The guard is not deleted — re-inviting somebody who really is a member is
-- still refused. It now tests for an ACTIVATED member (auth_uid is not null)
-- rather than for the placeholder that the invite flow itself creates. And
-- create_invite() now writes that placeholder itself, in the same transaction
-- as the invite row, so the ordering trap cannot come back: the client no
-- longer performs three separate unguarded writes that can partially fail.
--
-- Audit refs: W1a; regression from C3.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · create_invite ──────────────────────────────────────────────────────
-- Supersedes the C3 version. Same authorization (admin, caller's own firm,
-- role must belong to that firm), same single-use token return; what changes
-- is that the placeholder profiles / crm_profiles rows are created here
-- instead of by the browser, and the membership guard no longer trips on them.
-- Replaced rather than redefined: the placeholder rows carry the phone number
-- the form collects, so the signature gains a parameter and the C3-era
-- three-argument function must not linger as an overload PostgREST could
-- resolve ambiguously.
drop function if exists public.create_invite(text, text, text);

create or replace function public.create_invite(
  p_email     text,
  p_full_name text,
  p_role_id   text default null,
  p_phone     text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_firm   uuid;
  v_pid    uuid;
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_name   text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_phone  text := nullif(btrim(coalesce(p_phone, '')), '');
  v_token  text;
  v_id     uuid;
  v_exp    timestamptz;
  v_role   public.user_role;
begin
  select pr.firm_id, pr.id into v_firm, v_pid
  from public.profiles pr
  where pr.auth_uid = auth.uid()
  limit 1;

  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not public.crm_actor_is_admin() then
    raise exception 'only an administrator may invite users'
      using errcode = '42501';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email address is required' using errcode = '22023';
  end if;

  -- The role must belong to the caller's own firm, or an admin could mint an
  -- invite carrying another tenant's role id.
  if p_role_id is not null and not exists (
    select 1 from public.crm_roles r
    where r.id = p_role_id and r.firm_id = v_firm and r.enabled
  ) then
    raise exception 'unknown role for this firm' using errcode = '22023';
  end if;

  -- ACTIVATED members only. A profiles row with auth_uid IS NULL is the
  -- placeholder this function creates below; treating it as membership is what
  -- broke the flow after C3.
  if exists (
    select 1 from public.profiles pr
    where pr.firm_id = v_firm
      and lower(pr.email) = v_email
      and pr.auth_uid is not null
  ) then
    raise exception 'that person is already a member of this firm'
      using errcode = '23505';
  end if;

  -- Re-inviting supersedes any outstanding invite for the same address, so a
  -- previously issued token cannot still be redeemed after a re-invite.
  delete from public.user_invites
   where firm_id = v_firm and lower(email) = v_email and accepted_at is null;

  -- The legacy enum column mirrors the RBAC role where the two overlap, and
  -- otherwise falls back to the least-privileged value. Never read from the
  -- request (C6): it is derived from a role id already proven to be this
  -- firm's.
  select case
           when r.key in ('owner', 'architect', 'engineer', 'client')
             then r.key::public.user_role
           else 'engineer'::public.user_role
         end
    into v_role
  from public.crm_roles r
  where r.id = p_role_id and r.firm_id = v_firm;
  v_role := coalesce(v_role, 'engineer'::public.user_role);

  -- Placeholder identity rows. auth_uid stays NULL until redemption links it,
  -- which is precisely what marks this as "invited but not yet activated".
  insert into public.profiles (firm_id, email, full_name, role, phone)
  values (v_firm, v_email, coalesce(v_name, split_part(v_email, '@', 1)), v_role, v_phone)
  on conflict (firm_id, email) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role      = excluded.role,
        phone     = coalesce(excluded.phone, public.profiles.phone);

  insert into public.crm_profiles (id, firm_id, email, full_name, role, role_id, phone)
  values (gen_random_uuid()::text, v_firm, v_email,
          coalesce(v_name, split_part(v_email, '@', 1)), v_role::text, p_role_id, v_phone)
  on conflict (firm_id, lower(email)) do update
    set role_id   = excluded.role_id,
        role      = excluded.role,
        full_name = coalesce(excluded.full_name, public.crm_profiles.full_name),
        phone     = coalesce(excluded.phone, public.crm_profiles.phone);

  insert into public.user_invites (firm_id, email, full_name, role_id, invited_by)
  values (v_firm, v_email, v_name, p_role_id, v_pid)
  returning id, token, expires_at into v_id, v_token, v_exp;

  return jsonb_build_object(
    'id',         v_id,
    'email',      v_email,
    'token',      v_token,
    'expires_at', v_exp
  );
end $$;


-- ── 2 · invite_claim ───────────────────────────────────────────────────────
-- Step one of redemption, and the fix for the check-then-act guard. The token
-- is spent by the same statement that validates it: `where accepted_at is null
-- and expires_at > now()` on the UPDATE itself. Two concurrent redemptions of
-- one token cannot both pass, whatever the auth layer does or does not do.
--
-- Claiming BEFORE the auth user is created is deliberate. The reverse order
-- leaves a created account behind whenever the claim then fails; this order's
-- only failure mode is a claimed-but-unfinalized invite, which invite_release()
-- below hands back.
--
-- Reachable only by service_role — the edge function — never from a browser.
create or replace function public.invite_claim(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v      record;
  v_prev record;
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.user_invites i
     set accepted_at = now()
   where i.token = p_token
     and i.accepted_at is null
     and i.expires_at > now()
  returning i.id, i.firm_id, i.email, i.full_name, i.role_id into v;

  if found then
    return jsonb_build_object(
      'status',    'claimed',
      'invite_id', v.id,
      'firm_id',   v.firm_id,
      'email',     v.email,
      'full_name', v.full_name,
      'role_id',   v.role_id
    );
  end if;

  -- Nothing was claimed. Say why — but only to a caller already holding a
  -- 32-byte token, so this distinguishes states for the legitimate invitee
  -- and tells a guesser nothing beyond 'invalid'.
  select accepted_at into v_prev from public.user_invites where token = p_token;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_prev.accepted_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  return jsonb_build_object('status', 'expired');
end $$;


-- ── 3 · invite_finalize ────────────────────────────────────────────────────
-- Step two: bind the freshly created auth identity to the firm. Everything
-- W1a discarded is checked here, and every failure raises instead of being
-- summarised as success.
create or replace function public.invite_finalize(
  p_invite_id uuid,
  p_auth_uid  uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv  record;
  v_pid  uuid;
  v_role public.user_role;
  v_n    integer;
begin
  if p_auth_uid is null then
    raise exception 'an auth uid is required' using errcode = '22023';
  end if;

  select id, firm_id, email, full_name, role_id, accepted_at
    into v_inv
  from public.user_invites
  where id = p_invite_id;

  if not found then
    raise exception 'unknown invite' using errcode = '22023';
  end if;
  if v_inv.accepted_at is null then
    raise exception 'invite was never claimed' using errcode = '22023';
  end if;

  -- One auth identity, one profile. Without this an invite could re-point an
  -- existing user's identity at a second firm.
  if exists (
    select 1 from public.profiles pr
    where pr.auth_uid = p_auth_uid
      and not (pr.firm_id = v_inv.firm_id and lower(pr.email) = lower(v_inv.email))
  ) then
    raise exception 'that identity is already linked to another profile'
      using errcode = '23505';
  end if;

  select case
           when r.key in ('owner', 'architect', 'engineer', 'client')
             then r.key::public.user_role
           else 'engineer'::public.user_role
         end
    into v_role
  from public.crm_roles r
  where r.id = v_inv.role_id and r.firm_id = v_inv.firm_id;
  v_role := coalesce(v_role, 'engineer'::public.user_role);

  -- The write W1a never checked. UPSERT rather than UPDATE, so a missing
  -- placeholder — the exact condition that locked people out — is repaired
  -- rather than silently matching zero rows.
  insert into public.profiles (firm_id, email, full_name, role, auth_uid)
  values (v_inv.firm_id, v_inv.email,
          coalesce(v_inv.full_name, split_part(v_inv.email, '@', 1)),
          v_role, p_auth_uid)
  on conflict (firm_id, email) do update
    set auth_uid  = excluded.auth_uid,
        full_name = coalesce(public.profiles.full_name, excluded.full_name)
  returning id into v_pid;

  get diagnostics v_n = row_count;
  if v_n <> 1 or v_pid is null then
    raise exception 'linking the invite to a profile affected % row(s)', v_n
      using errcode = '25000';
  end if;

  -- The RBAC row. Also upserted, for the same reason.
  insert into public.crm_profiles (id, firm_id, email, full_name, role, role_id)
  values (gen_random_uuid()::text, v_inv.firm_id, v_inv.email,
          coalesce(v_inv.full_name, split_part(v_inv.email, '@', 1)),
          v_role::text, v_inv.role_id)
  on conflict (firm_id, lower(email)) do update
    set role_id = coalesce(excluded.role_id, public.crm_profiles.role_id);

  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'linking the invite to an RBAC profile affected % row(s)', v_n
      using errcode = '25000';
  end if;

  -- Belt and braces: prove the account can actually resolve its firm before
  -- telling anyone the redemption succeeded. This is the precise condition
  -- W1a left unverified.
  if not exists (
    select 1 from public.profiles pr
    where pr.auth_uid = p_auth_uid and pr.firm_id = v_inv.firm_id
  ) then
    raise exception 'redemption did not produce a usable profile'
      using errcode = '25000';
  end if;

  return jsonb_build_object(
    'profile_id', v_pid,
    'firm_id',    v_inv.firm_id,
    'email',      v_inv.email
  );
end $$;


-- ── 4 · invite_release ─────────────────────────────────────────────────────
-- Compensation. GoTrue's admin API is not in this transaction, so the edge
-- function can still fail between claim and finalize; when it does it deletes
-- the auth user it created and calls this, and the invitee's link keeps
-- working. Burning a token on a redemption that did not complete is the whole
-- of W1a's damage, so handing it back is the point.
create or replace function public.invite_release(p_invite_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.user_invites
     set accepted_at = null
   where id = p_invite_id
     and accepted_at is not null
     -- Never resurrect an invite whose account really was activated.
     and not exists (
       select 1 from public.profiles pr
       join public.user_invites i2 on i2.id = p_invite_id
       where pr.firm_id = i2.firm_id
         and lower(pr.email) = lower(i2.email)
         and pr.auth_uid is not null
     );
end $$;


-- ── 5 · Grants ─────────────────────────────────────────────────────────────
-- The three redemption functions are service_role only: they are the edge
-- function's private interface and must never be reachable from a browser.
-- Note this deliberately keeps anon's executable surface at exactly the three
-- functions C3's assertion pins, so that assertion still holds.
revoke all on function public.create_invite(text, text, text, text) from public, anon;
revoke all on function public.invite_claim(text)                from public, anon, authenticated;
revoke all on function public.invite_finalize(uuid, uuid)       from public, anon, authenticated;
revoke all on function public.invite_release(uuid)              from public, anon, authenticated;

grant execute on function public.create_invite(text, text, text, text) to authenticated;
grant execute on function public.invite_claim(text)              to service_role;
grant execute on function public.invite_finalize(uuid, uuid)     to service_role;
grant execute on function public.invite_release(uuid)            to service_role;


-- ── 6 · Assertions ─────────────────────────────────────────────────────────
do $$
declare v_bad text;
begin
  -- The redemption path must not be callable by a client role.
  select string_agg(p.proname || '/' || g.rolname, ', ') into v_bad
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  cross join (select unnest(array['anon', 'authenticated']) as rolname) g
  where ns.nspname = 'public'
    and p.proname in ('invite_claim', 'invite_finalize', 'invite_release')
    and has_function_privilege(g.rolname, p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'W1a: redemption RPCs reachable by a client role: %', v_bad;
  end if;

  -- user_invites stays deny-all (C3). The RPCs are definers; a policy here
  -- would reopen C3 regardless of them.
  if exists (select 1 from pg_policies
             where schemaname = 'public' and tablename = 'user_invites') then
    raise exception 'W1a: user_invites gained a client policy';
  end if;

  raise notice 'W1a verified: redemption RPCs are service_role-only; user_invites deny-all';
end $$;

-- The claim must be a single conditional statement, not a check followed by a
-- write. Strip -- comments before matching so this cannot be satisfied by the
-- prose above it.
do $$
declare src text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
    into src
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'invite_claim';

  if src !~* 'update\s+public\.user_invites.*accepted_at\s+is\s+null' then
    raise exception 'W1a: invite_claim no longer claims conditionally — '
                    'check-then-act has returned';
  end if;
  raise notice 'W1a verified: invite_claim spends the token in one conditional statement';
end $$;

-- The C3 regression: an admin must be able to invite somebody who has a
-- placeholder profile but has never activated. Exercised for real, then rolled
-- back, so a fresh database proves the flow rather than asserting about text.
do $$
declare
  v_firm  uuid;
  v_admin uuid;
  v_res   jsonb;
begin
  select id into v_firm from public.firms limit 1;
  if v_firm is null then
    raise notice 'W1a: no firm present, skipping create_invite rehearsal';
    return;
  end if;

  insert into public.profiles (firm_id, email, full_name, role, auth_uid)
  values (v_firm, 'w1a-assert-admin@invalid.test', 'Assertion Admin', 'owner',
          '00000000-0000-4000-8000-0000000000a1')
  on conflict (firm_id, email) do update set auth_uid = excluded.auth_uid
  returning id into v_admin;

  -- Impersonate that admin for the duration of the rehearsal.
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-0000000000a1')::text, true);

  v_res := public.create_invite('w1a-assert-invitee@invalid.test', 'Assertion Invitee', null, null);
  if v_res->>'token' is null then
    raise exception 'W1a: create_invite returned no token';
  end if;

  -- ...and again, now that the placeholder profiles row exists. This is the
  -- exact call that raised 23505 after C3.
  v_res := public.create_invite('w1a-assert-invitee@invalid.test', 'Assertion Invitee', null, null);
  if v_res->>'token' is null then
    raise exception 'W1a: re-inviting an unactivated placeholder still fails';
  end if;

  perform set_config('request.jwt.claims', null, true);

  delete from public.user_invites where email like 'w1a-assert-%@invalid.test';
  delete from public.crm_profiles  where email like 'w1a-assert-%@invalid.test';
  delete from public.profiles      where email like 'w1a-assert-%@invalid.test';

  raise notice 'W1a verified: create_invite works against its own placeholder (C3 regression closed)';
end $$;
