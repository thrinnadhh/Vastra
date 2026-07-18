create or replace function private.apply_verified_payment_event(p_event_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.payment_events;
  v_payment public.payments;
  v_order public.orders;
  v_meta jsonb;
  v_amount bigint;
  v_currency text;
  v_provider_payment_id text;
  v_occurred_at timestamptz;
  v_previous_status public.order_status;
  v_reservation record;
begin
  select * into v_event from public.payment_events where id = p_event_id;
  if not found then return 'IGNORED'; end if;

  if v_event.payment_id is null then
    select * into v_event from public.payment_events where id = p_event_id for update;
    if v_event.processing_status = 'RECEIVED' then
      update public.payment_events set processing_status = 'IGNORED', processed_at = transaction_timestamp()
      where id = p_event_id;
    end if;
    return 'IGNORED';
  end if;

  select * into strict v_payment from public.payments where id = v_event.payment_id;
  select * into strict v_order from public.orders where id = v_payment.order_id for update;
  select * into strict v_payment from public.payments where id = v_event.payment_id for update;
  select * into strict v_event from public.payment_events where id = p_event_id for update;

  if v_event.processing_status <> 'RECEIVED' then return v_event.processing_status::text; end if;
  if v_event.signature_valid is not true then
    update public.payment_events set processing_status = 'FAILED', processing_error = 'SIGNATURE_NOT_VERIFIED', processed_at = transaction_timestamp()
    where id = v_event.id;
    return 'FAILED';
  end if;

  v_meta := v_event.payload->'_vastra';
  begin
    v_amount := (v_meta->>'amountPaise')::bigint;
    v_currency := v_meta->>'currency';
    v_provider_payment_id := v_meta->>'providerPaymentId';
    v_occurred_at := (v_meta->>'occurredAt')::timestamptz;
  exception when others then
    update public.payment_events set processing_status = 'FAILED', processing_error = 'CANONICAL_EVENT_INVALID', processed_at = transaction_timestamp()
    where id = v_event.id;
    return 'FAILED';
  end;

  if v_amount <> v_payment.amount_paise or v_currency <> v_payment.currency
    or nullif(btrim(v_provider_payment_id), '') is null
    or (v_payment.provider_payment_id is not null and v_payment.provider_payment_id <> v_provider_payment_id) then
    update public.payment_events set processing_status = 'FAILED', processing_error = 'PAYMENT_IDENTITY_MISMATCH', processed_at = transaction_timestamp()
    where id = v_event.id;
    return 'FAILED';
  end if;

  if v_event.event_type = 'PAYMENT_SUCCESS' then
    if v_payment.status in ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED') then
      update public.payment_events set processing_status = 'IGNORED', processed_at = transaction_timestamp()
      where id = v_event.id;
      return 'IGNORED';
    end if;
    if v_payment.status in ('FAILED','CANCELLED') then
      update public.payment_events set processing_status = 'FAILED', processing_error = 'LATE_SUCCESS_AFTER_TERMINAL_STATE', processed_at = transaction_timestamp()
      where id = v_event.id;
      return 'FAILED';
    end if;

    update public.payments set
      status = 'CAPTURED', provider_payment_id = v_provider_payment_id,
      signature_verified = true, paid_at = v_occurred_at,
      failure_code = null, failure_message = null, updated_at = transaction_timestamp()
    where id = v_payment.id;

    update public.orders set
      payment_status = 'CAPTURED',
      status = case when status = 'PAYMENT_PENDING' then 'WAITING_FOR_MERCHANT' else status end,
      placed_at = coalesce(placed_at, v_occurred_at), updated_at = transaction_timestamp()
    where id = v_order.id returning status into v_previous_status;

    if v_order.status = 'PAYMENT_PENDING' then
      insert into public.order_status_history(order_id, previous_status, new_status, changed_by_role, reason_code)
      values (v_order.id, 'PAYMENT_PENDING', 'WAITING_FOR_MERCHANT', 'SYSTEM', 'PAYMENT_CAPTURED');
    end if;
  elsif v_event.event_type in ('PAYMENT_FAILED','PAYMENT_USER_DROPPED') then
    if v_payment.status in ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED') then
      update public.payment_events set processing_status = 'IGNORED', processed_at = transaction_timestamp()
      where id = v_event.id;
      return 'IGNORED';
    end if;
    if v_payment.status not in ('FAILED','CANCELLED') then
      update public.payments set
        status = case when v_event.event_type = 'PAYMENT_USER_DROPPED' then 'CANCELLED' else 'FAILED' end,
        provider_payment_id = coalesce(provider_payment_id, v_provider_payment_id),
        signature_verified = true,
        failure_code = case when v_event.event_type = 'PAYMENT_FAILED' then 'PROVIDER_PAYMENT_FAILED' else null end,
        failure_message = case when v_event.event_type = 'PAYMENT_FAILED' then 'Verified provider failure webhook' else null end,
        updated_at = transaction_timestamp()
      where id = v_payment.id;
      if v_order.status = 'PAYMENT_PENDING' then
        update public.orders set payment_status = 'FAILED', status = 'CANCELLED', cancelled_at = transaction_timestamp(), updated_at = transaction_timestamp()
        where id = v_order.id;
        insert into public.order_status_history(order_id, previous_status, new_status, changed_by_role, reason_code)
        values (v_order.id, 'PAYMENT_PENDING', 'CANCELLED', 'SYSTEM', v_event.event_type);
      end if;
      for v_reservation in
        select id from public.inventory_reservations
        where order_id = v_order.id and status = 'ACTIVE' order by id
      loop
        perform private.release_inventory_reservation(v_reservation.id, 'RELEASED', v_event.event_type, null);
      end loop;
    end if;
  else
    update public.payment_events set processing_status = 'IGNORED', processed_at = transaction_timestamp()
    where id = v_event.id;
    return 'IGNORED';
  end if;

  update public.payment_events set processing_status = 'PROCESSED', processing_error = null, processed_at = transaction_timestamp()
  where id = v_event.id;
  perform private.enqueue_outbox_event(
    'payment.event.processed', 'PAYMENT', v_payment.id,
    jsonb_build_object('paymentEventId', v_event.id::text, 'paymentId', v_payment.id, 'orderId', v_order.id, 'eventType', v_event.event_type),
    transaction_timestamp(), transaction_timestamp()
  );
  return 'PROCESSED';
end;
$$;

create or replace function public.process_verified_payment_events(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_result text;
  v_selected integer := 0;
  v_processed integer := 0;
  v_ignored integer := 0;
  v_failed integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'FINANCE_REQUEST_INVALID'; end if;
  for v_id in select id from public.payment_events where processing_status = 'RECEIVED' order by received_at, id limit p_limit
  loop
    v_selected := v_selected + 1;
    v_result := private.apply_verified_payment_event(v_id);
    if v_result = 'PROCESSED' then v_processed := v_processed + 1;
    elsif v_result = 'FAILED' then v_failed := v_failed + 1;
    else v_ignored := v_ignored + 1;
    end if;
  end loop;
  return jsonb_build_object('selected', v_selected, 'processed', v_processed, 'ignored', v_ignored, 'failed', v_failed);
end;
$$;

create or replace function public.admin_retry_payment_event(
  p_actor_id uuid, p_event_id bigint, p_idempotency_key uuid, p_note text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.payment_events;
  v_payment public.payments;
  v_receipt private.admin_command_receipts;
  v_audit_id uuid;
  v_fingerprint text;
  v_result jsonb;
begin
  if p_actor_id is null or p_event_id is null or p_idempotency_key is null then raise exception 'FINANCE_REQUEST_INVALID'; end if;
  perform 1 from public.profiles where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;
  v_fingerprint := encode(extensions.digest(concat_ws('|', p_event_id::text, coalesce(nullif(btrim(p_note), ''), '')), 'sha256'), 'hex');
  insert into private.admin_command_receipts(actor_id, action, idempotency_key, request_fingerprint)
  values (p_actor_id, 'finance.payment.retry_event', p_idempotency_key, v_fingerprint)
  on conflict do nothing returning * into v_receipt;
  if not found then
    select * into strict v_receipt from private.admin_command_receipts
    where actor_id = p_actor_id and action = 'finance.payment.retry_event' and idempotency_key = p_idempotency_key for update;
    if v_receipt.request_fingerprint <> v_fingerprint then raise exception 'FINANCE_IDEMPOTENCY_CONFLICT'; end if;
    if v_receipt.result_payload is null then raise exception 'FINANCE_REQUEST_INCOMPLETE'; end if;
    return v_receipt.result_payload || jsonb_build_object('replayed', true);
  end if;
  select * into v_event from public.payment_events where id = p_event_id for update;
  if not found or v_event.payment_id is null then raise exception 'FINANCE_PAYMENT_NOT_FOUND'; end if;
  select * into strict v_payment from public.payments where id = v_event.payment_id for update;
  if v_event.processing_status <> 'FAILED' then raise exception 'FINANCE_PAYMENT_STATE_CONFLICT'; end if;
  update public.payment_events set processing_status = 'RECEIVED', processing_error = null, processed_at = null where id = v_event.id;
  v_result := jsonb_build_object('eventId', v_event.id::text, 'paymentId', v_payment.id, 'processingStatus', 'RECEIVED', 'replayed', false);
  insert into private.admin_audit_log(actor_id, action, resource_type, resource_id, reason_code, note, idempotency_key, before_state, after_state)
  values (p_actor_id, 'finance.payment.retry_event', 'PAYMENT', v_payment.id, 'PAYMENT_RECOVERY', nullif(btrim(p_note), ''), p_idempotency_key,
    jsonb_build_object('eventStatus', v_event.processing_status, 'processingError', v_event.processing_error),
    jsonb_build_object('eventStatus', 'RECEIVED')) returning id into v_audit_id;
  update private.admin_command_receipts set audit_id = v_audit_id, result_payload = v_result, completed_at = transaction_timestamp()
  where actor_id = p_actor_id and action = 'finance.payment.retry_event' and idempotency_key = p_idempotency_key;
  return v_result;
end;
$$;

revoke all on function private.apply_verified_payment_event(bigint) from public, anon, authenticated;
revoke all on function public.process_verified_payment_events(integer) from public, anon, authenticated;
revoke all on function public.admin_retry_payment_event(uuid,bigint,uuid,text) from public, anon, authenticated;
grant execute on function public.process_verified_payment_events(integer) to service_role;
grant execute on function public.admin_retry_payment_event(uuid,bigint,uuid,text) to service_role;
