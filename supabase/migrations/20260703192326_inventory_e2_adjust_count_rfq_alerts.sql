-- ════════════════════════════════════════════════════════════════════════
-- Migration E2: Adjustments, Physical Counts, RFQ/Quotes, alerts + outbox.
-- ════════════════════════════════════════════════════════════════════════

-- helper: canonical base uom for a sku
create or replace function inv_base_uom(p_sku uuid)
returns uom language sql stable security definer set search_path='public' as $$
  select cp.base_uom from product_skus s join catalog_products cp on cp.id=s.product_id where s.id=p_sku;
$$;

-- ════════════════════════ STOCK ADJUSTMENTS ════════════════════════
create or replace function inv_save_adjustment(p_payload jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid; v_num text; it jsonb; idx int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    perform inv_require('stock_adjustments','create');
    v_num := inv_next_number(a.firm_id, 'ADJ', 'ADJ');
    insert into stock_adjustments(firm_id, adjustment_number, crm_project_id, location, kind, reason,
      status, evidence_url, requested_by, requested_by_name, note)
    values (a.firm_id, v_num, p_payload->>'crm_project_id', p_payload->>'location',
      coalesce(p_payload->>'kind','negative'), p_payload->>'reason', 'draft', p_payload->>'evidence_url',
      a.profile_id, a.full_name, p_payload->>'note')
    returning id into v_id;
  else
    perform inv_require('stock_adjustments','create');
    update stock_adjustments set crm_project_id=p_payload->>'crm_project_id', location=p_payload->>'location',
      kind=coalesce(p_payload->>'kind','negative'), reason=p_payload->>'reason',
      evidence_url=p_payload->>'evidence_url', note=p_payload->>'note', updated_at=now()
    where id=v_id and firm_id=a.firm_id and status='draft';
    if not found then raise exception 'adjustment not editable'; end if;
    delete from stock_adjustment_items where adjustment_id=v_id;
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into stock_adjustment_items(firm_id, adjustment_id, sku_id, uom, quantity, unit_cost, note, order_index)
    values (a.firm_id, v_id, (it->>'sku_id')::uuid, (it->>'uom')::uom, coalesce((it->>'quantity')::numeric,0),
      nullif(it->>'unit_cost','')::numeric, it->>'note', idx);
    idx := idx + 1;
  end loop;
  return v_id;
end $$;

create or replace function inv_submit_adjustment(p_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; adj stock_adjustments;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('stock_adjustments','create');
  select * into adj from stock_adjustments where id=p_id and firm_id=a.firm_id for update;
  if adj.id is null then raise exception 'adjustment not found'; end if;
  if adj.status <> 'draft' then raise exception 'adjustment already %', adj.status; end if;
  update stock_adjustments set status='pending_approval', updated_at=now() where id=adj.id;
  perform inv_notify_admins(a.firm_id, 'Stock adjustment awaiting approval',
    adj.adjustment_number||' ('||adj.kind||') needs approval', 'warning', 'projects|'||adj.crm_project_id);
  perform inv_log(a.firm_id, a.profile_id, 'submitted', 'Submitted adjustment '||adj.adjustment_number,
    'stock_adjustments', 'adjustment', adj.id::text, adj.adjustment_number, null);
end $$;

-- Approve → post the ledger movements atomically (or reject).
create or replace function inv_decide_adjustment(p_id uuid, p_decision text, p_notes text)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; adj stock_adjustments; it record; mt movement_type;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('stock_adjustments','approve');
  select * into adj from stock_adjustments where id=p_id and firm_id=a.firm_id for update;
  if adj.id is null then raise exception 'adjustment not found'; end if;
  if adj.status not in ('pending_approval','draft') then raise exception 'adjustment not approvable (is %)', adj.status; end if;

  if p_decision='reject' then
    update stock_adjustments set status='rejected', note=coalesce(p_notes,note), approved_by=a.profile_id,
      approved_by_name=a.full_name, approved_at=now(), updated_at=now() where id=adj.id;
    perform inv_notify(a.firm_id, adj.requested_by, 'Adjustment rejected',
      coalesce(p_notes, adj.adjustment_number||' rejected'), 'error', 'projects|'||adj.crm_project_id);
    return;
  end if;

  mt := case adj.kind when 'positive' then 'positive_adjustment' when 'negative' then 'negative_adjustment'
    when 'write_off' then 'write_off' when 'supplier_return' then 'supplier_return'
    else 'negative_adjustment' end::movement_type;

  for it in select * from stock_adjustment_items where adjustment_id=adj.id loop
    perform inv_post_movement(a.firm_id, adj.crm_project_id, adj.location, it.sku_id, mt,
      it.quantity, it.uom, it.unit_cost, 'adjustment', adj.id, it.id, null, null,
      a.profile_id, a.full_name, 'adj:'||it.id::text, adj.reason);
  end loop;
  update stock_adjustments set status='posted', approved_by=a.profile_id, approved_by_name=a.full_name,
    approved_at=now(), posted_at=now(), updated_at=now() where id=adj.id;
  perform inv_log(a.firm_id, a.profile_id, 'approved', 'Approved & posted adjustment '||adj.adjustment_number,
    'stock_adjustments', 'adjustment', adj.id::text, adj.adjustment_number, adj.reason);
  perform inv_notify(a.firm_id, adj.requested_by, 'Adjustment approved',
    adj.adjustment_number||' posted to the ledger', 'success', 'projects|'||adj.crm_project_id);
  perform inv_emit(a.firm_id, 'adjustment.posted', jsonb_build_object('id', adj.id, 'number', adj.adjustment_number));
end $$;

-- ════════════════════════ PHYSICAL COUNTS ════════════════════════
create or replace function inv_save_count(p_payload jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid; v_num text; it jsonb; idx int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    perform inv_require('stock_adjustments','create');
    v_num := inv_next_number(a.firm_id, 'PC', 'PC');
    insert into physical_counts(firm_id, count_number, crm_project_id, location, status, counted_at, note,
      created_by, created_by_name)
    values (a.firm_id, v_num, p_payload->>'crm_project_id', p_payload->>'location', 'draft',
      coalesce(nullif(p_payload->>'counted_at','')::date,current_date), p_payload->>'note', a.profile_id, a.full_name)
    returning id into v_id;
  else
    perform inv_require('stock_adjustments','create');
    update physical_counts set crm_project_id=p_payload->>'crm_project_id', location=p_payload->>'location',
      counted_at=coalesce(nullif(p_payload->>'counted_at','')::date,current_date), note=p_payload->>'note', updated_at=now()
    where id=v_id and firm_id=a.firm_id and status='draft';
    if not found then raise exception 'count not editable'; end if;
    delete from physical_count_items where count_id=v_id;
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into physical_count_items(firm_id, count_id, sku_id, uom, counted_qty, order_index)
    values (a.firm_id, v_id, (it->>'sku_id')::uuid, (it->>'uom')::uom, coalesce((it->>'counted_qty')::numeric,0), idx);
    idx := idx + 1;
  end loop;
  return v_id;
end $$;

-- Post a count: snapshot system on-hand, book variance as adjustment movements.
create or replace function inv_post_count(p_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; pc physical_counts; it record; v_sys numeric; v_counted_base numeric; v_var numeric; v_bu uom;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('stock_adjustments','approve');
  select * into pc from physical_counts where id=p_id and firm_id=a.firm_id for update;
  if pc.id is null then raise exception 'count not found'; end if;
  if pc.status <> 'draft' then raise exception 'count already %', pc.status; end if;

  for it in select * from physical_count_items where count_id=pc.id loop
    v_bu := inv_base_uom(it.sku_id);
    v_sys := coalesce((select on_hand from stock_balances where firm_id=a.firm_id and project_id=pc.crm_project_id and sku_id=it.sku_id), 0);
    v_counted_base := inv_to_base(it.sku_id, it.counted_qty, it.uom);
    v_var := round(v_counted_base - v_sys, 4);
    update physical_count_items set system_qty=v_sys, variance_qty=v_var where id=it.id;
    if v_var > 0 then
      perform inv_post_movement(a.firm_id, pc.crm_project_id, pc.location, it.sku_id, 'positive_adjustment',
        v_var, v_bu, null, 'count', pc.id, it.id, null, null, a.profile_id, a.full_name, 'pc:'||it.id::text,
        'Physical count '||pc.count_number);
    elsif v_var < 0 then
      perform inv_post_movement(a.firm_id, pc.crm_project_id, pc.location, it.sku_id, 'negative_adjustment',
        abs(v_var), v_bu, null, 'count', pc.id, it.id, null, null, a.profile_id, a.full_name, 'pc:'||it.id::text,
        'Physical count '||pc.count_number);
    end if;
    if v_var <> 0 then
      perform inv_alert(a.firm_id, 'count_variance', 'warning', 'Stock count variance',
        pc.count_number||' found a variance of '||v_var, pc.crm_project_id, it.sku_id, 'count', pc.id,
        'projects|'||pc.crm_project_id, 'pcvar_'||it.id::text);
    end if;
  end loop;
  update physical_counts set status='posted', posted_at=now(), updated_at=now() where id=pc.id;
  perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Posted physical count '||pc.count_number,
    'stock_adjustments', 'physical_count', pc.id::text, pc.count_number, null);
  perform inv_emit(a.firm_id, 'count.posted', jsonb_build_object('id', pc.id, 'number', pc.count_number));
end $$;

-- ════════════════════════ RFQ / VENDOR QUOTES ════════════════════════
create or replace function inv_save_rfq(p_payload jsonb, p_items jsonb, p_vendors jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid; v_num text; it jsonb; ve jsonb; idx int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    perform inv_require('rfqs','create');
    v_num := inv_next_number(a.firm_id, 'RFQ', 'RFQ');
    insert into rfqs(firm_id, rfq_number, project_id, material_request_id, priority, required_by, notes,
      status, created_by, created_by_name)
    values (a.firm_id, v_num, p_payload->>'project_id', nullif(p_payload->>'material_request_id','')::uuid,
      coalesce(p_payload->>'priority','balanced'), nullif(p_payload->>'required_by','')::date, p_payload->>'notes',
      'draft', a.profile_id, a.full_name)
    returning id into v_id;
  else
    perform inv_require('rfqs','edit');
    update rfqs set project_id=p_payload->>'project_id', material_request_id=nullif(p_payload->>'material_request_id','')::uuid,
      priority=coalesce(p_payload->>'priority','balanced'), required_by=nullif(p_payload->>'required_by','')::date,
      notes=p_payload->>'notes', updated_at=now()
    where id=v_id and firm_id=a.firm_id and status='draft';
    if not found then raise exception 'RFQ not editable'; end if;
    delete from rfq_items where rfq_id=v_id;
    delete from rfq_vendors where rfq_id=v_id;
  end if;
  idx := 0;
  for it in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into rfq_items(firm_id, rfq_id, sku_id, material_name, uom, quantity, required_by, boq_line_id, order_index)
    values (a.firm_id, v_id, nullif(it->>'sku_id','')::uuid, coalesce(it->>'material_name',''), nullif(it->>'uom','')::uom,
      coalesce((it->>'quantity')::numeric,0), nullif(it->>'required_by','')::date, nullif(it->>'boq_line_id','')::uuid, idx);
    idx := idx + 1;
  end loop;
  idx := 0;
  for ve in select * from jsonb_array_elements(coalesce(p_vendors,'[]'::jsonb)) loop
    insert into rfq_vendors(firm_id, rfq_id, vendor_id, vendor_name, status, quote_valid_until, credit_terms, order_index)
    values (a.firm_id, v_id, nullif(ve->>'vendor_id','')::uuid, coalesce(ve->>'vendor_name',''), 'pending',
      nullif(ve->>'quote_valid_until','')::date, ve->>'credit_terms', idx);
    idx := idx + 1;
  end loop;
  return v_id;
end $$;

create or replace function inv_send_rfq(p_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; r rfqs;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('rfqs','edit');
  select * into r from rfqs where id=p_id and firm_id=a.firm_id for update;
  if r.id is null then raise exception 'RFQ not found'; end if;
  if r.status not in ('draft') then raise exception 'RFQ already %', r.status; end if;
  update rfqs set status='sent', updated_at=now() where id=r.id;
  update rfq_vendors set status='sent', sent_at=current_date where rfq_id=r.id;
  perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Sent RFQ '||r.rfq_number,
    'rfqs', 'rfq', r.id::text, r.rfq_number, null);
  perform inv_alert(a.firm_id, 'rfq_pending', 'info', 'RFQ awaiting quotes',
    r.rfq_number||' sent to vendors', r.project_id, null, 'rfq', r.id, 'vendors', 'rfq_pending_'||r.id::text);
  perform inv_emit(a.firm_id, 'rfq.sent', jsonb_build_object('id', r.id, 'number', r.rfq_number));
end $$;

create or replace function inv_record_quote(p_rfq_vendor_id uuid, p_terms jsonb, p_quote_items jsonb)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; rv rfq_vendors; qi jsonb;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('rfqs','edit');
  select * into rv from rfq_vendors where id=p_rfq_vendor_id and firm_id=a.firm_id for update;
  if rv.id is null then raise exception 'RFQ vendor not found'; end if;
  update rfq_vendors set status='quoted',
    lead_time_days=nullif(p_terms->>'lead_time_days','')::int,
    promised_date=nullif(p_terms->>'promised_date','')::date,
    freight=coalesce((p_terms->>'freight')::numeric,0),
    quote_valid_until=nullif(p_terms->>'quote_valid_until','')::date,
    credit_terms=coalesce(p_terms->>'credit_terms', credit_terms),
    notes=p_terms->>'notes'
  where id=rv.id;
  for qi in select * from jsonb_array_elements(coalesce(p_quote_items,'[]'::jsonb)) loop
    insert into rfq_quote_items(firm_id, rfq_id, rfq_vendor_id, rfq_item_id, unit_price, tax_pct, moq, note)
    values (a.firm_id, rv.rfq_id, rv.id, (qi->>'rfq_item_id')::uuid, nullif(qi->>'unit_price','')::numeric,
      coalesce((qi->>'tax_pct')::numeric,0), nullif(qi->>'moq','')::numeric, qi->>'note')
    on conflict (rfq_vendor_id, rfq_item_id) do update
      set unit_price=excluded.unit_price, tax_pct=excluded.tax_pct, moq=excluded.moq, note=excluded.note;
  end loop;
  update rfqs set status='quotes_received', updated_at=now() where id=rv.rfq_id and status in ('draft','sent');
  perform inv_log(a.firm_id, a.profile_id, 'updated', 'Recorded quote from '||rv.vendor_name,
    'rfqs', 'rfq', rv.rfq_id::text, rv.vendor_name, null);
end $$;

-- Award: mark winners, create a draft PO per awarded vendor (partial award / split supported).
create or replace function inv_award_rfq(p_id uuid, p_awards jsonb)
returns void language plpgsql security definer set search_path='public' as $$
declare a record; r rfqs; aw jsonb; li jsonb; rv rfq_vendors; v_po uuid; v_num text; v_sub numeric; v_amt numeric;
  q record; v_qb numeric; v_total numeric; v_gst numeric;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('rfqs','approve');
  select * into r from rfqs where id=p_id and firm_id=a.firm_id for update;
  if r.id is null then raise exception 'RFQ not found'; end if;
  if r.status not in ('quotes_received','evaluated','sent') then raise exception 'RFQ not awardable (is %)', r.status; end if;

  for aw in select * from jsonb_array_elements(coalesce(p_awards,'[]'::jsonb)) loop
    select * into rv from rfq_vendors where id=(aw->>'rfq_vendor_id')::uuid and rfq_id=r.id;
    if rv.id is null then continue; end if;
    v_num := inv_next_number(a.firm_id, 'PO', 'PO');
    v_sub := 0;
    insert into purchase_orders(firm_id, po_number, crm_project_id, vendor_id, rfq_id, material_request_id,
      status, approval_status, required_by, credit_days, gst_rate, gst_type, freight_charges, payment_status,
      supplier_quotation_ref, created_by, subtotal, total_amount, gst_amount)
    values (a.firm_id, v_num, r.project_id, rv.vendor_id, r.id, r.material_request_id, 'draft', 'draft',
      r.required_by, null, 18, 'inclusive', coalesce(rv.freight,0), 'outstanding',
      'RFQ '||r.rfq_number, a.profile_id, 0, 0, 0)
    returning id into v_po;

    for li in select * from jsonb_array_elements(coalesce(aw->'items','[]'::jsonb)) loop
      select qi.unit_price, qi.tax_pct, ri.sku_id, ri.uom, ri.material_name, ri.boq_line_id
        into q
      from rfq_items ri
      left join rfq_quote_items qi on qi.rfq_item_id=ri.id and qi.rfq_vendor_id=rv.id
      where ri.id=(li->>'rfq_item_id')::uuid;
      v_amt := round(coalesce((li->>'qty')::numeric,0) * coalesce(q.unit_price,0), 2);
      v_sub := v_sub + v_amt;
      v_qb := case when q.sku_id is not null then inv_to_base(q.sku_id, coalesce((li->>'qty')::numeric,0), q.uom) else null end;
      insert into po_line_items(firm_id, po_id, sku_id, boq_line_id, description, uom, quantity, rate, amount, qty_base, qty_received_base)
      values (a.firm_id, v_po, q.sku_id, q.boq_line_id, coalesce(q.material_name,''), q.uom,
        coalesce((li->>'qty')::numeric,0), coalesce(q.unit_price,0), v_amt, v_qb, 0);
      update rfq_quote_items set is_awarded=true, awarded_qty=coalesce((li->>'qty')::numeric,0)
        where rfq_vendor_id=rv.id and rfq_item_id=(li->>'rfq_item_id')::uuid;
    end loop;

    v_total := round(v_sub + coalesce(rv.freight,0), 2);
    v_gst := round(v_total - (v_total/1.18), 2);
    update purchase_orders set subtotal=v_sub, total_amount=v_total, gst_amount=v_gst where id=v_po;
    update rfq_vendors set status='awarded' where id=rv.id;
    perform inv_log(a.firm_id, a.profile_id, 'created', 'Awarded '||r.rfq_number||' → PO '||v_num,
      'rfqs', 'rfq', r.id::text, r.rfq_number, 'Vendor '||rv.vendor_name);
  end loop;

  update rfqs set status='awarded', awarded_at=now(), updated_at=now() where id=r.id;
  update inventory_alerts set status='resolved', resolved_at=now() where dedupe_key='rfq_pending_'||r.id::text;
  if r.material_request_id is not null then
    update material_requests set status='in_procurement', updated_at=now()
    where id=r.material_request_id and status='approved';
  end if;
  perform inv_emit(a.firm_id, 'rfq.awarded', jsonb_build_object('id', r.id, 'number', r.rfq_number));
end $$;

-- ════════════════════════ ALERTS + OUTBOX AUTOMATION ════════════════════════
-- Regenerates exception-first alerts from live state; clears the ones no longer valid.
create or replace function inv_refresh_alerts()
returns integer language plpgsql security definer set search_path='public' as $$
declare a record; rec record; n int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;

  update inventory_alerts set status='resolved', resolved_at=now()
  where firm_id=a.firm_id and status='open'
    and alert_type in ('reorder','shortage','approval_pending','po_pending','rfq_pending');

  -- reorder / shortage from live position vs policy
  for rec in
    select sp.project_id, sp.sku_id, sp.available, sp.projected, s.reorder_level, s.safety_stock,
           pk.sku_code, pr.name as pname
    from stock_position sp
    join inventory_item_settings s
      on s.firm_id=a.firm_id and s.sku_id=sp.sku_id and (s.project_id=sp.project_id or s.project_id is null)
    join product_skus pk on pk.id=sp.sku_id
    join catalog_products pr on pr.id=pk.product_id
    where sp.firm_id=a.firm_id and s.reorder_level > 0
  loop
    if rec.projected < 0 then
      perform inv_alert(a.firm_id, 'shortage', 'critical', 'Projected shortage',
        coalesce(rec.pname,rec.sku_code)||' projected '||round(rec.projected,2)||' — will run short',
        rec.project_id, rec.sku_id, 'sku', rec.sku_id, 'projects|'||rec.project_id,
        'short_'||rec.project_id||'_'||rec.sku_id::text);
      n := n + 1;
    elsif rec.available <= rec.reorder_level then
      perform inv_alert(a.firm_id, 'reorder', 'warning', 'Below reorder level',
        coalesce(rec.pname,rec.sku_code)||' available '||round(rec.available,2)||' ≤ reorder '||round(rec.reorder_level,2),
        rec.project_id, rec.sku_id, 'sku', rec.sku_id, 'projects|'||rec.project_id,
        'reorder_'||rec.project_id||'_'||rec.sku_id::text);
      n := n + 1;
    end if;
  end loop;

  for rec in select id, request_number, project_id from material_requests where firm_id=a.firm_id and status='submitted' loop
    perform inv_alert(a.firm_id, 'approval_pending', 'warning', 'Material request awaiting approval',
      rec.request_number, rec.project_id, null, 'material_request', rec.id, 'projects|'||rec.project_id,
      'mrappr_'||rec.id::text);
    n := n + 1;
  end loop;
  for rec in select id, po_number, crm_project_id from purchase_orders where firm_id=a.firm_id and status='pending_approval' loop
    perform inv_alert(a.firm_id, 'po_pending', 'warning', 'PO awaiting approval', rec.po_number,
      rec.crm_project_id, null, 'purchase_order', rec.id, 'vendors', 'poappr_'||rec.id::text);
    n := n + 1;
  end loop;
  for rec in
    select r.id, r.rfq_number, r.project_id from rfqs r where r.firm_id=a.firm_id and r.status='sent'
    and not exists (select 1 from rfq_quote_items q where q.rfq_id=r.id)
  loop
    perform inv_alert(a.firm_id, 'rfq_pending', 'info', 'RFQ awaiting quotes', rec.rfq_number,
      rec.project_id, null, 'rfq', rec.id, 'vendors', 'rfq_pending_'||rec.id::text);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Durable outbox drain point for async/external automations (email, WhatsApp,
-- webhooks). In-app notifications are already emitted inline by each RPC; this
-- marks events consumed so an external worker can process them exactly once.
create or replace function inv_process_outbox(p_limit int default 100)
returns integer language plpgsql security definer set search_path='public' as $$
declare a record; rec record; n int := 0;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  for rec in select * from inventory_outbox where firm_id=a.firm_id and status='pending'
    order by created_at limit p_limit for update skip locked
  loop
    update inventory_outbox set status='processed', processed_at=now(), attempts=attempts+1 where id=rec.id;
    n := n + 1;
  end loop;
  return n;
end $$;

grant execute on function
  inv_save_adjustment(jsonb,jsonb), inv_submit_adjustment(uuid), inv_decide_adjustment(uuid,text,text),
  inv_save_count(jsonb,jsonb), inv_post_count(uuid),
  inv_save_rfq(jsonb,jsonb,jsonb), inv_send_rfq(uuid), inv_record_quote(uuid,jsonb,jsonb), inv_award_rfq(uuid,jsonb),
  inv_refresh_alerts(), inv_process_outbox(int), inv_base_uom(uuid)
to anon, authenticated;

-- item-settings upsert (reorder/safety policy) — small enough to allow directly via RPC
create or replace function inv_save_item_setting(p_sku uuid, p_project text, p_reorder numeric, p_safety numeric,
  p_max numeric, p_lead int, p_vendor uuid, p_notes text)
returns uuid language plpgsql security definer set search_path='public' as $$
declare a record; v_id uuid;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then raise exception 'not authenticated' using errcode='28000'; end if;
  perform inv_require('inventory','edit');
  insert into inventory_item_settings(firm_id, sku_id, project_id, reorder_level, safety_stock, max_level,
    lead_time_days, preferred_vendor_id, notes, updated_at)
  values (a.firm_id, p_sku, p_project, coalesce(p_reorder,0), coalesce(p_safety,0), p_max, p_lead, p_vendor, p_notes, now())
  on conflict (firm_id, sku_id, project_id) do update
    set reorder_level=excluded.reorder_level, safety_stock=excluded.safety_stock, max_level=excluded.max_level,
        lead_time_days=excluded.lead_time_days, preferred_vendor_id=excluded.preferred_vendor_id,
        notes=excluded.notes, updated_at=now()
  returning id into v_id;
  return v_id;
end $$;
grant execute on function inv_save_item_setting(uuid,text,numeric,numeric,numeric,int,uuid,text) to anon, authenticated;