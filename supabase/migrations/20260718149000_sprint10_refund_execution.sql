-- S10-09: approved-return refund execution and provider reconciliation.

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

create or replace function public.list_admin_refunds(
  p_status text,
  p_limit integer
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
    private.build_admin_refund_detail(r.id, true)
    order by r.created_at desc, r.id
  ), '[]'::jsonb)
  from (
    select x.id, x.created_at
    from public.refunds x
    where p_status is null or x.status::text = p_status
    order by x.created_at desc, x.id
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ) r
$$;

create or replace function public.get_admin_refund(
  p_refund_id uuid
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select private.build_admin_refund_detail(p_refund_id, true)
$$;

create or replace function public.prepare_return_refund(
  p_actor_id uuid,
  p_return_id uuid,
  p_reason_code text,
  p_note text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt private.finance_command_receipts;
  v_return public.return_requests;
  v_order public.orders;
  v_payment public.payments;
  v_refund public.refunds;
  v_refund_id uuid := gen_random_uuid();
  v_amount bigint;
  v_existing bigint;
  v_fingerprint text;
  v_audit_id uuid;
begin
  if p_actor_id is null or p_return_id is null or p_idempotency_key is null
    or nullif(btrim(p_reason_code), '') is null
    or btrim(p_reason_code) not in ('REFUND_EXECUTION', 'FINANCIAL_CORRECTION', 'OTHER')
    or (p_note is not null and (length(btrim(p_note)) < 1 or length(btrim(p_note)) > 1000))
  then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;

  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;

  v_fingerprint := encode(extensions.digest(concat_ws('|',
    p_return_id::text,
    btrim(p_reason_code),
    coalesce(nullif(btrim(p_note), ''), '')
  ), 'sha256'), 'hex');

  insert into private.finance_command_receipts(
    actor_id, action, idempotency_key, request_fingerprint
  ) values (
    p_actor_id, 'finance.refund.execute', p_idempotency_key, v_fingerprint
  ) on conflict do nothing returning * into v_receipt;

  if not found then
    select * into strict v_receipt
    from private.finance_command_receipts
    where actor_id = p_actor_id
      and action = 'finance.refund.execute'
      and idempotency_key = p_idempotency_key
    for update;
    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;
    if v_receipt.resource_id is null then
      raise exception 'FINANCE_REQUEST_INCOMPLETE';
    end if;
    return private.build_admin_refund_detail(v_receipt.resource_id, true);
  end if;

  select * into v_return from public.return_requests
  where id = p_return_id;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;

  select * into v_order from public.orders
  where id = v_return.order_id for update;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;

  select * into v_payment from public.payments
  where order_id = v_order.id
    and status in ('CAPTURED', 'PARTIALLY_REFUNDED')
    and provider_order_id is not null
    and provider_payment_id is not null
  order by paid_at desc nulls last, created_at desc, id
  limit 1
  for update;
  if not found then raise exception 'FINANCE_PAYMENT_STATE_CONFLICT'; end if;

  select * into v_return from public.return_requests
  where id = p_return_id for update;
  if v_return.status <> 'VERIFIED' then
    raise exception 'FINANCE_RETURN_STATE_CONFLICT';
  end if;

  perform 1 from public.return_items
  where return_request_id = v_return.id
  order by id for update;

  select coalesce(sum(di.approved_refund_paise), 0)::bigint
  into v_amount
  from public.return_admin_decision_items di
  join public.return_admin_decisions d on d.id = di.decision_id
  where d.return_request_id = v_return.id
    and d.phase = 'INSPECTION_REVIEW'
    and d.outcome = 'VERIFIED';

  if v_amount = 0 then
    select coalesce(sum(i.requested_refund_paise), 0)::bigint
    into v_amount
    from public.return_items i
    where i.return_request_id = v_return.id;
  end if;

  if v_amount < 1 then raise exception 'FINANCE_REFUND_AMOUNT_CONFLICT'; end if;

  perform 1 from public.refunds r
  where r.payment_id = v_payment.id
    and r.status in ('INITIATED', 'PROCESSING', 'COMPLETED')
  order by r.id
  for update;

  select coalesce(sum(r.amount_paise), 0)::bigint
  into v_existing
  from public.refunds r
  where r.payment_id = v_payment.id
    and r.status in ('INITIATED', 'PROCESSING', 'COMPLETED');

  if v_existing + v_amount > v_payment.amount_paise then
    raise exception 'FINANCE_REFUND_AMOUNT_CONFLICT';
  end if;

  insert into public.refunds(
    id, refund_number, idempotency_key, order_id, payment_id,
    return_request_id, amount_paise, reason_code, status,
    initiated_by, approved_by, initiated_at
  ) values (
    v_refund_id,
    'REF-' || upper(replace(v_refund_id::text, '-', '')),
    p_idempotency_key::text,
    v_order.id,
    v_payment.id,
    v_return.id,
    v_amount,
    btrim(p_reason_code),
    'INITIATED',
    p_actor_id,
    p_actor_id,
    transaction_timestamp()
  ) returning * into v_refund;

  update public.return_requests
  set status = 'REFUND_PENDING'
  where id = v_return.id and status = 'VERIFIED';

  insert into private.admin_audit_log(
    actor_id, action, resource_type, resource_id, reason_code, note,
    idempotency_key, before_state, after_state
  ) values (
    p_actor_id, 'finance.refund.execute', 'REFUND', v_refund.id,
    btrim(p_reason_code), nullif(btrim(p_note), ''), p_idempotency_key,
    jsonb_build_object(
      'returnStatus', v_return.status,
      'paymentStatus', v_payment.status
    ),
    jsonb_build_object(
      'refundStatus', v_refund.status,
      'returnStatus', 'REFUND_PENDING',
      'amountPaise', v_refund.amount_paise
    )
  ) returning id into v_audit_id;

  update private.finance_command_receipts
  set resource_id = v_refund.id, completed_at = transaction_timestamp()
  where actor_id = p_actor_id
    and action = 'finance.refund.execute'
    and idempotency_key = p_idempotency_key;

  perform private.enqueue_outbox_event(
    'refund.initiated',
    'REFUND',
    v_refund.id,
    jsonb_build_object(
      'refundId', v_refund.id,
      'returnId', v_return.id,
      'orderId', v_order.id,
      'paymentId', v_payment.id,
      'amountPaise', v_refund.amount_paise,
      'auditId', v_audit_id
    ),
    transaction_timestamp(),
    transaction_timestamp()
  );

  return private.build_admin_refund_detail(v_refund.id, false);
end;
$$;

create or replace function public.mark_refund_retrying(
  p_actor_id uuid,
  p_refund_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds;
begin
  if p_actor_id is null or p_refund_id is null then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;

  select * into v_refund from public.refunds
  where id = p_refund_id for update;
  if not found then raise exception 'FINANCE_REFUND_NOT_FOUND'; end if;
  if v_refund.status <> 'FAILED' then
    raise exception 'FINANCE_REFUND_STATE_CONFLICT';
  end if;

  update public.refunds
  set status = 'INITIATED',
      failure_message = null,
      initiated_at = transaction_timestamp()
  where id = v_refund.id;

  return private.build_admin_refund_detail(v_refund.id, false);
end;
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

  perform 1 from public.profiles
  where id = p_actor_id and account_type = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;

  select * into v_refund from public.refunds where id = p_refund_id;
  if not found then raise exception 'FINANCE_REFUND_NOT_FOUND'; end if;

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
revoke all on function public.list_admin_refunds(text,integer)
  from public, anon, authenticated;
revoke all on function public.get_admin_refund(uuid)
  from public, anon, authenticated;
revoke all on function public.prepare_return_refund(uuid,uuid,text,text,uuid)
  from public, anon, authenticated;
revoke all on function public.mark_refund_retrying(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.apply_return_refund_result(uuid,uuid,text,text,timestamptz,text)
  from public, anon, authenticated;

grant execute on function private.build_admin_refund_detail(uuid,boolean)
  to service_role;
grant execute on function public.list_admin_refunds(text,integer)
  to service_role;
grant execute on function public.get_admin_refund(uuid)
  to service_role;
grant execute on function public.prepare_return_refund(uuid,uuid,text,text,uuid)
  to service_role;
grant execute on function public.mark_refund_retrying(uuid,uuid)
  to service_role;
grant execute on function public.apply_return_refund_result(uuid,uuid,text,text,timestamptz,text)
  to service_role;
