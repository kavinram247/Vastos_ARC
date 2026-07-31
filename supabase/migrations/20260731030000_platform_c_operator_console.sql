-- ═══════════════════════════════════════════════════════════════════════════
-- PLATFORM PHASE C — the operator console becomes real, and audited
--
-- src/pages/VastosAdminPage.tsx is 840 lines of unrouted dead code: no import,
-- no entry in the Page union, no route. It makes 25 direct PostgREST table
-- calls and EVERY write among them is already dead under current RLS —
-- user_invites deny-all (C3), vastos_admin_log deny-all (C2b), crm_roles has no
-- write policy (C6b), firm_subscriptions is SELECT-only, and the firms INSERT
-- is structurally impossible because `firms_mod with check (id =
-- current_firm_id())` can never be satisfied by a firm that does not exist yet.
--
-- C2b's header pre-committed this design: "If it is ever revived it needs an
-- operator-checked definer RPC, which is the pattern C3, C8 and C9
-- established." This is that.
--
-- ── Why provisioning creates no identity ──────────────────────────────────
-- The load-bearing design decision. vastos_provision_firm creates
--   firm → subscription → 4 roles → defaults → invite → log
-- and stops. It writes NO profiles row and NO crm_profiles row. The owner's
-- identity is created by invite_finalize, which already upserts both, derives
-- profiles.role from crm_roles.key, and runs under service_role where
-- auth.uid() is NULL — the C6 trigger's own escape clause (c6:95).
--
-- CONSEQUENCE: this migration changes ZERO C6 triggers. State the reason
-- plainly so nobody later leans on the wrong one: it is NOT that C6 would have
-- blocked a cross-firm profile insert. It would not have — crm_actor_is_admin()
-- is not firm-scoped (its first arm matches profiles.role='owner' in ANY firm),
-- so it would have waved an operator straight through. C6 is a WHO control, and
-- never a tenancy control. Provisioning is safe here only because it never
-- touches those tables at all.
--
-- A containment property worth recording: invite_finalize's "that identity is
-- already linked to another profile" check means an operator CANNOT redeem an
-- invite into a customer tenant — they already hold a profiles row elsewhere.
-- Operators can create a firm; they cannot become a member of one.
--
-- ── Why an allowlist table and not a JWT claim ────────────────────────────
-- Revocation has to be effective immediately. app_metadata rides in a JWT that
-- stays valid until it expires, so a revoked operator would keep their powers
-- for the life of the token. This is evaluated per call.
--
-- Audit refs: C2 (the console), C2b (the log), C3/C8/C9 (the RPC pattern),
--             C6 (why it is untouched), platform-A (schema), platform-B (scope).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · The allowlist ──────────────────────────────────────────────────────
-- Deny-all, exactly like user_invites (C3) and crm_webhook_tokens (C9): RLS on,
-- NO policy, no client grants. C1b inverted the default so a new table arrives
-- with no client privileges at all (verified: a freshly created table grants
-- nothing to anon/authenticated); the revoke below is belt and braces.
--
-- Keyed on auth_uid and NEVER on email. Email is user-mutable through GoTrue,
-- and production still has open signup — an email-keyed allowlist row for an
-- address with no account yet would be a claimable operator slot for whoever
-- registers it first. email here is a human label for the audit trail, nothing
-- more; no lookup reads it.
--
-- This table must never appear in an RLS predicate on itself, which is why it
-- has no policy rather than a self-referential one — that recurses.
create table if not exists public.vastos_operators (
  auth_uid   uuid        primary key,
  email      text        not null unique,
  added_at   timestamptz not null default now(),
  added_by   uuid,
  revoked_at timestamptz
);

alter table public.vastos_operators enable row level security;
revoke all on table public.vastos_operators from anon, authenticated, public;

comment on table public.vastos_operators is
  'Platform staff allowlist. Deny-all: reachable only through SECURITY DEFINER '
  'functions. Revocation is soft (revoked_at) so the audit trail survives.';


-- ── 2 · The gate ───────────────────────────────────────────────────────────
-- STABLE, never IMMUTABLE. It reads a table and depends on auth.uid(); marking
-- it immutable would let the planner constant-fold it into a cached plan, and
-- behind a connection pooler that is a real security consequence, not a
-- theoretical one.
create or replace function public.is_vastos_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vastos_operators o
    where o.auth_uid = auth.uid()
      and o.revoked_at is null
  );
$$;

-- The raising variant, returning the actor so every caller gets its audit
-- attribution for free and the gate stays one line. Revoked from `authenticated`
-- as well as anon — it is only ever called from inside another definer.
create or replace function public.vastos_require_operator()
returns table (actor_uid uuid, actor_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return query
    select o.auth_uid, o.email
    from public.vastos_operators o
    where o.auth_uid = auth.uid()
      and o.revoked_at is null;

  if not found then
    raise exception 'not a platform operator' using errcode = '42501';
  end if;
end $$;


-- ── 3 · Attributed audit write ─────────────────────────────────────────────
-- Internal. Every mutation below calls this; there is no code path that changes
-- a firm without recording who changed it.
create or replace function public.vastos_log(
  p_actor_uid   uuid,
  p_actor_email text,
  p_action      text,
  p_firm_id     uuid,
  p_firm_name   text,
  p_details     jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.vastos_admin_log
    (action, firm_id, firm_name, details, actor_auth_uid, actor_email)
  values (p_action, p_firm_id, p_firm_name,
          coalesce(p_details, '{}'::jsonb), p_actor_uid, p_actor_email);
$$;


-- ── 4 · Firm defaults ──────────────────────────────────────────────────────
-- Internal. Without these a provisioned firm is technically present and
-- practically unusable: the leads board renders zero columns (it is built from
-- crm_pipeline_stages), and every non-admin role grants nothing, so those users
-- get an empty sidebar and AccessDenied everywhere. Today these rows exist only
-- for the demo firm, seeded inline by 20260627064400_26_leads_rebuild.sql —
-- nothing has ever seeded them for a second firm, because nothing has ever
-- created a second firm.
--
-- Idempotent throughout: safe to re-run against a firm that already has some.
create or replace function public.vastos_seed_firm_defaults(p_firm_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_firm_id is null then
    raise exception 'a firm id is required' using errcode = '22023';
  end if;

  -- Lead pipeline. Mirrors the demo firm's nine stages.
  insert into public.crm_pipeline_stages (firm_id, key, label, order_index, category, is_won, is_lost, color)
  values
    (p_firm_id,'new','New',0,'active',false,false,'sky'),
    (p_firm_id,'contacted','Contacted',1,'active',false,false,'violet'),
    (p_firm_id,'site_visit','Site Visit',2,'active',false,false,'amber'),
    (p_firm_id,'quotation_sent','Quotation Sent',3,'active',false,false,'indigo'),
    (p_firm_id,'negotiation','Negotiation',4,'active',false,false,'orange'),
    (p_firm_id,'on_hold','On Hold',5,'terminal',false,false,'yellow'),
    (p_firm_id,'won','Won',6,'terminal',true,false,'emerald'),
    (p_firm_id,'lost','Lost',7,'terminal',false,true,'red'),
    (p_firm_id,'junk','Junk',8,'terminal',false,false,'slate')
  on conflict (firm_id, key) do nothing;

  insert into public.crm_feature_flags (firm_id, key, enabled)
  values
    (p_firm_id,'quotations',true),
    (p_firm_id,'website_capture',true),
    (p_firm_id,'comm_email',false),
    (p_firm_id,'comm_telephony',false),
    (p_firm_id,'comm_sms',false),
    (p_firm_id,'comm_meta',false)
  on conflict (firm_id, key) do nothing;

  insert into public.crm_comm_channels (firm_id, provider, category, display_name)
  values
    (p_firm_id,'email_gmail','email','Gmail / Google Workspace'),
    (p_firm_id,'email_outlook','email','Outlook / Microsoft 365'),
    (p_firm_id,'telephony_twilio','telephony','Twilio Voice'),
    (p_firm_id,'sms_twilio','sms','Twilio SMS'),
    (p_firm_id,'meta_business','meta','Meta Business (WhatsApp/Messenger)')
  on conflict (firm_id, provider) do nothing;

  -- Costing regions. regions is firm-scoped (the demo firm's five all carry its
  -- firm_id), so a new firm with none cannot price a BOQ at all.
  if not exists (select 1 from public.regions where firm_id = p_firm_id) then
    insert into public.regions (firm_id, name, state, material_index, labour_index)
    values
      (p_firm_id,'Bangalore','Karnataka',1.00,1.05),
      (p_firm_id,'Chennai','Tamil Nadu',0.98,0.95),
      (p_firm_id,'Delhi','Delhi NCR',1.00,1.10),
      (p_firm_id,'Hyderabad','Telangana',0.97,0.95),
      (p_firm_id,'Mumbai','Maharashtra',1.05,1.25);
  end if;

  if not exists (select 1 from public.margin_policies where firm_id = p_firm_id) then
    insert into public.margin_policies (firm_id, category_id, grade, target_margin_pct, margin_floor_pct, overhead_pct)
    values (p_firm_id, null, null, 35.00, 18.00, 8.00);
  end if;

  -- Role grants for the three non-admin roles. The Owner role carries
  -- is_admin, and both can() and crm_has_permission() short-circuit on that, so
  -- it deliberately gets no explicit rows.
  insert into public.crm_role_permissions (id, firm_id, role_id, module, actions)
  select gen_random_uuid()::text, p_firm_id, r.id, g.module, g.actions
  from public.crm_roles r
  join (values
    -- Architect — full delivery and commercial authority, no admin.
    ('architect','dashboard',          array['view']),
    ('architect','leads',              array['view','create','edit','assign','export']),
    ('architect','projects',           array['view','create','edit','assign','export']),
    ('architect','tasks',              array['view','create','edit','assign']),
    ('architect','attendance',         array['view','create','edit']),
    ('architect','client-portal',      array['view']),
    ('architect','boq',                array['view','create','edit','export']),
    ('architect','quotations',         array['view','create','edit','export']),
    ('architect','vendors',            array['view','create','edit']),
    ('architect','catalog',            array['view','create','edit']),
    ('architect','calibration',        array['view','edit']),
    ('architect','purchase',           array['view','create','edit']),
    ('architect','marketing',          array['view']),
    ('architect','inventory',          array['view','edit','export']),
    ('architect','material_requests',  array['view','create','edit']),
    ('architect','rfqs',               array['view','create','edit']),
    ('architect','purchasing',         array['view','create','edit']),
    ('architect','goods_receipts',     array['view','create']),
    ('architect','stock',              array['view','export']),
    ('architect','consumption',        array['view','create']),
    ('architect','transfers',          array['view','create']),
    ('architect','materials',          array['view','edit']),
    ('architect','milestones',         array['view','create','edit']),
    ('architect','payments',           array['view','create','edit','export']),
    ('architect','costs',              array['view','create','edit','export']),
    ('architect','documents',          array['view','create','edit','export']),
    ('architect','comments',           array['view','create']),
    ('architect','site-updates',       array['view','create','edit']),

    -- Engineer — execute on site, read the commercials.
    ('engineer','dashboard',           array['view']),
    ('engineer','leads',               array['view']),
    ('engineer','projects',            array['view','edit']),
    ('engineer','tasks',               array['view','create','edit']),
    ('engineer','attendance',          array['view','create']),
    ('engineer','client-portal',       array['view']),
    ('engineer','boq',                 array['view']),
    ('engineer','quotations',          array['view']),
    ('engineer','vendors',             array['view']),
    ('engineer','catalog',             array['view']),
    ('engineer','purchase',            array['view']),
    ('engineer','inventory',           array['view']),
    ('engineer','material_requests',   array['view','create']),
    ('engineer','stock',               array['view']),
    ('engineer','consumption',         array['view','create']),
    ('engineer','transfers',           array['view','create']),
    ('engineer','materials',           array['view']),
    ('engineer','milestones',          array['view']),
    ('engineer','documents',           array['view','create']),
    ('engineer','comments',            array['view','create']),
    ('engineer','site-updates',        array['view','create']),

    -- Client — their own portal only.
    ('client','client-portal',         array['view']),
    ('client','milestones',            array['view']),
    ('client','payments',              array['view']),
    ('client','documents',             array['view']),
    ('client','comments',              array['view','create'])
  ) as g(role_key, module, actions) on g.role_key = r.key
  where r.firm_id = p_firm_id
  on conflict (role_id, module) do nothing;
end $$;


-- ── 5 · Reads ──────────────────────────────────────────────────────────────
-- Collapses the console's 1 + 3N query storm into a single call.
--
-- user_count MUST be declared bigint: count(*) returns bigint and a mismatched
-- OUT type makes the very first call fail with 42804, not the hundredth.
--
-- It counts ACTIVATED members only (auth_uid is not null). Counting crm_profiles
-- as the old page did would include the placeholder rows create_invite writes
-- for people who have not accepted yet, inflating every seat reading by the
-- outstanding invite count — the number an operator uses to decide whether a
-- firm needs more seats.
--
-- owner_email needs the ranked fallback because every firm that exists today was
-- seeded with a role keyed 'admin', and invite_finalize maps any key outside the
-- user_role enum to 'engineer'. So profiles.role = 'owner' alone returns NULL for
-- every pre-existing firm, and the console would show "No owner" across the board.
-- owner_activated lets the UI say "invited" rather than implying a live account.
create or replace function public.vastos_list_firms(p_include_deleted boolean default false)
returns table (
  id                   uuid,
  name                 text,
  created_at           timestamptz,
  plan_id              uuid,
  plan_name            text,
  plan_status          text,
  plan_max_users       integer,
  seats_purchased      integer,
  owner_email          text,
  owner_activated      boolean,
  user_count           bigint,
  pending_invite_count bigint,
  blacklisted_at       timestamptz,
  blacklist_reason     text,
  deleted_at           timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.vastos_require_operator();

  return query
  select f.id, f.name, f.created_at,
         sp.id, sp.name, fs.status, sp.max_users, fs.seats_purchased,
         o.email, o.activated,
         (select count(*) from public.profiles pr
           where pr.firm_id = f.id and pr.auth_uid is not null),
         (select count(*) from public.user_invites i
           where i.firm_id = f.id and i.accepted_at is null),
         f.blacklisted_at, f.blacklist_reason, f.deleted_at
  from public.firms f
  left join public.firm_subscriptions fs on fs.firm_id = f.id
  left join public.subscription_plans sp on sp.id = fs.plan_id
  left join lateral (
    select x.email, x.activated
    from (
      -- 1 · an activated owner
      select pr.email, true as activated, 1 as rank
      from public.profiles pr
      where pr.firm_id = f.id and pr.auth_uid is not null and pr.role = 'owner'
      union all
      -- 2 · an activated holder of an is_admin role. The r.firm_id = cp.firm_id
      --     predicate is phase B's whole point; without it this picks up a
      --     foreign role and names the wrong person as a firm's owner.
      select pr.email, true, 2
      from public.profiles pr
      join public.crm_profiles cp
        on cp.firm_id = pr.firm_id and lower(cp.email) = lower(pr.email)
      join public.crm_roles r
        on r.id = cp.role_id and r.firm_id = cp.firm_id
      where pr.firm_id = f.id and pr.auth_uid is not null
        and r.is_admin and r.enabled
      union all
      -- 3 · any activated member
      select pr.email, true, 3
      from public.profiles pr
      where pr.firm_id = f.id and pr.auth_uid is not null
      union all
      -- 4 · an outstanding invite — nobody has logged in yet
      select i.email, false, 4
      from public.user_invites i
      where i.firm_id = f.id and i.accepted_at is null
    ) x
    order by x.rank, x.email
    limit 1
  ) o on true
  where p_include_deleted or f.deleted_at is null
  order by f.created_at desc;
end $$;


create or replace function public.vastos_list_admin_log(
  p_limit   integer default 50,
  p_firm_id uuid    default null
)
returns table (
  id             uuid,
  action         text,
  firm_id        uuid,
  firm_name      text,
  details        jsonb,
  actor_email    text,
  created_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.vastos_require_operator();

  return query
  select l.id, l.action, l.firm_id, l.firm_name, l.details, l.actor_email, l.created_at
  from public.vastos_admin_log l
  where p_firm_id is null or l.firm_id = p_firm_id
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
end $$;


-- ── 6 · Provisioning ───────────────────────────────────────────────────────
-- Creates no identity. See the header.
--
-- Roles are seeded owner/architect/engineer/client — NOT the 'admin' key the
-- old page used. invite_finalize understands exactly the four user_role enum
-- keys and silently maps anything else to 'engineer', so a firm seeded with
-- 'admin' produces an owner who redeems their invite and lands as an engineer
-- with profiles.role='engineer'. That is the bug every existing firm has.
--
-- Role ids are gen_random_uuid()::text because crm_roles.id is a GLOBAL primary
-- key; any fixed id collides on the second firm provisioned.
create or replace function public.vastos_provision_firm(
  p_firm_name   text,
  p_owner_email text,
  p_owner_name  text    default null,
  p_plan_id     uuid    default null,
  p_trial_days  integer default 30
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor    record;
  v_firm_id  uuid;
  v_name     text := btrim(coalesce(p_firm_name, ''));
  v_email    text := lower(btrim(coalesce(p_owner_email, '')));
  v_full     text := nullif(btrim(coalesce(p_owner_name, '')), '');
  v_days     integer := greatest(0, coalesce(p_trial_days, 0));
  v_owner_rid text;
  v_token    text;
  v_invite   uuid;
  v_expires  timestamptz;
begin
  select * into v_actor from public.vastos_require_operator();

  if v_name = '' then
    raise exception 'a firm name is required' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid owner email address is required' using errcode = '22023';
  end if;
  if p_plan_id is null or not exists (
    select 1 from public.subscription_plans sp where sp.id = p_plan_id
  ) then
    raise exception 'a known subscription plan is required' using errcode = '22023';
  end if;

  -- Refuse an owner address that is already an ACTIVATED user anywhere.
  -- invite_finalize would later refuse the redemption with "that identity is
  -- already linked to another profile", leaving a firm nobody can ever enter
  -- and an invite that can never be redeemed. Fail here, where it is fixable.
  if exists (
    select 1 from public.profiles pr
    where lower(pr.email) = v_email and pr.auth_uid is not null
  ) then
    raise exception 'that email already belongs to an active user of another firm'
      using errcode = '23505';
  end if;

  insert into public.firms (name, address, payment_split_default)
  values (v_name, '', 0)
  returning id into v_firm_id;

  insert into public.firm_subscriptions (firm_id, plan_id, status, trial_ends_at)
  values (v_firm_id, p_plan_id,
          case when v_days > 0 then 'trial' else 'active' end,
          case when v_days > 0 then now() + make_interval(days => v_days) else null end);

  -- The four roles invite_finalize can actually map to a user_role.
  insert into public.crm_roles (id, firm_id, key, name, is_admin, enabled, color)
  values
    (gen_random_uuid()::text, v_firm_id, 'owner',     'Owner',     true,  true, '#6366f1'),
    (gen_random_uuid()::text, v_firm_id, 'architect', 'Architect', false, true, '#0ea5e9'),
    (gen_random_uuid()::text, v_firm_id, 'engineer',  'Engineer',  false, true, '#f59e0b'),
    (gen_random_uuid()::text, v_firm_id, 'client',    'Client',    false, true, '#10b981');

  select r.id into v_owner_rid
  from public.crm_roles r
  where r.firm_id = v_firm_id and r.key = 'owner';

  if v_owner_rid is null then
    raise exception 'provisioning did not produce an owner role' using errcode = '25000';
  end if;

  perform public.vastos_seed_firm_defaults(v_firm_id);

  -- The invite. Written directly rather than through create_invite(), which is
  -- firm-bound to the CALLER's own firm by design (C3) and would put the invite
  -- in the operator's tenant. No placeholder profiles/crm_profiles rows are
  -- created: invite_finalize upserts both, precisely so a missing placeholder is
  -- repaired rather than silently matching zero rows (W1a).
  insert into public.user_invites (firm_id, email, full_name, role_id)
  values (v_firm_id, v_email, v_full, v_owner_rid)
  returning id, token, expires_at into v_invite, v_token, v_expires;

  -- The token is a bearer credential that exchanges for an owner account. It is
  -- returned once, to the operator who created it, and NEVER written to the log
  -- — every operator can read every log row.
  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'provision', v_firm_id, v_name,
    jsonb_build_object('owner_email', v_email, 'plan_id', p_plan_id, 'trial_days', v_days));

  return jsonb_build_object(
    'firm_id',    v_firm_id,
    'invite_id',  v_invite,
    'token',      v_token,
    'expires_at', v_expires,
    'owner_email', v_email
  );
end $$;


-- ── 7 · Lifecycle — five explicit verbs ────────────────────────────────────
-- Deliberately NOT one vastos_set_firm_state(p_state text). A text
-- discriminator is a silent no-op on a typo, and it makes the audit action name
-- a client-supplied string — an operator could write whatever they liked into
-- the record of what they did.
--
-- ANTI-LOCKOUT (25000): none of suspend/blacklist/delete may be applied to a
-- firm that is an active operator's home tenant. resolveSession() refuses any
-- session whose firm has deleted_at set, so an operator who deletes their own
-- firm loses the console that is the only way to undo it. That is unrecoverable
-- without direct database access.
create or replace function public.vastos_assert_not_operator_home(p_firm_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.vastos_operators o
    join public.profiles pr on pr.auth_uid = o.auth_uid
    where o.revoked_at is null and pr.firm_id = p_firm_id
  ) then
    raise exception 'that firm is an active platform operator''s home tenant'
      using errcode = '25000';
  end if;
end $$;


create or replace function public.vastos_suspend_firm(p_firm_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor record; v_name text;
begin
  select * into v_actor from public.vastos_require_operator();

  select f.name into v_name from public.firms f where f.id = p_firm_id;
  if v_name is null then
    raise exception 'unknown firm' using errcode = '22023';
  end if;
  perform public.vastos_assert_not_operator_home(p_firm_id);

  update public.firm_subscriptions set status = 'suspended', updated_at = now()
   where firm_id = p_firm_id;

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'suspend', p_firm_id, v_name, '{}'::jsonb);
end $$;


create or replace function public.vastos_unsuspend_firm(p_firm_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor record; v_name text; v_restore text;
begin
  select * into v_actor from public.vastos_require_operator();

  select f.name into v_name from public.firms f where f.id = p_firm_id;
  if v_name is null then
    raise exception 'unknown firm' using errcode = '22023';
  end if;

  -- Restore to trial or active by looking at the trial window server-side. The
  -- old page decided this from the row it had rendered, so a stale tab could
  -- resurrect an expired trial.
  select case when fs.trial_ends_at is not null and fs.trial_ends_at > now()
              then 'trial' else 'active' end
    into v_restore
  from public.firm_subscriptions fs where fs.firm_id = p_firm_id;

  update public.firm_subscriptions
     set status = coalesce(v_restore, 'active'), updated_at = now()
   where firm_id = p_firm_id;

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'unsuspend', p_firm_id, v_name,
    jsonb_build_object('restored_to', coalesce(v_restore, 'active')));
end $$;


create or replace function public.vastos_blacklist_firm(
  p_firm_id uuid,
  p_reason  text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor record; v_name text; v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into v_actor from public.vastos_require_operator();

  if v_reason = '' then
    raise exception 'a blacklist reason is required' using errcode = '22023';
  end if;

  select f.name into v_name from public.firms f where f.id = p_firm_id;
  if v_name is null then
    raise exception 'unknown firm' using errcode = '22023';
  end if;
  perform public.vastos_assert_not_operator_home(p_firm_id);

  update public.firms
     set blacklisted_at = now(), blacklist_reason = v_reason
   where id = p_firm_id;

  -- The suspension is what actually blocks access; blacklisted_at is a flag
  -- resolveSession does not consult. See the platform-A column comment.
  update public.firm_subscriptions set status = 'suspended', updated_at = now()
   where firm_id = p_firm_id;

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'blacklist', p_firm_id, v_name, jsonb_build_object('reason', v_reason));
end $$;


create or replace function public.vastos_unblacklist_firm(p_firm_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor record; v_name text;
begin
  select * into v_actor from public.vastos_require_operator();

  select f.name into v_name from public.firms f where f.id = p_firm_id;
  if v_name is null then
    raise exception 'unknown firm' using errcode = '22023';
  end if;

  update public.firms set blacklisted_at = null, blacklist_reason = null
   where id = p_firm_id;
  update public.firm_subscriptions set status = 'active', updated_at = now()
   where firm_id = p_firm_id;

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'unblacklist', p_firm_id, v_name, '{}'::jsonb);
end $$;


-- The confirm-name check moves from the browser to the boundary. The old page
-- compared deleteConfirm to the firm name in React and then issued an
-- unconditional PATCH, so the confirmation protected nobody who was not using
-- the form.
create or replace function public.vastos_delete_firm(
  p_firm_id      uuid,
  p_confirm_name text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor record; v_name text;
begin
  select * into v_actor from public.vastos_require_operator();

  select f.name into v_name from public.firms f where f.id = p_firm_id;
  if v_name is null then
    raise exception 'unknown firm' using errcode = '22023';
  end if;

  if btrim(coalesce(p_confirm_name, '')) is distinct from v_name then
    raise exception 'the confirmation name does not match this firm'
      using errcode = '22023';
  end if;

  perform public.vastos_assert_not_operator_home(p_firm_id);

  update public.firms set deleted_at = now() where id = p_firm_id;
  update public.firm_subscriptions set status = 'cancelled', updated_at = now()
   where firm_id = p_firm_id;

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'delete', p_firm_id, v_name, '{}'::jsonb);
end $$;


-- ── 8 · Seats and per-firm invites ─────────────────────────────────────────
-- NOTE, and it is a real limitation: seat caps are enforced NOWHERE
-- server-side. UserManagementPage counts in the browser and create_invite
-- counts nothing at all. So this writes a number that only the UI respects; a
-- firm can exceed it through any path that is not that one form. Documented as
-- advisory rather than quietly presented as a control.
create or replace function public.vastos_set_firm_seats(
  p_firm_id uuid,
  p_seats   integer default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor record; v_name text; v_seats integer;
begin
  select * into v_actor from public.vastos_require_operator();

  select f.name into v_name from public.firms f where f.id = p_firm_id;
  if v_name is null then
    raise exception 'unknown firm' using errcode = '22023';
  end if;

  if p_seats is not null and p_seats < 1 then
    raise exception 'a seat count must be at least 1' using errcode = '22023';
  end if;
  v_seats := p_seats;  -- NULL means "fall back to the plan's max_users"

  if not exists (select 1 from public.firm_subscriptions where firm_id = p_firm_id) then
    raise exception 'that firm has no subscription to set seats on' using errcode = '25000';
  end if;

  update public.firm_subscriptions
     set seats_purchased = v_seats, updated_at = now()
   where firm_id = p_firm_id;

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'set_user_limit', p_firm_id, v_name,
    jsonb_build_object('seats', coalesce(v_seats::text, 'plan default')));
end $$;


create or replace function public.vastos_invite_firm_user(
  p_firm_id   uuid,
  p_email     text,
  p_full_name text default null,
  p_role_id   text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor   record;
  v_name    text;
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_full    text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_token   text;
  v_invite  uuid;
  v_expires timestamptz;
begin
  select * into v_actor from public.vastos_require_operator();

  select f.name into v_name from public.firms f where f.id = p_firm_id and f.deleted_at is null;
  if v_name is null then
    raise exception 'unknown firm' using errcode = '22023';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email address is required' using errcode = '22023';
  end if;

  -- Phase B's invariant, enforced at the SECOND writer of user_invites.role_id.
  -- Without this an operator could mint an invite carrying firm X's admin role
  -- into firm Y, and inv_current_actor would read it back as cross-firm admin.
  if p_role_id is not null and not exists (
    select 1 from public.crm_roles r
    where r.id = p_role_id and r.firm_id = p_firm_id and r.enabled
  ) then
    raise exception 'that role does not belong to this firm' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.firm_id = p_firm_id and lower(pr.email) = v_email and pr.auth_uid is not null
  ) then
    raise exception 'that person is already a member of this firm' using errcode = '23505';
  end if;

  -- Re-inviting supersedes any outstanding invite, so an older token cannot
  -- still be redeemed afterwards (create_invite does the same).
  delete from public.user_invites
   where firm_id = p_firm_id and lower(email) = v_email and accepted_at is null;

  insert into public.user_invites (firm_id, email, full_name, role_id)
  values (p_firm_id, v_email, v_full, p_role_id)
  returning id, token, expires_at into v_invite, v_token, v_expires;

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'invite_user', p_firm_id, v_name,
    jsonb_build_object('email', v_email, 'role_id', p_role_id));

  return jsonb_build_object(
    'invite_id', v_invite, 'token', v_token,
    'expires_at', v_expires, 'email', v_email
  );
end $$;


-- ── 9 · Operator management ────────────────────────────────────────────────
-- The target must ALREADY have an activated profile. That makes the slot
-- un-raceable: there is no window in which an allowlist row exists for an
-- identity that has not been created yet, which is what an email-keyed
-- allowlist would have opened up under open signup.
create or replace function public.vastos_add_operator(p_auth_uid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor record; v_email text;
begin
  select * into v_actor from public.vastos_require_operator();

  if p_auth_uid is null then
    raise exception 'an auth uid is required' using errcode = '22023';
  end if;

  select pr.email into v_email
  from public.profiles pr
  where pr.auth_uid = p_auth_uid
  limit 1;

  if v_email is null then
    raise exception 'that identity has no activated profile yet' using errcode = '22023';
  end if;

  insert into public.vastos_operators (auth_uid, email, added_by)
  values (p_auth_uid, lower(v_email), v_actor.actor_uid)
  on conflict (auth_uid) do update
    set revoked_at = null,
        email      = excluded.email,
        added_by   = excluded.added_by,
        added_at   = now();

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'add_operator', null, null,
    jsonb_build_object('operator_email', lower(v_email)));
end $$;


create or replace function public.vastos_revoke_operator(p_auth_uid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor record; v_email text; v_remaining integer;
begin
  select * into v_actor from public.vastos_require_operator();

  -- Both 25000: these are invariants about the console still being reachable,
  -- not authorization failures.
  if p_auth_uid = v_actor.actor_uid then
    raise exception 'an operator cannot revoke themselves' using errcode = '25000';
  end if;

  select o.email into v_email
  from public.vastos_operators o
  where o.auth_uid = p_auth_uid and o.revoked_at is null;

  if v_email is null then
    raise exception 'that identity is not an active operator' using errcode = '22023';
  end if;

  select count(*) into v_remaining
  from public.vastos_operators o
  where o.revoked_at is null and o.auth_uid <> p_auth_uid;

  if v_remaining < 1 then
    raise exception 'the last active platform operator cannot be revoked'
      using errcode = '25000';
  end if;

  update public.vastos_operators set revoked_at = now() where auth_uid = p_auth_uid;

  perform public.vastos_log(v_actor.actor_uid, v_actor.actor_email,
    'revoke_operator', null, null,
    jsonb_build_object('operator_email', v_email));
end $$;


-- The console cannot offer a role picker without this. crm_roles is RLS-scoped
-- to current_firm_id(), so an operator reading another tenant's roles directly
-- gets nothing back — and vastos_invite_firm_user REQUIRES a role that belongs
-- to the target firm, so without this the invite verb can only ever send a
-- role-less invite.
create or replace function public.vastos_list_firm_roles(p_firm_id uuid)
returns table (id text, key text, name text, is_admin boolean, enabled boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.vastos_require_operator();
  return query
    select r.id, r.key, r.name, r.is_admin, r.enabled
    from public.crm_roles r
    where r.firm_id = p_firm_id
    order by r.is_admin desc, r.name;
end $$;


create or replace function public.vastos_list_operators()
returns table (auth_uid uuid, email text, added_at timestamptz, revoked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.vastos_require_operator();
  return query
    select o.auth_uid, o.email, o.added_at, o.revoked_at
    from public.vastos_operators o
    order by o.revoked_at nulls first, o.added_at;
end $$;


-- ── 10 · Plan entitlements a provisioned firm needs to be usable ───────────
-- Found by provisioning a firm and reading what its owner would actually see.
--
-- canAccess() in usePermissions is `rbacCanAccess(role) && planAllows(module)`,
-- and planAllows tests plan.module_keys. NOT ONE plan lists users, roles,
-- notifications or activity-log, nor any of the six project sub-pages. Until
-- now that was invisible: the only account in existence has no
-- firm_subscriptions row at all, and planAllows returns true when plan is null,
-- so it failed open.
--
-- The moment vastos_provision_firm attaches a real plan, it stops failing open.
-- A newly provisioned firm's owner — is_admin, role 'owner' — would open the app
-- and find no Users page, no Roles & Access page, no notifications, no activity
-- log, and AccessDenied on every document, payment, cost, milestone, comment and
-- site update inside their own projects. The console's entire purpose is
-- creating firms that work, so this is in scope for it.
--
-- Only infrastructure modules are added, never features: Starter deliberately
-- omits boq/quotations/vendors/catalog/marketing and keeps omitting them. Every
-- plan already includes 'projects', so its sub-pages belong with it.
update public.subscription_plans sp
   set module_keys = (
     select jsonb_agg(distinct k order by k)
     from jsonb_array_elements_text(
       sp.module_keys || jsonb_build_array(
         'users', 'roles', 'notifications', 'activity-log',
         'milestones', 'payments', 'costs', 'documents', 'comments', 'site-updates'
       )
     ) as k
   )
 where sp.is_active;


-- ── 11 · Bootstrap ─────────────────────────────────────────────────────────
-- The operators' own tenant. They are ordinary users with an ordinary profiles
-- row — there is no firmless identity in this application, and inventing one
-- would mean restructuring resolveSession and HydrationGate both. A dedicated
-- internal firm keeps them out of crm_actor_is_admin()'s UNSCOPED first arm
-- (profiles.role='owner' matches in any firm), stops them consuming a customer's
-- seat and appearing in a customer's user list, and contains the HydrationGate
-- failure mode — crmApi.hydrateAll rejects if any of its 24 reads fails and
-- store.hydrate caches the rejected promise forever, so an operator whose home
-- firm will not hydrate gets a permanent spinner and no route to the console.
--
-- Operators 2 and 3 are invited into this firm through the console and added via
-- the audited vastos_add_operator.
do $$
declare
  v_firm uuid;
  v_plan uuid;
begin
  select id into v_firm from public.firms where name = 'Vasto Internal' limit 1;

  if v_firm is null then
    insert into public.firms (name, address, payment_split_default)
    values ('Vasto Internal', '', 0)
    returning id into v_firm;
    raise notice 'Platform-C: created the Vasto Internal operator tenant (%)', v_firm;
  end if;

  select id into v_plan from public.subscription_plans
   where name = 'Enterprise' and is_active order by created_at limit 1;

  if v_plan is not null and not exists (
    select 1 from public.firm_subscriptions where firm_id = v_firm
  ) then
    insert into public.firm_subscriptions (firm_id, plan_id, status)
    values (v_firm, v_plan, 'active');
  end if;

  if not exists (select 1 from public.crm_roles where firm_id = v_firm) then
    insert into public.crm_roles (id, firm_id, key, name, is_admin, enabled, color)
    values
      (gen_random_uuid()::text, v_firm, 'owner',     'Owner',     true,  true, '#6366f1'),
      (gen_random_uuid()::text, v_firm, 'architect', 'Architect', false, true, '#0ea5e9'),
      (gen_random_uuid()::text, v_firm, 'engineer',  'Engineer',  false, true, '#f59e0b'),
      (gen_random_uuid()::text, v_firm, 'client',    'Client',    false, true, '#10b981');
  end if;

  perform public.vastos_seed_firm_defaults(v_firm);
end $$;


-- Operator #1. Seeded from auth.users by email, and by AUTH_UID thereafter.
-- raise warning rather than exception: a migration that cannot succeed against a
-- clean database must never abort the tree (the C1b §4 precedent). On a local
-- reset there is no such auth user and that is fine — the console is simply
-- unreachable until somebody is added.
do $$
declare v_uid uuid; v_email text := 'vasto.api@gmail.com';
begin
  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;

  if v_uid is null then
    raise warning 'Platform-C: no auth user for % — the operator allowlist is EMPTY and the console is unreachable until one is added out of band', v_email;
    return;
  end if;

  insert into public.vastos_operators (auth_uid, email)
  values (v_uid, v_email)
  on conflict (auth_uid) do update set revoked_at = null;

  raise notice 'Platform-C: seeded % as operator #1 (%)', v_email, v_uid;
end $$;


-- ── 12 · Grants ────────────────────────────────────────────────────────────
-- Every operator function is reachable only by an authenticated caller, and the
-- in-body operator check is the real boundary — production still has open
-- signup, so `authenticated` currently means "anyone who can confirm an email
-- address", NOT "a customer's user". Turning signup off is the owner action
-- that makes this grant mean what it looks like it means.
--
-- The three internal helpers are revoked from authenticated too: they are only
-- ever called from inside another definer.
revoke all on function public.vastos_require_operator()                       from public, anon, authenticated;
revoke all on function public.vastos_log(uuid, text, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.vastos_seed_firm_defaults(uuid)                 from public, anon, authenticated;
revoke all on function public.vastos_assert_not_operator_home(uuid)           from public, anon, authenticated;

revoke all on function public.is_vastos_operator()                            from public, anon;
revoke all on function public.vastos_list_firms(boolean)                      from public, anon;
revoke all on function public.vastos_list_admin_log(integer, uuid)            from public, anon;
revoke all on function public.vastos_list_operators()                         from public, anon;
revoke all on function public.vastos_list_firm_roles(uuid)                     from public, anon;
revoke all on function public.vastos_provision_firm(text, text, text, uuid, integer) from public, anon;
revoke all on function public.vastos_suspend_firm(uuid)                       from public, anon;
revoke all on function public.vastos_unsuspend_firm(uuid)                     from public, anon;
revoke all on function public.vastos_blacklist_firm(uuid, text)               from public, anon;
revoke all on function public.vastos_unblacklist_firm(uuid)                   from public, anon;
revoke all on function public.vastos_delete_firm(uuid, text)                  from public, anon;
revoke all on function public.vastos_set_firm_seats(uuid, integer)            from public, anon;
revoke all on function public.vastos_invite_firm_user(uuid, text, text, text) from public, anon;
revoke all on function public.vastos_add_operator(uuid)                       from public, anon;
revoke all on function public.vastos_revoke_operator(uuid)                    from public, anon;

grant execute on function public.is_vastos_operator()                         to authenticated;
grant execute on function public.vastos_list_firms(boolean)                   to authenticated;
grant execute on function public.vastos_list_admin_log(integer, uuid)         to authenticated;
grant execute on function public.vastos_list_operators()                      to authenticated;
grant execute on function public.vastos_provision_firm(text, text, text, uuid, integer) to authenticated;
grant execute on function public.vastos_suspend_firm(uuid)                    to authenticated;
grant execute on function public.vastos_unsuspend_firm(uuid)                  to authenticated;
grant execute on function public.vastos_blacklist_firm(uuid, text)            to authenticated;
grant execute on function public.vastos_unblacklist_firm(uuid)                to authenticated;
grant execute on function public.vastos_delete_firm(uuid, text)               to authenticated;
grant execute on function public.vastos_set_firm_seats(uuid, integer)         to authenticated;
grant execute on function public.vastos_invite_firm_user(uuid, text, text, text) to authenticated;
grant execute on function public.vastos_add_operator(uuid)                    to authenticated;
grant execute on function public.vastos_revoke_operator(uuid)                 to authenticated;


-- ── 13 · Assertions ────────────────────────────────────────────────────────

-- The allowlist is deny-all.
do $$
declare v_bad text;
begin
  select string_agg(policyname, ', ') into v_bad
  from pg_policies where schemaname = 'public' and tablename = 'vastos_operators';
  if v_bad is not null then
    raise exception 'Platform-C: vastos_operators carries client policies: %', v_bad;
  end if;

  select string_agg(grantee, ', ') into v_bad
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'vastos_operators'
    and grantee in ('anon', 'authenticated', 'PUBLIC');
  if v_bad is not null then
    raise exception 'Platform-C: vastos_operators is reachable by: %', v_bad;
  end if;

  if not exists (select 1 from pg_class
                 where oid = 'public.vastos_operators'::regclass and relrowsecurity) then
    raise exception 'Platform-C: vastos_operators does not have RLS enabled';
  end if;

  raise notice 'Platform-C verified: the operator allowlist is deny-all';
end $$;

-- Every client-facing vastos_* function must be a SECURITY DEFINER with a
-- pinned search_path that actually calls the gate. A definer that forgot
-- vastos_require_operator() is a cross-tenant hole with a reassuring name.
do $$
declare
  r    record;
  src  text;
  v_bad text := '';
begin
  for r in
    select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname like 'vastos\_%'
      and p.proname not in ('vastos_log', 'vastos_seed_firm_defaults',
                            'vastos_require_operator', 'vastos_assert_not_operator_home')
  loop
    if not r.prosecdef then
      v_bad := v_bad || r.proname || ' (not security definer), ';
      continue;
    end if;
    if r.proconfig is null or not ('search_path=' = any(select split_part(c, '"', 1) from unnest(r.proconfig) c)
                                   or exists (select 1 from unnest(r.proconfig) c where c like 'search_path=%')) then
      v_bad := v_bad || r.proname || ' (search_path not pinned), ';
      continue;
    end if;

    select string_agg(regexp_replace(line, '--.*$', ''), E'\n') into src
    from regexp_split_to_table(pg_get_functiondef(r.oid), E'\n') as line;

    if src !~ 'vastos_require_operator' then
      v_bad := v_bad || r.proname || ' (does not call the operator gate), ';
    end if;
  end loop;

  if v_bad <> '' then
    raise exception 'Platform-C: ungated operator functions: %', rtrim(v_bad, ', ');
  end if;
  raise notice 'Platform-C verified: every vastos_* RPC is a gated definer with a pinned search_path';
end $$;

-- The internal helpers must NOT be callable from a browser.
do $$
declare v_bad text;
begin
  select string_agg(p.proname || '/' || g.rolname, ', ') into v_bad
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  cross join (select unnest(array['anon', 'authenticated']) as rolname) g
  where ns.nspname = 'public'
    and p.proname in ('vastos_require_operator', 'vastos_log',
                      'vastos_seed_firm_defaults', 'vastos_assert_not_operator_home')
    and has_function_privilege(g.rolname, p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'Platform-C: internal helpers reachable by a client role: %', v_bad;
  end if;
  raise notice 'Platform-C verified: operator helpers are unreachable from a client role';
end $$;

-- Re-run C3's anon-surface pin. C3 ran fifteen files earlier and cannot see
-- anything added since; this migration adds fourteen functions, and the whole
-- point of that assertion is that a fourth anon-executable function should be a
-- deliberate act.
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
    raise exception 'Platform-C: unexpected anon-executable functions: %', extra;
  end if;
  raise notice 'Platform-C verified: anon still executes exactly three functions';
end $$;

-- Signatures are pinned. PostgREST binds RPC arguments BY NAME, so renaming a
-- parameter silently breaks the caller with a 404 that reads like a missing
-- function — W1a had to drop create_invite/3 over exactly this.
do $$
declare v_missing text := '';
  v_sig text;
begin
  foreach v_sig in array array[
    'public.is_vastos_operator()',
    'public.vastos_list_firms(p_include_deleted boolean)',
    'public.vastos_list_admin_log(p_limit integer, p_firm_id uuid)',
    'public.vastos_list_operators()',
    'public.vastos_list_firm_roles(p_firm_id uuid)',
    'public.vastos_provision_firm(p_firm_name text, p_owner_email text, p_owner_name text, p_plan_id uuid, p_trial_days integer)',
    'public.vastos_suspend_firm(p_firm_id uuid)',
    'public.vastos_unsuspend_firm(p_firm_id uuid)',
    'public.vastos_blacklist_firm(p_firm_id uuid, p_reason text)',
    'public.vastos_unblacklist_firm(p_firm_id uuid)',
    'public.vastos_delete_firm(p_firm_id uuid, p_confirm_name text)',
    'public.vastos_set_firm_seats(p_firm_id uuid, p_seats integer)',
    'public.vastos_invite_firm_user(p_firm_id uuid, p_email text, p_full_name text, p_role_id text)',
    'public.vastos_add_operator(p_auth_uid uuid)',
    'public.vastos_revoke_operator(p_auth_uid uuid)'
  ]
  loop
    if to_regprocedure(regexp_replace(v_sig, '(\(|, )[a-z_]+ ', '\1', 'g')) is null then
      v_missing := v_missing || v_sig || ', ';
    end if;
  end loop;

  if v_missing <> '' then
    raise exception 'Platform-C: missing expected signature(s): %', rtrim(v_missing, ', ');
  end if;

  -- And the argument NAMES, which is the half regprocedure cannot check.
  if (select pg_get_function_identity_arguments('public.vastos_provision_firm(text,text,text,uuid,integer)'::regprocedure)) is null then
    raise exception 'Platform-C: vastos_provision_firm signature drifted';
  end if;

  -- Only the INPUT arguments. proargnames on a `returns table` function holds
  -- the input names followed by every OUT column name, so unnesting the whole
  -- array flags vastos_list_firms for its own result columns.
  select string_agg(p.proname, ', ') into v_missing
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname like 'vastos\_%'
    and p.pronargs > 0
    and (p.proargnames is null or exists (
      select 1 from unnest(p.proargnames[1:p.pronargs]) an where an !~ '^p_'
    ));
  if v_missing is not null then
    raise exception 'Platform-C: vastos_* functions with unnamed or non-p_ arguments (PostgREST binds by name): %', v_missing;
  end if;

  raise notice 'Platform-C verified: every operator RPC signature is present and named for PostgREST';
end $$;

-- Behavioural rehearsal. Assertions about the catalog prove the shape of the
-- gate; this proves it actually refuses people. Runs entirely inside a
-- subtransaction that is rolled back.
do $$
declare
  v_firm  uuid;
  v_uid   uuid := '00000000-dead-4bee-8000-000000000001';
  v_ok    boolean;
  v_stage text := '';
begin
  begin
    insert into public.firms (id, name, address, payment_split_default)
    values (gen_random_uuid(), 'Platform-C rehearsal firm', '', 0)
    returning id into v_firm;

    -- A firm OWNER who is not an operator. The strongest non-operator there is:
    -- crm_actor_is_admin() returns true for them in every firm.
    insert into public.profiles (firm_id, auth_uid, email, full_name, role)
    values (v_firm, v_uid, 'rehearsal-owner@platform-c.test', 'Rehearsal Owner', 'owner');

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

    -- 1 · a firm owner who is not an operator must be refused
    v_stage := 'non-operator firm owner';
    begin
      perform public.vastos_list_firms(false);
      raise exception 'Platform-C: a non-operator firm OWNER was allowed to list every firm';
    exception
      when sqlstate '42501' then null;
    end;

    -- 2 · an operator must succeed
    v_stage := 'operator';
    insert into public.vastos_operators (auth_uid, email)
    values (v_uid, 'rehearsal-owner@platform-c.test');

    select public.is_vastos_operator() into v_ok;
    if not v_ok then
      raise exception 'Platform-C: an allowlisted operator was not recognised';
    end if;
    perform public.vastos_list_firms(false);

    -- 3 · revocation takes effect in the SAME session, with no new token
    v_stage := 'revoked operator';
    update public.vastos_operators set revoked_at = now() where auth_uid = v_uid;

    select public.is_vastos_operator() into v_ok;
    if v_ok then
      raise exception 'Platform-C: a revoked operator is still recognised — revocation is not immediate';
    end if;
    begin
      perform public.vastos_list_firms(false);
      raise exception 'Platform-C: a REVOKED operator could still list every firm';
    exception
      when sqlstate '42501' then null;
    end;

    raise exception 'platform_c_rehearsal_rollback';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'platform_c_rehearsal_rollback' then
        raise exception 'Platform-C rehearsal failed at [%]: %', v_stage, sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'Platform-C verified: non-operator owner refused · operator allowed · revoked operator refused again in-session';
end $$;

-- Provisioning must create a firm and NO identity.
do $$
declare
  v_uid    uuid := '00000000-dead-4bee-8000-000000000002';
  v_plan   uuid;
  v_res    jsonb;
  v_firm   uuid;
  v_n      integer;
  v_detail jsonb;
begin
  select id into v_plan from public.subscription_plans where is_active order by name limit 1;
  if v_plan is null then
    raise notice 'Platform-C: no subscription plan to rehearse provisioning with — skipped';
    return;
  end if;

  begin
    insert into public.profiles (firm_id, auth_uid, email, full_name, role)
    select f.id, v_uid, 'prov-rehearsal@platform-c.test', 'Prov Rehearsal', 'engineer'
    from public.firms f order by f.created_at limit 1;

    insert into public.vastos_operators (auth_uid, email)
    values (v_uid, 'prov-rehearsal@platform-c.test');

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

    v_res  := public.vastos_provision_firm('Rehearsal Provisioned Ltd',
                'new-owner@platform-c.test', 'New Owner', v_plan, 14);
    v_firm := (v_res ->> 'firm_id')::uuid;

    select count(*) into v_n from public.crm_roles where firm_id = v_firm;
    if v_n <> 4 then raise exception 'expected 4 roles, got %', v_n; end if;

    if not exists (select 1 from public.crm_roles
                   where firm_id = v_firm and key = 'owner' and is_admin) then
      raise exception 'the seeded owner role is missing or not is_admin';
    end if;

    select count(*) into v_n from public.profiles where firm_id = v_firm;
    if v_n <> 0 then raise exception 'provisioning created % profiles row(s) — it must create no identity', v_n; end if;

    select count(*) into v_n from public.crm_profiles where firm_id = v_firm;
    if v_n <> 0 then raise exception 'provisioning created % crm_profiles row(s) — it must create no identity', v_n; end if;

    -- The invite's role must belong to the new firm (phase B).
    if not exists (
      select 1 from public.user_invites i
      join public.crm_roles r on r.id = i.role_id and r.firm_id = i.firm_id
      where i.firm_id = v_firm and r.key = 'owner'
    ) then
      raise exception 'the owner invite does not carry a firm-scoped owner role';
    end if;

    select count(*) into v_n from public.crm_pipeline_stages where firm_id = v_firm;
    if v_n < 9 then raise exception 'expected the 9 seeded pipeline stages, got %', v_n; end if;

    select count(*) into v_n from public.crm_role_permissions where firm_id = v_firm;
    if v_n < 1 then raise exception 'no role permissions were seeded — non-admin roles would grant nothing'; end if;

    -- Attributed, and carrying no bearer token.
    select details into v_detail from public.vastos_admin_log
     where firm_id = v_firm and action = 'provision' limit 1;
    if v_detail is null then raise exception 'provisioning wrote no audit row'; end if;
    if not exists (select 1 from public.vastos_admin_log
                   where firm_id = v_firm and actor_auth_uid = v_uid) then
      raise exception 'the provisioning audit row is not attributed to the actor';
    end if;
    if v_detail::text like '%' || (v_res ->> 'token') || '%' then
      raise exception 'the invite TOKEN was written to the audit log, which every operator can read';
    end if;

    -- Anti-lockout: the rehearsal operator's own home firm must be undeletable.
    begin
      perform public.vastos_delete_firm(
        (select firm_id from public.profiles where auth_uid = v_uid),
        (select f.name from public.firms f
          join public.profiles pr on pr.firm_id = f.id where pr.auth_uid = v_uid));
      raise exception 'an operator was allowed to delete their own home tenant';
    exception
      when sqlstate '25000' then null;
    end;

    raise exception 'platform_c_provision_rollback';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'platform_c_provision_rollback' then
        raise exception 'Platform-C provisioning rehearsal failed: %', sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'Platform-C verified: provisioning writes 4 roles / 0 profiles / 0 crm_profiles / firm-scoped invite / defaults / attributed log, no token in the log, and cannot delete an operator''s home firm';
end $$;
