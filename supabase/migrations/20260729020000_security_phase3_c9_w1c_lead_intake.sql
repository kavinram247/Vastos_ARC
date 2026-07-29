-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 3 — C9 · every website lead written to the demo tenant
--                    W1c · PostgREST filter injection in lead-intake
--
-- Both live in supabase/functions/lead-intake/index.ts, deployed to production.
--
-- C9. `const FIRM_ID = '11111111-1111-4111-8111-111111111111'` was hardcoded,
-- so every website enquiry from every customer's site was written into the demo
-- firm — tenant B's prospects (name, email, phone, stated requirements) became
-- rows tenant A read as its own pipeline. This is H3 surviving in the one place
-- H3 never looked: Phase 1 closed H3 by deleting demo-firm constants from the
-- client, and this one was invisible because the function was not in the repo.
-- The audit asked whether a caller could write into an ARBITRARY firm_id; the
-- answer was that every caller wrote into exactly one, wrong for everybody
-- except the demo firm.
--
-- W1c. `email` and `phone` were interpolated raw into a PostgREST .or() filter
-- whose delimiters are exactly the characters the caller controls:
--
--   if (email) ors.push(`email.eq.${email}`);
--   … .eq('firm_id', FIRM_ID).or(ors.join(',')).limit(1);
--
-- Reproduced: or=(email.eq.nobody@nowhere.tld) returns [], while
-- or=(email.eq.nobody@nowhere.tld,full_name.like.Priya*) returns the match. The
-- comma survives the percent-encoding supabase-js applies. Because the response
-- carried `returning: !!contactId`, that was a boolean oracle — unauthenticated
-- blind enumeration of crm_contacts, character by character, over the same firm
-- C9 funnelled every tenant into.
--
-- The fix for both is the same shape: the webhook stops being logic in Deno and
-- becomes one SECURITY DEFINER call.
--
--   · the firm is resolved from a per-firm bearer token, not a constant;
--   · the contact match is a parameterised query, so there is no filter string
--     for a caller to close and extend;
--   · the response no longer says whether the contact already existed, because
--     that answer was itself an enumeration oracle even without the injection;
--   · fields are length-bounded and email/phone format-checked;
--   · the firm is rate-limited.
--
-- Audit refs: C9, W1c.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Per-firm webhook credentials ───────────────────────────────────────────
-- Only the SHA-256 of the token is stored. A database disclosure therefore
-- yields no usable webhook credential, and there is no read path — not even for
-- an admin — that returns a token after the moment it is minted.
create table if not exists public.crm_webhook_tokens (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  kind         text not null default 'lead_intake',
  token_hash   text not null unique,
  label        text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists crm_webhook_tokens_firm on public.crm_webhook_tokens (firm_id, kind);

alter table public.crm_webhook_tokens enable row level security;

-- No policy of any kind: the table is reachable only through the RPCs below.
-- Note the explicit revoke of `authenticated` as well as `anon` — C8's
-- assertion established that CREATE TABLE hands `authenticated` full DML on
-- every new table, because Phase 2's C1b cleared the default privileges for
-- anon only. Without this line the firm's own members could read the hashes and
-- delete each other's tokens.
revoke all on public.crm_webhook_tokens from anon, authenticated, public;


create or replace function public.crm_webhook_token_hash(p_token text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function public.crm_webhook_token_hash(text) from public, anon, authenticated;


-- ── Mint a token ───────────────────────────────────────────────────────────
-- Returns the plaintext exactly once. There is deliberately no way to read it
-- back: if an admin loses it they mint another and revoke the old one.
create or replace function public.create_lead_intake_token(p_label text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_firm  uuid;
  v_pid   uuid;
  v_token text;
  v_id    uuid;
begin
  select pr.firm_id, pr.id into v_firm, v_pid
  from public.profiles pr
  where pr.auth_uid = auth.uid()
  limit 1;

  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not public.crm_has_permission('leads', 'edit') then
    raise exception 'permission denied: edit on leads' using errcode = '42501';
  end if;

  -- 32 bytes, same strength as the invite token C3 established.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.crm_webhook_tokens (firm_id, kind, token_hash, label, created_by)
  values (v_firm, 'lead_intake', public.crm_webhook_token_hash(v_token),
          nullif(btrim(coalesce(p_label, '')), ''), v_pid)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'firm_id', v_firm);
end $$;

revoke all on function public.create_lead_intake_token(text) from public, anon;
grant execute on function public.create_lead_intake_token(text) to authenticated;


-- ── List / revoke ──────────────────────────────────────────────────────────
-- The listing carries no token and no hash — C3's lesson, that a management
-- view of credentials must not be a distribution channel for them.
create or replace function public.list_lead_intake_tokens()
returns table(id uuid, label text, created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.label, t.created_at, t.last_used_at, t.revoked_at
  from public.crm_webhook_tokens t
  join public.profiles pr on pr.firm_id = t.firm_id
  where pr.auth_uid = auth.uid()
    and t.kind = 'lead_intake'
    and public.crm_has_permission('leads', 'view')
  order by t.created_at desc;
$$;

revoke all on function public.list_lead_intake_tokens() from public, anon;
grant execute on function public.list_lead_intake_tokens() to authenticated;


create or replace function public.revoke_lead_intake_token(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_firm uuid;
begin
  select pr.firm_id into v_firm
  from public.profiles pr
  where pr.auth_uid = auth.uid()
  limit 1;

  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.crm_has_permission('leads', 'edit') then
    raise exception 'permission denied: edit on leads' using errcode = '42501';
  end if;

  update public.crm_webhook_tokens
     set revoked_at = now()
   where id = p_id and firm_id = v_firm and revoked_at is null;
end $$;

revoke all on function public.revoke_lead_intake_token(uuid) from public, anon;
grant execute on function public.revoke_lead_intake_token(uuid) to authenticated;


-- ── The webhook itself ─────────────────────────────────────────────────────
-- Everything the edge function used to do in Deno now happens here, in one
-- transaction, with every value passed as a parameter rather than concatenated
-- into a filter. Granted to service_role only: the sole caller is the edge
-- function, which holds the token and applies the HTTP-level plumbing.
create or replace function public.lead_intake_capture(
  p_token        text,
  p_name         text,
  p_email        text default null,
  p_phone        text default null,
  p_project_type text default null,
  p_message      text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_firm       uuid;
  v_tok        uuid;
  v_flag       boolean;
  v_name       text := nullif(btrim(coalesce(p_name, '')), '');
  v_email      text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_phone      text := nullif(btrim(coalesce(p_phone, '')), '');
  v_type       text := coalesce(nullif(btrim(coalesce(p_project_type, '')), ''), 'Website enquiry');
  v_message    text := nullif(btrim(coalesce(p_message, '')), '');
  v_contact    text;
  v_status     text;
  v_lead       text;
  v_recent     integer;
  c_rate_limit constant integer := 100;   -- website enquiries per firm per hour
begin
  -- ── Authenticate the webhook ────────────────────────────────────────────
  -- This is C9's fix. The firm comes from the credential the caller presents,
  -- so two customers' websites can no longer land in the same pipeline, and an
  -- unauthenticated stranger cannot write into anybody's.
  if p_token is null or length(p_token) < 32 then
    raise exception 'invalid webhook token' using errcode = '28000';
  end if;

  select t.id, t.firm_id into v_tok, v_firm
  from public.crm_webhook_tokens t
  where t.token_hash = public.crm_webhook_token_hash(p_token)
    and t.kind = 'lead_intake'
    and t.revoked_at is null;

  if v_firm is null then
    raise exception 'invalid webhook token' using errcode = '28000';
  end if;

  -- ── Feature flag ────────────────────────────────────────────────────────
  select f.enabled into v_flag
  from public.crm_feature_flags f
  where f.firm_id = v_firm and f.key = 'website_capture';

  if v_flag is false then
    raise exception 'website capture disabled' using errcode = '42501';
  end if;

  -- ── Validate. Every field was previously an unbounded string written ────
  -- straight to Postgres.
  if v_name is null then
    raise exception 'name is required' using errcode = '22023';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'email or phone is required' using errcode = '22023';
  end if;
  if length(v_name) > 200 or length(coalesce(v_email, '')) > 320
     or length(coalesce(v_phone, '')) > 32 or length(v_type) > 120
     or length(coalesce(v_message, '')) > 5000 then
    raise exception 'a submitted field is too long' using errcode = '22023';
  end if;
  -- Stricter than the invite RPC's `[^@[:space:]]+` shape, deliberately. That
  -- one admits any non-space character, so W1c's own payload —
  -- nobody@nowhere.tld,full_name.like.Priya* — passes it as a valid address.
  -- The injection is dead either way now that the match is parameterised, but
  -- an address containing a PostgREST filter fragment should never have been
  -- stored as a customer's email in the first place. Commas, asterisks and
  -- parentheses are not addressable characters here.
  if v_email is not null
     and v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'invalid email address' using errcode = '22023';
  end if;
  if v_phone is not null
     and regexp_replace(v_phone, '\s', '', 'g') !~ '^\+?[0-9][0-9()-]{5,19}$' then
    raise exception 'invalid phone number' using errcode = '22023';
  end if;

  -- ── Rate limit ──────────────────────────────────────────────────────────
  -- The endpoint is public by design, so this is the only thing standing
  -- between a stranger holding the token and an unusable lead pipeline.
  select count(*) into v_recent
  from public.crm_leads l
  where l.firm_id = v_firm
    and l.source = 'website'
    and l.created_at > now() - interval '1 hour';

  if v_recent >= c_rate_limit then
    raise exception 'website capture rate limit reached' using errcode = '54000';
  end if;

  -- ── Returning-customer match ────────────────────────────────────────────
  -- W1c's fix. Two parameterised equality tests, evaluated by the planner —
  -- there is no filter STRING here at all, so there is nothing for a comma in
  -- an email address to terminate. Compare emails case-insensitively, which
  -- the interpolated .eq. never did.
  select c.id into v_contact
  from public.crm_contacts c
  where c.firm_id = v_firm
    and (
      (v_email is not null and lower(c.email) = v_email)
      or (v_phone is not null and c.phone = v_phone)
    )
  limit 1;

  if v_contact is null then
    insert into public.crm_contacts (id, firm_id, full_name, email, phone)
    values (gen_random_uuid()::text, v_firm, v_name, v_email, v_phone)
    returning id into v_contact;
  end if;

  -- ── First active pipeline stage ─────────────────────────────────────────
  select s.key into v_status
  from public.crm_pipeline_stages s
  where s.firm_id = v_firm and s.category = 'active'
  order by s.order_index
  limit 1;

  insert into public.crm_leads (
    id, firm_id, client_name, client_email, client_phone, project_type,
    project_requirements, status, source, priority, inquiry_date, contact_id, created_by
  ) values (
    gen_random_uuid()::text, v_firm, v_name, v_email, v_phone, v_type,
    v_message, coalesce(v_status, 'new'), 'website', 'medium',
    current_date, v_contact, 'website'
  )
  returning id into v_lead;

  update public.crm_webhook_tokens set last_used_at = now() where id = v_tok;

  -- Deliberately NOT returning whether the contact already existed. The old
  -- response carried `returning: !!contactId`, and that boolean was the oracle
  -- W1c's injection read one character at a time — it leaks "is this person a
  -- customer of yours" to anyone who can reach the endpoint, injection or not.
  return jsonb_build_object('ok', true, 'lead_id', v_lead);
end $$;

revoke all on function public.lead_intake_capture(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.lead_intake_capture(text, text, text, text, text, text)
  to service_role;


-- ── Assertions ─────────────────────────────────────────────────────────────
do $$
begin
  -- The webhook must not be callable straight off the public REST API with the
  -- anon key: the edge function is where the plumbing lives, and bypassing it
  -- would bypass whatever is added there later.
  if has_function_privilege('anon', 'public.lead_intake_capture(text, text, text, text, text, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.lead_intake_capture(text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'C9: lead_intake_capture must be service_role only';
  end if;
  if not has_function_privilege('service_role', 'public.lead_intake_capture(text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'C9: service_role cannot execute lead_intake_capture';
  end if;

  if has_function_privilege('anon', 'public.create_lead_intake_token(text)', 'EXECUTE') then
    raise exception 'C9: create_lead_intake_token must not be anon-executable';
  end if;
end $$;

-- The token table must be unreachable except through the RPCs. A firm member
-- who can SELECT it holds every sibling firm's hash; one who can DELETE from it
-- can silently switch off a competitor's lead capture.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'crm_webhook_tokens'
  loop
    raise exception 'C9: crm_webhook_tokens carries policy % — it must be '
                    'reachable only through the RPCs', p.policyname;
  end loop;

  if has_table_privilege('anon', 'public.crm_webhook_tokens', 'SELECT')
     or has_table_privilege('authenticated', 'public.crm_webhook_tokens', 'SELECT') then
    raise exception 'C9: webhook token hashes are readable from the client';
  end if;
end $$;

-- W1c regression guard. The defect was a filter string built by concatenation;
-- assert the replacement takes its inputs as parameters and contains no
-- PostgREST filter syntax at all.
do $$
declare
  v_src  text;
  v_code text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lead_intake_capture';

  -- Strip -- comments first. The commentary above deliberately quotes the old
  -- `email.eq.` filter to explain what was wrong, and on the first run this
  -- assertion matched its own prose. What matters is whether the syntax appears
  -- in executable code.
  v_code := regexp_replace(v_src, '--[^\n]*', '', 'g');

  if v_code ~ '\.eq\.' or v_code ~ '\.or\(' then
    raise exception 'W1c: lead_intake_capture contains PostgREST filter syntax — '
                    'the injection has been reintroduced';
  end if;
  raise notice 'C9/W1c verified: per-firm webhook token, parameterised contact match';
end $$;
