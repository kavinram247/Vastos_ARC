-- ════════════════════════════════════════════════════════════════════════
-- Migration E1: Goods Receipt, Consumption, and Transfer workflows.
-- Posting a receipt is the ONLY inbound that raises physical stock; consumption
-- and transfers are the outbounds. All go through inv_post_movement.
-- ════════════════════════════════════════════════════════════════════════

-- clean re-definition of the ledger poster (drops an earlier dead guard line)
create or replace function inv_post_movement(
  p_firm uuid, p_project text, p_location text, p_sku uuid, p_type movement_type,
  p_qty numeric, p_uom uom, p_unit_cost numeric, p_ref_type text, p_ref_id uuid, p_ref_line uuid,
  p_counterparty text, p_batch text, p_actor text, p_actor_name text, p_idem text, p_note text)
returns uuid language plpgsql security definer set search_path='public' as $$
declare v_class movement_class; v_sign int; v_base numeric; v_avail numeric; v_id uuid; v_existing uuid;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'quantity must be positive'; end if;
  if p_idem is not null then
    select id into v_existing from stock_movements where firm_id=p_firm and idempotency_key=p_idem;
    if v_existing is not null then return v_existing; end if;
  end if;
  v_class := case when p_type in ('reservation','reservation_release') then 'reserved' else 'physical' end;
  v_sign  := case p_type
    when 'opening_balance' then 1 when 'purchase_receipt' then 1 when 'transfer_in' then 1
    when 'positive_adjustment' then 1 when 'reservation' then 1
    when 'site_consumption' then -1 when 'transfer_out' then -1 when 'supplier_return' then -1
    when 'write_off' then -1 when 'negative_adjustment' then -1 when 'reservation_release' then -1
    else 1 end;
  v_base := inv_to_base(p_sku, p_qty, p_uom) * v_sign;
  perform pg_advisory_xact_lock(hashtextextended(p_firm::text||':'||p_project||':'||p_sku::text, 0));
  if v_sign < 0 then
    v_avail := inv_available(p_firm, p_project, p_sku);
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

create or replace function inv_notify_team(p_firm uuid, p_project text, p_title text, p_msg text, p_type text, p_link text)
returns void language plpgsql security definer set search_path='public' as $$
declare u text;
begin
  for u in select user_id from crm_project_assignments where firm_id=p_firm and project_id=p_project loop
    perform inv_notify(p_firm, u, p_title, p_msg, p_type, p_link);
  end loop;
end $$;

-- ════════════════════════ GOODS RECEIPTS ════════════════════════
create or replace function inv_save_goods_receipt(p_payload jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid; v_num text; it jsonb; idx int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    perform inv_require('goods_receipts','create');
    v_num := inv_next_number(a.firm_id, 'GRN', 'GRN');
    insert into goods_receipts(firm_id, grn_number, po_id, crm_project_id, vendor_id, location,
      delivery_date, challan_no, received_by, received_by_name, status, notes, created_by, created_by_name)
    values (a.firm_id, v_num, nullif(p_payload->>'po_id','')::uuid, p_payload->>'crm_project_id',
      nullif(p_payload->>'vendor_id','')::uuid, p_payload->>'location',
      coalesce(nullif(p_payload->>'delivery_date','')::date, current_date), p_payload->>'challan_no',
      a.profile_id, a.full_name, 'draft', p_payload->>'notes', a.profile_id, a.full_name)
    returning id into v_id;
  else
    perform inv_require('goods_receipts','edit');
    update goods_receipts set po_id=nullif(p_payload->>'po_id','')::uuid, crm_project_id=p_payload->>'crm_project_id',
      vendor_id=nullif(p_payload->>'vendor_id','')::uuid, location=p_payload->>'location',
      delivery_date=coalesce(nullif(p_payload->>'delivery_date','')::date,current_date),
      challan_no=p_payload->>'challan_no', notes=p_payload->>'notes', updated_at=now()
    where id=v_id and firm_id=a.firm_id and status='draft';
    if not found then raise exception 'goods receipt not editable'; end if;
    delete from goods_receipt_items where grn_id=v_id;
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into goods_receipt_items(firm_id, grn_id, po_line_id, sku_id, material_name, uom, ordered_qty,
      prev_received_qty, delivered_qty, accepted_qty, rejected_qty, damaged_qty, rejection_reason,
      quality_notes, batch_ref, unit_cost, order_index)
    values (a.firm_id, v_id, nullif(it->>'po_line_id','')::uuid, nullif(it->>'sku_id','')::uuid,
      coalesce(it->>'material_name',''), nullif(it->>'uom','')::uom, coalesce((it->>'ordered_qty')::numeric,0),
      coalesce((it->>'prev_received_qty')::numeric,0), coalesce((it->>'delivered_qty')::numeric,0),
      coalesce((it->>'accepted_qty')::numeric,0), coalesce((it->>'rejected_qty')::numeric,0),
      coalesce((it->>'damaged_qty')::numeric,0), it->>'rejection_reason', it->>'quality_notes',
      it->>'batch_ref', nullif(it->>'unit_cost','')::numeric, idx);
    idx := idx + 1;
  end loop;
  return v_id;
end $$;

-- Post a receipt: accepted qty → stock; update PO, vendor performance, last price, project cost.
create or replace function inv_post_goods_receipt(p_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; g goods_receipts; it record; po purchase_orders;
  v_cost numeric := 0; v_accepted numeric := 0; v_defect numeric := 0; v_delivered numeric := 0;
  v_price numeric; v_prom int; v_act int; v_any_reject boolean := false; v_all_recv boolean;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('goods_receipts','approve');
  select * into g from goods_receipts where id=p_id and firm_id=a.firm_id for update;
  if g.id is null then raise exception 'goods receipt not found'; end if;
  if g.status <> 'draft' then raise exception 'goods receipt already %', g.status; end if;
  if g.crm_project_id is null then raise exception 'goods receipt has no project'; end if;

  for it in select * from goods_receipt_items where grn_id=g.id loop
    if it.accepted_qty > 0 then
      if it.sku_id is null then raise exception 'accepted item "%" has no SKU — stock cannot be posted', it.material_name; end if;
      perform inv_post_movement(a.firm_id, g.crm_project_id, g.location, it.sku_id, 'purchase_receipt',
        it.accepted_qty, it.uom, it.unit_cost, 'grn', g.id, it.id, null, it.batch_ref,
        a.profile_id, a.full_name, 'grn:'||it.id::text, 'GRN '||g.grn_number);
      v_cost := v_cost + it.accepted_qty * coalesce(it.unit_cost,0);
      v_accepted := v_accepted + it.accepted_qty;
      -- update PO line received (original + base uom)
      if it.po_line_id is not null then
        update po_line_items set qty_received = qty_received + it.accepted_qty,
          qty_received_base = qty_received_base + inv_to_base(it.sku_id, it.accepted_qty, it.uom)
        where id = it.po_line_id;
      end if;
      -- last accepted purchase price (best-effort; never blocks posting)
      if g.vendor_id is not null and it.unit_cost is not null then
        begin
          update vendor_skus set price = it.unit_cost
            where firm_id=a.firm_id and vendor_id=g.vendor_id and sku_id=it.sku_id and valid_from = current_date;
          if not found then
            insert into vendor_skus(firm_id, vendor_id, sku_id, price, lead_time_days)
            values (a.firm_id, g.vendor_id, it.sku_id, it.unit_cost, 0);
          end if;
        exception when others then null; end;
      end if;
    end if;
    v_delivered := v_delivered + it.delivered_qty;
    v_defect := v_defect + it.rejected_qty + it.damaged_qty;
    if (it.rejected_qty + it.damaged_qty) > 0 then v_any_reject := true; end if;
  end loop;

  -- vendor performance feedback (feeds computeVendorScore)
  if g.vendor_id is not null and g.po_id is not null then
    select * into po from purchase_orders where id=g.po_id;
    v_price := case when v_accepted > 0 then round(v_cost / v_accepted, 2) else null end;
    v_prom := case when po.issued_at is not null and po.required_by is not null
                   then greatest((po.required_by - po.issued_at::date), 0) else null end;
    v_act  := case when po.issued_at is not null
                   then greatest((g.delivery_date - po.issued_at::date), 0) else null end;
    insert into vendor_performance(firm_id, vendor_id, po_id, promised_days, actual_days,
      qty_ordered, qty_defective, price_at_order, market_price, recorded_at)
    values (a.firm_id, g.vendor_id, g.po_id, v_prom, v_act, v_delivered, v_defect, v_price, null, now());
  end if;

  -- recompute PO fulfillment status
  if g.po_id is not null then
    select * into po from purchase_orders where id=g.po_id for update;
    select bool_and(qty_received >= quantity) into v_all_recv from po_line_items where po_id=g.po_id;
    update purchase_orders set status = case when v_all_recv then 'received' else 'partially_received' end,
      received_at = case when v_all_recv then now() else received_at end, updated_at=now()
    where id=g.po_id and status in ('issued','partially_received','approved');
    if v_all_recv and po.material_request_id is not null then
      update material_requests set status='fulfilled', updated_at=now()
      where id=po.material_request_id and status in ('ordered','partially_ordered','in_procurement');
    end if;
  end if;

  -- project actual material cost (booked at receipt — the canonical cost point)
  if v_cost > 0 then
    insert into crm_cost_entries(id, firm_id, project_id, category, description, amount, date, vendor_name, created_by)
    values (gen_random_uuid()::text, a.firm_id, g.crm_project_id, 'materials',
      'Goods receipt '||g.grn_number, round(v_cost,2), g.delivery_date,
      (select company_name from vendors where id=g.vendor_id), a.profile_id);
  end if;

  update goods_receipts set status='posted', posted_at=now(), updated_at=now() where id=g.id;

  perform inv_log(a.firm_id, a.profile_id, 'received', 'Posted goods receipt '||g.grn_number,
    'goods_receipts', 'goods_receipt', g.id::text, g.grn_number, 'Accepted '||v_accepted||' units');
  perform inv_notify_team(a.firm_id, g.crm_project_id, 'Goods received',
    g.grn_number||' posted to site stock', 'success', 'projects|'||g.crm_project_id);
  perform inv_notify(a.firm_id, (select created_by from purchase_orders where id=g.po_id),
    'Goods received', g.grn_number||' posted', 'success', 'vendors');
  if v_any_reject then
    perform inv_alert(a.firm_id, 'rejected_receipt', 'warning', 'Rejected/damaged goods',
      g.grn_number||' has rejected or damaged material', g.crm_project_id, null, 'goods_receipt', g.id,
      'projects|'||g.crm_project_id, 'grn_reject_'||g.id::text);
  end if;
  perform inv_emit(a.firm_id, 'goods_receipt.posted',
    jsonb_build_object('id', g.id, 'number', g.grn_number, 'accepted', v_accepted, 'cost', v_cost));
end $$;

-- ════════════════════════ SITE CONSUMPTION ════════════════════════
create or replace function inv_save_consumption(p_payload jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid; v_num text; it jsonb; idx int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    perform inv_require('consumption','create');
    v_num := inv_next_number(a.firm_id, 'CON', 'CON');
    insert into stock_consumptions(firm_id, consumption_number, crm_project_id, location, milestone_id,
      task_id, consumed_at, entered_by, entered_by_name, note, photo_url, status)
    values (a.firm_id, v_num, p_payload->>'crm_project_id', p_payload->>'location', p_payload->>'milestone_id',
      p_payload->>'task_id', coalesce(nullif(p_payload->>'consumed_at','')::date, current_date),
      a.profile_id, a.full_name, p_payload->>'note', p_payload->>'photo_url', 'draft')
    returning id into v_id;
  else
    perform inv_require('consumption','edit');
    update stock_consumptions set crm_project_id=p_payload->>'crm_project_id', location=p_payload->>'location',
      milestone_id=p_payload->>'milestone_id', task_id=p_payload->>'task_id',
      consumed_at=coalesce(nullif(p_payload->>'consumed_at','')::date,current_date), note=p_payload->>'note',
      photo_url=p_payload->>'photo_url', updated_at=now()
    where id=v_id and firm_id=a.firm_id and status='draft';
    if not found then raise exception 'consumption not editable'; end if;
    delete from stock_consumption_items where consumption_id=v_id;
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into stock_consumption_items(firm_id, consumption_id, sku_id, uom, quantity, boq_line_id, unit_cost, order_index)
    values (a.firm_id, v_id, (it->>'sku_id')::uuid, (it->>'uom')::uom, coalesce((it->>'quantity')::numeric,0),
      nullif(it->>'boq_line_id','')::uuid, nullif(it->>'unit_cost','')::numeric, idx);
    idx := idx + 1;
  end loop;
  return v_id;
end $$;

-- Post consumption: reduce stock + feed BOQ estimated-vs-actual + tolerance alerts.
create or replace function inv_post_consumption(p_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; c stock_consumptions; it record; bl record; bd record;
  v_cost numeric; v_est numeric; v_actual_total numeric;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('consumption','create');
  select * into c from stock_consumptions where id=p_id and firm_id=a.firm_id for update;
  if c.id is null then raise exception 'consumption not found'; end if;
  if c.status <> 'draft' then raise exception 'consumption already %', c.status; end if;

  for it in select * from stock_consumption_items where consumption_id=c.id loop
    -- unit cost falls back to the last received cost for this sku/project
    v_cost := coalesce(it.unit_cost,
      (select unit_cost from stock_movements where firm_id=a.firm_id and project_id=c.crm_project_id
        and sku_id=it.sku_id and unit_cost is not null order by created_at desc limit 1), 0);
    perform inv_post_movement(a.firm_id, c.crm_project_id, c.location, it.sku_id, 'site_consumption',
      it.quantity, it.uom, v_cost, 'consumption', c.id, it.id, null, null,
      a.profile_id, a.full_name, 'con:'||it.id::text, 'Consumption '||c.consumption_number);

    -- BOQ estimated-vs-actual feedback (calibration input)
    if it.boq_line_id is not null then
      select * into bl from boq_line_items where id=it.boq_line_id;
      if bl.id is not null then
        select * into bd from boq_documents where id=bl.boq_id;
        insert into boq_actual_variance(firm_id, boq_line_id, project_id, region_id, product_id,
          estimated_qty, actual_qty, estimated_rate, actual_rate, estimated_cost, actual_cost, variance_pct, captured_at)
        values (a.firm_id, bl.id, bd.project_id, bd.region_id, bl.product_id,
          bl.quantity, it.quantity, bl.rate, v_cost, bl.cost_price, round(it.quantity*v_cost,2),
          case when bl.quantity>0 then round((it.quantity - bl.quantity)/bl.quantity*100,2) else null end, now());
        -- tolerance breach (actual usage > estimate + 10%)
        select coalesce(sum(actual_qty),0) into v_actual_total from boq_actual_variance where boq_line_id=bl.id;
        v_est := bl.quantity;
        if v_est > 0 and v_actual_total > v_est * 1.10 then
          perform inv_alert(a.firm_id, 'consumption_over_tolerance', 'warning', 'Consumption over BOQ tolerance',
            bl.description||' used '||round(v_actual_total,2)||' vs planned '||round(v_est,2),
            c.crm_project_id, it.sku_id, 'boq_line', bl.id, 'projects|'||c.crm_project_id,
            'tol_'||bl.id::text);
        end if;
      end if;
    end if;
  end loop;

  update stock_consumptions set status='posted', posted_at=now(), updated_at=now() where id=c.id;
  perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Posted consumption '||c.consumption_number,
    'consumption', 'consumption', c.id::text, c.consumption_number, null);
  perform inv_emit(a.firm_id, 'consumption.posted', jsonb_build_object('id', c.id, 'number', c.consumption_number));
end $$;

-- ════════════════════════ STOCK TRANSFERS ════════════════════════
create or replace function inv_save_transfer(p_payload jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid; v_num text; it jsonb; idx int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    perform inv_require('transfers','create');
    v_num := inv_next_number(a.firm_id, 'TRF', 'TRF');
    insert into stock_transfers(firm_id, transfer_number, from_project, to_project, from_location, to_location,
      status, note, created_by, created_by_name)
    values (a.firm_id, v_num, p_payload->>'from_project', p_payload->>'to_project', p_payload->>'from_location',
      p_payload->>'to_location', 'draft', p_payload->>'note', a.profile_id, a.full_name)
    returning id into v_id;
  else
    perform inv_require('transfers','create');
    update stock_transfers set from_project=p_payload->>'from_project', to_project=p_payload->>'to_project',
      from_location=p_payload->>'from_location', to_location=p_payload->>'to_location', note=p_payload->>'note', updated_at=now()
    where id=v_id and firm_id=a.firm_id and status='draft';
    if not found then raise exception 'transfer not editable'; end if;
    delete from stock_transfer_items where transfer_id=v_id;
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into stock_transfer_items(firm_id, transfer_id, sku_id, uom, quantity, order_index)
    values (a.firm_id, v_id, (it->>'sku_id')::uuid, (it->>'uom')::uom, coalesce((it->>'quantity')::numeric,0), idx);
    idx := idx + 1;
  end loop;
  return v_id;
end $$;

create or replace function inv_dispatch_transfer(p_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; t stock_transfers; it record;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('transfers','create');
  select * into t from stock_transfers where id=p_id and firm_id=a.firm_id for update;
  if t.id is null then raise exception 'transfer not found'; end if;
  if t.status <> 'draft' then raise exception 'transfer already %', t.status; end if;
  for it in select * from stock_transfer_items where transfer_id=t.id loop
    perform inv_post_movement(a.firm_id, t.from_project, t.from_location, it.sku_id, 'transfer_out',
      it.quantity, it.uom, null, 'transfer', t.id, it.id, t.to_project, null,
      a.profile_id, a.full_name, 'trf_out:'||it.id::text, 'Transfer '||t.transfer_number);
    update stock_transfer_items set dispatched_qty = it.quantity where id=it.id;
  end loop;
  update stock_transfers set status='dispatched', dispatched_at=now(), updated_at=now() where id=t.id;
  perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Dispatched transfer '||t.transfer_number,
    'transfers', 'transfer', t.id::text, t.transfer_number, null);
  perform inv_notify_team(a.firm_id, t.to_project, 'Incoming stock transfer',
    t.transfer_number||' is on the way — confirm receipt', 'info', 'projects|'||t.to_project);
  perform inv_alert(a.firm_id, 'transfer_pending', 'info', 'Transfer awaiting receipt',
    t.transfer_number||' dispatched', t.to_project, null, 'transfer', t.id, 'projects|'||t.to_project,
    'trf_pending_'||t.id::text);
  perform inv_emit(a.firm_id, 'transfer.dispatched', jsonb_build_object('id', t.id, 'number', t.transfer_number));
end $$;

create or replace function inv_receive_transfer(p_id uuid, p_received jsonb)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; t stock_transfers; it record; v_recv numeric;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('transfers','approve');
  select * into t from stock_transfers where id=p_id and firm_id=a.firm_id for update;
  if t.id is null then raise exception 'transfer not found'; end if;
  if t.status <> 'dispatched' then raise exception 'transfer is not in transit (is %)', t.status; end if;
  for it in select * from stock_transfer_items where transfer_id=t.id loop
    v_recv := coalesce((p_received->>(it.id::text))::numeric, it.dispatched_qty);
    if v_recv > 0 then
      perform inv_post_movement(a.firm_id, t.to_project, t.to_location, it.sku_id, 'transfer_in',
        v_recv, it.uom, null, 'transfer', t.id, it.id, t.from_project, null,
        a.profile_id, a.full_name, 'trf_in:'||it.id::text, 'Transfer '||t.transfer_number);
    end if;
    update stock_transfer_items set received_qty = v_recv where id=it.id;
  end loop;
  update stock_transfers set status='received', received_at=now(), updated_at=now() where id=t.id;
  update inventory_alerts set status='resolved', resolved_at=now() where dedupe_key='trf_pending_'||t.id::text;
  perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Received transfer '||t.transfer_number,
    'transfers', 'transfer', t.id::text, t.transfer_number, null);
  perform inv_emit(a.firm_id, 'transfer.received', jsonb_build_object('id', t.id, 'number', t.transfer_number));
end $$;

grant execute on function
  inv_save_goods_receipt(jsonb,jsonb), inv_post_goods_receipt(uuid),
  inv_save_consumption(jsonb,jsonb), inv_post_consumption(uuid),
  inv_save_transfer(jsonb,jsonb), inv_dispatch_transfer(uuid), inv_receive_transfer(uuid,jsonb)
to anon, authenticated;