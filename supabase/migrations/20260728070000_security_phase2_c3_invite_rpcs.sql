-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 2 — C3 fix-forward · invite RPCs
--
-- Phase 1 left user_invites with NO policy for any client role, deliberately:
-- `token` is a gen_random_bytes(32) bearer credential that exchanges for a
-- confirmed account, and it was previously readable AND writable by anon.
-- Closing it first was the right order (there were no live users), but it
-- knowingly broke two legitimate paths:
--
--   · AcceptInvitePage.tsx:26   pre-flight lookup of the invite
--   · UserManagementPage.tsx:387 invite creation
--
-- Both are restored here through narrow RPCs. user_invites keeps its deny-all
-- posture — neither function grants table access, and the token never travels
-- in either direction beyond the one the caller already holds.
--
-- Audit refs: C3.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · validate_invite ────────────────────────────────────────────────────
-- Returns ONLY what the accept screen needs to render: the email it is for,
-- and a status. Deliberately NOT returned: firm_id, role_id, invited_by, or
-- the token itself. A caller who holds the token learns nothing they did not
-- already have; a caller who guesses one learns only 'invalid'.
--
-- Every failure mode returns the same shape rather than raising, so the page
-- can render 'expired' / 'used' distinctly — those are states the legitimate
-- holder of a token is entitled to distinguish, and they leak nothing to
-- anyone else, since reaching them at all requires a valid 32-byte token.
create or replace function public.validate_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select email, full_name, expires_at, accepted_at
    into v
  from public.user_invites
  where token = p_token;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v.accepted_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if v.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  return jsonb_build_object(
    'status',    'valid',
    'email',     v.email,
    'full_name', v.full_name
  );
end $$;


-- ── 2 · create_invite ──────────────────────────────────────────────────────
-- Admin-checked, and firm-bound to the CALLER's firm rather than to a firm id
-- supplied by the client — that parameter was how UserManagementPage passed it
-- before, and it would have let any admin invite a user into someone else's
-- tenant. The generated token is returned once, to the admin who created it,
-- so the UI can build the invite link; it is never readable again.
create or replace function public.create_invite(
  p_email     text,
  p_full_name text,
  p_role_id   text default null
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
  v_token  text;
  v_id     uuid;
  v_exp    timestamptz;
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

  if exists (
    select 1 from public.profiles pr
    where pr.firm_id = v_firm and lower(pr.email) = v_email
  ) then
    raise exception 'that person is already a member of this firm'
      using errcode = '23505';
  end if;

  -- Re-inviting supersedes any outstanding invite for the same address, so a
  -- previously issued token cannot still be redeemed after a re-invite.
  delete from public.user_invites
   where firm_id = v_firm and lower(email) = v_email and accepted_at is null;

  insert into public.user_invites (firm_id, email, full_name, role_id, invited_by)
  values (v_firm, v_email, nullif(btrim(coalesce(p_full_name, '')), ''), p_role_id, v_pid)
  returning id, token, expires_at into v_id, v_token, v_exp;

  return jsonb_build_object(
    'id',         v_id,
    'email',      v_email,
    'token',      v_token,
    'expires_at', v_exp
  );
end $$;


-- ── 3 · revoke_invite ──────────────────────────────────────────────────────
-- Without this, an admin who mis-sends an invite has no way to withdraw it:
-- the table is deny-all, so there is no DELETE path from the client at all.
create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_firm uuid;
begin
  select pr.firm_id into v_firm
  from public.profiles pr where pr.auth_uid = auth.uid() limit 1;

  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.crm_actor_is_admin() then
    raise exception 'only an administrator may revoke invites' using errcode = '42501';
  end if;

  delete from public.user_invites
   where id = p_invite_id and firm_id = v_firm and accepted_at is null;
end $$;


-- ── 4 · list_invites ───────────────────────────────────────────────────────
-- The pending-invites list, WITHOUT tokens. This is the read that C3 closed;
-- it is restored minus the bearer credential that made it dangerous.
create or replace function public.list_invites()
returns table (
  id uuid, email text, full_name text, role_id text,
  expires_at timestamptz, accepted_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.email, i.full_name, i.role_id,
         i.expires_at, i.accepted_at, i.created_at
  from public.user_invites i
  join public.profiles pr
    on pr.auth_uid = auth.uid() and pr.firm_id = i.firm_id
  where public.crm_actor_is_admin()
  order by i.created_at desc;
$$;


-- ── 5 · Grants ─────────────────────────────────────────────────────────────
-- validate_invite is reachable without a session by design: the accept screen
-- runs before the user has an account. The others require one.
-- Phase 1 revoked the anon grants on every table but left `authenticated`
-- holding privileges on user_invites. RLS denies it today — the table has no
-- policy, and "RLS on, no policy" is deny-all — so this is not currently
-- exploitable. It is revoked anyway: with the grant in place, C3 depends
-- entirely on nobody ever adding a policy to this table, and the assertion at
-- the foot of this file would not catch it. The definer functions above are
-- unaffected; they execute as the function owner.
revoke all on table public.user_invites from authenticated, anon;

revoke all on function public.validate_invite(text)            from public, anon;
revoke all on function public.create_invite(text, text, text)   from public, anon;
revoke all on function public.revoke_invite(uuid)               from public, anon;
revoke all on function public.list_invites()                    from public, anon;

grant execute on function public.validate_invite(text)          to anon, authenticated;
grant execute on function public.create_invite(text, text, text) to authenticated;
grant execute on function public.revoke_invite(uuid)             to authenticated;
grant execute on function public.list_invites()                  to authenticated;


-- ── 6 · Assertions ─────────────────────────────────────────────────────────
-- user_invites must STILL be deny-all. These RPCs are definer functions; if a
-- policy ever reappears, C3 is reopened regardless of them.
do $$
declare p text;
begin
  select string_agg(policyname, ', ') into p
  from pg_policies where schemaname = 'public' and tablename = 'user_invites';
  if p is not null then
    raise exception 'C3: user_invites gained client policies: %', p;
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'user_invites'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'C3: user_invites is directly reachable by a client role';
  end if;
  raise notice 'C3 verified: user_invites remains deny-all; access only via RPC';
end $$;

-- anon's surface is now exactly three functions. Keep that list explicit so
-- adding a fourth is a deliberate act rather than an accident.
do $$
declare extra text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into extra
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where ns.nspname = 'public'
    and d.objid is null
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname not in ('quote_public_view', 'accept_quote', 'validate_invite');

  if extra is not null then
    raise exception 'C3: unexpected anon-executable functions: %', extra;
  end if;
  raise notice 'C3 verified: anon executes exactly quote_public_view, accept_quote, validate_invite';
end $$;
