alter table public.payments
  add column if not exists provider_reference_id text,
  add column if not exists provider_session_id text,
  add column if not exists provider_session_expires_at timestamptz;

alter table public.payments
  drop constraint if exists payments_provider_reference_nonempty,
  add constraint payments_provider_reference_nonempty check (
    provider_reference_id is null or length(btrim(provider_reference_id)) > 0
  ),
  drop constraint if exists payments_provider_session_nonempty,
  add constraint payments_provider_session_nonempty check (
    provider_session_id is null or length(btrim(provider_session_id)) > 0
  ),
  drop constraint if exists payments_provider_session_shape,
  add constraint payments_provider_session_shape check (
    (provider_session_id is null and provider_reference_id is null)
    or (provider_session_id is not null and provider_reference_id is not null)
  );

create unique index if not exists payments_provider_reference_id_idx
  on public.payments(provider, provider_reference_id)
  where provider_reference_id is not null;

create unique index if not exists payments_provider_session_id_idx
  on public.payments(provider_session_id)
  where provider_session_id is not null;

create table if not exists private.customer_online_payment_requests (
  customer_id uuid not null references public.customer_profiles(user_id),
  idempotency_key uuid not null,
  request_payload jsonb not null,
  order_id uuid references public.orders(id),
  payment_id uuid references public.payments(id),
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (customer_id, idempotency_key),
  constraint customer_online_payment_request_object check (
    jsonb_typeof(request_payload) = 'object'
  ),
  constraint customer_online_payment_result_object check (
    result_payload is null or jsonb_typeof(result_payload) = 'object'
  ),
  constraint customer_online_payment_completion_shape check (
    (order_id is null and payment_id is null and result_payload is null and completed_at is null)
    or
    (order_id is not null and payment_id is not null and result_payload is not null
      and completed_at is not null and completed_at >= created_at)
  )
);

revoke all on private.customer_online_payment_requests from public, anon, authenticated;
grant select, insert, update on private.customer_online_payment_requests to service_role;

create or replace function private.build_customer_online_payment_preparation(
  p_payment_id uuid,
  p_replayed boolean
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'orderId', o.id,
    'orderNumber', o.order_number,
    'paymentId', p.id,
    'providerOrderId', p.provider_order_id,
    'amountPaise', p.amount_paise,
    'currency', p.currency,
    'customerPhone', o.address_snapshot->>'phoneNumber',
    'paymentStatus', p.status,
    'providerReferenceId', p.provider_reference_id,
    'paymentSessionId', p.provider_session_id,
    'paymentSessionExpiresAt', p.provider_session_expires_at,
    'replayed', p_replayed
  )
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = p_payment_id
$$;

create or replace function private.build_customer_payment_checkout(
  p_payment_id uuid,
  p_replayed boolean
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select case when p.provider_session_id is null then null else jsonb_build_object(
    'orderId', o.id,
    'orderNumber', o.order_number,
    'paymentId', p.id,
    'provider', p.provider,
    'providerOrderId', p.provider_order_id,
    'providerReferenceId', p.provider_reference_id,
    'paymentSessionId', p.provider_session_id,
    'amountPaise', p.amount_paise,
    'currency', p.currency,
    'paymentStatus', p.status,
    'expiresAt', p.provider_session_expires_at,
    'replayed', p_replayed
  ) end
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = p_payment_id
$$;

revoke all on function private.build_customer_online_payment_preparation(uuid,boolean)
  from public, anon, authenticated;
revoke all on function private.build_customer_payment_checkout(uuid,boolean)
  from public, anon, authenticated;
grant execute on function private.build_customer_online_payment_preparation(uuid,boolean)
  to service_role;
grant execute on function private.build_customer_payment_checkout(uuid,boolean)
  to service_role;

create or replace function public.prepare_customer_online_payment(
  p_actor_id uuid,
  p_cart_id uuid,
  p_quote_id uuid,
  p_address_id uuid,
  p_customer_note text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.customer_online_payment_requests;
  v_quote public.checkout_quotes;
  v_cart public.carts;
  v_address public.addresses;
  v_shop public.shops;
  v_order public.orders;
  v_payment public.payments;
  v_reservation public.inventory_reservations;
  v_movement public.inventory_movements;
  v_balance public.inventory_balances;
  v_line record;
  v_request_payload jsonb;
  v_items jsonb;
  v_address_payload jsonb;
  v_shop_payload jsonb;
  v_cart_hash text;
  v_subtotal bigint;
  v_item_count integer;
  v_unavailable boolean;
  v_distance integer;
  v_order_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_provider_order_id text;
  v_note text;
  v_result jsonb;
begin
  if p_actor_id is null or p_cart_id is null or p_quote_id is null
    or p_address_id is null or p_idempotency_key is null then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  v_note := nullif(btrim(coalesce(p_customer_note, '')), '');
  if v_note is not null and length(v_note) > 500 then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  perform 1 from public.customer_profiles
  where user_id = p_actor_id for update;
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;

  v_request_payload := jsonb_build_object(
    'cartId', p_cart_id,
    'quoteId', p_quote_id,
    'addressId', p_address_id,
    'paymentMethod', 'ONLINE',
    'customerNote', v_note
  );
  insert into private.customer_online_payment_requests(
    customer_id, idempotency_key, request_payload
  ) values (p_actor_id, p_idempotency_key, v_request_payload)
  on conflict do nothing
  returning * into v_request;
  if not found then
    select * into strict v_request
    from private.customer_online_payment_requests
    where customer_id = p_actor_id and idempotency_key = p_idempotency_key
    for update;
    if v_request.request_payload <> v_request_payload then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;
    if v_request.payment_id is null then
      raise exception 'FINANCE_REQUEST_INCOMPLETE';
    end if;
    return private.build_customer_online_payment_preparation(v_request.payment_id, true);
  end if;

  select * into v_quote from public.checkout_quotes
  where id = p_quote_id and customer_id = p_actor_id
    and cart_id = p_cart_id and address_id = p_address_id
  for update;
  if not found or v_quote.expires_at <= statement_timestamp() then
    raise exception 'FINANCE_QUOTE_INVALID';
  end if;
  select * into v_cart from public.carts
  where id = p_cart_id and customer_id = p_actor_id
    and shop_id = v_quote.shop_id and status = 'ACTIVE'
  for update;
  if not found then raise exception 'FINANCE_QUOTE_INVALID'; end if;
  select * into v_address from public.addresses
  where id = p_address_id and user_id = p_actor_id;
  if not found then raise exception 'FINANCE_QUOTE_INVALID'; end if;
  select * into v_shop from public.shops
  where id = v_cart.shop_id and deleted_at is null;
  if not found or v_shop.verification_status <> 'VERIFIED'
    or v_shop.operational_status not in ('OPEN','BUSY')
    or not v_shop.accepts_online_orders then
    raise exception 'FINANCE_ORDER_NOT_PAYABLE';
  end if;
  v_distance := round(extensions.st_distance(v_shop.location, v_address.location))::integer;
  if v_distance > v_shop.service_radius_meters then
    raise exception 'FINANCE_QUOTE_INVALID';
  end if;

  perform 1 from public.cart_items
  where cart_id = v_cart.id order by id for update;
  if not found then raise exception 'FINANCE_QUOTE_INVALID'; end if;
  perform 1 from public.inventory_balances b
  join public.cart_items i on i.shop_id = b.shop_id and i.variant_id = b.variant_id
  where i.cart_id = v_cart.id order by b.id for update of b;

  select coalesce(jsonb_agg(jsonb_build_object(
      'cartItemId', i.id,
      'variantId', v.id,
      'productId', p.id,
      'productName', p.name,
      'sku', v.sku,
      'colourName', v.colour_name,
      'sizeLabel', v.size_label,
      'quantity', i.quantity,
      'previousUnitPricePaise', i.unit_price_snapshot_paise,
      'unitPricePaise', v.selling_price_paise,
      'priceChanged', i.unit_price_snapshot_paise <> v.selling_price_paise,
      'availableQuantity', greatest(coalesce(
        b.stock_on_hand - b.reserved_quantity - b.damaged_quantity, 0
      ) + coalesce(owned.quantity, 0), 0),
      'inventoryVersion', coalesce(b.version, 1),
      'lineTotalPaise', i.quantity::bigint * v.selling_price_paise
    ) order by i.added_at, i.id), '[]'::jsonb),
    count(*)::integer,
    coalesce(sum(i.quantity::bigint * v.selling_price_paise), 0),
    coalesce(bool_or(not (
      p.moderation_status = 'APPROVED' and p.is_active and p.deleted_at is null
      and v.is_active and b.id is not null
      and greatest(b.stock_on_hand - b.reserved_quantity - b.damaged_quantity
        + coalesce(owned.quantity, 0), 0) >= i.quantity
    )), false)
  into v_items, v_item_count, v_subtotal, v_unavailable
  from public.cart_items i
  join public.product_variants v on v.id = i.variant_id and v.shop_id = i.shop_id
  join public.products p on p.id = v.product_id and p.shop_id = v.shop_id
  left join public.inventory_balances b on b.shop_id = i.shop_id and b.variant_id = i.variant_id
  left join lateral (
    select sum(r.quantity)::bigint as quantity
    from public.inventory_reservations r
    where r.cart_id = i.cart_id and r.variant_id = i.variant_id
      and r.status = 'ACTIVE' and r.expires_at > statement_timestamp()
  ) owned on true
  where i.cart_id = v_cart.id;
  if v_item_count = 0 or v_unavailable then raise exception 'FINANCE_QUOTE_INVALID'; end if;
  v_cart_hash := encode(extensions.digest(v_items::text, 'sha256'), 'hex');
  v_address_payload := jsonb_build_object(
    'id', v_address.id, 'label', v_address.label,
    'recipientName', v_address.recipient_name, 'phoneNumber', v_address.phone_number,
    'line1', v_address.line1, 'line2', v_address.line2,
    'landmark', v_address.landmark, 'area', v_address.area,
    'city', v_address.city, 'state', v_address.state,
    'postalCode', v_address.postal_code, 'countryCode', v_address.country_code,
    'latitude', extensions.st_y(v_address.location::extensions.geometry),
    'longitude', extensions.st_x(v_address.location::extensions.geometry)
  );
  v_shop_payload := jsonb_build_object(
    'id', v_shop.id, 'name', v_shop.name, 'slug', v_shop.slug,
    'minimumOrderPaise', v_shop.minimum_order_paise,
    'averagePreparationMinutes', v_shop.average_preparation_minutes,
    'distanceMeters', v_distance, 'serviceRadiusMeters', v_shop.service_radius_meters
  );
  if v_cart_hash <> v_quote.cart_snapshot_hash
    or v_quote.payload->'address' <> v_address_payload
    or v_quote.payload->'shop' <> v_shop_payload
    or v_quote.subtotal_paise <> v_subtotal
    or v_quote.total_paise <> v_subtotal then
    raise exception 'FINANCE_QUOTE_INVALID';
  end if;

  insert into public.orders(
    id, order_number, idempotency_key, customer_id, shop_id, cart_id,
    checkout_quote_id, delivery_address_id, address_snapshot, status,
    payment_status, fulfilment_type, subtotal_paise, product_discount_paise,
    coupon_discount_paise, delivery_fee_paise, platform_fee_paise, tax_paise,
    total_paise, estimated_delivery_at, customer_note
  ) values (
    v_order_id, 'VAS-' || upper(replace(v_order_id::text, '-', '')),
    p_idempotency_key::text, p_actor_id, v_cart.shop_id, v_cart.id,
    v_quote.id, v_address.id, v_address_payload, 'PAYMENT_PENDING', 'PENDING',
    'DELIVERY', v_quote.subtotal_paise, v_quote.product_discount_paise,
    v_quote.coupon_discount_paise, v_quote.delivery_fee_paise,
    v_quote.platform_fee_paise, v_quote.tax_paise, v_quote.total_paise,
    v_quote.estimated_delivery_at, v_note
  ) returning * into v_order;

  insert into public.order_items(
    order_id, shop_id, product_id, variant_id, product_name_snapshot,
    sku_snapshot, colour_snapshot, size_snapshot, image_object_key_snapshot,
    quantity, unit_mrp_paise, unit_selling_price_paise, discount_paise, total_paise
  )
  select v_order.id, i.shop_id, p.id, v.id, p.name, v.sku, v.colour_name,
    v.size_label, image.image_object_key, i.quantity, v.mrp_paise,
    v.selling_price_paise, 0, i.quantity::bigint * v.selling_price_paise
  from public.cart_items i
  join public.product_variants v on v.id = i.variant_id and v.shop_id = i.shop_id
  join public.products p on p.id = v.product_id and p.shop_id = v.shop_id
  left join lateral (
    select coalesce(pi.thumbnail_object_key, pi.storage_object_key) as image_object_key
    from public.product_images pi
    where pi.product_id = p.id and (pi.variant_id = v.id or pi.variant_id is null)
    order by (pi.variant_id = v.id) desc, pi.is_primary desc, pi.display_order, pi.id
    limit 1
  ) image on true
  where i.cart_id = v_cart.id order by i.added_at, i.id;

  for v_line in select id from public.inventory_reservations
    where cart_id = v_cart.id and status = 'ACTIVE'
    order by created_at, id for update
  loop
    perform public.release_customer_cart_reservation(
      v_line.id, 'Cart reservation replaced by online payment reservation', p_actor_id
    );
  end loop;
  for v_line in select variant_id, quantity from public.cart_items
    where cart_id = v_cart.id order by variant_id
  loop
    select * into strict v_reservation from private.reserve_inventory(
      v_cart.shop_id, v_line.variant_id, v_line.quantity,
      statement_timestamp() + interval '15 minutes', null, v_order.id, p_actor_id
    );
    select * into strict v_movement from public.inventory_movements
    where reference_type = 'INVENTORY_RESERVATION'
      and reference_id = v_reservation.id and movement_type = 'ONLINE_ORDER_RESERVED';
    select * into strict v_balance from public.inventory_balances
    where shop_id = v_reservation.shop_id and variant_id = v_reservation.variant_id;
    perform private.enqueue_outbox_event(
      'inventory.balance.changed', 'PRODUCT_VARIANT', v_reservation.variant_id,
      jsonb_build_object(
        'shopId', v_reservation.shop_id, 'variantId', v_reservation.variant_id,
        'reservationId', v_reservation.id, 'orderId', v_order.id,
        'movementId', v_movement.id::text, 'action', 'RESERVE_FOR_PAYMENT',
        'stockOnHand', v_balance.stock_on_hand,
        'reservedQuantity', v_balance.reserved_quantity,
        'damagedQuantity', v_balance.damaged_quantity,
        'availableQuantity', v_balance.stock_on_hand - v_balance.reserved_quantity
          - v_balance.damaged_quantity, 'version', v_balance.version
      ), v_movement.created_at, v_movement.created_at
    );
  end loop;
  update public.carts set status = 'CONVERTED' where id = v_cart.id;

  v_provider_order_id := 'VASPAY' || upper(replace(v_payment_id::text, '-', ''));
  insert into public.payments(
    id, order_id, customer_id, idempotency_key, provider, provider_order_id,
    method, amount_paise, currency, status
  ) values (
    v_payment_id, v_order.id, p_actor_id, p_idempotency_key::text,
    'cashfree', v_provider_order_id, 'OTHER', v_order.total_paise, 'INR', 'CREATED'
  ) returning * into v_payment;

  v_result := private.build_customer_online_payment_preparation(v_payment.id, false);
  update private.customer_online_payment_requests
  set order_id = v_order.id, payment_id = v_payment.id,
      result_payload = v_result, completed_at = transaction_timestamp()
  where customer_id = p_actor_id and idempotency_key = p_idempotency_key;
  perform private.enqueue_outbox_event(
    'payment.checkout.prepared', 'PAYMENT', v_payment.id,
    jsonb_build_object(
      'paymentId', v_payment.id, 'orderId', v_order.id,
      'provider', v_payment.provider, 'providerOrderId', v_provider_order_id,
      'amountPaise', v_payment.amount_paise, 'currency', v_payment.currency
    ), transaction_timestamp(), transaction_timestamp()
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
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_payment public.payments;
begin
  if p_actor_id is null or p_payment_id is null
    or nullif(btrim(p_provider_order_id), '') is null
    or nullif(btrim(p_provider_reference_id), '') is null
    or nullif(btrim(p_payment_session_id), '') is null then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  select order_id into v_order_id from public.payments where id = p_payment_id;
  if not found then raise exception 'FINANCE_PAYMENT_NOT_FOUND'; end if;
  perform 1 from public.orders
  where id = v_order_id and customer_id = p_actor_id for update;
  if not found then raise exception 'FINANCE_PAYMENT_NOT_FOUND'; end if;
  select * into strict v_payment from public.payments
  where id = p_payment_id and customer_id = p_actor_id for update;
  if v_payment.provider <> 'cashfree'
    or v_payment.provider_order_id <> btrim(p_provider_order_id)
    or v_payment.amount_paise <> p_amount_paise
    or v_payment.currency <> p_currency then
    raise exception 'FINANCE_PAYMENT_AMOUNT_MISMATCH';
  end if;
  if v_payment.status not in ('CREATED','PENDING') then
    raise exception 'FINANCE_PAYMENT_STATE_CONFLICT';
  end if;
  if v_payment.provider_session_id is not null then
    if v_payment.provider_reference_id <> btrim(p_provider_reference_id)
      or v_payment.provider_session_id <> btrim(p_payment_session_id)
      or v_payment.provider_session_expires_at is distinct from p_expires_at then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;
    return private.build_customer_payment_checkout(v_payment.id, true);
  end if;
  update public.payments set
    provider_reference_id = btrim(p_provider_reference_id),
    provider_session_id = btrim(p_payment_session_id),
    provider_session_expires_at = p_expires_at,
    status = 'PENDING',
    updated_at = transaction_timestamp()
  where id = v_payment.id;
  perform private.enqueue_outbox_event(
    'payment.session.attached', 'PAYMENT', v_payment.id,
    jsonb_build_object(
      'paymentId', v_payment.id, 'orderId', v_order_id,
      'providerOrderId', p_provider_order_id,
      'providerReferenceId', p_provider_reference_id
    ), transaction_timestamp(), transaction_timestamp()
  );
  return private.build_customer_payment_checkout(v_payment.id, false);
end;
$$;

create or replace function public.get_customer_latest_payment_session(
  p_actor_id uuid,
  p_order_id uuid
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select private.build_customer_payment_checkout(p.id, true)
  from public.payments p
  join public.orders o on o.id = p.order_id
  where o.id = p_order_id and o.customer_id = p_actor_id
    and p.provider_session_id is not null
  order by p.created_at desc, p.id desc limit 1
$$;

revoke all on function public.prepare_customer_online_payment(uuid,uuid,uuid,uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.attach_customer_payment_session(uuid,uuid,text,text,text,bigint,text,timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_customer_latest_payment_session(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_customer_online_payment(uuid,uuid,uuid,uuid,text,uuid)
  to service_role;
grant execute on function public.attach_customer_payment_session(uuid,uuid,text,text,text,bigint,text,timestamptz)
  to service_role;
grant execute on function public.get_customer_latest_payment_session(uuid,uuid)
  to service_role;
