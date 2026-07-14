-- S5-01: atomic and idempotent customer COD order placement.
--
-- The trusted function validates a short-lived quote against current cart,
-- catalogue, address, shop, and inventory state. It then creates the order and
-- immutable item snapshots, replaces cart reservations with order reservations,
-- converts the cart, records lifecycle history, and writes outbox events in one
-- PostgreSQL transaction.

create table private.customer_order_requests (
  customer_id uuid not null,
  idempotency_key uuid not null,
  request_payload jsonb not null,
  order_id uuid,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint customer_order_requests_pkey
    primary key (customer_id, idempotency_key),

  constraint customer_order_requests_customer_id_fkey
    foreign key (customer_id)
    references public.customer_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint customer_order_requests_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint customer_order_requests_request_object
    check (jsonb_typeof(request_payload) = 'object'),

  constraint customer_order_requests_result_object
    check (
      result_payload is null
      or jsonb_typeof(result_payload) = 'object'
    ),

  constraint customer_order_requests_completion_shape
    check (
      (
        order_id is null
        and result_payload is null
        and completed_at is null
      )
      or (
        order_id is not null
        and result_payload is not null
        and completed_at is not null
        and completed_at >= created_at
      )
    )
);

comment on table private.customer_order_requests is
  'Backend-only idempotency receipts for atomic customer order placement.';

revoke all privileges
on table private.customer_order_requests
from public, anon, authenticated;

alter table public.orders
add column checkout_quote_id uuid;

alter table public.orders
add constraint orders_checkout_quote_id_fkey
foreign key (checkout_quote_id)
references public.checkout_quotes (id)
on update cascade
on delete restrict;

create unique index orders_one_per_cart_idx
on public.orders (cart_id)
where cart_id is not null;

create unique index orders_one_per_checkout_quote_idx
on public.orders (checkout_quote_id)
where checkout_quote_id is not null;

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
  order_row public.orders;
  shop_row public.shops;
  items_payload jsonb;
begin
  select *
  into strict order_row
  from public.orders placed_order
  where placed_order.id = p_order_id;

  select *
  into strict shop_row
  from public.shops shop
  where shop.id = order_row.shop_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'productId', item.product_id,
        'variantId', item.variant_id,
        'productName', item.product_name_snapshot,
        'sku', item.sku_snapshot,
        'colourName', item.colour_snapshot,
        'sizeLabel', item.size_snapshot,
        'imageObjectKey', item.image_object_key_snapshot,
        'quantity', item.quantity,
        'unitMrpPaise', item.unit_mrp_paise,
        'unitSellingPricePaise', item.unit_selling_price_paise,
        'discountPaise', item.discount_paise,
        'totalPaise', item.total_paise
      )
      order by item.created_at, item.id
    ),
    '[]'::jsonb
  )
  into items_payload
  from public.order_items item
  where item.order_id = order_row.id;

  return jsonb_build_object(
    'id', order_row.id,
    'orderNumber', order_row.order_number,
    'cartId', order_row.cart_id,
    'quoteId', order_row.checkout_quote_id,
    'shop',
      jsonb_build_object(
        'id', shop_row.id,
        'name', shop_row.name,
        'slug', shop_row.slug
      ),
    'address', order_row.address_snapshot,
    'status', order_row.status,
    'paymentStatus', order_row.payment_status,
    'paymentMethod', 'COD',
    'fulfilmentType', order_row.fulfilment_type,
    'items', items_payload,
    'totals',
      jsonb_build_object(
        'subtotalPaise', order_row.subtotal_paise,
        'productDiscountPaise', order_row.product_discount_paise,
        'couponDiscountPaise', order_row.coupon_discount_paise,
        'deliveryFeePaise', order_row.delivery_fee_paise,
        'platformFeePaise', order_row.platform_fee_paise,
        'taxPaise', order_row.tax_paise,
        'totalPaise', order_row.total_paise
      ),
    'estimatedDeliveryAt', order_row.estimated_delivery_at,
    'customerNote', order_row.customer_note,
    'placedAt', order_row.placed_at,
    'replayed', p_replayed
  );
end;
$$;

revoke all
on function private.build_customer_cod_order_payload(uuid, boolean)
from public, anon, authenticated;

grant execute
on function private.build_customer_cod_order_payload(uuid, boolean)
to service_role;

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
  actor_id uuid := p_actor;
  normalized_note text;
  request_payload jsonb;
  request_row private.customer_order_requests;
  quote_row public.checkout_quotes;
  cart_row public.carts;
  address_row public.addresses;
  shop_row public.shops;
  order_row public.orders;
  line_row record;
  reservation_row public.inventory_reservations;
  movement_row public.inventory_movements;
  balance_row public.inventory_balances;
  current_items_payload jsonb;
  current_address_payload jsonb;
  current_shop_payload jsonb;
  current_cart_hash text;
  item_rows integer;
  current_subtotal_paise bigint;
  has_unavailable_items boolean;
  distance_meters integer;
  order_id uuid := gen_random_uuid();
  response_payload jsonb;
begin
  if actor_id is null
    or p_cart_id is null
    or p_quote_id is null
    or p_address_id is null
    or p_idempotency_key is null
  then
    raise exception 'actor, cart, quote, address, and idempotency key are required'
      using errcode = '22023';
  end if;

  normalized_note := nullif(btrim(coalesce(p_customer_note, '')), '');

  if normalized_note is not null and length(normalized_note) > 500 then
    raise exception 'customer note must not exceed 500 characters'
      using errcode = '22023';
  end if;

  perform 1
  from public.customer_profiles customer
  where customer.user_id = actor_id
  for update;

  if not found then
    raise exception 'customer profile not found'
      using errcode = '42501';
  end if;

  request_payload := jsonb_build_object(
    'cartId', p_cart_id,
    'quoteId', p_quote_id,
    'addressId', p_address_id,
    'paymentMethod', 'COD',
    'customerNote', normalized_note
  );

  insert into private.customer_order_requests (
    customer_id,
    idempotency_key,
    request_payload
  )
  values (
    actor_id,
    p_idempotency_key,
    request_payload
  )
  on conflict (customer_id, idempotency_key) do nothing
  returning * into request_row;

  if not found then
    select *
    into strict request_row
    from private.customer_order_requests request
    where request.customer_id = actor_id
      and request.idempotency_key = p_idempotency_key
    for update;

    if request_row.request_payload <> request_payload then
      raise exception 'idempotency key reused with a different order request'
        using errcode = 'P0010';
    end if;

    if request_row.result_payload is null then
      raise exception 'customer order idempotency receipt is incomplete'
        using errcode = '55000';
    end if;

    return jsonb_set(
      request_row.result_payload,
      '{replayed}',
      to_jsonb(true),
      true
    );
  end if;

  select *
  into quote_row
  from public.checkout_quotes quote
  where quote.id = p_quote_id
    and quote.customer_id = actor_id
    and quote.cart_id = p_cart_id
    and quote.address_id = p_address_id
  for update;

  if not found then
    raise exception 'checkout quote not found'
      using errcode = 'P0011';
  end if;

  if quote_row.expires_at <= statement_timestamp() then
    raise exception 'checkout quote has expired'
      using errcode = 'P0012';
  end if;

  select *
  into cart_row
  from public.carts cart
  where cart.id = p_cart_id
    and cart.customer_id = actor_id
    and cart.shop_id = quote_row.shop_id
    and cart.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'active customer cart not found'
      using errcode = 'P0002';
  end if;

  select *
  into address_row
  from public.addresses address
  where address.id = p_address_id
    and address.user_id = actor_id;

  if not found then
    raise exception 'customer address not found'
      using errcode = 'P0011';
  end if;

  select *
  into shop_row
  from public.shops shop
  where shop.id = cart_row.shop_id
    and shop.deleted_at is null;

  if not found
    or shop_row.verification_status <> 'VERIFIED'
    or shop_row.operational_status not in ('OPEN', 'BUSY')
    or not shop_row.accepts_online_orders
  then
    raise exception 'shop is not accepting orders'
      using errcode = 'P0007';
  end if;

  distance_meters := round(
    extensions.st_distance(
      shop_row.location,
      address_row.location
    )
  )::integer;

  if distance_meters > shop_row.service_radius_meters then
    raise exception 'address is outside the shop service area'
      using errcode = 'P0008';
  end if;

  perform 1
  from public.cart_items item
  where item.cart_id = cart_row.id
  order by item.id
  for update;

  if not found then
    raise exception 'active customer cart not found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.inventory_balances balance
  join public.cart_items item
    on item.shop_id = balance.shop_id
   and item.variant_id = balance.variant_id
  where item.cart_id = cart_row.id
  order by balance.id
  for update of balance;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'cartItemId', item.id,
          'variantId', variant.id,
          'productId', product.id,
          'productName', product.name,
          'sku', variant.sku,
          'colourName', variant.colour_name,
          'sizeLabel', variant.size_label,
          'quantity', item.quantity,
          'previousUnitPricePaise',
            item.unit_price_snapshot_paise,
          'unitPricePaise', variant.selling_price_paise,
          'priceChanged',
            item.unit_price_snapshot_paise
              <> variant.selling_price_paise,
          'availableQuantity',
            greatest(
              coalesce(
                balance.stock_on_hand
                  - balance.reserved_quantity
                  - balance.damaged_quantity,
                0
              )
              + coalesce(owned_reservation.quantity, 0),
              0
            ),
          'inventoryVersion', coalesce(balance.version, 1),
          'lineTotalPaise',
            item.quantity::bigint
              * variant.selling_price_paise
        )
        order by item.added_at, item.id
      ),
      '[]'::jsonb
    ),
    count(*)::integer,
    coalesce(
      sum(
        item.quantity::bigint
          * variant.selling_price_paise
      ),
      0
    ),
    coalesce(
      bool_or(
        not (
          product.moderation_status = 'APPROVED'
          and product.is_active
          and product.deleted_at is null
          and variant.is_active
          and balance.id is not null
          and greatest(
            balance.stock_on_hand
              - balance.reserved_quantity
              - balance.damaged_quantity
              + coalesce(owned_reservation.quantity, 0),
            0
          ) >= item.quantity
        )
      ),
      false
    )
  into
    current_items_payload,
    item_rows,
    current_subtotal_paise,
    has_unavailable_items
  from public.cart_items item
  join public.product_variants variant
    on variant.id = item.variant_id
   and variant.shop_id = item.shop_id
  join public.products product
    on product.id = variant.product_id
   and product.shop_id = variant.shop_id
  left join public.inventory_balances balance
    on balance.shop_id = item.shop_id
   and balance.variant_id = item.variant_id
  left join lateral (
    select sum(reservation.quantity)::bigint as quantity
    from public.inventory_reservations reservation
    where reservation.cart_id = item.cart_id
      and reservation.variant_id = item.variant_id
      and reservation.status = 'ACTIVE'
      and reservation.expires_at > statement_timestamp()
  ) owned_reservation on true
  where item.cart_id = cart_row.id;

  if item_rows = 0 then
    raise exception 'active customer cart not found'
      using errcode = 'P0002';
  end if;

  if has_unavailable_items then
    raise exception 'one or more final item quantities are unavailable'
      using errcode = 'P0001';
  end if;

  current_cart_hash := encode(
    extensions.digest(current_items_payload::text, 'sha256'),
    'hex'
  );

  current_address_payload := jsonb_build_object(
    'id', address_row.id,
    'label', address_row.label,
    'recipientName', address_row.recipient_name,
    'phoneNumber', address_row.phone_number,
    'line1', address_row.line1,
    'line2', address_row.line2,
    'landmark', address_row.landmark,
    'area', address_row.area,
    'city', address_row.city,
    'state', address_row.state,
    'postalCode', address_row.postal_code,
    'countryCode', address_row.country_code,
    'latitude',
      extensions.st_y(
        address_row.location::extensions.geometry
      ),
    'longitude',
      extensions.st_x(
        address_row.location::extensions.geometry
      )
  );

  current_shop_payload := jsonb_build_object(
    'id', shop_row.id,
    'name', shop_row.name,
    'slug', shop_row.slug,
    'minimumOrderPaise', shop_row.minimum_order_paise,
    'averagePreparationMinutes',
      shop_row.average_preparation_minutes,
    'distanceMeters', distance_meters,
    'serviceRadiusMeters', shop_row.service_radius_meters
  );

  if current_cart_hash <> quote_row.cart_snapshot_hash
    or quote_row.payload->'address' <> current_address_payload
    or quote_row.payload->'shop' <> current_shop_payload
    or quote_row.subtotal_paise <> current_subtotal_paise
    or quote_row.product_discount_paise <> 0
    or quote_row.coupon_discount_paise <> 0
    or quote_row.delivery_fee_paise <> 0
    or quote_row.platform_fee_paise <> 0
    or quote_row.tax_paise <> 0
    or quote_row.total_paise <> current_subtotal_paise
  then
    raise exception 'checkout quote no longer matches current state'
      using errcode = 'P0013';
  end if;

  if current_subtotal_paise < shop_row.minimum_order_paise then
    raise exception 'checkout quote no longer matches current state'
      using errcode = 'P0013';
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
    estimated_delivery_at,
    customer_note
  )
  values (
    order_id,
    'VAS-' || upper(replace(order_id::text, '-', '')),
    p_idempotency_key::text,
    actor_id,
    cart_row.shop_id,
    cart_row.id,
    quote_row.id,
    address_row.id,
    current_address_payload,
    'PAYMENT_PENDING',
    'COD_PENDING',
    'DELIVERY',
    quote_row.subtotal_paise,
    quote_row.product_discount_paise,
    quote_row.coupon_discount_paise,
    quote_row.delivery_fee_paise,
    quote_row.platform_fee_paise,
    quote_row.tax_paise,
    quote_row.total_paise,
    quote_row.estimated_delivery_at,
    normalized_note
  )
  returning * into order_row;

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
    total_paise
  )
  select
    order_row.id,
    cart_item.shop_id,
    product.id,
    variant.id,
    product.name,
    variant.sku,
    variant.colour_name,
    variant.size_label,
    image.image_object_key,
    cart_item.quantity,
    variant.mrp_paise,
    variant.selling_price_paise,
    0,
    cart_item.quantity::bigint * variant.selling_price_paise
  from public.cart_items cart_item
  join public.product_variants variant
    on variant.id = cart_item.variant_id
   and variant.shop_id = cart_item.shop_id
  join public.products product
    on product.id = variant.product_id
   and product.shop_id = variant.shop_id
  left join lateral (
    select coalesce(
      product_image.thumbnail_object_key,
      product_image.storage_object_key
    ) as image_object_key
    from public.product_images product_image
    where product_image.product_id = product.id
      and (
        product_image.variant_id = variant.id
        or product_image.variant_id is null
      )
    order by
      (product_image.variant_id = variant.id) desc,
      product_image.is_primary desc,
      product_image.display_order,
      product_image.id
    limit 1
  ) image on true
  where cart_item.cart_id = cart_row.id
  order by cart_item.added_at, cart_item.id;

  for line_row in
    select reservation.id
    from public.inventory_reservations reservation
    where reservation.cart_id = cart_row.id
      and reservation.status = 'ACTIVE'
    order by reservation.created_at, reservation.id
    for update
  loop
    perform public.release_customer_cart_reservation(
      line_row.id,
      'Cart reservation replaced by COD order reservation',
      actor_id
    );
  end loop;

  for line_row in
    select item.variant_id, item.quantity
    from public.cart_items item
    where item.cart_id = cart_row.id
    order by item.variant_id
  loop
    select *
    into strict reservation_row
    from private.reserve_inventory(
      cart_row.shop_id,
      line_row.variant_id,
      line_row.quantity,
      statement_timestamp() + interval '15 minutes',
      null,
      order_row.id,
      actor_id
    );

    select *
    into strict movement_row
    from public.inventory_movements movement
    where movement.reference_type = 'INVENTORY_RESERVATION'
      and movement.reference_id = reservation_row.id
      and movement.movement_type = 'ONLINE_ORDER_RESERVED';

    select *
    into strict balance_row
    from public.inventory_balances balance
    where balance.shop_id = reservation_row.shop_id
      and balance.variant_id = reservation_row.variant_id;

    perform private.enqueue_outbox_event(
      'inventory.balance.changed',
      'PRODUCT_VARIANT',
      reservation_row.variant_id,
      jsonb_build_object(
        'shopId', reservation_row.shop_id,
        'variantId', reservation_row.variant_id,
        'reservationId', reservation_row.id,
        'orderId', reservation_row.order_id,
        'movementId', movement_row.id::text,
        'action', 'RESERVE_FOR_ORDER',
        'stockOnHand', balance_row.stock_on_hand,
        'reservedQuantity', balance_row.reserved_quantity,
        'damagedQuantity', balance_row.damaged_quantity,
        'availableQuantity',
          balance_row.stock_on_hand
          - balance_row.reserved_quantity
          - balance_row.damaged_quantity,
        'version', balance_row.version
      ),
      movement_row.created_at,
      movement_row.created_at
    );
  end loop;

  update public.carts cart
  set status = 'CONVERTED'
  where cart.id = cart_row.id;

  select *
  into strict order_row
  from private.transition_order_state(
    order_row.id,
    'WAITING_FOR_MERCHANT',
    actor_id,
    'CUSTOMER',
    null,
    'Customer placed a COD order'
  );

  perform private.enqueue_outbox_event(
    'order.placed',
    'ORDER',
    order_row.id,
    jsonb_build_object(
      'orderId', order_row.id,
      'orderNumber', order_row.order_number,
      'customerId', order_row.customer_id,
      'shopId', order_row.shop_id,
      'cartId', order_row.cart_id,
      'quoteId', order_row.checkout_quote_id,
      'status', order_row.status,
      'paymentMethod', 'COD',
      'paymentStatus', order_row.payment_status,
      'totalPaise', order_row.total_paise,
      'placedAt', order_row.placed_at
    ),
    order_row.placed_at,
    order_row.placed_at
  );

  response_payload := private.build_customer_cod_order_payload(
    order_row.id,
    false
  );

  update private.customer_order_requests request
  set
    order_id = order_row.id,
    result_payload = response_payload,
    completed_at = now()
  where request.customer_id = actor_id
    and request.idempotency_key = p_idempotency_key;

  return response_payload;
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
  'Atomically places one idempotent COD order from a current customer checkout quote.';

revoke all
on function public.place_customer_cod_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.place_customer_cod_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
to service_role;
