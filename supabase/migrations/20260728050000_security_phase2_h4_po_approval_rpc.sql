-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 2 — H4 · purchase-order approval moved server-side
--
-- Was: src/purchase/poApi.ts:142 (decidePoApproval)
--   sb.from('purchase_orders')
--     .update({ approval_status: 'approved', status: 'issued' })
--     .eq('id', po.id)
--
-- A plain table UPDATE. The only thing standing between any authenticated
-- member of the firm and an approved purchase order was the React button being
-- hidden — and an attacker never runs your JavaScript. Nothing checked that the
-- actor held purchase:approve, and nothing checked that the approver was not
-- the person who raised the order. Both are the point of an approval step.
--
-- Now: a SECURITY DEFINER RPC that re-derives the actor from auth.uid() and
-- enforces, in order — firm binding, permission, state, and segregation of
-- duties. The table keeps its firm-scoped RLS; this closes the authorization
-- gap that RLS was never going to express.
--
-- DEPENDS ON C6 (20260728040000). Without it the permission check below is
-- decorative: a member could PATCH their own crm_profiles.role_id to the admin
-- role and satisfy this gate legitimately. The two ship together.
--
-- Audit refs: H4. See the security audit artifact.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.approve_purchase_order(
  p_po_id    uuid,
  p_decision text,
  p_notes    text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_firm   uuid;
  v_actor_pid    uuid;
  v_actor_name   text;
  v_po           record;
  v_now          timestamptz := now();
  v_new_status   text;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;

  -- Transaction-local marker telling guard_po_approval_columns() that this
  -- write arrived through the gate below rather than as a direct PATCH.
  -- `true` scopes it to the current transaction, so it cannot leak into a
  -- later statement on a pooled connection.
  perform set_config('vasto.po_approval_via_rpc', '1', true);

  -- ── Actor, from the session only ────────────────────────────────────────
  select pr.firm_id, pr.id, pr.full_name
    into v_actor_firm, v_actor_pid, v_actor_name
  from public.profiles pr
  where pr.auth_uid = auth.uid()
  limit 1;

  if v_actor_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- ── The order, bound to the actor's firm ────────────────────────────────
  -- Locked, so two approvers racing cannot both pass the state check below.
  select * into v_po
  from public.purchase_orders
  where id = p_po_id
  for update;

  if not found or v_po.firm_id <> v_actor_firm then
    -- Same error either way: no cross-tenant existence oracle.
    raise exception 'purchase order not found' using errcode = '42704';
  end if;

  -- ── Permission ──────────────────────────────────────────────────────────
  -- crm_has_permission() resolves the role from auth.uid() (Phase 1, C4) and
  -- passes firm owners and admin roles unconditionally.
  if not public.crm_has_permission('purchase', 'approve') then
    raise exception 'permission denied: approve on purchase' using errcode = '42501';
  end if;

  -- ── State ───────────────────────────────────────────────────────────────
  -- Only a submitted order is decidable. This also makes the call idempotent
  -- in the safe direction: a second approval is refused rather than silently
  -- re-issuing an order and re-notifying the vendor.
  if coalesce(v_po.approval_status, 'draft') <> 'pending' then
    raise exception
      'purchase order % is not awaiting approval (status: %)',
      v_po.po_number, coalesce(v_po.approval_status, 'draft')
      using errcode = '22023';
  end if;

  -- ── Segregation of duties ───────────────────────────────────────────────
  -- The requester may not approve their own order, whatever permissions they
  -- hold. This is the control that makes an approval step mean anything: it is
  -- what stops one compromised or dishonest account from issuing a purchase
  -- order to a vendor of its choosing, for an amount of its choosing.
  -- Deliberately not exempting admins — an admin approving their own spend is
  -- exactly the case this is here to prevent.
  if v_po.created_by is not null and v_po.created_by = v_actor_pid then
    raise exception
      'segregation of duties: % cannot approve a purchase order they raised',
      coalesce(v_actor_name, 'this user')
      using errcode = '42501';
  end if;

  -- ── Apply ───────────────────────────────────────────────────────────────
  v_new_status := case when p_decision = 'approved' then 'issued' else 'cancelled' end;

  update public.purchase_orders
     set approval_status = p_decision,
         admin_notes     = nullif(btrim(coalesce(p_notes, '')), ''),
         approved_by     = v_actor_pid::text,
         approved_at     = v_now,
         status          = v_new_status::public.po_status,
         issued_at       = case when p_decision = 'approved' then v_now else issued_at end,
         updated_at      = v_now
   where id = v_po.id;

  return jsonb_build_object(
    'id',              v_po.id,
    'po_number',       v_po.po_number,
    'approval_status', p_decision,
    'status',          v_new_status,
    'approved_by',     v_actor_pid,
    'approved_at',     v_now
  );
end $$;

revoke all on function public.approve_purchase_order(uuid, text, text) from public, anon;
grant execute on function public.approve_purchase_order(uuid, text, text) to authenticated;


-- ── The back door ──────────────────────────────────────────────────────────
-- Adding the RPC above is NOT sufficient, and it is worth being explicit about
-- why: an RPC is only a front door. `purchase_orders_mod` still grants every
-- authenticated member of the firm UPDATE on every column, so the original
--
--   PATCH /rest/v1/purchase_orders?id=eq.<id>
--   {"approval_status":"approved","status":"issued"}
--
-- continued to work verbatim after the RPC existed — verified against the local
-- database, HTTP 204, order issued. An attacker has no reason to call the
-- function that checks their permissions when the table accepts the write
-- directly. RLS cannot express this: the row IS in the caller's firm, which is
-- all a policy can ask about.
--
-- So the approval columns are made writable only from inside the RPC, which
-- sets a transaction-local marker before it writes. Everything else about a
-- purchase order stays directly editable.
create or replace function public.guard_po_approval_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The RPC itself, the service role, edge functions, migrations.
  if coalesce(current_setting('vasto.po_approval_via_rpc', true), '') = '1'
     or auth.uid() is null then
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status
     and coalesce(new.approval_status, '') in ('approved', 'rejected') then
    raise exception
      'purchase order approval must go through approve_purchase_order()'
      using errcode = '42501';
  end if;

  if new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    raise exception
      'approved_by / approved_at are set by approve_purchase_order()'
      using errcode = '42501';
  end if;

  -- 'issued' is the state an approval produces; reaching it another way would
  -- send an unapproved order to a vendor.
  if new.status is distinct from old.status and new.status = 'issued' then
    raise exception
      'a purchase order is issued by approving it, not by setting its status'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists guard_po_approval_columns_trg on public.purchase_orders;
create trigger guard_po_approval_columns_trg
  before update on public.purchase_orders
  for each row execute function public.guard_po_approval_columns();


-- ── Assertions ─────────────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.approve_purchase_order(uuid, text, text)', 'EXECUTE') then
    raise exception 'H4: approve_purchase_order must not be anon-executable';
  end if;
  if not has_function_privilege('authenticated', 'public.approve_purchase_order(uuid, text, text)', 'EXECUTE') then
    raise exception 'H4: authenticated cannot execute approve_purchase_order';
  end if;
end $$;

-- H4 is only as strong as C6. If the role guards are ever dropped, the
-- permission check above becomes self-service and this migration's guarantee
-- quietly evaporates — so make that a hard dependency rather than a comment.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.crm_profiles'::regclass
      and tgname  = 'guard_crm_profile_privileges_trg'
      and not tgisinternal
  ) then
    raise exception
      'H4: the C6 role guard is missing — an approver could grant themselves '
      'purchase:approve, making this gate meaningless';
  end if;
  raise notice 'H4 verified: approval RPC installed, C6 guard present';
end $$;

-- The RPC is pointless without the column guard; assert both, not just one.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.purchase_orders'::regclass
      and tgname  = 'guard_po_approval_columns_trg'
      and not tgisinternal
  ) then
    raise exception
      'H4: the approval-column guard is missing — a direct PATCH would still '
      'approve a purchase order, bypassing the RPC entirely';
  end if;
  raise notice 'H4 verified: direct writes to the approval columns are blocked';
end $$;
