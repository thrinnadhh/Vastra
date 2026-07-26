-- Transactional customer cancellation and shared cancellation side effects.
--
-- Customer cancellation is allowed only before merchant acceptance. Every
-- cancellation path releases order-linked inventory, stops active merchant
-- alerting, and creates one durable provider refund when payment was captured.

create table private.customer_order_cancellation_requests (
  customer_id uuid not null,
  idempotency_key uuid not null,
  order_id uuid not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  primary key (customer_id, idempotency_key),

  constraint customer_order_cancellation_requests_customer_fkey
    foreign key (customer_id)
    references public.customer_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint customer_order_cancellation_requests_order_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint customer_order_cancellation_requests_result_object
    check (
      result_payload is null
      or jsonb_typeof(result_payload) = 'object'
    ),

  constraint customer_order_cancellation_requests_completion
    check (
      (result_payload is null and completed_at is null)
      or (result_payload is not null and completed_at is not null)
    )
);

comment on table private.customer_order_cancellation_requests is
  'Backend-only idempotency receipts for customer order cancellation.';

create or replace function private.release_order_inventory_reservations(
  p_order_id uuid,
  p_actor_id uuid,
  p_reason text
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.inventory_reservations;
  v_released public.inventory_reservations;
  v_movement public.inventory_movements;
  v_balance public.inventory_balances;
  v_count integer := 0;
begin
  if p_order_id is null or p_actor_id is null
    or nullif(btrim(p_reason), '') is null
    or length(btrim(p_reason)) > 500
  then
    raise exception 'order inventory release input is invalid'
      using errcode = '22023';
  end if;

  for v_reservation in
    select reservation.*
    from public.inventory_reservations reservation
    where reservation.order_id = p_order_id
      and reservation.status = 'ACTIVE'
    order by reservation.created_at, reservation.id
    for update
  loop
    select *
    into strict v_released
    from private.release_inventory_reservation(
      v_reservation.id,
      'RELEASED',
      btrim(p_reason),
      p_actor_id
    );

    select movement.*
    into strict v_movement
    from public.inventory_movements movement
    where movement.reference_type = 'INVENTORY_RESERVATION'
      and movement.reference_id = v_released.id
      and movement.movement_type = 'ONLINE_ORDER_RELEASED'
    order by movement.id desc
    limit 1;

    select balance.*
    into strict v_balance
    from public.inventory_balances balance
    where balance.shop_id = v_released.shop_id
      and balance.variant_id = v_released.variant_id;

    perform private.enqueue_outbox_event(
      'inventory.balance.changed',
      'PRODUCT_VARIANT',
      v_released.variant_id,
      jsonb_build_object(
        'shopId', v_released.shop_id,
        'variantId', v_released.variant_id,
        'reservationId', v_released.id,
        'orderId', p_order_id,
        'movementId', v_movement.id::text,
        'action', 'RELEASE_FOR_ORDER_CANCELLATION',
        'stockOnHand', v_balance.stock_on_hand,
        'reservedQuantity', v_balance.reserved_quantity,
        'damagedQuantity', v_balance.damaged_quantity,
        'availableQuantity',
          v_balance.stock_on_hand
          - v_balance.reserved_quantity
          - v_balance.damaged_quantity,
        'version', v_balance.version
      ),
      v_movement.created_at,
      v_movement.created_at
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function private.prepare_order_cancellation_refund(
  p_order_id uuid,
  p_actor_id uuid,
  p_reason_code text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_refund public.refunds;
  v_refund_id uuid := gen_random_uuid();
  v_existing_amount bigint;
  v_remaining_amount bigint;
  v_idempotency_key text;
begin
  if p_order_id is null or p_actor_id is null
    or nullif(btrim(p_reason_code), '') is null
  then
    raise exception 'cancellation refund input is invalid'
      using errcode = '22023';
  end if;

  select *
  into strict v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.payment_status not in ('CAPTURED', 'PARTIALLY_REFUNDED') then
    return null;
  end if;

  select payment.*
  into v_payment
  from public.payments payment
  where payment.order_id = p_order_id
    and payment.status in ('CAPTURED', 'PARTIALLY_REFUNDED')
    and payment.provider_order_id is not null
    and payment.provider_payment_id is not null
  order by payment.paid_at desc nulls last, payment.created_at desc, payment.id
  limit 1
  for update;

  if not found then
    raise exception 'captured cancellation payment is not refundable'
      using errcode = 'P0038';
  end if;

  perform 1
  from public.refunds refund
  where refund.payment_id = v_payment.id
  order by refund.id
  for update;

  select coalesce(sum(refund.amount_paise), 0)::bigint
  into v_existing_amount
  from public.refunds refund
  where refund.payment_id = v_payment.id
    and refund.status in ('INITIATED', 'PROCESSING', 'COMPLETED');

  v_remaining_amount := v_payment.amount_paise - v_existing_amount;
  if v_remaining_amount < 1 then
    select refund.id
    into v_refund_id
    from public.refunds refund
    where refund.payment_id = v_payment.id
      and refund.status in ('INITIATED', 'PROCESSING', 'COMPLETED')
    order by refund.created_at desc, refund.id
    limit 1;
    return v_refund_id;
  end if;

  v_idempotency_key := 'order-cancellation:' || p_order_id::text;
  insert into public.refunds (
    id,
    refund_number,
    idempotency_key,
    order_id,
    payment_id,
    return_request_id,
    amount_paise,
    reason_code,
    status,
    initiated_by,
    approved_by,
    initiated_at
  ) values (
    v_refund_id,
    'REF-' || upper(replace(v_refund_id::text, '-', '')),
    v_idempotency_key,
    p_order_id,
    v_payment.id,
    null,
    v_remaining_amount,
    btrim(p_reason_code),
    'INITIATED',
    p_actor_id,
    null,
    transaction_timestamp()
  )
  on conflict (order_id, idempotency_key) do nothing
  returning * into v_refund;

  if not found then
    select *
    into strict v_refund
    from public.refunds
    where order_id = p_order_id
      and idempotency_key = v_idempotency_key;
    return v_refund.id;
  end if;

  perform private.enqueue_outbox_event(
    'refund.initiated',
    'REFUND',
    v_refund.id,
    jsonb_build_object(
      'refundId', v_refund.id,
      'returnId', null,
      'orderId', p_order_id,
      'paymentId', v_payment.id,
      'amountPaise', v_refund.amount_paise,
      'reasonCode', btrim(p_reason_code)
    ),
    transaction_timestamp(),
    transaction_timestamp()
  );

  return v_refund.id;
end;
$$;

create or replace function public.cancel_customer_order(
  p_actor_id uuid,
  p_order_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt private.customer_order_cancellation_requests;
  v_order public.orders;
  v_refund public.refunds;
  v_refund_id uuid;
  v_released integer;
  v_result jsonb;
begin
  if p_actor_id is null or p_order_id is null or p_idempotency_key is null then
    raise exception 'customer cancellation input is invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.profiles
  where id = p_actor_id
    and account_type = 'CUSTOMER'
    and status = 'ACTIVE';
  if not found then
    raise exception 'customer cancellation access denied'
      using errcode = '42501';
  end if;

  insert into private.customer_order_cancellation_requests (
    customer_id,
    idempotency_key,
    order_id
  ) values (
    p_actor_id,
    p_idempotency_key,
    p_order_id
  )
  on conflict do nothing
  returning * into v_receipt;

  if not found then
    select *
    into strict v_receipt
    from private.customer_order_cancellation_requests request
    where request.customer_id = p_actor_id
      and request.idempotency_key = p_idempotency_key
    for update;

    if v_receipt.order_id <> p_order_id then
      raise exception 'customer cancellation idempotency conflict'
        using errcode = 'P0036';
    end if;
    if v_receipt.result_payload is null then
      raise exception 'customer cancellation receipt is incomplete'
        using errcode = 'P0038';
    end if;
    return v_receipt.result_payload || jsonb_build_object('replayed', true);
  end if;

  select order_row.*
  into v_order
  from public.orders order_row
  where order_row.id = p_order_id
    and order_row.customer_id = p_actor_id
  for update;

  if not found then
    raise exception 'customer order not found'
      using errcode = 'P0033';
  end if;
  if v_order.status = 'CANCELLED' then
    raise exception 'customer order already cancelled'
      using errcode = 'P0035';
  end if;
  if v_order.status not in ('PAYMENT_PENDING', 'WAITING_FOR_MERCHANT') then
    raise exception 'customer cancellation window closed'
      using errcode = 'P0034';
  end if;

  if v_order.payment_status in ('PENDING', 'AUTHORIZED') then
    update public.payments
    set status = 'CANCELLED',
        updated_at = transaction_timestamp()
    where order_id = v_order.id
      and status in ('CREATED', 'PENDING', 'AUTHORIZED');

    update public.orders
    set payment_status = 'FAILED'
    where id = v_order.id;
  end if;

  v_released := private.release_order_inventory_reservations(
    v_order.id,
    p_actor_id,
    'Customer cancelled before merchant acceptance'
  );
  v_refund_id := private.prepare_order_cancellation_refund(
    v_order.id,
    p_actor_id,
    'CUSTOMER_CANCELLATION'
  );

  select *
  into strict v_order
  from private.transition_order_state(
    v_order.id,
    'CANCELLED',
    p_actor_id,
    'CUSTOMER',
    'CUSTOMER_REQUESTED',
    'Customer cancelled before merchant acceptance'
  );

  update public.order_items
  set fulfilment_status = 'CANCELLED'
  where order_id = v_order.id
    and fulfilment_status in ('PENDING', 'VERIFIED', 'PACKED');

  if exists (
    select 1
    from public.merchant_order_alerts alert
    where alert.order_id = v_order.id
  ) then
    perform private.finish_merchant_alert(v_order.id, p_actor_id);
  end if;

  if v_refund_id is not null then
    select *
    into strict v_refund
    from public.refunds
    where id = v_refund_id;
  end if;

  perform private.enqueue_outbox_event(
    'order.customer.cancelled',
    'ORDER',
    v_order.id,
    jsonb_build_object(
      'orderId', v_order.id,
      'customerId', p_actor_id,
      'shopId', v_order.shop_id,
      'reservationsReleased', v_released,
      'refundId', v_refund_id,
      'cancelledAt', v_order.cancelled_at
    ),
    v_order.cancelled_at,
    v_order.cancelled_at
  );

  v_result := jsonb_build_object(
    'orderId', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'paymentStatus', v_order.payment_status,
    'refundId', v_refund_id,
    'refundStatus', v_refund.status,
    'reservationsReleased', v_released,
    'cancelledAt', v_order.cancelled_at,
    'replayed', false
  );

  update private.customer_order_cancellation_requests
  set result_payload = v_result,
      completed_at = transaction_timestamp()
  where customer_id = p_actor_id
    and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

-- Repair merchant rejection so it releases order reservations instead of
-- invoking the cart-only release RPC.
create or replace function public.reject_merchant_order(
  p_actor uuid,
  p_order_id uuid,
  p_reason_code text,
  p_order_item_id uuid default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  a public.merchant_order_alerts;
  released integer := 0;
  refund_id uuid;
  replay boolean := false;
begin
  if p_reason_code not in (
    'OUT_OF_STOCK',
    'SIZE_UNAVAILABLE',
    'COLOUR_UNAVAILABLE',
    'DAMAGED_ITEM',
    'INVENTORY_MISMATCH',
    'ITEM_NOT_FOUND',
    'SHOP_BUSY',
    'SHOP_CLOSING',
    'OTHER'
  ) then
    raise exception 'invalid rejection reason' using errcode = '22023';
  end if;
  if p_reason_code = 'OTHER' and nullif(btrim(p_note), '') is null then
    raise exception 'rejection note required' using errcode = '22023';
  end if;

  select ord.*
  into o
  from public.orders ord
  join public.shops shop on shop.id = ord.shop_id
  where ord.id = p_order_id
    and shop.merchant_id = p_actor
  for update of ord;
  if not found then
    raise exception 'merchant order not found' using errcode = 'P0017';
  end if;

  if o.status = 'CANCELLED'
    and o.cancellation_reason_code = p_reason_code
    and o.cancellation_note is not distinct from nullif(btrim(p_note), '')
  then
    replay := true;
  elsif o.status <> 'WAITING_FOR_MERCHANT' then
    raise exception 'merchant order state invalid' using errcode = 'P0019';
  end if;

  select *
  into a
  from public.merchant_order_alerts
  where order_id = o.id
  for update;
  if a.expires_at <= statement_timestamp() and not replay then
    raise exception 'merchant response expired' using errcode = 'P0018';
  end if;

  if not replay then
    if p_order_item_id is not null
      and not exists (
        select 1
        from public.order_items
        where id = p_order_item_id
          and order_id = o.id
      )
    then
      raise exception 'merchant order not found' using errcode = 'P0017';
    end if;

    insert into public.merchant_order_issues (
      order_id,
      order_item_id,
      issue_type,
      description,
      reported_by
    ) values (
      o.id,
      p_order_item_id,
      p_reason_code,
      nullif(btrim(p_note), ''),
      p_actor
    );

    released := private.release_order_inventory_reservations(
      o.id,
      p_actor,
      'Merchant rejected order: ' || p_reason_code
    );
    refund_id := private.prepare_order_cancellation_refund(
      o.id,
      p_actor,
      'MERCHANT_REJECTION'
    );

    update public.orders
    set cancellation_reason_code = p_reason_code,
        cancellation_note = nullif(btrim(p_note), '')
    where id = o.id;

    select *
    into o
    from private.transition_order_state(
      o.id,
      'CANCELLED',
      p_actor,
      'MERCHANT',
      p_reason_code,
      coalesce(nullif(btrim(p_note), ''), 'Merchant rejected the full order')
    );
    update public.order_items
    set fulfilment_status = 'CANCELLED'
    where order_id = o.id
      and fulfilment_status in ('PENDING', 'VERIFIED', 'PACKED');
    a := private.finish_merchant_alert(o.id, p_actor);

    perform private.enqueue_outbox_event(
      'order.merchant.rejected',
      'ORDER',
      o.id,
      jsonb_build_object(
        'orderId', o.id,
        'shopId', o.shop_id,
        'reasonCode', p_reason_code,
        'orderItemId', p_order_item_id,
        'reservationsReleased', released,
        'refundId', refund_id,
        'cancelledAt', o.cancelled_at
      ),
      o.cancelled_at,
      o.cancelled_at
    );
  else
    a := private.finish_merchant_alert(o.id, p_actor);
  end if;

  return jsonb_build_object(
    'orderId', o.id,
    'orderNumber', o.order_number,
    'status', o.status,
    'alertStatus', a.alert_status,
    'merchantPreparationMinutes', o.merchant_preparation_minutes,
    'acceptedAt', o.accepted_at,
    'cancelledAt', o.cancelled_at,
    'cancellationReasonCode', o.cancellation_reason_code,
    'cancellationNote', o.cancellation_note,
    'reservationsReleased', released,
    'replayed', replay
  );
end;
$$;

-- Repair admin cancellation with the same inventory/refund invariants.
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
  v_released integer;
  v_refund_id uuid;
begin
  v_replay := private.claim_admin_operation(
    p_actor_id,
    'admin.order.cancel',
    p_idempotency_key,
    'ORDER',
    p_order_id,
    p_reason_code,
    p_note,
    jsonb_build_object('orderId', p_order_id)
  );
  if v_replay is not null then return v_replay; end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'ADMIN_ORDER_NOT_FOUND'; end if;
  if v_order.status not in (
    'PAYMENT_PENDING',
    'WAITING_FOR_MERCHANT',
    'MERCHANT_ACCEPTED',
    'PACKING',
    'READY_FOR_PICKUP',
    'CAPTAIN_SEARCHING',
    'CAPTAIN_ASSIGNED',
    'CAPTAIN_AT_STORE',
    'PROBLEM_REPORTED'
  ) or v_order.picked_up_at is not null then
    raise exception 'ADMIN_ORDER_STATE_CONFLICT';
  end if;

  v_before := jsonb_build_object(
    'status', v_order.status,
    'paymentStatus', v_order.payment_status,
    'version', v_order.version
  );

  select *
  into v_task
  from public.delivery_tasks
  where order_id = p_order_id
    and task_type = 'FORWARD_DELIVERY'
    and status not in ('COMPLETED', 'CANCELLED')
  order by created_at desc
  limit 1
  for update;

  if found then
    perform 1
    from public.delivery_assignments
    where delivery_task_id = v_task.id
    order by id
    for update;

    select captain_id
    into v_captain_id
    from public.delivery_assignments
    where delivery_task_id = v_task.id
      and assignment_status = 'ACCEPTED'
    order by created_at desc
    limit 1;

    if v_captain_id is not null then
      perform 1
      from public.captain_profiles
      where user_id = v_captain_id
      for update;
    end if;

    update public.delivery_assignments
    set assignment_status = case
          when assignment_status = 'ACCEPTED'
            then 'RELEASED'::public.delivery_assignment_status
          else 'CANCELLED'::public.delivery_assignment_status
        end,
        responded_at = coalesce(responded_at, transaction_timestamp())
    where delivery_task_id = v_task.id
      and assignment_status in ('OFFERED', 'ACCEPTED');

    update public.delivery_tasks
    set status = 'CANCELLED',
        assigned_captain_id = null,
        assigned_at = null,
        pickup_code_hash = null,
        pickup_code_expires_at = null,
        delivery_otp_hash = null,
        delivery_otp_expires_at = null,
        updated_at = transaction_timestamp()
    where id = v_task.id;

    if v_captain_id is not null then
      update public.captain_profiles
      set availability_status = 'AVAILABLE',
          updated_at = transaction_timestamp()
      where user_id = v_captain_id;

      update public.captain_current_locations
      set active_delivery_task_id = null,
          updated_at = transaction_timestamp()
      where captain_id = v_captain_id;
    end if;
  end if;

  if v_order.payment_status in ('PENDING', 'AUTHORIZED') then
    update public.payments
    set status = 'CANCELLED',
        updated_at = transaction_timestamp()
    where order_id = v_order.id
      and status in ('CREATED', 'PENDING', 'AUTHORIZED');
    update public.orders
    set payment_status = 'FAILED'
    where id = v_order.id;
  end if;

  v_released := private.release_order_inventory_reservations(
    p_order_id,
    p_actor_id,
    'Admin cancelled order: ' || p_reason_code
  );
  v_refund_id := private.prepare_order_cancellation_refund(
    p_order_id,
    p_actor_id,
    'ADMIN_CANCELLATION'
  );

  select *
  into strict v_updated
  from private.transition_order_state(
    p_order_id,
    'CANCELLED',
    p_actor_id,
    'ADMIN',
    p_reason_code,
    p_note
  );

  update public.order_items
  set fulfilment_status = 'CANCELLED'
  where order_id = p_order_id
    and fulfilment_status in ('PENDING', 'VERIFIED', 'PACKED');

  if exists (
    select 1
    from public.merchant_order_alerts alert
    where alert.order_id = p_order_id
      and alert.alert_status in ('PENDING', 'SENT', 'DELIVERED')
  ) then
    perform private.finish_merchant_alert(p_order_id, p_actor_id);
  end if;

  perform private.enqueue_outbox_event(
    'admin.order.cancelled',
    'ORDER',
    p_order_id,
    jsonb_build_object(
      'orderId', p_order_id,
      'reasonCode', p_reason_code,
      'reservationsReleased', v_released,
      'refundId', v_refund_id
    ),
    transaction_timestamp(),
    transaction_timestamp()
  );

  v_result := jsonb_build_object(
    'orderId', v_updated.id,
    'orderNumber', v_updated.order_number,
    'orderStatus', v_updated.status,
    'cancelledAt', v_updated.cancelled_at,
    'deliveryTaskId', v_task.id,
    'reservationsReleased', v_released,
    'refundId', v_refund_id
  );

  return private.complete_admin_operation(
    p_actor_id,
    'admin.order.cancel',
    p_idempotency_key,
    'ORDER',
    p_order_id,
    p_reason_code,
    p_note,
    p_request_id,
    v_before,
    jsonb_build_object(
      'status', v_updated.status,
      'version', v_updated.version,
      'reservationsReleased', v_released,
      'refundId', v_refund_id
    ),
    v_result
  );
end;
$$;

revoke all on table private.customer_order_cancellation_requests
  from public, anon, authenticated;
revoke all on function private.release_order_inventory_reservations(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function private.prepare_order_cancellation_refund(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.cancel_customer_order(uuid,uuid,uuid)
  from public, anon, authenticated;

grant select, insert, update
  on table private.customer_order_cancellation_requests
  to service_role;
grant execute on function private.release_order_inventory_reservations(uuid,uuid,text)
  to service_role;
grant execute on function private.prepare_order_cancellation_refund(uuid,uuid,text)
  to service_role;
grant execute on function public.cancel_customer_order(uuid,uuid,uuid)
  to service_role;
