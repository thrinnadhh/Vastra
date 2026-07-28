-- Phase 2D-A correction: preserve canonical order lifecycle semantics.
--
-- The generic finance processor remains available for contract-v1 orders.
-- Contract-v2 orders are handled by the wrapper below so every order status
-- change flows through private.transition_order_state.

alter function private.apply_verified_payment_event(bigint)
  rename to apply_verified_payment_event_phase_2d_legacy;

create or replace function private.prevent_duplicate_initial_order_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.previous_status is null
    and exists (
      select 1
      from public.order_status_history osh
      where osh.order_id = new.order_id
        and osh.previous_status is null
    )
  then
    return null;
  end if;

  return new;
end;
$$;

create trigger order_status_history_one_initial_entry
before insert on public.order_status_history
for each row execute function private.prevent_duplicate_initial_order_history();

create or replace function private.apply_verified_payment_event(
  p_event_id bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_version integer;
  v_event public.payment_events;
  v_payment public.payments;
  v_order public.orders;
  v_meta jsonb;
  v_amount bigint;
  v_currency text;
  v_provider_payment_id text;
  v_occurred_at timestamptz;
  v_reservation record;
begin
  select o.order_contract_version
  into v_contract_version
  from public.payment_events pe
  join public.payments p
    on p.id = pe.payment_id
  join public.orders o
    on o.id = p.order_id
  where pe.id = p_event_id;

  if not found or coalesce(v_contract_version, 1) <> 2 then
    return private.apply_verified_payment_event_phase_2d_legacy(
      p_event_id
    );
  end if;

  select o.*
  into strict v_order
  from public.payment_events pe
  join public.payments p
    on p.id = pe.payment_id
  join public.orders o
    on o.id = p.order_id
  where pe.id = p_event_id
  for update of o;

  select p.*
  into strict v_payment
  from public.payments p
  where p.id = (
    select pe.payment_id
    from public.payment_events pe
    where pe.id = p_event_id
  )
  for update;

  select pe.*
  into strict v_event
  from public.payment_events pe
  where pe.id = p_event_id
  for update;

  if v_event.processing_status <> 'RECEIVED' then
    return v_event.processing_status::text;
  end if;

  if v_event.signature_valid is not true then
    update public.payment_events
    set
      processing_status = 'FAILED',
      processing_error = 'SIGNATURE_NOT_VERIFIED',
      processed_at = transaction_timestamp()
    where id = v_event.id;

    return 'FAILED';
  end if;

  v_meta := v_event.payload -> '_vastra';

  begin
    v_amount := (v_meta ->> 'amountPaise')::bigint;
    v_currency := v_meta ->> 'currency';
    v_provider_payment_id := v_meta ->> 'providerPaymentId';
    v_occurred_at := (v_meta ->> 'occurredAt')::timestamptz;
  exception
    when others then
      update public.payment_events
      set
        processing_status = 'FAILED',
        processing_error = 'CANONICAL_EVENT_INVALID',
        processed_at = transaction_timestamp()
      where id = v_event.id;

      return 'FAILED';
  end;

  if v_amount <> v_payment.amount_paise
    or v_currency <> v_payment.currency
    or nullif(btrim(v_provider_payment_id), '') is null
    or (
      v_payment.provider_payment_id is not null
      and v_payment.provider_payment_id <> v_provider_payment_id
    )
  then
    update public.payment_events
    set
      processing_status = 'FAILED',
      processing_error = 'PAYMENT_IDENTITY_MISMATCH',
      processed_at = transaction_timestamp()
    where id = v_event.id;

    return 'FAILED';
  end if;

  if v_event.event_type = 'PAYMENT_SUCCESS' then
    if v_payment.status in (
      'CAPTURED',
      'PARTIALLY_REFUNDED',
      'REFUNDED'
    ) then
      update public.payment_events
      set
        processing_status = 'IGNORED',
        processed_at = transaction_timestamp()
      where id = v_event.id;

      return 'IGNORED';
    end if;

    if v_payment.status in ('FAILED', 'CANCELLED') then
      update public.payment_events
      set
        processing_status = 'FAILED',
        processing_error = 'LATE_SUCCESS_AFTER_TERMINAL_STATE',
        processed_at = transaction_timestamp()
      where id = v_event.id;

      return 'FAILED';
    end if;

    if exists (
      select 1
      from public.branch_inventory_reservations bir
      where bir.order_id = v_order.id
        and bir.status in ('RELEASED', 'EXPIRED')
    )
    or (
      select count(*)
      from public.branch_inventory_reservations bir
      where bir.order_id = v_order.id
    ) <> (
      select count(*)
      from public.order_items oi
      where oi.order_id = v_order.id
    )
    then
      update public.payment_events
      set
        processing_status = 'FAILED',
        processing_error =
          'BRANCH_RESERVATION_UNAVAILABLE_AFTER_PAYMENT',
        processed_at = transaction_timestamp()
      where id = v_event.id;

      return 'FAILED';
    end if;

    for v_reservation in
      select bir.id, bir.status
      from public.branch_inventory_reservations bir
      where bir.order_id = v_order.id
      order by bir.variant_id, bir.id
      for update
    loop
      if v_reservation.status = 'ACTIVE' then
        perform private.convert_branch_inventory_reservation(
          v_reservation.id,
          null
        );
      end if;
    end loop;

    update public.payments
    set
      status = 'CAPTURED',
      provider_payment_id = v_provider_payment_id,
      signature_verified = true,
      paid_at = v_occurred_at,
      failure_code = null,
      failure_message = null,
      updated_at = transaction_timestamp()
    where id = v_payment.id;

    update public.orders
    set
      payment_status = 'CAPTURED',
      placed_at = coalesce(placed_at, v_occurred_at),
      updated_at = transaction_timestamp()
    where id = v_order.id;

    if v_order.status = 'PAYMENT_PENDING' then
      perform private.transition_order_state(
        v_order.id,
        'WAITING_FOR_MERCHANT',
        null,
        'SYSTEM',
        'PAYMENT_CAPTURED',
        null
      );
    end if;
  elsif v_event.event_type in (
    'PAYMENT_FAILED',
    'PAYMENT_USER_DROPPED'
  ) then
    if v_payment.status in (
      'CAPTURED',
      'PARTIALLY_REFUNDED',
      'REFUNDED'
    ) then
      update public.payment_events
      set
        processing_status = 'IGNORED',
        processed_at = transaction_timestamp()
      where id = v_event.id;

      return 'IGNORED';
    end if;

    if v_payment.status not in ('FAILED', 'CANCELLED') then
      update public.payments
      set
        status = case
          when v_event.event_type = 'PAYMENT_USER_DROPPED'
            then 'CANCELLED'::public.payment_attempt_status
          else 'FAILED'::public.payment_attempt_status
        end,
        provider_payment_id =
          coalesce(provider_payment_id, v_provider_payment_id),
        signature_verified = true,
        failure_code = case
          when v_event.event_type = 'PAYMENT_FAILED'
            then 'PROVIDER_PAYMENT_FAILED'
          else null
        end,
        failure_message = case
          when v_event.event_type = 'PAYMENT_FAILED'
            then 'Verified provider failure webhook'
          else null
        end,
        updated_at = transaction_timestamp()
      where id = v_payment.id;

      update public.orders
      set
        payment_status = 'FAILED',
        updated_at = transaction_timestamp()
      where id = v_order.id;

      if v_order.status = 'PAYMENT_PENDING' then
        perform private.transition_order_state(
          v_order.id,
          'CANCELLED',
          null,
          'SYSTEM',
          v_event.event_type,
          null
        );
      end if;

      for v_reservation in
        select bir.id
        from public.branch_inventory_reservations bir
        where bir.order_id = v_order.id
          and bir.status = 'ACTIVE'
        order by bir.variant_id, bir.id
        for update
      loop
        perform private.release_branch_inventory_reservation(
          v_reservation.id,
          'RELEASED',
          v_event.event_type,
          null
        );
      end loop;
    end if;
  else
    update public.payment_events
    set
      processing_status = 'IGNORED',
      processed_at = transaction_timestamp()
    where id = v_event.id;

    return 'IGNORED';
  end if;

  update public.payment_events
  set
    processing_status = 'PROCESSED',
    processing_error = null,
    processed_at = transaction_timestamp()
  where id = v_event.id;

  perform private.enqueue_outbox_event(
    'payment.event.processed',
    'PAYMENT',
    v_payment.id,
    jsonb_build_object(
      'paymentEventId', v_event.id::text,
      'paymentId', v_payment.id,
      'orderId', v_order.id,
      'eventType', v_event.event_type
    )
  );

  return 'PROCESSED';
end;
$$;

alter function public.expire_pending_branch_checkout_orders(integer)
  rename to expire_pending_branch_checkout_orders_legacy;

create or replace function public.expire_pending_branch_checkout_orders(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order public.orders;
  v_payment public.payments;
  v_has_payment boolean;
  v_reservation record;
  v_count integer := 0;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'BRANCH_CHECKOUT_EXPIRY_LIMIT_INVALID'
      using errcode = '22023';
  end if;

  for v_order_id in
    select o.id
    from public.orders o
    where o.order_contract_version = 2
      and o.status = 'PAYMENT_PENDING'
      and exists (
        select 1
        from public.branch_inventory_reservations bir
        where bir.order_id = o.id
          and bir.status = 'ACTIVE'
          and bir.expires_at <= now()
      )
    order by o.created_at, o.id
    for update skip locked
    limit p_limit
  loop
    select *
    into strict v_order
    from public.orders o
    where o.id = v_order_id
    for update;

    select *
    into v_payment
    from public.payments p
    where p.order_id = v_order.id
    order by p.created_at desc, p.id desc
    limit 1
    for update;

    v_has_payment := found;

    if v_has_payment
      and v_payment.status in (
        'CAPTURED',
        'PARTIALLY_REFUNDED',
        'REFUNDED'
      )
    then
      continue;
    end if;

    for v_reservation in
      select bir.id
      from public.branch_inventory_reservations bir
      where bir.order_id = v_order.id
        and bir.status = 'ACTIVE'
      order by bir.variant_id, bir.id
      for update
    loop
      perform private.release_branch_inventory_reservation(
        v_reservation.id,
        'EXPIRED',
        'Payment session expired',
        null
      );
    end loop;

    if v_has_payment then
      update public.payments
      set
        status = 'FAILED',
        failure_code = 'PAYMENT_SESSION_EXPIRED',
        failure_message = 'Payment session expired before capture',
        updated_at = transaction_timestamp()
      where id = v_payment.id
        and status in ('CREATED', 'PENDING');
    end if;

    update public.orders
    set
      payment_status = 'FAILED',
      updated_at = transaction_timestamp()
    where id = v_order.id;

    perform private.transition_order_state(
      v_order.id,
      'CANCELLED',
      null,
      'SYSTEM',
      'PAYMENT_SESSION_EXPIRED',
      null
    );

    perform private.enqueue_outbox_event(
      'order.payment_expired',
      'ORDER',
      v_order.id,
      jsonb_build_object(
        'orderId', v_order.id,
        'paymentId', case
          when v_has_payment then v_payment.id
          else null
        end,
        'merchantBranchId', v_order.merchant_branch_id
      )
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all
on function private.prevent_duplicate_initial_order_history()
from public, anon, authenticated;

revoke all
on function private.apply_verified_payment_event_phase_2d_legacy(bigint)
from public, anon, authenticated;

revoke all
on function public.expire_pending_branch_checkout_orders_legacy(integer)
from public, anon, authenticated;

revoke all
on function public.expire_pending_branch_checkout_orders(integer)
from public, anon, authenticated;

grant execute
on function public.expire_pending_branch_checkout_orders(integer)
to service_role;
