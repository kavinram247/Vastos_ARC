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

  for li in select * from po_line_items where po_id=po.id and mr_item_id is not null loop
    update material_request_items set ordered_qty = ordered_qty + li.quantity where id=li.mr_item_id;
  end loop;
  mrid := po.material_request_id;
  if mrid is not null then
    select bool_and(ordered_qty >= coalesce(approved_qty, required_qty))
      into allordered from material_request_items where request_id=mrid;
    update material_requests
      set status = (case when allordered then 'ordered' else 'partially_ordered' end)::mr_status,
          updated_at=now()
    where id=mrid and status in ('approved','in_procurement','partially_ordered');
  end if;

  perform inv_log(a.firm_id, a.profile_id, 'status_changed', 'Issued PO '||po.po_number,
    'purchasing', 'purchase_order', po.id::text, po.po_number, null);
  perform inv_alert(a.firm_id, 'partial_receipt', 'info', 'PO issued — awaiting delivery',
    po.po_number||' issued', po.crm_project_id, null, 'purchase_order', po.id, 'vendors',
    'po_awaiting_'||po.id::text);
  perform inv_emit(a.firm_id, 'purchase_order.issued', jsonb_build_object('id', po.id, 'number', po.po_number));
end $$;