alter table private.admin_command_receipts
  add column if not exists result_payload jsonb,
  add column if not exists completed_at timestamptz;

create or replace function private.claim_admin_operation(
  p_actor_id uuid,
  p_action text,
  p_idempotency_key uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_reason_code text,
  p_note text,
  p_request_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_receipt private.admin_command_receipts%rowtype;
begin
  if p_actor_id is null or p_resource_id is null or p_idempotency_key is null
    or p_action is null or length(btrim(p_action)) = 0
    or p_request_payload is null or jsonb_typeof(p_request_payload) <> 'object'
  then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;

  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'ADMIN_ACCESS_DENIED'; end if;

  v_fingerprint := encode(extensions.digest(concat_ws('|', p_resource_type,
    p_resource_id::text, p_reason_code, coalesce(p_note, ''), p_request_payload::text), 'sha256'), 'hex');

  insert into private.admin_command_receipts(
    actor_id, action, idempotency_key, request_fingerprint
  ) values (p_actor_id, p_action, p_idempotency_key, v_fingerprint)
  on conflict do nothing;

  select * into strict v_receipt
  from private.admin_command_receipts
  where actor_id = p_actor_id and action = p_action and idempotency_key = p_idempotency_key
  for update;

  if v_receipt.request_fingerprint <> v_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;

  if v_receipt.audit_id is not null then
    return coalesce(v_receipt.result_payload, '{}'::jsonb)
      || jsonb_build_object('replayed', true);
  end if;

  return null;
end;
$$;

create or replace function private.complete_admin_operation(
  p_actor_id uuid,
  p_action text,
  p_idempotency_key uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_before_state jsonb,
  p_after_state jsonb,
  p_result jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit_id uuid;
begin
  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    request_id, idempotency_key, before_state, after_state
  ) values (
    p_actor_id, p_action, p_resource_type, p_resource_id, p_reason_code,
    nullif(btrim(p_note), ''), nullif(btrim(p_request_id), ''), p_idempotency_key,
    p_before_state, p_after_state
  ) returning id into v_audit_id;

  update private.admin_command_receipts
  set audit_id = v_audit_id,
      result_payload = p_result,
      completed_at = transaction_timestamp()
  where actor_id = p_actor_id and action = p_action and idempotency_key = p_idempotency_key;

  return p_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function private.claim_admin_operation(uuid,text,uuid,text,uuid,text,text,jsonb)
  from public, anon, authenticated;
revoke all on function private.complete_admin_operation(uuid,text,uuid,text,uuid,text,text,text,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function private.claim_admin_operation(uuid,text,uuid,text,uuid,text,text,jsonb)
  to service_role;
grant execute on function private.complete_admin_operation(uuid,text,uuid,text,uuid,text,text,text,jsonb,jsonb,jsonb)
  to service_role;

create or replace function public.admin_cancel_order_operation(
  p_actor_id uuid,
  p_order_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_order public.orders;
  v_updated public.orders;
  v_task public.delivery_tasks;
  v_captain_id uuid;
  v_before jsonb;
  v_result jsonb;
begin
  v_replay := private.claim_admin_operation(
    p_actor_id, 'admin.order.cancel', p_idempotency_key, 'ORDER', p_order_id,
    p_reason_code, p_note, jsonb_build_object('orderId', p_order_id)
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ADMIN_ORDER_NOT_FOUND'; end if;
  if v_order.status not in (
    'PAYMENT_PENDING','WAITING_FOR_MERCHANT','MERCHANT_ACCEPTED','PACKING',
    'READY_FOR_PICKUP','CAPTAIN_SEARCHING','CAPTAIN_ASSIGNED','CAPTAIN_AT_STORE',
    'PROBLEM_REPORTED'
  ) or v_order.picked_up_at is not null then
    raise exception 'ADMIN_ORDER_STATE_CONFLICT';
  end if;

  v_before := jsonb_build_object(
    'status', v_order.status, 'paymentStatus', v_order.payment_status,
    'version', v_order.version
  );

  select * into v_task
  from public.delivery_tasks
  where order_id = p_order_id and task_type = 'FORWARD_DELIVERY'
    and status not in ('COMPLETED','CANCELLED')
  order by created_at desc limit 1 for update;

  if found then
    perform 1 from public.delivery_assignments
    where delivery_task_id = v_task.id order by id for update;
    select captain_id into v_captain_id from public.delivery_assignments
    where delivery_task_id = v_task.id and assignment_status = 'ACCEPTED'
    order by created_at desc limit 1;
    if v_captain_id is not null then
      perform 1 from public.captain_profiles where user_id = v_captain_id for update;
    end if;
    update public.delivery_assignments
    set assignment_status = case
      when assignment_status = 'ACCEPTED' then 'RELEASED'::public.delivery_assignment_status
      else 'CANCELLED'::public.delivery_assignment_status end,
      responded_at = coalesce(responded_at, transaction_timestamp())
    where delivery_task_id = v_task.id
      and assignment_status in ('OFFERED','ACCEPTED');
    update public.delivery_tasks
    set status = 'CANCELLED', assigned_captain_id = null, assigned_at = null,
        pickup_code_hash = null, pickup_code_expires_at = null,
        delivery_otp_hash = null, delivery_otp_expires_at = null,
        updated_at = transaction_timestamp()
    where id = v_task.id;
    if v_captain_id is not null then
      update public.captain_profiles set availability_status = 'AVAILABLE',
        updated_at = transaction_timestamp() where user_id = v_captain_id;
      update public.captain_current_locations set active_delivery_task_id = null,
        updated_at = transaction_timestamp() where captain_id = v_captain_id;
    end if;
  end if;

  select * into strict v_updated from private.transition_order_state(
    p_order_id, 'CANCELLED', p_actor_id, 'ADMIN', p_reason_code, p_note
  );
  update public.order_items set fulfilment_status = 'CANCELLED'
  where order_id = p_order_id and fulfilment_status in ('PENDING','VERIFIED','PACKED');

  perform private.enqueue_outbox_event(
    'admin.order.cancelled', 'ORDER', p_order_id,
    jsonb_build_object('orderId', p_order_id, 'reasonCode', p_reason_code),
    transaction_timestamp(), transaction_timestamp()
  );

  v_result := jsonb_build_object(
    'orderId', v_updated.id, 'orderNumber', v_updated.order_number,
    'orderStatus', v_updated.status, 'cancelledAt', v_updated.cancelled_at,
    'deliveryTaskId', v_task.id
  );
  return private.complete_admin_operation(
    p_actor_id, 'admin.order.cancel', p_idempotency_key, 'ORDER', p_order_id,
    p_reason_code, p_note, p_request_id, v_before,
    jsonb_build_object('status', v_updated.status, 'version', v_updated.version), v_result
  );
end;
$$;

create or replace function public.admin_retry_order_dispatch(
  p_actor_id uuid,
  p_order_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_order public.orders;
  v_updated public.orders;
  v_task public.delivery_tasks;
  v_captain_id uuid;
  v_before jsonb;
  v_result jsonb;
begin
  v_replay := private.claim_admin_operation(
    p_actor_id, 'admin.order.retry_dispatch', p_idempotency_key, 'ORDER', p_order_id,
    p_reason_code, p_note, jsonb_build_object('orderId', p_order_id)
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ADMIN_ORDER_NOT_FOUND'; end if;
  if v_order.status not in (
    'READY_FOR_PICKUP','CAPTAIN_SEARCHING','CAPTAIN_ASSIGNED','CAPTAIN_AT_STORE',
    'PROBLEM_REPORTED'
  ) or v_order.ready_at is null or v_order.picked_up_at is not null then
    raise exception 'ADMIN_ORDER_STATE_CONFLICT';
  end if;

  select * into v_task from public.delivery_tasks
  where order_id = p_order_id and task_type = 'FORWARD_DELIVERY'
    and status not in ('COMPLETED','CANCELLED')
  order by created_at desc limit 1 for update;
  if not found then raise exception 'ADMIN_DELIVERY_TASK_NOT_FOUND'; end if;
  if v_task.status not in ('SEARCHING','OFFERED','ASSIGNED','AT_PICKUP','FAILED')
    or v_task.picked_up_at is not null then
    raise exception 'ADMIN_DELIVERY_STATE_CONFLICT';
  end if;

  v_before := jsonb_build_object(
    'orderStatus', v_order.status, 'taskStatus', v_task.status,
    'assignedCaptainId', v_task.assigned_captain_id
  );

  perform 1 from public.delivery_assignments
  where delivery_task_id = v_task.id order by id for update;
  select captain_id into v_captain_id from public.delivery_assignments
  where delivery_task_id = v_task.id and assignment_status = 'ACCEPTED'
  order by created_at desc limit 1;
  if v_captain_id is not null then
    perform 1 from public.captain_profiles where user_id = v_captain_id for update;
  end if;

  update public.delivery_assignments
  set assignment_status = case
    when assignment_status = 'ACCEPTED' then 'RELEASED'::public.delivery_assignment_status
    else 'CANCELLED'::public.delivery_assignment_status end,
    responded_at = coalesce(responded_at, transaction_timestamp())
  where delivery_task_id = v_task.id and assignment_status in ('OFFERED','ACCEPTED');

  update public.delivery_tasks
  set status = 'SEARCHING', assigned_captain_id = null, assigned_at = null,
      arrived_pickup_at = null, pickup_code_hash = null,
      pickup_code_expires_at = null, pickup_code_attempts = 0,
      problem_reported_at = null, next_offer_wave_at = transaction_timestamp(),
      updated_at = transaction_timestamp()
  where id = v_task.id;

  if v_captain_id is not null then
    update public.captain_profiles set availability_status = 'AVAILABLE',
      updated_at = transaction_timestamp() where user_id = v_captain_id;
    update public.captain_current_locations set active_delivery_task_id = null,
      updated_at = transaction_timestamp() where captain_id = v_captain_id;
  end if;

  select * into strict v_updated from private.transition_order_state(
    p_order_id, 'CAPTAIN_SEARCHING', p_actor_id, 'ADMIN', p_reason_code, p_note
  );
  perform private.enqueue_outbox_event(
    'admin.delivery.search_restarted', 'DELIVERY_TASK', v_task.id,
    jsonb_build_object('deliveryTaskId', v_task.id, 'orderId', p_order_id,
      'reasonCode', p_reason_code), transaction_timestamp(), transaction_timestamp()
  );

  v_result := jsonb_build_object(
    'orderId', p_order_id, 'deliveryTaskId', v_task.id,
    'orderStatus', v_updated.status, 'deliveryTaskStatus', 'SEARCHING'
  );
  return private.complete_admin_operation(
    p_actor_id, 'admin.order.retry_dispatch', p_idempotency_key, 'ORDER', p_order_id,
    p_reason_code, p_note, p_request_id, v_before,
    jsonb_build_object('orderStatus', v_updated.status, 'taskStatus', 'SEARCHING'), v_result
  );
end;
$$;

create or replace function public.admin_release_delivery_operation(
  p_actor_id uuid,
  p_delivery_task_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_before jsonb;
  v_result jsonb;
begin
  v_replay := private.claim_admin_operation(
    p_actor_id, 'admin.delivery.release', p_idempotency_key, 'DELIVERY_TASK',
    p_delivery_task_id, p_reason_code, p_note,
    jsonb_build_object('deliveryTaskId', p_delivery_task_id)
  );
  if v_replay is not null then return v_replay; end if;

  select jsonb_build_object('status', status, 'assignedCaptainId', assigned_captain_id)
  into v_before from public.delivery_tasks where id = p_delivery_task_id;
  if not found then raise exception 'ADMIN_DELIVERY_TASK_NOT_FOUND'; end if;

  v_result := public.release_delivery_task(
    p_actor_id, p_delivery_task_id, 'OTHER', p_note, true, p_idempotency_key,
    null, null, null, null
  );
  return private.complete_admin_operation(
    p_actor_id, 'admin.delivery.release', p_idempotency_key, 'DELIVERY_TASK',
    p_delivery_task_id, p_reason_code, p_note, p_request_id, v_before,
    jsonb_build_object('status', 'SEARCHING', 'assignedCaptainId', null), v_result
  );
end;
$$;

create or replace function public.admin_reset_delivery_verification(
  p_actor_id uuid,
  p_delivery_task_id uuid,
  p_verification_kind text,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_order_id uuid;
  v_task public.delivery_tasks;
  v_before jsonb;
  v_result jsonb;
begin
  if p_verification_kind not in ('PICKUP_CODE','DELIVERY_OTP') then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;
  v_replay := private.claim_admin_operation(
    p_actor_id, 'admin.delivery.reset_verification', p_idempotency_key,
    'DELIVERY_TASK', p_delivery_task_id, p_reason_code, p_note,
    jsonb_build_object('deliveryTaskId', p_delivery_task_id,
      'verificationKind', p_verification_kind)
  );
  if v_replay is not null then return v_replay; end if;

  select order_id into v_order_id from public.delivery_tasks where id = p_delivery_task_id;
  if not found then raise exception 'ADMIN_DELIVERY_TASK_NOT_FOUND'; end if;
  perform 1 from public.orders where id = v_order_id for update;
  select * into strict v_task from public.delivery_tasks
  where id = p_delivery_task_id for update;

  if (p_verification_kind = 'PICKUP_CODE' and v_task.status <> 'AT_PICKUP')
    or (p_verification_kind = 'DELIVERY_OTP' and v_task.status <> 'AT_DROP') then
    raise exception 'ADMIN_DELIVERY_STATE_CONFLICT';
  end if;

  v_before := case when p_verification_kind = 'PICKUP_CODE' then
    jsonb_build_object('verificationKind', p_verification_kind,
      'attempts', v_task.pickup_code_attempts,
      'hasActiveSecret', v_task.pickup_code_hash is not null)
  else jsonb_build_object('verificationKind', p_verification_kind,
      'attempts', v_task.delivery_otp_attempts,
      'hasActiveSecret', v_task.delivery_otp_hash is not null) end;

  if p_verification_kind = 'PICKUP_CODE' then
    update public.delivery_tasks set pickup_code_hash = null,
      pickup_code_expires_at = null, pickup_code_attempts = 0,
      updated_at = transaction_timestamp() where id = p_delivery_task_id;
  else
    update public.delivery_tasks set delivery_otp_hash = null,
      delivery_otp_expires_at = null, delivery_otp_attempts = 0,
      updated_at = transaction_timestamp() where id = p_delivery_task_id;
  end if;

  perform private.enqueue_outbox_event(
    'admin.delivery.verification_reset', 'DELIVERY_TASK', p_delivery_task_id,
    jsonb_build_object('deliveryTaskId', p_delivery_task_id,
      'orderId', v_order_id, 'verificationKind', p_verification_kind),
    transaction_timestamp(), transaction_timestamp()
  );
  v_result := jsonb_build_object(
    'deliveryTaskId', p_delivery_task_id, 'orderId', v_order_id,
    'verificationKind', p_verification_kind,
    'requiresAuthorizedReissue', true
  );
  return private.complete_admin_operation(
    p_actor_id, 'admin.delivery.reset_verification', p_idempotency_key,
    'DELIVERY_TASK', p_delivery_task_id, p_reason_code, p_note, p_request_id,
    v_before, jsonb_build_object('verificationKind', p_verification_kind,
      'attempts', 0, 'hasActiveSecret', false), v_result
  );
end;
$$;

revoke all on function public.admin_cancel_order_operation(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
revoke all on function public.admin_retry_order_dispatch(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
revoke all on function public.admin_release_delivery_operation(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
revoke all on function public.admin_reset_delivery_verification(uuid,uuid,text,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_cancel_order_operation(uuid,uuid,text,text,text,uuid)
  to service_role;
grant execute on function public.admin_retry_order_dispatch(uuid,uuid,text,text,text,uuid)
  to service_role;
grant execute on function public.admin_release_delivery_operation(uuid,uuid,text,text,text,uuid)
  to service_role;
grant execute on function public.admin_reset_delivery_verification(uuid,uuid,text,text,text,text,uuid)
  to service_role;
