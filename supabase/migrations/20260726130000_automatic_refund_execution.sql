-- Automatically execute cancellation refunds while preserving the immutable
-- initiating actor. These functions remain service-role only.

create or replace function private.build_admin_refund_detail(
  p_refund_id uuid,
  p_replayed boolean
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'refundId', r.id,
    'refundNumber', r.refund_number,
    'returnId', r.return_request_id,
    'initiatedBy', r.initiated_by,
    'orderId', r.order_id,
    'paymentId', r.payment_id,
    'providerOrderId', p.provider_order_id,
    'providerPaymentId', p.provider_payment_id,
    'providerRefundId', r.provider_refund_id,
    'amountPaise', r.amount_paise,
    'idempotencyKey', r.idempotency_key,
    'reasonCode', r.reason_code,
    'status', r.status,
    'failureMessage', r.failure_message,
    'initiatedAt', r.initiated_at,
    'completedAt', r.completed_at,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'replayed', p_replayed
  )
  from public.refunds r
  join public.payments p on p.id = r.payment_id
  where r.id = p_refund_id
$$;

create or replace function public.apply_return_refund_result(
  p_actor_id uuid,
  p_refund_id uuid,
  p_provider_refund_id text,
  p_provider_status text,
  p_processed_at timestamptz,
  p_failure_message text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_refund public.refunds;
  v_order public.orders;
  v_payment public.payments;
  v_return public.return_requests;
  v_next public.refund_status;
  v_total_completed bigint;
  v_audit_key uuid := gen_random_uuid();
  v_audit_id uuid;
begin
  if p_actor_id is null or p_refund_id is null
    or nullif(btrim(p_provider_refund_id), '') is null
    or p_provider_status not in ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')
    or (p_failure_message is not null and length(btrim(p_failure_message)) > 1000)
  then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;

  select * into v_refund
  from public.refunds
  where id = p_refund_id;
  if not found then raise exception 'FINANCE_REFUND_NOT_FOUND'; end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_id and status = 'ACTIVE';
  if not found
    or (p_actor_id <> v_refund.initiated_by and v_actor.account_type <> 'ADMIN')
  then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;

  select * into v_order from public.orders
  where id = v_refund.order_id for update;
  select * into v_payment from public.payments
  where id = v_refund.payment_id for update;
  select * into v_return from public.return_requests
  where id = v_refund.return_request_id for update;
  select * into v_refund from public.refunds
  where id = p_refund_id for update;

  if v_refund.provider_refund_id is not null
    and v_refund.provider_refund_id <> btrim(p_provider_refund_id)
  then
    raise exception 'FINANCE_REFUND_STATE_CONFLICT';
  end if;

  if v_refund.status = 'COMPLETED'
    or (v_refund.status = 'PROCESSING' and p_provider_status = 'PENDING')
    or (v_refund.status = 'FAILED' and p_provider_status = 'FAILED')
    or (v_refund.status = 'CANCELLED' and p_provider_status = 'CANCELLED')
  then
    return private.build_admin_refund_detail(v_refund.id, true);
  end if;
  if v_refund.status not in ('INITIATED', 'PROCESSING', 'FAILED') then
    raise exception 'FINANCE_REFUND_STATE_CONFLICT';
  end if;

  v_next := case p_provider_status
    when 'PENDING' then 'PROCESSING'::public.refund_status
    when 'SUCCESS' then 'COMPLETED'::public.refund_status
    when 'FAILED' then 'FAILED'::public.refund_status
    else 'CANCELLED'::public.refund_status
  end;

  update public.refunds
  set provider_refund_id = btrim(p_provider_refund_id),
      status = v_next,
      initiated_at = coalesce(initiated_at, transaction_timestamp()),
      completed_at = case
        when v_next = 'COMPLETED'
          then coalesce(p_processed_at, transaction_timestamp())
        else null
      end,
      failure_message = case
        when v_next = 'FAILED'
          then coalesce(nullif(btrim(p_failure_message), ''), 'Provider reported refund failure')
        else null
      end
  where id = v_refund.id;

  if v_next = 'COMPLETED' then
    select coalesce(sum(r.amount_paise), 0)::bigint
    into v_total_completed
    from public.refunds r
    where r.payment_id = v_payment.id and r.status = 'COMPLETED';

    update public.payments
    set status = case
      when v_total_completed = v_payment.amount_paise
        then 'REFUNDED'::public.payment_attempt_status
      else 'PARTIALLY_REFUNDED'::public.payment_attempt_status
    end
    where id = v_payment.id;

    update public.orders
    set payment_status = case
      when v_total_completed = v_payment.amount_paise
        then 'REFUNDED'::public.order_payment_status
      else 'PARTIALLY_REFUNDED'::public.order_payment_status
    end
    where id = v_order.id;

    update public.return_requests
    set status = 'REFUNDED',
        completed_at = coalesce(p_processed_at, transaction_timestamp())
    where id = v_return.id and status = 'REFUND_PENDING';
  end if;

  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    idempotency_key, before_state, after_state
  ) values (
    p_actor_id, 'finance.refund.provider_result', 'REFUND', v_refund.id,
    'REFUND_EXECUTION',
    nullif(btrim(p_failure_message), ''),
    v_audit_key,
    jsonb_build_object('status', v_refund.status),
    jsonb_build_object(
      'status', v_next,
      'providerRefundId', btrim(p_provider_refund_id),
      'providerStatus', p_provider_status
    )
  ) returning id into v_audit_id;

  perform private.enqueue_outbox_event(
    case v_next
      when 'COMPLETED' then 'refund.completed'
      when 'FAILED' then 'refund.failed'
      when 'CANCELLED' then 'refund.cancelled'
      else 'refund.processing'
    end,
    'REFUND',
    v_refund.id,
    jsonb_build_object(
      'refundId', v_refund.id,
      'returnId', v_return.id,
      'orderId', v_order.id,
      'paymentId', v_payment.id,
      'status', v_next,
      'auditId', v_audit_id
    ),
    transaction_timestamp(),
    transaction_timestamp()
  );

  return private.build_admin_refund_detail(v_refund.id, false);
end;
$$;

revoke all on function private.build_admin_refund_detail(uuid,boolean)
  from public, anon, authenticated;
revoke all on function public.apply_return_refund_result(uuid,uuid,text,text,timestamptz,text)
  from public, anon, authenticated;

grant execute on function private.build_admin_refund_detail(uuid,boolean)
  to service_role;
grant execute on function public.apply_return_refund_result(uuid,uuid,text,text,timestamptz,text)
  to service_role;
