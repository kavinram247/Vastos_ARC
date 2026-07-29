-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 3 — C8 · telephony-call was an unauthenticated open relay
--
-- Was: supabase/functions/telephony-call/index.ts, deployed to production with
-- no authentication of any kind.
--
--   const to   = String(body.to   || '').replace(/\s+/g, '');
--   const from = String(body.from || '').replace(/\s+/g, '');
--   … Exotel connect.json { From: from, To: to, CallerId: CALLER }
--
-- No JWT, no API key, no firm membership check. Both numbers came straight from
-- the request body and became a real, billed call carrying the firm's own
-- ExoPhone as CallerId. CORS was '*', there was no rate limit, and the
-- lead_id / firm_id / provider the client sent were read by nothing — there was
-- no tenant scoping in the function at all. The URL is printed in the app's own
-- admin UI and follows the predictable
--   https://<ref>.supabase.co/functions/v1/telephony-call
--
-- Three distinct harms: unmetered toll fraud billed to the firm; caller-ID
-- spoofing aimed at the firm's own clients, who see a number they trust; and
-- telephony DoS against any number an attacker names.
--
-- Now: the function accepts a lead id and nothing else. This RPC re-derives the
-- actor from auth.uid(), binds the lead to the actor's firm, checks the actor
-- may act on leads, reads the destination number FROM THE DATABASE rather than
-- the request body, and rate-limits per firm and per user. The caller cannot
-- name a destination, so the endpoint stops being a dialler.
--
-- DEPENDS ON C6 (20260728040000). Without it the permission check below is
-- decorative: any member could PATCH their own crm_profiles.role_id to the
-- admin role and satisfy this gate legitimately.
--
-- Audit refs: C8, and the client-side half of W1b (the tenant-writable
-- click_to_call_url that leaked lead phone numbers to an attacker-chosen host —
-- the client now invokes its own function and never reads that field).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Call ledger ────────────────────────────────────────────────────────────
-- Serves two purposes: the rate-limit window is computed from it, and it is the
-- audit trail C8 never had — before this, a billed call left no record of who
-- asked for it. Writes happen only inside the two SECURITY DEFINER functions
-- below; the table itself carries no write policy for anyone.
create table if not exists public.crm_telephony_calls (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  lead_id      text not null,
  requested_by uuid not null,
  to_number    text not null,
  from_number  text,
  provider     text,
  call_sid     text,
  status       text not null default 'requested',
  error        text,
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
);

create index if not exists crm_telephony_calls_firm_time
  on public.crm_telephony_calls (firm_id, created_at desc);
create index if not exists crm_telephony_calls_actor_time
  on public.crm_telephony_calls (requested_by, created_at desc);

alter table public.crm_telephony_calls enable row level security;

-- Readable within your own firm; writable by nobody directly. C1b established
-- that Supabase's ALTER DEFAULT PRIVILEGES re-grants full DML on every new
-- table, so revoke explicitly here rather than trusting the default to hold.
--
-- The revoke must name `authenticated` as well as `anon`, and that is not
-- belt-and-braces: the assertion at the foot of this file failed on the first
-- run precisely because CREATE TABLE handed `authenticated` INSERT/UPDATE/
-- DELETE on this ledger. Phase 2's C1b migration cleared those defaults for
-- anon only, so every new table still arrives writable by every logged-in user.
drop policy if exists crm_telephony_calls_sel on public.crm_telephony_calls;
create policy crm_telephony_calls_sel on public.crm_telephony_calls
  for select to authenticated
  using (firm_id = public.current_firm_id());

revoke all on public.crm_telephony_calls from anon, authenticated, public;
grant select on public.crm_telephony_calls to authenticated;


-- ── Authorize and record a call request ────────────────────────────────────
-- Returns the numbers to dial. The edge function is a dumb pipe to Exotel after
-- this: everything that decides whether a call may happen, and to whom, is
-- decided here from the session.
create or replace function public.telephony_request_call(p_lead_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_firm  uuid;
  v_actor_pid   uuid;
  v_lead        record;
  v_channel     record;
  v_cfg         jsonb;
  v_to          text;
  v_from        text;
  v_provider    text;
  v_flag        boolean;
  v_firm_calls  integer;
  v_user_calls  integer;
  v_id          uuid;
  -- Per-hour ceilings. A sales team of five placing a call every ten minutes
  -- each stays well inside these; a toll-fraud script does not.
  c_firm_limit  constant integer := 60;
  c_user_limit  constant integer := 20;
begin
  -- ── Actor, from the session only ────────────────────────────────────────
  select pr.firm_id, pr.id
    into v_actor_firm, v_actor_pid
  from public.profiles pr
  where pr.auth_uid = auth.uid()
  limit 1;

  if v_actor_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- ── Permission ──────────────────────────────────────────────────────────
  -- Placing a call contacts a client and writes the lead timeline; it is an
  -- edit, not a read. crm_has_permission() resolves the role from auth.uid()
  -- (Phase 1, C4) and passes firm owners and admin roles unconditionally.
  if not public.crm_has_permission('leads', 'edit') then
    raise exception 'permission denied: edit on leads' using errcode = '42501';
  end if;

  -- ── Feature flag ────────────────────────────────────────────────────────
  -- Defaults to on when no row exists, matching the client's
  -- isFeatureEnabled(firmId, 'comm_telephony', true).
  select f.enabled into v_flag
  from public.crm_feature_flags f
  where f.firm_id = v_actor_firm and f.key = 'comm_telephony';

  if v_flag is false then
    raise exception 'telephony is disabled for this firm' using errcode = '42501';
  end if;

  -- ── The lead, bound to the actor's firm ─────────────────────────────────
  select * into v_lead
  from public.crm_leads
  where id = p_lead_id;

  if not found or v_lead.firm_id <> v_actor_firm then
    -- Same error either way: no cross-tenant existence oracle.
    raise exception 'lead not found' using errcode = '42704';
  end if;

  -- ── Destination, from the database ──────────────────────────────────────
  -- This line is the fix. The number dialled is the one stored on the lead the
  -- caller is entitled to see; there is no request field that can change it.
  v_to := regexp_replace(coalesce(v_lead.client_phone, ''), '\s', '', 'g');
  if v_to = '' then
    raise exception 'lead has no phone number' using errcode = '22023';
  end if;
  if v_to !~ '^\+?[0-9][0-9()-]{5,19}$' then
    raise exception 'lead phone number is not dialable: %', v_to using errcode = '22023';
  end if;

  -- ── Firm's own telephony settings ───────────────────────────────────────
  select * into v_channel
  from public.crm_comm_channels c
  where c.firm_id = v_actor_firm
    and c.category = 'telephony'
    and c.status = 'connected'
  limit 1;

  if not found then
    raise exception 'telephony is not connected for this firm' using errcode = '42501';
  end if;

  v_cfg      := coalesce(v_channel.config, '{}'::jsonb);
  v_provider := coalesce(v_cfg->>'provider', 'manual');
  v_from     := regexp_replace(
                  coalesce(nullif(btrim(v_cfg->>'agent_number'), ''),
                           nullif(btrim(v_cfg->>'caller_id'), ''), ''),
                  '\s', '', 'g');

  if v_from = '' then
    raise exception 'no agent number configured — set it in Leads Admin → Telephony'
      using errcode = '22023';
  end if;
  if v_from !~ '^\+?[0-9][0-9()-]{5,19}$' then
    raise exception 'configured agent number is not dialable' using errcode = '22023';
  end if;

  -- ── Rate limit ──────────────────────────────────────────────────────────
  -- Counted from the ledger, so it survives function restarts and cannot be
  -- reset by the caller. Firm-wide first: one compromised account must not be
  -- able to spend the firm's whole telephony budget.
  select count(*) into v_firm_calls
  from public.crm_telephony_calls t
  where t.firm_id = v_actor_firm
    and t.created_at > now() - interval '1 hour';

  if v_firm_calls >= c_firm_limit then
    raise exception 'telephony rate limit reached for this firm (% calls/hour)', c_firm_limit
      using errcode = '54000';
  end if;

  select count(*) into v_user_calls
  from public.crm_telephony_calls t
  where t.requested_by = v_actor_pid
    and t.created_at > now() - interval '1 hour';

  if v_user_calls >= c_user_limit then
    raise exception 'telephony rate limit reached for this user (% calls/hour)', c_user_limit
      using errcode = '54000';
  end if;

  -- ── Record, then hand the numbers back ──────────────────────────────────
  -- Inserted BEFORE the call is placed, so a request that is authorized still
  -- consumes rate-limit budget even if the provider never answers. Otherwise a
  -- flood of failing calls would be free.
  insert into public.crm_telephony_calls
    (firm_id, lead_id, requested_by, to_number, from_number, provider)
  values
    (v_actor_firm, p_lead_id, v_actor_pid, v_to, v_from, v_provider)
  returning id into v_id;

  return jsonb_build_object(
    'call_request_id', v_id,
    'to',              v_to,
    'from',            v_from,
    'provider',        v_provider
  );
end $$;

revoke all on function public.telephony_request_call(text) from public, anon;
grant execute on function public.telephony_request_call(text) to authenticated;


-- ── Settle a call request ──────────────────────────────────────────────────
-- The edge function reports what the provider did. Scoped to the caller's own
-- firm and to a row that is still open, so this cannot be used to rewrite
-- another tenant's call history or to launder an old record.
create or replace function public.telephony_settle_call(
  p_id       uuid,
  p_status   text,
  p_call_sid text default null,
  p_error    text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_firm uuid;
begin
  if p_status not in ('placed', 'failed') then
    raise exception 'status must be placed or failed' using errcode = '22023';
  end if;

  select pr.firm_id into v_actor_firm
  from public.profiles pr
  where pr.auth_uid = auth.uid()
  limit 1;

  if v_actor_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.crm_telephony_calls
     set status     = p_status,
         call_sid   = left(p_call_sid, 128),
         error      = left(p_error, 300),
         settled_at = now()
   where id = p_id
     and firm_id = v_actor_firm
     and status = 'requested';
end $$;

revoke all on function public.telephony_settle_call(uuid, text, text, text) from public, anon;
grant execute on function public.telephony_settle_call(uuid, text, text, text) to authenticated;


-- ── Assertions ─────────────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.telephony_request_call(text)', 'EXECUTE') then
    raise exception 'C8: telephony_request_call must not be anon-executable';
  end if;
  if not has_function_privilege('authenticated', 'public.telephony_request_call(text)', 'EXECUTE') then
    raise exception 'C8: authenticated cannot execute telephony_request_call';
  end if;
  if has_function_privilege('anon', 'public.telephony_settle_call(uuid, text, text, text)', 'EXECUTE') then
    raise exception 'C8: telephony_settle_call must not be anon-executable';
  end if;
end $$;

-- The ledger must not be writable directly: a caller who can INSERT their own
-- rows can neither be rate-limited nor audited, and a caller who can DELETE
-- them resets the window at will.
do $$
declare p record;
begin
  for p in
    select policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_telephony_calls'
      and cmd <> 'SELECT'
  loop
    raise exception 'C8: crm_telephony_calls carries a % policy (%) — the rate '
                    'limit and the audit trail are both bypassable', p.cmd, p.policyname;
  end loop;

  if has_table_privilege('anon', 'public.crm_telephony_calls', 'SELECT') then
    raise exception 'C8: anon can read the telephony call ledger';
  end if;
  if has_table_privilege('authenticated', 'public.crm_telephony_calls', 'INSERT')
     or has_table_privilege('authenticated', 'public.crm_telephony_calls', 'UPDATE')
     or has_table_privilege('authenticated', 'public.crm_telephony_calls', 'DELETE') then
    raise exception 'C8: authenticated holds direct DML on the telephony call ledger';
  end if;
end $$;

-- C8 is only as strong as C6, for the same reason H4 is.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.crm_profiles'::regclass
      and tgname  = 'guard_crm_profile_privileges_trg'
      and not tgisinternal
  ) then
    raise exception
      'C8: the C6 role guard is missing — a member could grant themselves '
      'leads:edit, making the permission gate meaningless';
  end if;
  raise notice 'C8 verified: telephony authorization RPC installed, ledger sealed';
end $$;
