-- ════════════════════════════════════════════════════════════════════════
-- Migration D: RPC core (audit/notify/outbox/alert helpers + immutable-ledger
-- poster) and the Material Request + Purchase Order + reservation workflows.
-- Every RPC resolves firm/user/role from auth.uid(); client ids/totals/status
-- are never trusted. Functions are atomic (a raise rolls back the whole call).
-- ════════════════════════════════════════════════════════════════════════

-- ── internal side-effect helpers ───────────────────────────────────────────
create or replace function inv_log(p_firm uuid, p_actor text, p_action text, p_label text,
  p_module text, p_etype text, p_eid text, p_ename text, p_details text)
returns void language sql security definer set search_path='public' as $$
  insert into crm_activity_log(id, firm_id, user_id, action, action_label, module,
    entity_type, entity_id, entity_name, details)
  values (gen_random_uuid()::text, p_firm, coalesce(p_actor,'system'), p_action, p_label,
    p_module, p_etype, p_eid, p_ename, p_details);
$$;

create or replace function inv_notify(p_firm uuid, p_user text, p_title text, p_message text,
  p_type text, p_link text)
returns void language plpgsql security definer set search_path='public' as $$
begin
  if p_user is null or p_user = '' then return; end if;
  insert into crm_notifications(id, firm_id, user_id, title, message, type, read, link)
  values (gen_random_uuid()::text, p_firm, p_user, p_title, p_message, coalesce(p_type,'info'), false, p_link);
end $$;

create or replace function inv_emit(p_firm uuid, p_event text, p_payload jsonb)
returns void language sql security definer set search_path='public' as $$
  insert into inventory_outbox(firm_id, event_type, payload) values (p_firm, p_event, coalesce(p_payload,'{}'::jsonb));
$$;

create or replace function inv_alert(p_firm uuid, p_type text, p_sev text, p_title text, p_msg text,
  p_project text, p_sku uuid, p_ref_type text, p_ref_id uuid, p_link text, p_dedupe text)
returns void language plpgsql security definer set search_path='public' as $$
begin
  insert into inventory_alerts(firm_id, alert_type, severity, title, message, project_id, sku_id,
    ref_type, ref_id, link, dedupe_key, status, created_at, resolved_at)
  values (p_firm, p_type, coalesce(p_sev,'warning'), p_title, p_msg, p_project, p_sku,
    p_ref_type, p_ref_id, p_link, p_dedupe, 'open', now(), null)
  on conflict (firm_id, dedupe_key) do update
    set severity=excluded.severity, title=excluded.title, message=excluded.message,
        link=excluded.link, status='open', resolved_at=null, created_at=now();
end $$;

-- Notify every admin (owner-level) user of the firm.
create or replace function inv_notify_admins(p_firm uuid, p_title text, p_msg text, p_type text, p_link text)
returns void language plpgsql security definer set search_path='public' as $$
declare u text;
begin
  for u in
    select cp.id from crm_profiles cp join crm_roles r on r.id=cp.role_id
    where cp.firm_id=p_firm and r.is_admin and r.enabled
  loop
    perform inv_notify(p_firm, u, p_title, p_msg, p_type, p_link);
  end loop;
end $$;

-- Pick an approver (first admin) for auto-created workflow tasks.
create or replace function inv_first_admin(p_firm uuid)
returns table(id text, name text) language sql stable security definer set search_path='public' as $$
  select cp.id::text, cp.full_name
  from crm_profiles cp join crm_roles r on r.id=cp.role_id
  where cp.firm_id=p_firm and r.is_admin and r.enabled
  order by cp.created_at limit 1;
$$;

-- Create a workflow task (best-effort; never blocks the transition).
create or replace function inv_create_task(p_firm uuid, p_title text, p_assignee text, p_assignee_name text,
  p_project text, p_link_type text, p_link_id text, p_link_label text, p_priority text, p_due date)
returns void language plpgsql security definer set search_path='public' as $$
declare pname text;
begin
  if p_assignee is null then return; end if;
  select name into pname from crm_projects where id = p_project and firm_id = p_firm;
  insert into tasks(firm_id, title, assignee_id, assignee_name, created_by_id, created_by_name,
    project_id, project_name, status, priority, due_date, link_type, link_id, link_label,
    tags, attachments, is_followup, progress, order_index)
  values (p_firm, p_title, p_assignee, coalesce(p_assignee_name,'—'), 'system', 'Inventory',
    p_project, pname, 'not_started', coalesce(p_priority,'medium'), p_due,
    p_link_type, p_link_id, p_link_label, '{}', '[]'::jsonb, true, 0, (extract(epoch from now())*1000)::bigint);
exception when others then null; -- tasks table shape drift must never block a workflow transition
end $$;

-- ── current available balance (ledger-derived) ─────────────────────────────
create or replace function inv_available(p_firm uuid, p_project text, p_sku uuid)
returns numeric language sql stable security definer set search_path='public' as $$
  select coalesce((select available from stock_balances
    where firm_id=p_firm and project_id=p_project and sku_id=p_sku), 0);
$$;

-- ── the ONE way stock ever changes: append to the immutable ledger ─────────
create or replace function inv_post_movement(
  p_firm uuid, p_project text, p_location text, p_sku uuid, p_type movement_type,
  p_qty numeric, p_uom uom, p_unit_cost numeric, p_ref_type text, p_ref_id uuid, p_ref_line uuid,
  p_counterparty text, p_batch text, p_actor text, p_actor_name text, p_idem text, p_note text)
returns uuid language plpgsql security definer set search_path='public' as $$
declare
  v_class movement_class; v_sign int; v_base numeric; v_avail numeric; v_id uuid; v_existing uuid;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'quantity must be positive'; end if;

  -- idempotency: same key already posted → return the prior movement
  if p_idem is not null then
    select id into v_existing from stock_movements where firm_id=p_firm and idempotency_key=p_idem;
    if v_existing is not null then return v_existing; end if;
  end if;

  -- classify + sign
  v_class := case when p_type in ('reservation','reservation_release') then 'reserved' else 'physical' end;
  v_sign  := case p_type
    when 'opening_balance' then 1 when 'purchase_receipt' then 1 when 'transfer_in' then 1
    when 'positive_adjustment' then 1 when 'reservation' then 1
    when 'site_consumption' then -1 when 'transfer_out' then -1 when 'supplier_return' then -1
    when 'write_off' then -1 when 'negative_adjustment' then -1 when 'reservation_release' then -1
    else 1 end;

  v_base := inv_to_base(p_sku, p_qty, p_uom) * v_sign;

  -- serialize concurrent postings per (firm, project, sku) to prevent oversell
  perform pg_advisory_xact_lock(hashtextextended(p_firm::text||':'||p_project||':'||p_sku::text, 0));

  -- outflows may not exceed available (reservations included)
  if v_sign < 0 then
    v_avail := inv_available(p_firm, p_project, p_sku);
    if v_avail < p_qty * abs(v_sign) * (v_base / nullif(v_sign * p_qty,0)) then null; end if; -- no-op guard
    if v_avail + v_base < -0.0000001 then
      raise exception 'insufficient available stock for sku % at project %: available %, requested %',
        p_sku, p_project, v_avail, abs(v_base) using errcode='23514';
    end if;
  end if;

  insert into stock_movements(firm_id, project_id, location, sku_id, movement_type, movement_class,
    qty, uom, qty_base, unit_cost, ref_type, ref_id, ref_line_id, counterparty_project, batch_ref,
    idempotency_key, note, posted_by, posted_by_name)
  values (p_firm, p_project, p_location, p_sku, p_type, v_class, p_qty, p_uom, v_base, p_unit_cost,
    p_ref_type, p_ref_id, p_ref_line, p_counterparty, p_batch, p_idem, p_note, p_actor, p_actor_name)
  returning id into v_id;
  return v_id;
end $$;

-- Reverse a posted movement (corrections without deleting history).
create or replace function inv_reverse_movement(p_movement_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; m stock_movements; v_id uuid;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('inventory','edit');
  select * into m from stock_movements where id=p_movement_id and firm_id=a.firm_id;
  if m.id is null then raise exception 'movement not found'; end if;
  insert into stock_movements(firm_id, project_id, location, sku_id, movement_type, movement_class,
    qty, uom, qty_base, unit_cost, ref_type, ref_id, ref_line_id, counterparty_project, batch_ref,
    reverses_id, note, posted_by, posted_by_name)
  values (m.firm_id, m.project_id, m.location, m.sku_id, 'reversal', m.movement_class,
    m.qty, m.uom, -m.qty_base, m.unit_cost, m.ref_type, m.ref_id, m.ref_line_id, m.counterparty_project,
    m.batch_ref, m.id, coalesce(p_note,'reversal of '||m.id::text), a.profile_id, a.full_name)
  returning id into v_id;
  perform inv_log(a.firm_id, a.profile_id, 'reversed', 'Reversed stock movement', 'inventory',
    'stock_movement', v_id::text, null, p_note);
  return v_id;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- MATERIAL REQUESTS
-- ════════════════════════════════════════════════════════════════════════
create or replace function inv_save_material_request(p_payload jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid; v_num text; it jsonb; idx int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;

  if v_id is null then
    perform inv_require('material_requests','create');
    v_num := inv_next_number(a.firm_id, 'MR', 'MR');
    insert into material_requests(firm_id, request_number, project_id, location, milestone_id, boq_id,
      requester_id, requester_name, status, priority, source, required_by, notes, created_by, created_by_name)
    values (a.firm_id, v_num, p_payload->>'project_id', p_payload->>'location', p_payload->>'milestone_id',
      nullif(p_payload->>'boq_id','')::uuid, a.profile_id, a.full_name, 'draft',
      coalesce(p_payload->>'priority','medium'), coalesce(p_payload->>'source','manual'),
      nullif(p_payload->>'required_by','')::date, p_payload->>'notes', a.profile_id, a.full_name)
    returning id into v_id;
    perform inv_log(a.firm_id, a.profile_id, 'created', 'Created material request '||v_num,
      'material_requests', 'material_request', v_id::text, v_num, null);
  else
    perform inv_require('material_requests','edit');
    update material_requests set
      project_id=p_payload->>'project_id', location=p_payload->>'location', milestone_id=p_payload->>'milestone_id',
      boq_id=nullif(p_payload->>'boq_id','')::uuid, priority=coalesce(p_payload->>'priority','medium'),
      source=coalesce(p_payload->>'source','manual'), required_by=nullif(p_payload->>'required_by','')::date,
      notes=p_payload->>'notes', updated_at=now()
    where id=v_id and firm_id=a.firm_id and status='draft';
    if not found then raise exception 'material request not editable (not found or not draft)'; end if;
    delete from material_request_items where request_id=v_id;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into material_request_items(firm_id, request_id, sku_id, material_name, specification, uom,
      required_qty, required_by, boq_line_id, order_index)
    values (a.firm_id, v_id, nullif(it->>'sku_id','')::uuid, coalesce(it->>'material_name',''),
      it->>'specification', nullif(it->>'uom','')::uom, coalesce((it->>'required_qty')::numeric,0),
      nullif(it->>'required_by','')::date, nullif(it->>'boq_line_id','')::uuid, idx);
    idx := idx + 1;
  end loop;
  return v_id;
end $$;

-- Submit: snapshot availability (Required − Available − On-order = To-procure),
-- notify approvers, raise a workflow task. Optimistic-locked.
create or replace function inv_submit_material_request(p_id uuid, p_expected_version int)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; mr material_requests; it record; adm record; v_avail numeric; v_onord numeric;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('material_requests','create');
  select * into mr from material_requests where id=p_id and firm_id=a.firm_id for update;
  if mr.id is null then raise exception 'material request not found'; end if;
  if mr.status <> 'draft' then raise exception 'only draft requests can be submitted (is %)', mr.status; end if;
  if p_expected_version is not null and mr.version <> p_expected_version then
    raise exception 'material request was modified by someone else (stale version)' using errcode='40001';
  end if;

  for it in select * from material_request_items where request_id=mr.id loop
    if it.sku_id is not null then
      v_avail := inv_available(a.firm_id, mr.project_id, it.sku_id);
      select coalesce(on_order,0) into v_onord from stock_position
        where firm_id=a.firm_id and project_id=mr.project_id and sku_id=it.sku_id;
    else v_avail := 0; v_onord := 0; end if;
    update material_request_items set available_qty=v_avail, on_order_qty=coalesce(v_onord,0),
      suggested_qty=greatest(required_qty - v_avail - coalesce(v_onord,0), 0)
    where id=it.id;
  end loop;

  update material_requests set status='submitted', submitted_at=now(), version=version+1, updated_at=now()
  where id=mr.id;

  perform inv_log(a.firm_id, a.profile_id, 'submitted', 'Submitted material request '||mr.request_number,
    'material_requests', 'material_request', mr.id::text, mr.request_number, null);
  perform inv_notify_admins(a.firm_id, 'Material request awaiting approval',
    mr.request_number||' needs your approval', 'warning', 'projects|'||mr.project_id);
  select id, name into adm from inv_first_admin(a.firm_id);
  perform inv_create_task(a.firm_id, 'Approve '||mr.request_number, adm.id, adm.name, mr.project_id,
    'purchase', mr.id::text, mr.request_number, mr.priority, mr.required_by);
  perform inv_emit(a.firm_id, 'material_request.submitted',
    jsonb_build_object('id', mr.id, 'number', mr.request_number, 'project_id', mr.project_id));
end $$;

-- Approve / reject a submitted request (per-item approved quantities).
create or replace function inv_decide_material_request(p_id uuid, p_decision text, p_notes text, p_item_approvals jsonb)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; mr material_requests; it record; v_qty numeric;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('material_requests','approve');
  select * into mr from material_requests where id=p_id and firm_id=a.firm_id for update;
  if mr.id is null then raise exception 'material request not found'; end if;
  if mr.status <> 'submitted' then raise exception 'only submitted requests can be decided (is %)', mr.status; end if;

  if p_decision = 'approve' then
    for it in select * from material_request_items where request_id=mr.id loop
      v_qty := coalesce((p_item_approvals->>(it.id::text))::numeric, it.required_qty);
      update material_request_items set approved_qty=v_qty where id=it.id;
    end loop;
    update material_requests set status='approved', approved_at=now(), approver_id=a.profile_id,
      approver_name=a.full_name, version=version+1, updated_at=now() where id=mr.id;
    perform inv_log(a.firm_id, a.profile_id, 'approved', 'Approved '||mr.request_number,
      'material_requests', 'material_request', mr.id::text, mr.request_number, p_notes);
    perform inv_notify(a.firm_id, mr.requester_id, 'Material request approved',
      mr.request_number||' was approved', 'success', 'projects|'||mr.project_id);
    perform inv_emit(a.firm_id, 'material_request.approved',
      jsonb_build_object('id', mr.id, 'number', mr.request_number, 'project_id', mr.project_id));
  elsif p_decision = 'reject' then
    update material_requests set status='rejected', rejected_reason=p_notes, approver_id=a.profile_id,
      approver_name=a.full_name, version=version+1, updated_at=now() where id=mr.id;
    perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Rejected '||mr.request_number,
      'material_requests', 'material_request', mr.id::text, mr.request_number, p_notes);
    perform inv_notify(a.firm_id, mr.requester_id, 'Material request rejected',
      coalesce(p_notes, mr.request_number||' was rejected'), 'error', 'projects|'||mr.project_id);
  else raise exception 'unknown decision %', p_decision; end if;
end $$;

create or replace function inv_cancel_material_request(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; mr material_requests;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('material_requests','edit');
  select * into mr from material_requests where id=p_id and firm_id=a.firm_id for update;
  if mr.id is null then raise exception 'material request not found'; end if;
  if mr.status in ('fulfilled','cancelled') then raise exception 'cannot cancel a % request', mr.status; end if;
  update material_requests set status='cancelled', rejected_reason=coalesce(p_reason,'cancelled'),
    version=version+1, updated_at=now() where id=mr.id;
  perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Cancelled '||mr.request_number,
    'material_requests', 'material_request', mr.id::text, mr.request_number, p_reason);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- PURCHASE ORDERS  (approval/issue never touch physical stock)
-- ════════════════════════════════════════════════════════════════════════
create or replace function inv_save_purchase_order(p_payload jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid; v_num text; it jsonb; v_sub numeric := 0; v_amt numeric;
  v_gst_rate numeric; v_gst_type text; v_freight numeric; v_gst numeric; v_total numeric; v_qb numeric;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  v_gst_rate := coalesce((p_payload->>'gst_rate')::numeric, 18);
  v_gst_type := coalesce(p_payload->>'gst_type','inclusive');
  v_freight  := coalesce((p_payload->>'freight_charges')::numeric, 0);

  if v_id is null then
    perform inv_require('purchasing','create');
    v_num := inv_next_number(a.firm_id, 'PO', 'PO');
    insert into purchase_orders(firm_id, po_number, crm_project_id, vendor_id, material_request_id, rfq_id,
      boq_id, milestone_id, status, approval_status, required_by, delivery_date, delivery_address,
      credit_days, gst_rate, gst_type, freight_charges, notes, supplier_quotation_ref, material_type,
      payment_status, created_by, subtotal, total_amount, gst_amount)
    values (a.firm_id, v_num, p_payload->>'crm_project_id', nullif(p_payload->>'vendor_id','')::uuid,
      nullif(p_payload->>'material_request_id','')::uuid, nullif(p_payload->>'rfq_id','')::uuid,
      nullif(p_payload->>'boq_id','')::uuid, p_payload->>'milestone_id', 'draft', 'draft',
      nullif(p_payload->>'required_by','')::date, nullif(p_payload->>'delivery_date','')::date,
      p_payload->>'delivery_address', nullif(p_payload->>'credit_days','')::int, v_gst_rate, v_gst_type,
      v_freight, p_payload->>'notes', p_payload->>'supplier_quotation_ref', p_payload->>'material_type',
      'outstanding', a.profile_id, 0, 0, 0)
    returning id into v_id;
    perform inv_log(a.firm_id, a.profile_id, 'created', 'Created purchase order '||v_num,
      'purchasing', 'purchase_order', v_id::text, v_num, null);
  else
    perform inv_require('purchasing','edit');
    perform 1 from purchase_orders where id=v_id and firm_id=a.firm_id and status in ('draft','needs_changes');
    if not found then raise exception 'purchase order not editable (not found or locked)'; end if;
    update purchase_orders set crm_project_id=p_payload->>'crm_project_id',
      vendor_id=nullif(p_payload->>'vendor_id','')::uuid, material_request_id=nullif(p_payload->>'material_request_id','')::uuid,
      rfq_id=nullif(p_payload->>'rfq_id','')::uuid, boq_id=nullif(p_payload->>'boq_id','')::uuid,
      milestone_id=p_payload->>'milestone_id', required_by=nullif(p_payload->>'required_by','')::date,
      delivery_date=nullif(p_payload->>'delivery_date','')::date, delivery_address=p_payload->>'delivery_address',
      credit_days=nullif(p_payload->>'credit_days','')::int, gst_rate=v_gst_rate, gst_type=v_gst_type,
      freight_charges=v_freight, notes=p_payload->>'notes', supplier_quotation_ref=p_payload->>'supplier_quotation_ref',
      material_type=p_payload->>'material_type', updated_at=now()
    where id=v_id;
    delete from po_line_items where po_id=v_id;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_amt := round(coalesce((it->>'quantity')::numeric,0) * coalesce((it->>'rate')::numeric,0), 2);
    v_sub := v_sub + v_amt;
    v_qb := case when nullif(it->>'sku_id','') is not null
      then inv_to_base(nullif(it->>'sku_id','')::uuid, coalesce((it->>'quantity')::numeric,0), nullif(it->>'uom','')::uom)
      else null end;
    insert into po_line_items(firm_id, po_id, sku_id, boq_line_id, mr_item_id, description, uom,
      quantity, rate, amount, qty_base, qty_received_base)
    values (a.firm_id, v_id, nullif(it->>'sku_id','')::uuid, nullif(it->>'boq_line_id','')::uuid,
      nullif(it->>'mr_item_id','')::uuid, coalesce(it->>'description',''), nullif(it->>'uom','')::uom,
      coalesce((it->>'quantity')::numeric,0), coalesce((it->>'rate')::numeric,0), v_amt, v_qb, 0);
  end loop;

  -- server-computed totals (client totals are never trusted)
  if v_gst_type = 'inclusive' then
    v_total := round(v_sub + v_freight, 2);
    v_gst := round(v_total - (v_total / (1 + v_gst_rate/100.0)), 2);
  else
    v_gst := round(v_sub * v_gst_rate/100.0, 2);
    v_total := round(v_sub + v_gst + v_freight, 2);
  end if;
  update purchase_orders set subtotal=v_sub, gst_amount=v_gst, total_amount=v_total, updated_at=now() where id=v_id;
  return v_id;
end $$;

create or replace function inv_submit_po(p_id uuid, p_expected_version int)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; po purchase_orders; adm record;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('purchasing','create');
  select * into po from purchase_orders where id=p_id and firm_id=a.firm_id for update;
  if po.id is null then raise exception 'purchase order not found'; end if;
  if po.status not in ('draft','needs_changes') then raise exception 'PO cannot be submitted from % state', po.status; end if;
  if p_expected_version is not null and po.version <> p_expected_version then
    raise exception 'purchase order was modified by someone else (stale version)' using errcode='40001'; end if;
  update purchase_orders set status='pending_approval', approval_status='pending_approval',
    submitted_at=now(), version=version+1, updated_at=now() where id=po.id;
  perform inv_log(a.firm_id, a.profile_id, 'submitted', 'Submitted PO '||po.po_number||' for approval',
    'purchasing', 'purchase_order', po.id::text, po.po_number, null);
  perform inv_notify_admins(a.firm_id, 'PO awaiting approval', po.po_number||' (₹'||round(po.total_amount)||') needs approval',
    'warning', 'vendors');
  select id, name into adm from inv_first_admin(a.firm_id);
  perform inv_create_task(a.firm_id, 'Approve '||po.po_number, adm.id, adm.name, po.crm_project_id,
    'purchase', po.id::text, po.po_number, 'high', po.required_by);
  perform inv_emit(a.firm_id, 'purchase_order.submitted', jsonb_build_object('id', po.id, 'number', po.po_number));
end $$;

create or replace function inv_decide_po(p_id uuid, p_decision text, p_notes text)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; po purchase_orders;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('purchasing','approve');
  select * into po from purchase_orders where id=p_id and firm_id=a.firm_id for update;
  if po.id is null then raise exception 'purchase order not found'; end if;
  if po.status <> 'pending_approval' then raise exception 'PO is not pending approval (is %)', po.status; end if;
  if p_decision='approve' then
    update purchase_orders set status='approved', approval_status='approved', approved_at=now(),
      approved_by=a.profile_id, admin_notes=p_notes, version=version+1, updated_at=now() where id=po.id;
    perform inv_log(a.firm_id, a.profile_id, 'approved', 'Approved PO '||po.po_number,
      'purchasing', 'purchase_order', po.id::text, po.po_number, p_notes);
    perform inv_notify(a.firm_id, po.created_by, 'PO approved', po.po_number||' was approved', 'success', 'vendors');
    perform inv_emit(a.firm_id, 'purchase_order.approved', jsonb_build_object('id', po.id, 'number', po.po_number));
  elsif p_decision='needs_changes' then
    update purchase_orders set status='needs_changes', approval_status='needs_changes', admin_notes=p_notes,
      version=version+1, updated_at=now() where id=po.id;
    perform inv_notify(a.firm_id, po.created_by, 'PO needs changes', coalesce(p_notes,po.po_number||' needs changes'), 'warning', 'vendors');
  elsif p_decision='reject' then
    update purchase_orders set status='cancelled', approval_status='cancelled', admin_notes=p_notes,
      version=version+1, updated_at=now() where id=po.id;
    perform inv_notify(a.firm_id, po.created_by, 'PO rejected', coalesce(p_notes,po.po_number||' was rejected'), 'error', 'vendors');
  else raise exception 'unknown decision %', p_decision; end if;
end $$;

-- Issue an approved PO: rolls demand into the linked MR, contributes to on_order.
create or replace function inv_issue_po(p_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; po purchase_orders; li record; mrid uuid; allordered boolean;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('purchasing','edit');
  select * into po from purchase_orders where id=p_id and firm_id=a.firm_id for update;
  if po.id is null then raise exception 'purchase order not found'; end if;
  if po.status <> 'approved' then raise exception 'only approved POs can be issued (is %)', po.status; end if;
  update purchase_orders set status='issued', issued_at=now(), version=version+1, updated_at=now() where id=po.id;

  -- roll ordered quantities into the source material request
  for li in select * from po_line_items where po_id=po.id and mr_item_id is not null loop
    update material_request_items set ordered_qty = ordered_qty + li.quantity where id=li.mr_item_id;
  end loop;
  mrid := po.material_request_id;
  if mrid is not null then
    select bool_and(ordered_qty >= coalesce(approved_qty, required_qty))
      into allordered from material_request_items where request_id=mrid;
    update material_requests set status = case when allordered then 'ordered' else 'partially_ordered' end,
      updated_at=now() where id=mrid and status in ('approved','in_procurement','partially_ordered');
  end if;

  perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Issued PO '||po.po_number,
    'purchasing', 'purchase_order', po.id::text, po.po_number, null);
  perform inv_alert(a.firm_id, 'partial_receipt', 'info', 'PO issued — awaiting delivery',
    po.po_number||' issued', po.crm_project_id, null, 'purchase_order', po.id, 'vendors',
    'po_awaiting_'||po.id::text);
  perform inv_emit(a.firm_id, 'purchase_order.issued', jsonb_build_object('id', po.id, 'number', po.po_number));
end $$;

-- ── Reservations (logical hold that lowers Available without touching On-hand)
create or replace function inv_reserve_stock(p_project text, p_sku uuid, p_qty numeric, p_uom uom,
  p_ref_type text, p_ref_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v uuid;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('inventory','edit');
  v := inv_post_movement(a.firm_id, p_project, null, p_sku, 'reservation', p_qty, p_uom, null,
    coalesce(p_ref_type,'reservation'), p_ref_id, null, null, null, a.profile_id, a.full_name, null, p_note);
  perform inv_log(a.firm_id, a.profile_id, 'created', 'Reserved stock', 'inventory', 'reservation', v::text, null, p_note);
  return v;
end $$;

create or replace function inv_release_reservation(p_project text, p_sku uuid, p_qty numeric, p_uom uom,
  p_ref_type text, p_ref_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v uuid;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('inventory','edit');
  v := inv_post_movement(a.firm_id, p_project, null, p_sku, 'reservation_release', p_qty, p_uom, null,
    coalesce(p_ref_type,'reservation'), p_ref_id, null, null, null, a.profile_id, a.full_name, null, p_note);
  return v;
end $$;

grant execute on function
  inv_save_material_request(jsonb,jsonb), inv_submit_material_request(uuid,int),
  inv_decide_material_request(uuid,text,text,jsonb), inv_cancel_material_request(uuid,text),
  inv_save_purchase_order(jsonb,jsonb), inv_submit_po(uuid,int), inv_decide_po(uuid,text,text),
  inv_issue_po(uuid), inv_reserve_stock(text,uuid,numeric,uom,text,uuid,text),
  inv_release_reservation(text,uuid,numeric,uom,text,uuid,text), inv_reverse_movement(uuid,text),
  inv_available(uuid,text,uuid)
to anon, authenticated;