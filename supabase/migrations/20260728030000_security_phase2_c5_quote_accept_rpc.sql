-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 2 — C5 · quote acceptance recomputed server-side
--
-- Was: acceptQuote() (src/boq/quoteShareApi.ts:88) took `taxable`, `gst`,
-- `grandTotal` and `firmId` COMPUTED IN THE BROWSER and wrote them straight
-- into payment_schedules / payment_milestones, updating the quotation by
-- `.eq('id', quotationId)` with no re-verification of the share token.
-- Intercepting the request and setting grandTotal to 1 billed the client ₹1.
--
-- Now: the client sends no monetary value at all. It sends the share token,
-- a signatory name, and which optional line ids it wants. Everything else is
-- recomputed here from boq_line_items.
--
-- Two functions, and they are the ONLY things anon may execute:
--   quote_public_view(token)                 → read the quote (also marks viewed)
--   accept_quote(token, name, selected[])    → accept, recompute, build schedule
--
-- C1 revoked every anon grant, so the public quote page has been dead since
-- Phase 1. These restore it through a narrow, auditable door instead of
-- re-opening table access.
--
-- Audit refs: C5. See the security audit artifact.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · The money, in one place ────────────────────────────────────────────
-- Mirrors clientQuoteView() in src/boq/engine/documents.ts:52 exactly, so the
-- figure the client renders while toggling add-ons matches the figure that is
-- ultimately written. The client's arithmetic is now cosmetic; this is binding.
--
-- GST follows the app's rule: per-line GST at the line's own rate, fees taxed
-- at a flat 18%, and the whole GST base scaled down by the discount percentage
-- (rather than discounting the taxable base and re-taxing it).
create or replace function public.quote_compute_totals(
  p_boq_id   uuid,
  p_selected uuid[],
  p_design   numeric,
  p_super    numeric,
  p_other    numeric,
  p_disc     numeric
)
returns table (
  items_subtotal     numeric,
  optionals_subtotal numeric,
  fees               numeric,
  discount           numeric,
  taxable            numeric,
  gst                numeric,
  grand_total        numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    select li.id, li.selling_price, li.gst_rate, li.is_optional
    from public.boq_line_items li
    where li.boq_id = p_boq_id
  ),
  committed as (
    select * from lines where not is_optional
  ),
  chosen as (
    select * from lines
    where is_optional
      and id = any(coalesce(p_selected, '{}'::uuid[]))
  ),
  base as (
    select
      round(coalesce((select sum(selling_price) from committed), 0), 2) as items_sub,
      round(coalesce((select sum(selling_price) from chosen),    0), 2) as opt_sub,
      round(coalesce(p_design, 0) + coalesce(p_super, 0) + coalesce(p_other, 0), 2) as fee_total,
      -- per-line GST is rounded per line before summing, matching gstAmount()
      coalesce((select sum(round(selling_price * gst_rate / 100, 2)) from committed), 0)
      + coalesce((select sum(round(selling_price * gst_rate / 100, 2)) from chosen), 0) as line_gst
  ),
  pre as (
    select b.*,
           round(b.items_sub + b.opt_sub + b.fee_total, 2) as pre_discount
    from base b
  ),
  disc as (
    select p.*,
           round(p.pre_discount * coalesce(p_disc, 0) / 100, 2) as disc_amt
    from pre p
  ),
  final as (
    select d.*,
           round(d.pre_discount - d.disc_amt, 2) as tax_base,
           round((d.line_gst + d.fee_total * 0.18)
                 * (1 - coalesce(p_disc, 0) / 100), 2) as gst_amt
    from disc d
  )
  select
    f.items_sub,
    f.opt_sub,
    f.fee_total,
    f.disc_amt,
    f.tax_base,
    f.gst_amt,
    round(f.tax_base + f.gst_amt, 2)
  from final f;
$$;


-- ── 2 · The public read ────────────────────────────────────────────────────
-- Resolves BY TOKEN. Returns only what a client is entitled to see.
--
-- Note what is NOT returned: cost_price, rate, margin_pct. The old page called
-- fetchBoqDetail(), which selected the firm's internal cost and margin on every
-- line and shipped them to the browser — anyone holding a share link could read
-- the firm's markup. That data no longer leaves the database.
create or replace function public.quote_public_view(p_token uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  q        record;
  f        record;
  payload  jsonb;
  sched    jsonb;
begin
  if p_token is null then
    raise exception 'quote not found' using errcode = '42704';
  end if;

  select * into q from public.quotations where share_token = p_token;
  if not found then
    -- Deliberately indistinguishable from a wrong token: no existence oracle.
    raise exception 'quote not found' using errcode = '42704';
  end if;

  select name, address, gstin, logo_url into f
  from public.firms where id = q.firm_id;

  -- First open stamps viewed_at; a later open only advances the status label.
  update public.quotations
     set viewed_at = coalesce(viewed_at, now()),
         status    = case when status in ('draft', 'sent') then 'viewed' else status end
   where id = q.id;

  select jsonb_build_object(
    'quotation', jsonb_build_object(
      'id',               q.id,
      'quotation_number', q.quotation_number,
      'status',           case when q.status in ('draft','sent') then 'viewed' else q.status end,
      'design_fees',      q.design_fees,
      'supervision_fees', q.supervision_fees,
      'other_charges',    q.other_charges,
      'discount_pct',     q.discount_pct,
      'accepted_at',      q.accepted_at,
      'accepted_by_name', q.accepted_by_name,
      'selected_options', coalesce(q.selected_options, '[]'::jsonb)
    ),
    'firm', jsonb_build_object(
      'name',     f.name,
      'address',  f.address,
      'gstin',    f.gstin,
      'logo_url', f.logo_url
    ),
    'sections', coalesce((
      select jsonb_agg(sec order by sec->>'order_index', sec->>'name')
      from (
        select jsonb_build_object(
                 'id',          s.id,
                 'name',        s.name,
                 'order_index', s.order_index,
                 'lines', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id',          li.id,
                            'description', li.description,
                            'uom',         li.uom,
                            'quantity',    li.quantity,
                            'selling_price', li.selling_price,
                            'gst_rate',    li.gst_rate,
                            'is_optional', li.is_optional
                          ) order by li.order_index)
                   from public.boq_line_items li
                   where li.section_id = s.id
                 ), '[]'::jsonb)
               ) as sec
        from public.boq_sections s
        where s.boq_id = q.boq_id
      ) x
    ), '[]'::jsonb)
  ) into payload;

  -- An accepted quote also carries its (already server-computed) schedule.
  if q.accepted_at is not null then
    select jsonb_build_object(
             'total_amount', ps.total_amount,
             'split_count',  ps.split_count,
             'signed_name',  ps.signed_name,
             'signed_at',    ps.signed_at,
             'milestones', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'split_number',   pm.split_number,
                        'label',          pm.label,
                        'percent',        pm.percent,
                        'amount',         pm.amount,
                        'gst_amount',     pm.gst_amount,
                        'total_with_gst', pm.total_with_gst
                      ) order by pm.split_number)
               from public.payment_milestones pm where pm.schedule_id = ps.id
             ), '[]'::jsonb)
           ) into sched
    from public.payment_schedules ps
    where ps.quotation_id = q.id
    order by ps.created_at desc
    limit 1;
  end if;

  return payload || jsonb_build_object('schedule', sched);
end $$;


-- ── 3 · Acceptance ─────────────────────────────────────────────────────────
-- The client sends: token, name, chosen optional line ids. Nothing else is
-- trusted — not the firm, not the quotation id, and above all not the money.
create or replace function public.accept_quote(
  p_token    uuid,
  p_name     text,
  p_selected uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  q        record;
  t        record;
  v_valid  uuid[];
  v_sched  uuid;
  v_now    timestamptz := now();
  v_name   text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'a signatory name is required' using errcode = '22023';
  end if;

  -- Lock the row: two concurrent accepts must not both create a schedule.
  select * into q
  from public.quotations
  where share_token = p_token
  for update;

  if not found then
    raise exception 'quote not found' using errcode = '42704';
  end if;

  -- Replay guard. Acceptance is a one-time, financially binding act.
  if q.accepted_at is not null or q.status = 'accepted' then
    raise exception 'this quotation has already been accepted'
      using errcode = '23505';
  end if;

  if q.boq_id is null then
    raise exception 'this quotation has no bill of quantities to price'
      using errcode = '22023';
  end if;

  -- Only optional lines belonging to THIS quotation's BOQ count. Ids from any
  -- other document — another firm's, or a committed line smuggled in to be
  -- double-counted — are dropped rather than rejected, so a tampered payload
  -- degrades to the honest quote instead of failing open.
  select coalesce(array_agg(li.id), '{}'::uuid[]) into v_valid
  from public.boq_line_items li
  where li.boq_id = q.boq_id
    and li.is_optional
    and li.id = any(coalesce(p_selected, '{}'::uuid[]));

  select * into t from public.quote_compute_totals(
    q.boq_id, v_valid, q.design_fees, q.supervision_fees, q.other_charges, q.discount_pct);

  update public.quotations
     set status           = 'accepted',
         accepted_at      = v_now,
         accepted_by_name = v_name,
         selected_options = to_jsonb(v_valid),
         viewed_at        = coalesce(viewed_at, v_now),
         subtotal         = t.taxable,
         gst_amount       = t.gst,
         total_amount     = t.grand_total,
         updated_at       = v_now
   where id = q.id;

  -- firm_id comes from the quotation row, never from the caller.
  insert into public.payment_schedules
    (firm_id, quotation_id, boq_id, total_amount, split_count, signed_name, signed_at)
  values
    (q.firm_id, q.id, q.boq_id, t.grand_total, 4, v_name, v_now)
  returning id into v_sched;

  -- The 4-stage Indian interior plan. Authoritative here; PAYMENT_STAGES in
  -- quoteShareApi.ts is now display-only and must mirror this.
  insert into public.payment_milestones
    (firm_id, schedule_id, split_number, label, percent,
     amount, gst_rate, gst_amount, total_with_gst, trigger_type)
  select q.firm_id, v_sched, s.n, s.label, s.pct,
         round(t.taxable * s.pct / 100, 2),
         18,
         round(t.gst * s.pct / 100, 2),
         round(t.taxable * s.pct / 100, 2) + round(t.gst * s.pct / 100, 2),
         'milestone'
  from (values
    (1, 'Booking advance',                    10::numeric),
    (2, 'Design sign-off',                    40::numeric),
    (3, 'Production & material procurement',  40::numeric),
    (4, 'Installation & handover',            10::numeric)
  ) as s(n, label, pct);

  return jsonb_build_object(
    'total_amount', t.grand_total,
    'split_count',  4,
    'signed_name',  v_name,
    'signed_at',    v_now,
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'split_number',   pm.split_number,
               'label',          pm.label,
               'percent',        pm.percent,
               'amount',         pm.amount,
               'gst_amount',     pm.gst_amount,
               'total_with_gst', pm.total_with_gst
             ) order by pm.split_number)
      from public.payment_milestones pm where pm.schedule_id = v_sched
    ), '[]'::jsonb)
  );
end $$;


-- ── 4 · Grants ─────────────────────────────────────────────────────────────
-- Phase 1 revoked EXECUTE from PUBLIC (and therefore from anon) on everything.
-- These two functions are the entire anon surface of the application. The
-- internal helper is NOT granted to anon: it takes a boq_id directly and would
-- price any document in any firm without a token.
-- `from public, anon` on both counts: PUBLIC covers the implicit inheritance,
-- and anon covers the explicit grant that ALTER DEFAULT PRIVILEGES attaches at
-- CREATE FUNCTION time (C1b). Revoking only PUBLIC leaves that one in place —
-- which is exactly how the assertion below caught this the first time.
revoke all on function public.quote_compute_totals(uuid, uuid[], numeric, numeric, numeric, numeric) from public, anon;
revoke all on function public.quote_public_view(uuid) from public, anon;
revoke all on function public.accept_quote(uuid, text, uuid[]) from public, anon;

grant execute on function public.quote_public_view(uuid) to anon, authenticated;
grant execute on function public.accept_quote(uuid, text, uuid[]) to anon, authenticated;
grant execute on function public.quote_compute_totals(uuid, uuid[], numeric, numeric, numeric, numeric) to authenticated;


-- ── 5 · Assertions ─────────────────────────────────────────────────────────
-- The C1 invariant is "anon executes nothing". That becomes "anon executes
-- exactly the public surface, and nothing has crept in beside it". The list
-- is the whole anon attack surface of the application, so it is spelled out
-- rather than pattern-matched: validate_invite is added by the C3 migration
-- later in this phase (20260728070000) and is named here so this assertion
-- keeps passing on a fresh `db reset`, where every migration in the tree runs
-- in order and this file is re-executed before that one exists.
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
    raise exception 'C5: anon may execute unexpected functions: %', extra;
  end if;
end $$;

do $$
begin
  if not has_function_privilege('anon', 'public.accept_quote(uuid, text, uuid[])', 'EXECUTE') then
    raise exception 'C5: anon cannot execute accept_quote — the public quote page stays broken';
  end if;
  if not has_function_privilege('anon', 'public.quote_public_view(uuid)', 'EXECUTE') then
    raise exception 'C5: anon cannot execute quote_public_view — the public quote page stays broken';
  end if;
  if has_function_privilege('anon',
       'public.quote_compute_totals(uuid, uuid[], numeric, numeric, numeric, numeric)', 'EXECUTE') then
    raise exception 'C5: anon must not reach quote_compute_totals directly';
  end if;
  raise notice 'C5 verified: anon executes exactly quote_public_view + accept_quote';
end $$;

-- anon must still hold no table privileges — the RPCs are the only door.
do $$
declare n int;
begin
  select count(*) into n
  from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public';
  if n > 0 then
    raise exception 'C5: anon regained % table grants', n;
  end if;
end $$;
