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
    update purchase_orders
      set status = (case when v_all_recv then 'received' else 'partially_received' end)::po_status,
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