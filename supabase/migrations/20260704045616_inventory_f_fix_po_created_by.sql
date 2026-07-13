-- purchase_orders.created_by is a uuid FK → profiles (auth side). The inventory
-- actor id is a crm_profiles.id (text), so it must live in its own column.
alter table purchase_orders add column if not exists created_by_crm text;

-- inv_save_purchase_order: write crm actor into created_by_crm, leave uuid created_by null
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
      payment_status, created_by_crm, subtotal, total_amount, gst_amount)
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

-- inv_decide_po: notify the CRM creator id
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
    perform inv_notify(a.firm_id, po.created_by_crm, 'PO approved', po.po_number||' was approved', 'success', 'vendors');
    perform inv_emit(a.firm_id, 'purchase_order.approved', jsonb_build_object('id', po.id, 'number', po.po_number));
  elsif p_decision='needs_changes' then
    update purchase_orders set status='needs_changes', approval_status='needs_changes', admin_notes=p_notes,
      version=version+1, updated_at=now() where id=po.id;
    perform inv_notify(a.firm_id, po.created_by_crm, 'PO needs changes', coalesce(p_notes,po.po_number||' needs changes'), 'warning', 'vendors');
  elsif p_decision='reject' then
    update purchase_orders set status='cancelled', approval_status='cancelled', admin_notes=p_notes,
      version=version+1, updated_at=now() where id=po.id;
    perform inv_notify(a.firm_id, po.created_by_crm, 'PO rejected', coalesce(p_notes,po.po_number||' was rejected'), 'error', 'vendors');
  else raise exception 'unknown decision %', p_decision; end if;
end $$;

-- inv_post_goods_receipt: notify the PO's CRM creator id (was uuid created_by)
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
      if it.po_line_id is not null then
        update po_line_items set qty_received = qty_received + it.accepted_qty,
          qty_received_base = qty_received_base + inv_to_base(it.sku_id, it.accepted_qty, it.uom)
        where id = it.po_line_id;
      end if;
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
  perform inv_notify(a.firm_id, (select created_by_crm from purchase_orders where id=g.po_id),
    'Goods received', g.grn_number||' posted', 'success', 'vendors');
  if v_any_reject then
    perform inv_alert(a.firm_id, 'rejected_receipt', 'warning', 'Rejected/damaged goods',
      g.grn_number||' has rejected or damaged material', g.crm_project_id, null, 'goods_receipt', g.id,
      'projects|'||g.crm_project_id, 'grn_reject_'||g.id::text);
  end if;
  perform inv_emit(a.firm_id, 'goods_receipt.posted',
    jsonb_build_object('id', g.id, 'number', g.grn_number, 'accepted', v_accepted, 'cost', v_cost));
end $$;

-- inv_award_rfq: PO created_by_crm (not the uuid column)
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
      supplier_quotation_ref, created_by_crm, subtotal, total_amount, gst_amount)
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