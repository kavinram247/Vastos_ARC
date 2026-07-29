-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 3 — H7 · meta-oauth gets a state parameter, a real firm, and
--                          token storage that actually stores
--
-- The deployed function had no OAuth `state` anywhere: the consent URL omitted
-- it and the callback validated none. It was unauthenticated and answered GET,
-- so nothing bound an OAuth flow to a CRM session — anyone who presented a
-- ?code had it exchanged and the resulting ad accounts upserted. Textbook
-- OAuth CSRF, with attacker-controlled ad accounts landing in a firm's
-- dashboard.
--
-- It also still carried the hardcoded FIRM_ID = '11111111-…'. C9 removed that
-- from lead-intake; this is the other half, and the reason every firm's Meta
-- connection would have been written to the demo tenant.
--
-- And its token storage silently did nothing. `.rpc('vault.create_secret')`
-- issues POST /rest/v1/rpc/vault.create_secret, which PostgREST resolves
-- against its exposed schema as public."vault.create_secret" — 404 PGRST202,
-- verified — and the trailing `.catch(() => {})` swallowed it. The comment's
-- promise that the token never touches a client-readable table was kept only
-- by accident: it was not stored at all, and nothing said so.
--
-- The shape here is the one C8 and C9 established. The browser names nothing
-- that matters: the firm is recovered from the consumed state row, never from
-- the request. The two legs split by trust:
--
--   begin     authenticated, needs marketing:edit and the comm_meta flag.
--             Mints the state and returns the consent URL.
--   callback  necessarily unauthenticated — Meta redirects a browser to it —
--             and therefore carries NO authority of its own. The state is the
--             only thing that grants it a firm, it is single-use, and it
--             expires in ten minutes.
--
-- Audit refs: H7; C9 (second half).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · State store ────────────────────────────────────────────────────────
-- Only the SHA-256 is kept, as with C9's webhook tokens: the plaintext travels
-- to Meta and back through a browser, so a database read must not yield
-- something replayable. No policy and no grants — this table is reachable only
-- through the definer functions below.
create table if not exists public.crm_oauth_states (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  actor_email  text not null,
  provider     text not null default 'meta',
  state_hash   text not null unique,
  redirect_uri text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '10 minutes',
  consumed_at  timestamptz
);

alter table public.crm_oauth_states enable row level security;
revoke all on public.crm_oauth_states from anon, authenticated, public;

create index if not exists crm_oauth_states_expiry_idx
  on public.crm_oauth_states (expires_at) where consumed_at is null;


-- ── 2 · Token store ────────────────────────────────────────────────────────
-- The access token itself goes to Supabase Vault. This table records only
-- WHICH vault secret belongs to which firm, so nothing here is a credential.
create table if not exists public.crm_oauth_tokens (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  provider    text not null default 'meta',
  secret_id   uuid not null,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (firm_id, provider)
);

alter table public.crm_oauth_tokens enable row level security;
revoke all on public.crm_oauth_tokens from anon, authenticated, public;


-- ── 3 · Hash helper ────────────────────────────────────────────────────────
-- pgcrypto lives in the extensions schema, so digest() must be qualified —
-- these functions pin search_path = ''.
create or replace function public.crm_oauth_state_hash(p_state text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_state, 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function public.crm_oauth_state_hash(text) from public, anon, authenticated;


-- ── 4 · meta_oauth_begin ───────────────────────────────────────────────────
-- The authenticated leg, and the whole of the CSRF fix: a flow cannot start
-- without a CRM session that holds marketing:edit in a firm whose comm_meta
-- flag is on. The state it returns is what later grants the callback a firm.
create or replace function public.meta_oauth_begin(p_redirect_uri text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_firm  uuid;
  v_email text;
  v_state text;
begin
  select pr.firm_id, pr.email into v_firm, v_email
  from public.profiles pr
  where pr.auth_uid = auth.uid()
  limit 1;

  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not public.crm_has_permission('marketing', 'edit') then
    raise exception 'you do not have permission to connect an ad account'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.crm_feature_flags f
    where f.firm_id = v_firm and f.key = 'comm_meta' and f.enabled
  ) then
    raise exception 'the Meta integration is not enabled for this firm'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_redirect_uri), '') = '' then
    raise exception 'a redirect uri is required' using errcode = '22023';
  end if;

  -- Housekeeping: nothing expired needs keeping, and this table has no other
  -- reaper.
  delete from public.crm_oauth_states
   where expires_at < now() - interval '1 day';

  -- One flow in flight per firm. A second begin supersedes the first, so a
  -- state minted and abandoned cannot be replayed later.
  delete from public.crm_oauth_states
   where firm_id = v_firm and provider = 'meta' and consumed_at is null;

  v_state := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.crm_oauth_states (firm_id, actor_email, provider, state_hash, redirect_uri)
  values (v_firm, v_email, 'meta', public.crm_oauth_state_hash(v_state), btrim(p_redirect_uri));

  -- The plaintext state is returned exactly once, to the session that proved
  -- it may connect an ad account. There is no read path back to it.
  return jsonb_build_object('state', v_state, 'firm_id', v_firm);
end $$;


-- ── 5 · meta_oauth_consume ─────────────────────────────────────────────────
-- The callback's only source of authority. Single statement, as with
-- invite_claim: the state is validated and spent together, so a replayed
-- callback cannot race a live one.
create or replace function public.meta_oauth_consume(p_state text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v record;
begin
  if p_state is null or length(p_state) < 32 then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.crm_oauth_states s
     set consumed_at = now()
   where s.state_hash = public.crm_oauth_state_hash(p_state)
     and s.provider = 'meta'
     and s.consumed_at is null
     and s.expires_at > now()
  returning s.firm_id, s.redirect_uri into v;

  if not found then
    -- Deliberately undifferentiated. Unlike an invite token, nobody is
    -- entitled to learn whether a state was wrong, spent or stale: the only
    -- party who should ever present one is Meta, redirecting a browser that
    -- just came from meta_oauth_begin.
    return jsonb_build_object('status', 'invalid');
  end if;

  return jsonb_build_object(
    'status',       'ok',
    'firm_id',      v.firm_id,
    'redirect_uri', v.redirect_uri
  );
end $$;


-- ── 6 · meta_oauth_store_token ─────────────────────────────────────────────
-- What the deployed function believed it was doing. supabase-js .rpc() can
-- only reach PostgREST's exposed schema, so `vault.create_secret` was never
-- callable from there; wrapping it in a public definer function makes the
-- vault reachable without exposing the vault schema itself. Failures raise —
-- the old `.catch(() => {})` is exactly how nobody noticed.
create or replace function public.meta_oauth_store_token(
  p_firm_id    uuid,
  p_token      text,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_existing  uuid;
  v_name      text;
begin
  if p_firm_id is null then
    raise exception 'a firm is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_token), '') = '' then
    raise exception 'an access token is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.firms f where f.id = p_firm_id) then
    raise exception 'unknown firm' using errcode = '22023';
  end if;

  -- Vault secret names are global, so scope by firm.
  v_name := 'meta_token_' || p_firm_id::text;

  -- Resolve against the VAULT, not against the bookkeeping table below.
  -- vault.secrets.name is unique, so keying off crm_oauth_tokens alone means a
  -- firm that reconnects — token expired, permissions re-granted, row cleaned
  -- up — hits a unique violation and can never connect again. Reconnecting is
  -- the normal case for OAuth, not an edge case.
  select s.id into v_existing from vault.secrets s where s.name = v_name;

  if v_existing is not null then
    perform vault.update_secret(v_existing, p_token);
    v_secret_id := v_existing;
  else
    v_secret_id := vault.create_secret(p_token, v_name,
                     'Meta long-lived access token for firm ' || p_firm_id::text);
  end if;

  if v_secret_id is null then
    raise exception 'the access token was not stored' using errcode = '25000';
  end if;

  insert into public.crm_oauth_tokens (firm_id, provider, secret_id, expires_at)
  values (p_firm_id, 'meta', v_secret_id, p_expires_at)
  on conflict (firm_id, provider) do update
    set secret_id  = excluded.secret_id,
        expires_at = excluded.expires_at,
        updated_at = now();

  -- Never return the secret, only its handle.
  return jsonb_build_object('secret_id', v_secret_id);
end $$;


-- ── 7 · meta_oauth_link_accounts ───────────────────────────────────────────
-- The upsert, with the firm supplied by the caller's consumed state rather
-- than by a constant. Doing it here rather than through PostgREST is the point:
-- there is no code path left in which a firm id can be typed by hand.
create or replace function public.meta_oauth_link_accounts(
  p_firm_id  uuid,
  p_accounts jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a jsonb;
  n integer := 0;
begin
  if p_firm_id is null then
    raise exception 'a firm is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.firms f where f.id = p_firm_id) then
    raise exception 'unknown firm' using errcode = '22023';
  end if;
  if p_accounts is null or jsonb_typeof(p_accounts) <> 'array' then
    raise exception 'accounts must be a json array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_accounts) > 200 then
    raise exception 'too many accounts' using errcode = '22023';
  end if;

  for a in select * from jsonb_array_elements(p_accounts) loop
    if coalesce(btrim(a->>'external_account_id'), '') = '' then
      continue;
    end if;

    insert into public.crm_ad_accounts (
      firm_id, provider, external_account_id, name, currency, status, connected_by
    ) values (
      p_firm_id, 'meta',
      left(a->>'external_account_id', 128),
      left(coalesce(nullif(btrim(a->>'name'), ''), 'Meta ad account'), 200),
      left(coalesce(nullif(btrim(a->>'currency'), ''), 'INR'), 8),
      'connected', 'meta-oauth'
    )
    on conflict (firm_id, provider, external_account_id) do update
      set name       = excluded.name,
          currency   = excluded.currency,
          status     = 'connected',
          updated_at = now();
    n := n + 1;
  end loop;

  return n;
end $$;


-- ── 8 · Grants ─────────────────────────────────────────────────────────────
-- begin is the only leg a browser may reach, and only with a session.
-- Everything the callback touches is service_role — the edge function's
-- private interface. anon's executable surface is unchanged, so C3's
-- assertion still holds.
revoke all on function public.meta_oauth_begin(text)                        from public, anon;
revoke all on function public.meta_oauth_consume(text)                      from public, anon, authenticated;
revoke all on function public.meta_oauth_store_token(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.meta_oauth_link_accounts(uuid, jsonb)         from public, anon, authenticated;

grant execute on function public.meta_oauth_begin(text)                        to authenticated;
grant execute on function public.meta_oauth_consume(text)                      to service_role;
grant execute on function public.meta_oauth_store_token(uuid, text, timestamptz) to service_role;
grant execute on function public.meta_oauth_link_accounts(uuid, jsonb)         to service_role;


-- ── 9 · Assertions ─────────────────────────────────────────────────────────
do $$
declare v_bad text;
begin
  -- Neither state nor token store may be reachable by a client role, and
  -- neither may carry a policy that would make RLS permissive.
  select string_agg(table_name || '/' || grantee, ', ') into v_bad
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('crm_oauth_states', 'crm_oauth_tokens')
    and grantee in ('anon', 'authenticated', 'PUBLIC');
  if v_bad is not null then
    raise exception 'H7: oauth tables directly reachable by a client role: %', v_bad;
  end if;

  select string_agg(tablename || '/' || policyname, ', ') into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename in ('crm_oauth_states', 'crm_oauth_tokens');
  if v_bad is not null then
    raise exception 'H7: oauth tables gained a policy: %', v_bad;
  end if;

  select string_agg(p.proname || '/' || g.rolname, ', ') into v_bad
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  cross join (select unnest(array['anon', 'authenticated']) as rolname) g
  where ns.nspname = 'public'
    and p.proname in ('meta_oauth_consume', 'meta_oauth_store_token',
                      'meta_oauth_link_accounts', 'crm_oauth_state_hash')
    and has_function_privilege(g.rolname, p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'H7: callback-side RPCs reachable by a client role: %', v_bad;
  end if;

  raise notice 'H7 verified: oauth state and token stores are RPC-only; callback RPCs are service_role-only';
end $$;

-- No hardcoded firm may survive anywhere in the Meta path. Comments are
-- stripped before matching so the prose above cannot satisfy this.
do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname like 'meta_oauth%'
    and regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
        ~ '11111111-1111-4111-8111-111111111111';
  if v_bad is not null then
    raise exception 'H7/C9: a hardcoded firm id is back in: %', v_bad;
  end if;
  raise notice 'H7 verified: no hardcoded firm id in the Meta OAuth path';
end $$;

-- The state must be spent by the same statement that validates it.
do $$
declare src text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into src
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'meta_oauth_consume';

  if src !~* 'update\s+public\.crm_oauth_states.*consumed_at\s+is\s+null' then
    raise exception 'H7: meta_oauth_consume no longer spends the state conditionally';
  end if;
  if src !~* 'expires_at\s*>\s*now\(\)' then
    raise exception 'H7: meta_oauth_consume no longer enforces state expiry';
  end if;
  raise notice 'H7 verified: the OAuth state is single-use and expiring';
end $$;

-- The vault wrapper must actually reach the vault. The deployed function's
-- storage was a no-op for a year of code review precisely because nothing
-- ever asserted this.
do $$
declare
  v_firm uuid;
  v_res  jsonb;
  v_sid  uuid;
  v_back text;
begin
  select id into v_firm from public.firms limit 1;
  if v_firm is null then
    raise notice 'H7: no firm present, skipping vault rehearsal';
    return;
  end if;

  v_res := public.meta_oauth_store_token(v_firm, 'h7-assertion-token-value');
  v_sid := (v_res->>'secret_id')::uuid;
  if v_sid is null then
    raise exception 'H7: meta_oauth_store_token returned no secret id';
  end if;

  select decrypted_secret into v_back
  from vault.decrypted_secrets where id = v_sid;

  if v_back is distinct from 'h7-assertion-token-value' then
    raise exception 'H7: the token did not survive a vault round trip (got %)',
      coalesce(v_back, '<null>');
  end if;

  -- and it must not be sitting in a client-readable table
  if exists (
    select 1 from public.crm_oauth_tokens
    where firm_id = v_firm and secret_id::text = 'h7-assertion-token-value'
  ) then
    raise exception 'H7: the token is stored in plaintext';
  end if;

  -- Reconnecting must work. vault.secrets.name is unique, so a version that
  -- keys only off crm_oauth_tokens raises 23505 here and the firm can never
  -- connect Meta a second time — and re-authorising is routine for OAuth, not
  -- an edge case.
  v_res := public.meta_oauth_store_token(v_firm, 'h7-assertion-token-rotated');
  if (v_res->>'secret_id')::uuid is distinct from v_sid then
    raise exception 'H7: reconnecting minted a second secret instead of rotating';
  end if;
  select decrypted_secret into v_back
  from vault.decrypted_secrets where id = v_sid;
  if v_back is distinct from 'h7-assertion-token-rotated' then
    raise exception 'H7: the rotated token did not replace the old one (got %)',
      coalesce(v_back, '<null>');
  end if;

  delete from public.crm_oauth_tokens where firm_id = v_firm and provider = 'meta';
  delete from vault.secrets where id = v_sid;

  raise notice 'H7 verified: the access token reaches the vault, round-trips, and rotates on reconnect';
end $$;
