begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(39);

select has_function(
  'public',
  'place_customer_cod_order',
  array['uuid', 'uuid', 'uuid', 'uuid', 'text', 'uuid'],
  'trusted customer COD order placement RPC exists'
);

select function_privs_are(
  'public',
  'place_customer_cod_order',
  array['uuid', 'uuid', 'uuid', 'uuid', 'text', 'uuid'],
  'service_role',
  array['EXECUTE'],
  'service role can place customer COD orders'
);

select function_privs_are(
  'public',
  'place_customer_cod_order',
  array['uuid', 'uuid', 'uuid', 'uuid', 'text', 'uuid'],
  'authenticated',
  array[]::text[],
  'authenticated clients cannot directly execute order placement'
);

select has_table(
  'private',
  'customer_order_requests',
  'private order idempotency receipts exist'
);

select has_column(
  'public',
  'orders',
  'checkout_quote_id',
  'orders retain the source checkout quote'
);

select has_index(
  'public',
  'orders',
  'orders_one_per_cart_idx',
  'one order may be created from a cart'
);

select has_index(
  'public',
  'orders',
  'orders_one_per_checkout_quote_idx',
  'one order may be created from a quote'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'cod-order-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'cod-order-customer-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'cod-order-customer-two@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (
  id,
  account_type,
  full_name,
  status
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'MERCHANT',
    'COD Order Merchant',
    'ACTIVE'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'COD Order Customer One',
    'ACTIVE'
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'CUSTOMER',
    'COD Order Customer Two',
    'ACTIVE'
  );

insert into public.merchant_profiles (user_id, legal_name)
values (
  'b1000000-0000-4000-8000-000000000001',
  'COD Order Merchant Legal'
);

insert into public.customer_profiles (user_id)
values
  ('b1000000-0000-4000-8000-000000000002'),
  ('b1000000-0000-4000-8000-000000000003');

insert into public.addresses (
  id,
  user_id,
  label,
  recipient_name,
  phone_number,
  line1,
  area,
  city,
  state,
  postal_code,
  country_code,
  location
)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'Shop',
    'COD Merchant',
    '9000000101',
    'COD Shop Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'Home',
    'Customer One',
    '9000000102',
    'Customer One Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517502',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000003',
    'Home',
    'Customer Two',
    '9000000103',
    'Customer Two Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517503',
    'IN',
    'SRID=4326;POINT(79.4205 13.6295)'::extensions.geography
  );

insert into public.shops (
  id,
  merchant_id,
  address_id,
  shop_code,
  name,
  slug,
  phone_number,
  location,
  verification_status,
  operational_status,
  accepts_online_orders,
  service_radius_meters,
  minimum_order_paise,
  average_preparation_minutes
)
values (
  'b3000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'COD-ORDER-SHOP',
  'COD Order Shop',
  'cod-order-shop',
  '9000000111',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  'VERIFIED',
  'OPEN',
  true,
  5000,
  0,
  20
);

insert into public.products (
  id,
  shop_id,
  category_id,
  name,
  slug,
  moderation_status,
  is_active
)
values (
  'b4000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'COD Order Kurta',
  'cod-order-kurta',
  'APPROVED',
  true
);

insert into public.product_variants (
  id,
  product_id,
  shop_id,
  sku,
  colour_name,
  size_label,
  mrp_paise,
  selling_price_paise,
  is_active
)
values (
  'b5000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'COD-ORDER-KURTA-M',
  'Blue',
  'M',
  90000,
  75000,
  true
);

select private.apply_inventory_delta(
  'b3000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  5,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'COD_ORDER_TEST',
  null,
  'COD order fixture',
  null
);

insert into public.carts (
  id,
  customer_id,
  shop_id,
  status
)
values
  (
    'b6000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000001',
    'ACTIVE'
  ),
  (
    'b6000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000003',
    'b3000000-0000-4000-8000-000000000001',
    'ACTIVE'
  );

insert into public.cart_items (
  id,
  cart_id,
  shop_id,
  variant_id,
  quantity,
  unit_price_snapshot_paise
)
values
  (
    'b7000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    2,
    75000
  ),
  (
    'b7000000-0000-4000-8000-000000000002',
    'b6000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    1,
    75000
  );

create temporary table cod_order_test_state (
  key text primary key,
  value jsonb not null
);

insert into cod_order_test_state (key, value)
values (
  'quote-one',
  public.create_customer_checkout_quote(
    'b1000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000002'
  )
);

insert into cod_order_test_state (key, value)
select
  'order-one',
  public.place_customer_cod_order(
    'b1000000-0000-4000-8000-000000000002',
    'b6000000-0000-4000-8000-000000000001',
    (value->>'id')::uuid,
    'b2000000-0000-4000-8000-000000000002',
    '  Call on arrival  ',
    'b8000000-0000-4000-8000-000000000001'
  )
from cod_order_test_state
where key = 'quote-one';

select ok(
  ((select value->>'id' from cod_order_test_state where key = 'order-one'))::uuid is not null,
  'placement returns an order identifier'
);

select is(
  (select value->>'status' from cod_order_test_state where key = 'order-one'),
  'WAITING_FOR_MERCHANT',
  'COD order waits for merchant'
);

select is(
  (select value->>'paymentStatus' from cod_order_test_state where key = 'order-one'),
  'COD_PENDING',
  'COD payment starts pending collection'
);

select is(
  (select value->>'paymentMethod' from cod_order_test_state where key = 'order-one'),
  'COD',
  'response identifies COD payment'
);

select is(
  (select (value->>'replayed')::boolean from cod_order_test_state where key = 'order-one'),
  false,
  'first placement is not a replay'
);

select is(
  (
    select count(*)::integer
    from public.orders
    where customer_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  1,
  'one order header is created'
);

select is(
  (
    select checkout_quote_id::text
    from public.orders
    where customer_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  (select value->>'id' from cod_order_test_state where key = 'quote-one'),
  'order retains the quote identifier'
);

select is(
  (
    select cart_id::text
    from public.orders
    where customer_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  'b6000000-0000-4000-8000-000000000001',
  'order retains the converted cart'
);

select is(
  (
    select status::text
    from public.carts
    where id = 'b6000000-0000-4000-8000-000000000001'
  ),
  'CONVERTED',
  'successful placement converts the cart'
);

select is(
  (
    select count(*)::integer
    from public.order_items item
    join public.orders placed_order
      on placed_order.id = item.order_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  1,
  'one immutable order item snapshot is created'
);

select is(
  (
    select item.quantity::integer
    from public.order_items item
    join public.orders placed_order
      on placed_order.id = item.order_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  2,
  'order item quantity matches the quote'
);

select is(
  (
    select item.unit_selling_price_paise::bigint
    from public.order_items item
    join public.orders placed_order
      on placed_order.id = item.order_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  75000::bigint,
  'order item keeps the current selling price'
);

select is(
  (
    select count(*)::integer
    from public.inventory_reservations reservation
    join public.orders placed_order
      on placed_order.id = reservation.order_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
      and reservation.status = 'ACTIVE'
  ),
  1,
  'order placement creates one active order reservation'
);

select is(
  (
    select reserved_quantity::integer
    from public.inventory_balances
    where shop_id = 'b3000000-0000-4000-8000-000000000001'
      and variant_id = 'b5000000-0000-4000-8000-000000000001'
  ),
  2,
  'order placement reserves the ordered quantity'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements movement
    join public.inventory_reservations reservation
      on reservation.id = movement.reference_id
    join public.orders placed_order
      on placed_order.id = reservation.order_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
      and movement.movement_type = 'ONLINE_ORDER_RESERVED'
  ),
  1,
  'order reservation writes one immutable inventory movement'
);

select is(
  (
    select count(*)::integer
    from public.order_status_history history
    join public.orders placed_order
      on placed_order.id = history.order_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
      and history.previous_status is null
      and history.new_status = 'PAYMENT_PENDING'
  ),
  1,
  'initial payment-pending state is recorded'
);

select is(
  (
    select count(*)::integer
    from public.order_status_history history
    join public.orders placed_order
      on placed_order.id = history.order_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
      and history.previous_status = 'PAYMENT_PENDING'
      and history.new_status = 'WAITING_FOR_MERCHANT'
  ),
  1,
  'customer placement transition is recorded'
);

select is(
  (
    select count(*)::integer
    from public.order_status_history history
    join public.orders placed_order
      on placed_order.id = history.order_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  2,
  'every placement state has history'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events event
    join public.orders placed_order
      on placed_order.id = event.aggregate_id
    where placed_order.customer_id = 'b1000000-0000-4000-8000-000000000002'
      and event.event_type = 'order.placed'
  ),
  1,
  'order placement writes one transactional outbox event'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events event
    where event.event_type = 'inventory.balance.changed'
      and event.payload->>'orderId' = (
        select value->>'id'
        from cod_order_test_state
        where key = 'order-one'
      )
  ),
  1,
  'order reservation writes an inventory outbox event'
);

select is(
  (
    select count(*)::integer
    from private.customer_order_requests request
    where request.customer_id = 'b1000000-0000-4000-8000-000000000002'
      and request.idempotency_key = 'b8000000-0000-4000-8000-000000000001'
      and request.order_id is not null
      and request.result_payload is not null
      and request.completed_at is not null
  ),
  1,
  'completed placement stores an idempotency receipt'
);

insert into cod_order_test_state (key, value)
select
  'order-replay',
  public.place_customer_cod_order(
    'b1000000-0000-4000-8000-000000000002',
    'b6000000-0000-4000-8000-000000000001',
    (select value->>'id' from cod_order_test_state where key = 'quote-one')::uuid,
    'b2000000-0000-4000-8000-000000000002',
    'Call on arrival',
    'b8000000-0000-4000-8000-000000000001'
  )
from cod_order_test_state
where key = 'order-one';

select is(
  (select value->>'id' from cod_order_test_state where key = 'order-replay'),
  (select value->>'id' from cod_order_test_state where key = 'order-one'),
  'identical idempotent replay returns the same order'
);

select is(
  (select (value->>'replayed')::boolean from cod_order_test_state where key = 'order-replay'),
  true,
  'identical replay is marked as replayed'
);

select is(
  (
    select count(*)::integer
    from public.orders
    where customer_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  1,
  'idempotent replay creates no duplicate order'
);

select throws_ok(
  (
    select format(
      $f$select public.place_customer_cod_order(
        'b1000000-0000-4000-8000-000000000002',
        'b6000000-0000-4000-8000-000000000001',
        %L::uuid,
        'b2000000-0000-4000-8000-000000000002',
        'Different note',
        'b8000000-0000-4000-8000-000000000001'
      )$f$,
      value->>'id'
    )
    from cod_order_test_state
    where key = 'quote-one'
  ),
  'P0010',
  'idempotency key reused with a different order request',
  'same key with another payload is rejected'
);

select throws_ok(
  $$
    select public.place_customer_cod_order(
      'b1000000-0000-4000-8000-000000000003',
      'b6000000-0000-4000-8000-000000000002',
      'b9000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000003',
      null,
      'b8000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0011',
  'checkout quote not found',
  'missing checkout quote is rejected'
);

insert into cod_order_test_state (key, value)
values (
  'quote-expired',
  public.create_customer_checkout_quote(
    'b1000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000003'
  )
);

update public.checkout_quotes quote
set
  created_at = statement_timestamp() - interval '10 minutes',
  expires_at = statement_timestamp() - interval '5 minutes'
where quote.id = (
  select (value->>'id')::uuid
  from cod_order_test_state
  where key = 'quote-expired'
);

select throws_ok(
  (
    select format(
      $f$select public.place_customer_cod_order(
        'b1000000-0000-4000-8000-000000000003',
        'b6000000-0000-4000-8000-000000000002',
        %L::uuid,
        'b2000000-0000-4000-8000-000000000003',
        null,
        'b8000000-0000-4000-8000-000000000003'
      )$f$,
      value->>'id'
    )
    from cod_order_test_state
    where key = 'quote-expired'
  ),
  'P0012',
  'checkout quote has expired',
  'expired quote is rejected'
);

insert into cod_order_test_state (key, value)
values (
  'quote-stale',
  public.create_customer_checkout_quote(
    'b1000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000003'
  )
);

update public.product_variants
set selling_price_paise = 76000
where id = 'b5000000-0000-4000-8000-000000000001';

select throws_ok(
  (
    select format(
      $f$select public.place_customer_cod_order(
        'b1000000-0000-4000-8000-000000000003',
        'b6000000-0000-4000-8000-000000000002',
        %L::uuid,
        'b2000000-0000-4000-8000-000000000003',
        null,
        'b8000000-0000-4000-8000-000000000004'
      )$f$,
      value->>'id'
    )
    from cod_order_test_state
    where key = 'quote-stale'
  ),
  'P0013',
  'checkout quote no longer matches current state',
  'price change makes a quote stale'
);

update public.product_variants
set selling_price_paise = 75000
where id = 'b5000000-0000-4000-8000-000000000001';

insert into cod_order_test_state (key, value)
values (
  'quote-distance',
  public.create_customer_checkout_quote(
    'b1000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000003'
  )
);

update public.addresses
set location = 'SRID=4326;POINT(80.2707 13.0827)'::extensions.geography
where id = 'b2000000-0000-4000-8000-000000000003';

select throws_ok(
  (
    select format(
      $f$select public.place_customer_cod_order(
        'b1000000-0000-4000-8000-000000000003',
        'b6000000-0000-4000-8000-000000000002',
        %L::uuid,
        'b2000000-0000-4000-8000-000000000003',
        null,
        'b8000000-0000-4000-8000-000000000005'
      )$f$,
      value->>'id'
    )
    from cod_order_test_state
    where key = 'quote-distance'
  ),
  'P0008',
  'address is outside the shop service area',
  'address serviceability is revalidated'
);

update public.addresses
set location = 'SRID=4326;POINT(79.4205 13.6295)'::extensions.geography
where id = 'b2000000-0000-4000-8000-000000000003';

insert into cod_order_test_state (key, value)
values (
  'quote-shop',
  public.create_customer_checkout_quote(
    'b1000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000003'
  )
);

update public.shops
set operational_status = 'CLOSED_FOR_DAY'
where id = 'b3000000-0000-4000-8000-000000000001';

select throws_ok(
  (
    select format(
      $f$select public.place_customer_cod_order(
        'b1000000-0000-4000-8000-000000000003',
        'b6000000-0000-4000-8000-000000000002',
        %L::uuid,
        'b2000000-0000-4000-8000-000000000003',
        null,
        'b8000000-0000-4000-8000-000000000006'
      )$f$,
      value->>'id'
    )
    from cod_order_test_state
    where key = 'quote-shop'
  ),
  'P0007',
  'shop is not accepting orders',
  'shop readiness is revalidated'
);

update public.shops
set operational_status = 'OPEN'
where id = 'b3000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000002',
  true
);

select is(
  (
    select count(*)::integer
    from public.orders
  ),
  1,
  'customer can read the owned order'
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000003',
  true
);

select is(
  (
    select count(*)::integer
    from public.orders
  ),
  0,
  'another customer cannot read the order'
);

reset role;

select * from finish();

rollback;
