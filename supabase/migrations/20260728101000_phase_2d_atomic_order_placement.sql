-- Phase 2D-A: atomic branch-aware order placement and payment inventory lifecycle.
--
-- Both COD and online payment use the same quote revalidation, immutable order
-- snapshot, lock order, and branch inventory reservation core.

create or replace function private.create_branch_order_from_quote(
  p_actor uuid,
  p_cart_id uuid,
  p_quote_id uuid,
  p_address_id uuid,
  p_customer_note text,
  p_idempotency_key uuid,
  p_payment_method text,
  p_order_id uuid,
  p_reservation_expires_at timestamptz
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.checkout_quotes;
  v_cart public.carts;
  v_order public.orders;
  v_line record;
  v_reservation jsonb;
  v_reservation_id uuid;
  v_now timestamptz := statement_timestamp();
  v_status public.order_status;
  v_payment_status public.order_payment_status;
  v_placed_at timestamptz;
begin
  if p_order_id is null
    or p_idempotency_key is null
    or p_reservation_expires_at is null
    or p_reservation_expires_at <= v_now
  then
    raise exception 'BRANCH_CHECKOUT_ORDER_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_quote := private.revalidate_branch_checkout_quote(
    p_actor,
    p_cart_id,
    p_quote_id,
    p_address_id,
    p_payment_method
  );

  select *
  into strict v_cart
  from public.carts c
  where c.id = p_cart_id;

  if p_payment_method = 'COD' then
    v_status := 'WAITING_FOR_MERCHANT';
    v_payment_status := 'COD_PENDING';
    v_placed_at := v_now;
  else
    v_status := 'PAYMENT_PENDING';
    v_payment_status := 'PENDING';
    v_placed_at := null;
  end if;

  insert into public.orders (
    id,
    order_number,
    idempotency_key,
    customer_id,
    shop_id,
    cart_id,
    checkout_quote_id,
    delivery_address_id,
    address_snapshot,
    status,
    payment_status,
    fulfilment_type,
    subtotal_paise,
    product_discount_paise,
    coupon_discount_paise,
    delivery_fee_paise,
    platform_fee_paise,
    tax_paise,
    total_paise,
    merchant_preparation_minutes,
    estimated_delivery_at,
    customer_note,
    placed_at,
    order_contract_version,
    merchant_branch_id,
    city_id,
    service_zone_id,
    fulfilment_mode,
    customer_pincode,
    branch_snapshot,
    geography_snapshot,
    commercial_snapshot,
    city_configuration_version
  )
  values (
    p_order_id,
    'VAS-' || upper(replace(p_order_id::text, '-', '')),
    p_idempotency_key::text,
    p_actor,
    v_quote.shop_id,
    v_cart.id,
    v_quote.id,
    p_address_id,
    v_quote.payload -> 'address',
    v_status,
    v_payment_status,
    'DELIVERY',
    v_quote.subtotal_paise,
    v_quote.product_discount_paise,
    v_quote.coupon_discount_paise,
    v_quote.delivery_fee_paise,
    v_quote.platform_fee_paise,
    v_quote.tax_paise,
    v_quote.total_paise,
    v_quote.estimated_preparation_minutes,
    v_quote.estimated_delivery_at,
    p_customer_note,
    v_placed_at,
    2,
    v_quote.merchant_branch_id,
    v_quote.city_id,
    v_quote.service_zone_id,
    v_quote.fulfilment_mode,
    v_quote.payload #>> '{address,postalCode}',
    v_quote.branch_snapshot,
    v_quote.geography_snapshot,
    v_quote.commercial_snapshot,
    v_quote.city_configuration_version
  )
  returning * into v_order;

  insert into public.order_items (
    order_id,
    shop_id,
    product_id,
    variant_id,
    product_name_snapshot,
    sku_snapshot,
    colour_snapshot,
    size_snapshot,
    image_object_key_snapshot,
    quantity,
    unit_mrp_paise,
    unit_selling_price_paise,
    discount_paise,
    total_paise,
    branch_inventory_version_snapshot
  )
  select
    v_order.id,
    ci.shop_id,
    product.id,
    pv.id,
    product.name,
    pv.sku,
    pv.colour_name,
    pv.size_label,
    image.image_object_key,
    ci.quantity,
    pv.mrp_paise,
    pv.selling_price_paise,
    0,
    ci.quantity::bigint * pv.selling_price_paise,
    (snapshot.item ->> 'branchInventoryVersion')::integer
  from public.cart_items ci
  join public.product_variants pv
    on pv.id = ci.variant_id
   and pv.shop_id = ci.shop_id
  join public.products product
    on product.id = pv.product_id
   and product.shop_id = pv.shop_id
  join lateral (
    select item
    from jsonb_array_elements(v_quote.payload -> 'items') item
    where item ->> 'variantId' = pv.id::text
    limit 1
  ) snapshot on true
  left join lateral (
    select coalesce(pi.thumbnail_object_key, pi.storage_object_key)
      as image_object_key
    from public.product_images pi
    where pi.product_id = product.id
      and (
        pi.variant_id = pv.id
        or pi.variant_id is null
      )
    order by
      (pi.variant_id = pv.id) desc,
      pi.is_primary desc,
      pi.display_order,
      pi.id
    limit 1
  ) image on true
  where ci.cart_id = v_cart.id
  order by ci.added_at, ci.id;

  -- Cart reservations belong to the legacy shop-level inventory model. They are
  -- released only after the selected branch rows have been locked and the quote
  -- has been revalidated. Any later failure rolls the releases back.
  for v_line in
    select ir.id
    from public.inventory_reservations ir
    where ir.cart_id = v_cart.id
      and ir.status = 'ACTIVE'
    order by ir.created_at, ir.id
    for update
  loop
    perform public.release_customer_cart_reservation(
      v_line.id,
      'Legacy cart reservation replaced by branch order reservation',
      p_actor
    );
  end loop;

  for v_line in
    select ci.variant_id, ci.quantity
    from public.cart_items ci
    where ci.cart_id = v_cart.id
    order by ci.variant_id
  loop
    v_reservation := private.reserve_branch_inventory(
      v_quote.merchant_branch_id,
      v_line.variant_id,
      v_line.quantity,
      p_reservation_expires_at,
      gen_random_uuid(),
      null,
      v_order.id,
      p_actor
    );

    v_reservation_id := (v_reservation ->> 'id')::uuid;

    update public.order_items oi
    set branch_inventory_reservation_id = v_reservation_id
    where oi.order_id = v_order.id
      and oi.variant_id = v_line.variant_id;

    if p_payment_method = 'COD' then
      perform private.convert_branch_inventory_reservation(
        v_reservation_id,
        p_actor
      );
    end if;
  end loop;

  update public.carts
  set status = 'CONVERTED'
  where id = v_cart.id;

  insert into public.order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by_user_id,
    changed_by_role,
    reason_code
  )
  values (
    v_order.id,
    null,
    v_status,
    p_actor,
    'CUSTOMER',
    case
      when p_payment_method = 'COD'
        then 'CUSTOMER_COD_PLACED'
      else 'CUSTOMER_ONLINE_PAYMENT_PREPARED'
    end
  );

  perform private.enqueue_outbox_event(
    case
      when p_payment_method = 'COD'
        then 'order.placed'
      else 'order.payment_pending'
    end,
    'ORDER',
    v_order.id,
    jsonb_build_object(
      'orderId', v_order.id,
      'orderNumber', v_order.order_number,
      'customerId', v_order.customer_id,
      'shopId', v_order.shop_id,
      'merchantBranchId', v_order.merchant_branch_id,
      'cityId', v_order.city_id,
      'serviceZoneId', v_order.service_zone_id,
      'fulfilmentMode', v_order.fulfilment_mode,
      'paymentMethod', p_payment_method,
      'totalPaise', v_order.total_paise
    )
  );

  return v_order;
end;
$$;

create or replace function private.build_customer_cod_order_payload(
  p_order_id uuid,
  p_replayed boolean
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_order public.orders;
  v_shop public.shops;
  v_items jsonb;
begin
  select *
  into strict v_order
  from public.orders o
  where o.id = p_order_id;

  select *
  into strict v_shop
  from public.shops s
  where s.id = v_order.shop_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'productId', oi.product_id,
        'variantId', oi.variant_id,
        'productName', oi.product_name_snapshot,
        'sku', oi.sku_snapshot,
        'colourName', oi.colour_snapshot,
        'sizeLabel', oi.size_snapshot,
        'imageObjectKey', oi.image_object_key_snapshot,
        'quantity', oi.quantity,
        'unitMrpPaise', oi.unit_mrp_paise,
        'unitSellingPricePaise', oi.unit_selling_price_paise,
        'discountPaise', oi.discount_paise,
        'totalPaise', oi.total_paise,
        'branchInventoryVersion',
          oi.branch_inventory_version_snapshot,
        'branchInventoryReservationId',
          oi.branch_inventory_reservation_id
      )
      order by oi.created_at, oi.id
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'cartId', v_order.cart_id,
    'quoteId', v_order.checkout_quote_id,
    'contractVersion', v_order.order_contract_version,
    'shop',
      jsonb_build_object(
        'id', v_shop.id,
        'name', v_shop.name,
        'slug', v_shop.slug
      ),
    'branch', v_order.branch_snapshot,
    'geography', v_order.geography_snapshot,
    'commercial', v_order.commercial_snapshot,
    'address', v_order.address_snapshot,
    'status', v_order.status,
    'paymentStatus', v_order.payment_status,
    'paymentMethod', 'COD',
    'fulfilmentType', v_order.fulfilment_type,
    'fulfilmentMode', v_order.fulfilment_mode,
    'items', v_items,
    'totals',
      jsonb_build_object(
        'subtotalPaise', v_order.subtotal_paise,
        'productDiscountPaise', v_order.product_discount_paise,
        'couponDiscountPaise', v_order.coupon_discount_paise,
        'deliveryFeePaise', v_order.delivery_fee_paise,
        'platformFeePaise', v_order.platform_fee_paise,
        'taxPaise', v_order.tax_paise,
        'totalPaise', v_order.total_paise
      ),
    'estimatedDeliveryAt', v_order.estimated_delivery_at,
    'customerNote', v_order.customer_note,
    'placedAt', v_order.placed_at,
    'replayed', p_replayed
  );
end;
$$;

create or replace function public.place_customer_cod_order(
  p_actor uuid,
  p_cart_id uuid,
  p_quote_id uuid,
  p_address_id uuid,
  p_customer_note text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
  v_request_payload jsonb;
  v_request private.customer_order_requests;
  v_order public.orders;
  v_order_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if p_actor is null
    or p_cart_id is null
    or p_quote_id is null
    or p_address_id is null
    or p_idempotency_key is null
  then
    raise exception
      'actor, cart, quote, address, and idempotency key are required'
      using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_customer_note, '')), '');

  if v_note is not null and length(v_note) > 500 then
    raise exception 'customer note must not exceed 500 characters'
      using errcode = '22023';
  end if;

  perform 1
  from public.customer_profiles cp
  where cp.user_id = p_actor
  for update;

  if not found then
    raise exception 'customer profile not found'
      using errcode = '42501';
  end if;

  v_request_payload := jsonb_build_object(
    'cartId', p_cart_id,
    'quoteId', p_quote_id,
    'addressId', p_address_id,
    'paymentMethod', 'COD',
    'customerNote', v_note,
    'checkoutContractVersion', 2
  );

  insert into private.customer_order_requests (
    customer_id,
    idempotency_key,
    request_payload
  )
  values (
    p_actor,
    p_idempotency_key,
    v_request_payload
  )
  on conflict (customer_id, idempotency_key) do nothing
  returning * into v_request;

  if not found then
    select *
    into strict v_request
    from private.customer_order_requests cor
    where cor.customer_id = p_actor
      and cor.idempotency_key = p_idempotency_key
    for update;

    if v_request.request_payload <> v_request_payload then
      raise exception
        'idempotency key reused with a different order request'
        using errcode = 'P0010';
    end if;

    if v_request.result_payload is null then
      raise exception 'customer order idempotency receipt is incomplete'
        using errcode = '55000';
    end if;

    return jsonb_set(
      v_request.result_payload,
      '{replayed}',
      to_jsonb(true),
      true
    );
  end if;

  v_order := private.create_branch_order_from_quote(
    p_actor,
    p_cart_id,
    p_quote_id,
    p_address_id,
    v_note,
    p_idempotency_key,
    'COD',
    v_order_id,
    statement_timestamp() + interval '15 minutes'
  );

  v_result := private.build_customer_cod_order_payload(
    v_order.id,
    false
  );

  update private.customer_order_requests
  set
    order_id = v_order.id,
    result_payload = v_result,
    completed_at = transaction_timestamp()
  where customer_id = p_actor
    and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

create or replace function public.prepare_customer_online_payment(
  p_actor_id uuid,
  p_cart_id uuid,
  p_quote_id uuid,
  p_address_id uuid,
  p_customer_note text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
  v_request_payload jsonb;
  v_request private.customer_online_payment_requests;
  v_order public.orders;
  v_payment public.payments;
  v_payment_id uuid := gen_random_uuid();
  v_provider_order_id text;
  v_result jsonb;
begin
  if p_actor_id is null
    or p_cart_id is null
    or p_quote_id is null
    or p_address_id is null
    or p_idempotency_key is null
  then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;

  v_note := nullif(btrim(coalesce(p_customer_note, '')), '');

  if v_note is not null and length(v_note) > 500 then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;

  perform 1
  from public.customer_profiles cp
  where cp.user_id = p_actor_id
  for update;

  if not found then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;

  v_request_payload := jsonb_build_object(
    'cartId', p_cart_id,
    'quoteId', p_quote_id,
    'addressId', p_address_id,
    'paymentMethod', 'ONLINE',
    'customerNote', v_note,
    'checkoutContractVersion', 2
  );

  insert into private.customer_online_payment_requests (
    customer_id,
    idempotency_key,
    request_payload
  )
  values (
    p_actor_id,
    p_idempotency_key,
    v_request_payload
  )
  on conflict do nothing
  returning * into v_request;

  if not found then
    select *
    into strict v_request
    from private.customer_online_payment_requests copr
    where copr.customer_id = p_actor_id
      and copr.idempotency_key = p_idempotency_key
    for update;

    if v_request.request_payload <> v_request_payload then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;

    if v_request.payment_id is null then
      raise exception 'FINANCE_REQUEST_INCOMPLETE';
    end if;

    return private.build_customer_online_payment_preparation(
      v_request.payment_id,
      true
    );
  end if;

  v_order := private.create_branch_order_from_quote(
    p_actor_id,
    p_cart_id,
    p_quote_id,
    p_address_id,
    v_note,
    p_idempotency_key,
    'ONLINE',
    gen_random_uuid(),
    statement_timestamp() + interval '15 minutes'
  );

  v_provider_order_id :=
    'VASPAY' || upper(replace(v_payment_id::text, '-', ''));

  insert into public.payments (
    id,
    order_id,
    customer_id,
    idempotency_key,
    provider,
    provider_order_id,
    method,
    amount_paise,
    currency,
    status
  )
  values (
    v_payment_id,
    v_order.id,
    p_actor_id,
    p_idempotency_key::text,
    'cashfree',
    v_provider_order_id,
    'OTHER',
    v_order.total_paise,
    'INR',
    'CREATED'
  )
  returning * into v_payment;

  v_result := private.build_customer_online_payment_preparation(
    v_payment.id,
    false
  );

  update private.customer_online_payment_requests
  set
    order_id = v_order.id,
    payment_id = v_payment.id,
    result_payload = v_result,
    completed_at = transaction_timestamp()
  where customer_id = p_actor_id
    and idempotency_key = p_idempotency_key;

  perform private.enqueue_outbox_event(
    'payment.checkout.prepared',
    'PAYMENT',
    v_payment.id,
    jsonb_build_object(
      'paymentId', v_payment.id,
      'orderId', v_order.id,
      'provider', v_payment.provider,
      'providerOrderId', v_provider_order_id,
      'amountPaise', v_payment.amount_paise,
      'currency', v_payment.currency,
      'merchantBranchId', v_order.merchant_branch_id
    )
  );

  return v_result;
end;
$$;

create or replace function public.attach_customer_payment_session(
  p_actor_id uuid,
  p_payment_id uuid,
  p_provider_order_id text,
  p_provider_reference_id text,
  p_payment_session_id text,
  p_amount_paise bigint,
  p_currency text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_payment public.payments;
begin
  if p_actor_id is null
    or p_payment_id is null
    or nullif(btrim(p_provider_order_id), '') is null
    or nullif(btrim(p_provider_reference_id), '') is null
    or nullif(btrim(p_payment_session_id), '') is null
    or p_expires_at is null
    or p_expires_at <= statement_timestamp()
  then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;

  select o.*
  into v_order
  from public.payments p
  join public.orders o
    on o.id = p.order_id
  where p.id = p_payment_id
    and o.customer_id = p_actor_id
  for update of o;

  if not found then
    raise exception 'FINANCE_PAYMENT_NOT_FOUND';
  end if;

  select *
  into strict v_payment
  from public.payments p
  where p.id = p_payment_id
    and p.customer_id = p_actor_id
  for update;

  if v_payment.provider <> 'cashfree'
    or v_payment.provider_order_id <> btrim(p_provider_order_id)
    or v_payment.amount_paise <> p_amount_paise
    or v_payment.currency <> p_currency
  then
    raise exception 'FINANCE_PAYMENT_AMOUNT_MISMATCH';
  end if;

  if v_payment.status not in ('CREATED', 'PENDING') then
    raise exception 'FINANCE_PAYMENT_STATE_CONFLICT';
  end if;

  if v_payment.provider_session_id is not null then
    if v_payment.provider_reference_id
        <> btrim(p_provider_reference_id)
      or v_payment.provider_session_id
        <> btrim(p_payment_session_id)
      or v_payment.provider_session_expires_at
        is distinct from p_expires_at
    then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;

    return private.build_customer_payment_checkout(
      v_payment.id,
      true
    );
  end if;

  if v_order.order_contract_version = 2 then
    if not exists (
      select 1
      from public.branch_inventory_reservations bir
      where bir.order_id = v_order.id
        and bir.status = 'ACTIVE'
    ) then
      raise exception 'PAYMENT_RESERVATION_EXPIRED'
        using errcode = 'P0025';
    end if;

    update public.branch_inventory_reservations
    set expires_at = p_expires_at
    where order_id = v_order.id
      and status = 'ACTIVE';
  end if;

  update public.payments
  set
    provider_reference_id = btrim(p_provider_reference_id),
    provider_session_id = btrim(p_payment_session_id),
    provider_session_expires_at = p_expires_at,
    status = 'PENDING',
    updated_at = transaction_timestamp()
  where id = v_payment.id;

  perform private.enqueue_outbox_event(
    'payment.session.attached',
    'PAYMENT',
    v_payment.id,
    jsonb_build_object(
      'paymentId', v_payment.id,
      'orderId', v_order.id,
      'providerOrderId', p_provider_order_id,
      'providerReferenceId', p_provider_reference_id,
      'reservationExpiresAt', p_expires_at
    )
  );

  return private.build_customer_payment_checkout(
    v_payment.id,
    false
  );
end;
$$;

create or replace function private.apply_verified_payment_event(
  p_event_id bigint
)
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
  v_reservation record;
begin
  select *
  into v_event
  from public.payment_events pe
  where pe.id = p_event_id;

  if not found then
    return 'IGNORED';
  end if;

  if v_event.payment_id is null then
    select *
    into v_event
    from public.payment_events pe
    where pe.id = p_event_id
    for update;

    if v_event.processing_status = 'RECEIVED' then
      update public.payment_events
      set
        processing_status = 'IGNORED',
        processed_at = transaction_timestamp()
      where id = p_event_id;
    end if;

    return 'IGNORED';
  end if;

  select o.*
  into strict v_order
  from public.orders o
  join public.payments p
    on p.order_id = o.id
  where p.id = v_event.payment_id
  for update of o;

  select *
  into strict v_payment
  from public.payments p
  where p.id = v_event.payment_id
  for update;

  select *
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

    if v_order.order_contract_version = 2 then
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
    end if;

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

    if v_order.status = 'PAYMENT_PENDING' then
      update public.orders
      set
        payment_status = 'CAPTURED',
        status = 'WAITING_FOR_MERCHANT',
        placed_at = coalesce(placed_at, v_occurred_at),
        updated_at = transaction_timestamp()
      where id = v_order.id;

      insert into public.order_status_history (
        order_id,
        previous_status,
        new_status,
        changed_by_role,
        reason_code
      )
      values (
        v_order.id,
        'PAYMENT_PENDING',
        'WAITING_FOR_MERCHANT',
        'SYSTEM',
        'PAYMENT_CAPTURED'
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

      if v_order.status = 'PAYMENT_PENDING' then
        update public.orders
        set
          payment_status = 'FAILED',
          status = 'CANCELLED',
          cancellation_reason_code = v_event.event_type,
          cancelled_at = transaction_timestamp(),
          updated_at = transaction_timestamp()
        where id = v_order.id;

        insert into public.order_status_history (
          order_id,
          previous_status,
          new_status,
          changed_by_role,
          reason_code
        )
        values (
          v_order.id,
          'PAYMENT_PENDING',
          'CANCELLED',
          'SYSTEM',
          v_event.event_type
        );
      end if;

      if v_order.order_contract_version = 2 then
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
      else
        for v_reservation in
          select ir.id
          from public.inventory_reservations ir
          where ir.order_id = v_order.id
            and ir.status = 'ACTIVE'
          order by ir.id
        loop
          perform private.release_inventory_reservation(
            v_reservation.id,
            'RELEASED',
            v_event.event_type,
            null
          );
        end loop;
      end if;
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

-- Generic inventory expiry must not race payment processing for Phase 2D
-- payment-pending orders. Those orders are expired by the order-aware worker
-- below, which locks order -> payment -> reservations.
create or replace function private.expire_branch_inventory_reservations(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation_id uuid;
  v_expired_count integer := 0;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'BRANCH_RESERVATION_EXPIRY_LIMIT_INVALID'
      using errcode = '22023';
  end if;

  for v_reservation_id in
    select bir.id
    from public.branch_inventory_reservations bir
    left join public.orders o
      on o.id = bir.order_id
    where bir.status = 'ACTIVE'
      and bir.expires_at <= now()
      and not coalesce(
        o.order_contract_version = 2
        and o.status = 'PAYMENT_PENDING',
        false
      )
    order by bir.expires_at, bir.id
    for update of bir skip locked
    limit p_limit
  loop
    perform private.release_branch_inventory_reservation(
      v_reservation_id,
      'EXPIRED',
      'Reservation TTL expired',
      null
    );

    v_expired_count := v_expired_count + 1;
  end loop;

  return v_expired_count;
end;
$$;

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
      status = 'CANCELLED',
      cancellation_reason_code = 'PAYMENT_SESSION_EXPIRED',
      cancelled_at = transaction_timestamp(),
      updated_at = transaction_timestamp()
    where id = v_order.id
      and status = 'PAYMENT_PENDING';

    insert into public.order_status_history (
      order_id,
      previous_status,
      new_status,
      changed_by_role,
      reason_code
    )
    values (
      v_order.id,
      'PAYMENT_PENDING',
      'CANCELLED',
      'SYSTEM',
      'PAYMENT_SESSION_EXPIRED'
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

comment on function public.place_customer_cod_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
) is
  'Atomically revalidates a Phase 2D quote, creates immutable branch-aware order snapshots, converts branch inventory, and places a local COD order.';

comment on function public.prepare_customer_online_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
) is
  'Atomically revalidates a Phase 2D quote, creates a payment-pending order, and holds exact branch inventory before provider initialization.';

revoke all
on function private.create_branch_order_from_quote(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid,
  timestamptz
)
from public, anon, authenticated;

revoke all
on function public.expire_pending_branch_checkout_orders(integer)
from public, anon, authenticated;

grant execute
on function public.expire_pending_branch_checkout_orders(integer)
to service_role;
