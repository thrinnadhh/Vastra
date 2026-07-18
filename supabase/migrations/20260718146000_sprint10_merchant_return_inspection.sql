create table if not exists private.return_command_receipts (
  actor_id uuid not null references public.profiles(id),
  action text not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  result_payload jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(actor_id, action, idempotency_key),
  constraint return_command_fingerprint_sha256 check (request_fingerprint ~ '^[0-9a-f]{64}$')
);
revoke all on private.return_command_receipts from public, anon, authenticated;
grant select, insert, update on private.return_command_receipts to service_role;

create or replace function public.merchant_list_returns(p_actor_id uuid, p_limit integer default 25)
returns jsonb language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(row_payload order by requested_at desc, id desc), '[]'::jsonb)
  from (
    select r.id, r.requested_at,
      jsonb_build_object('returnId', r.id, 'returnNumber', r.return_number, 'orderId', r.order_id,
        'status', r.status, 'reasonCode', r.reason_code, 'requestedAt', r.requested_at,
        'itemCount', (select count(*) from public.return_items i where i.return_request_id = r.id)) row_payload
    from public.return_requests r join public.shops s on s.id = r.shop_id
    where s.merchant_id = p_actor_id order by r.requested_at desc, r.id desc limit greatest(1, least(coalesce(p_limit,25),100))
  ) q;
$$;

create or replace function public.merchant_get_return(p_actor_id uuid, p_return_id uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object('returnId', r.id, 'returnNumber', r.return_number, 'orderId', r.order_id,
    'status', r.status, 'reasonCode', r.reason_code, 'customerNote', r.customer_note,
    'requestedAt', r.requested_at, 'approvedAt', r.approved_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object('returnItemId', i.id, 'orderItemId', i.order_item_id,
      'quantity', i.quantity, 'requestedRefundPaise', i.requested_refund_paise,
      'inspectionStatus', i.inspection_status, 'merchantDecision', i.merchant_decision,
      'merchantNote', i.merchant_note) order by i.id) from public.return_items i where i.return_request_id = r.id), '[]'::jsonb))
  from public.return_requests r join public.shops s on s.id = r.shop_id
  where r.id = p_return_id and s.merchant_id = p_actor_id;
$$;

create or replace function public.merchant_receive_return(
  p_actor_id uuid, p_return_id uuid, p_idempotency_key uuid, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_return public.return_requests; v_receipt private.return_command_receipts; v_hash text; v_result jsonb;
begin
  if p_actor_id is null or p_return_id is null or p_idempotency_key is null then raise exception 'FINANCE_REQUEST_INVALID'; end if;
  v_hash := encode(extensions.digest(concat_ws('|', p_return_id::text, coalesce(nullif(btrim(p_note),''),'')), 'sha256'), 'hex');
  insert into private.return_command_receipts(actor_id,action,idempotency_key,request_fingerprint)
  values(p_actor_id,'merchant.return.receive',p_idempotency_key,v_hash) on conflict do nothing returning * into v_receipt;
  if not found then
    select * into strict v_receipt from private.return_command_receipts where actor_id=p_actor_id and action='merchant.return.receive' and idempotency_key=p_idempotency_key for update;
    if v_receipt.request_fingerprint<>v_hash then raise exception 'FINANCE_IDEMPOTENCY_CONFLICT'; end if;
    if v_receipt.result_payload is null then raise exception 'FINANCE_REQUEST_INCOMPLETE'; end if;
    return v_receipt.result_payload || jsonb_build_object('replayed',true);
  end if;
  select r.* into v_return from public.return_requests r join public.shops s on s.id=r.shop_id
  where r.id=p_return_id and s.merchant_id=p_actor_id for update of r;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;
  if v_return.status <> 'PICKED_UP' and not (v_return.status='PICKUP_ASSIGNED' and exists(
    select 1 from public.delivery_tasks d where d.return_request_id=v_return.id and d.task_type='RETURN_PICKUP' and d.status='COMPLETED')) then
    raise exception 'FINANCE_RETURN_STATE_CONFLICT';
  end if;
  update public.return_requests set status='RECEIVED', updated_at=transaction_timestamp() where id=v_return.id;
  insert into public.return_status_history(return_request_id,previous_status,new_status,changed_by,reason_code,note)
  values(v_return.id,v_return.status,'RECEIVED',p_actor_id,'RETURN_RECEIVED',nullif(btrim(p_note),''));
  v_result:=jsonb_build_object('returnId',v_return.id,'status','RECEIVED','replayed',false);
  update private.return_command_receipts set result_payload=v_result,completed_at=transaction_timestamp()
  where actor_id=p_actor_id and action='merchant.return.receive' and idempotency_key=p_idempotency_key;
  return v_result;
end; $$;

create or replace function public.merchant_submit_return_inspection(
  p_actor_id uuid, p_return_id uuid, p_items jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_return public.return_requests; v_receipt private.return_command_receipts; v_hash text; v_input record; v_count integer; v_next public.return_request_status; v_result jsonb;
begin
  if p_actor_id is null or p_return_id is null or p_idempotency_key is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 then raise exception 'FINANCE_REQUEST_INVALID'; end if;
  v_hash:=encode(extensions.digest(concat_ws('|',p_return_id::text,p_items::text),'sha256'),'hex');
  insert into private.return_command_receipts(actor_id,action,idempotency_key,request_fingerprint)
  values(p_actor_id,'merchant.return.inspect',p_idempotency_key,v_hash) on conflict do nothing returning * into v_receipt;
  if not found then
    select * into strict v_receipt from private.return_command_receipts where actor_id=p_actor_id and action='merchant.return.inspect' and idempotency_key=p_idempotency_key for update;
    if v_receipt.request_fingerprint<>v_hash then raise exception 'FINANCE_IDEMPOTENCY_CONFLICT'; end if;
    if v_receipt.result_payload is null then raise exception 'FINANCE_REQUEST_INCOMPLETE'; end if;
    return v_receipt.result_payload || jsonb_build_object('replayed',true);
  end if;
  select r.* into v_return from public.return_requests r join public.shops s on s.id=r.shop_id
  where r.id=p_return_id and s.merchant_id=p_actor_id for update of r;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;
  if v_return.status<>'RECEIVED' then raise exception 'FINANCE_RETURN_STATE_CONFLICT'; end if;
  perform 1 from public.return_items where return_request_id=v_return.id order by id for update;
  select count(*) into v_count from public.return_items where return_request_id=v_return.id;
  if v_count<>jsonb_array_length(p_items) or exists(
    select 1 from jsonb_to_recordset(p_items) x("returnItemId" uuid) left join public.return_items i on i.id=x."returnItemId" and i.return_request_id=v_return.id where i.id is null
  ) then raise exception 'FINANCE_REQUEST_INVALID'; end if;
  for v_input in select * from jsonb_to_recordset(p_items) x("returnItemId" uuid,"inspectionStatus" text,"merchantDecision" text,note text,"evidenceObjectKey" text)
  loop
    if v_input."inspectionStatus" not in ('SELLABLE','DAMAGED','USED','WRONG_ITEM','DISPUTED') or v_input."merchantDecision" not in ('ACCEPTED','DISPUTED','PARTIAL') then raise exception 'FINANCE_REQUEST_INVALID'; end if;
    if v_input."merchantDecision"='DISPUTED' and v_input."inspectionStatus" not in ('DISPUTED','WRONG_ITEM') then raise exception 'FINANCE_REQUEST_INVALID'; end if;
    update public.return_items set inspection_status=v_input."inspectionStatus"::public.return_inspection_status,
      merchant_decision=v_input."merchantDecision"::public.return_merchant_decision,
      merchant_note=nullif(btrim(v_input.note),''),inspected_by=p_actor_id,inspected_at=transaction_timestamp()
    where id=v_input."returnItemId" and inspection_status='PENDING';
    if not found then raise exception 'FINANCE_RETURN_STATE_CONFLICT'; end if;
    if nullif(btrim(v_input."evidenceObjectKey"),'') is not null then
      if v_input."evidenceObjectKey" not like format('returns/%s/%s/%%',p_return_id,p_actor_id) or position('..' in v_input."evidenceObjectKey")>0 then raise exception 'FINANCE_REQUEST_INVALID'; end if;
      insert into public.return_evidence(return_request_id,uploaded_by,evidence_type,storage_object_key,description)
      values(p_return_id,p_actor_id,'MERCHANT_PHOTO',v_input."evidenceObjectKey",format('Inspection evidence for item %s',v_input."returnItemId"));
    end if;
  end loop;
  if exists(select 1 from public.return_items where return_request_id=v_return.id and merchant_decision<>'ACCEPTED') then v_next:='REVIEW'; else v_next:='VERIFIED'; end if;
  update public.return_requests set status=v_next,updated_at=transaction_timestamp() where id=v_return.id;
  insert into public.return_status_history(return_request_id,previous_status,new_status,changed_by,reason_code)
  values(v_return.id,'RECEIVED',v_next,p_actor_id,'RETURN_INSPECTION');
  v_result:=jsonb_build_object('returnId',v_return.id,'status',v_next,'itemCount',v_count,'replayed',false);
  update private.return_command_receipts set result_payload=v_result,completed_at=transaction_timestamp()
  where actor_id=p_actor_id and action='merchant.return.inspect' and idempotency_key=p_idempotency_key;
  return v_result;
end; $$;

revoke all on function public.merchant_list_returns(uuid,integer) from public,anon,authenticated;
revoke all on function public.merchant_get_return(uuid,uuid) from public,anon,authenticated;
revoke all on function public.merchant_receive_return(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.merchant_submit_return_inspection(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.merchant_list_returns(uuid,integer) to service_role;
grant execute on function public.merchant_get_return(uuid,uuid) to service_role;
grant execute on function public.merchant_receive_return(uuid,uuid,uuid,text) to service_role;
grant execute on function public.merchant_submit_return_inspection(uuid,uuid,jsonb,uuid) to service_role;
