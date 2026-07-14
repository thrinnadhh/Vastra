begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(16);

select ok(
  to_regclass('public.merchant_order_alerts_one_per_order_idx') is not null,
  'merchant orders have at most one durable alert'
);

select ok(
  to_regprocedure('private.create_waiting_order_merchant_alert()') is not null,
  'waiting-order alert trigger function exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'create_waiting_order_merchant_alert'
      and not tgisinternal
  ),
  'orders create merchant alerts on the waiting transition'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.merchant_order_alerts',
    'SELECT'
  ),
  'authenticated merchants can read alert records through RLS'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.merchant_order_alerts',
    'SELECT'
  ),
  'anonymous users cannot read merchant alerts'
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
    'd1100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'merchant-alert-customer@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'd1100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'merchant-alert-owner@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'd1100000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'merchant-alert-other@example.test',
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
    'd1100000-0000-4000-8000-000000000001',
    'CUSTOMER',
    'Merchant Alert Customer',
    'ACTIVE'
  ),
  (
    'd1100000-0000-4000-8000-000000000002',
    'MERCHANT',
    'Merchant Alert Owner',
    'ACTIVE'
  ),
  (
    'd1100000-0000-4000-8000-000000000003',
    'MERCHANT',
    'Merchant Alert Other',
    'ACTIVE'
  );

insert into public.customer_profiles (user_id)
values ('d1100000-0000-4000-8000-000000000001');

insert into public.merchant_profiles (user_id, legal_name)
values
  (
    'd1100000-0000-4000-8000-000000000002',
    'Merchant Alert Owner Legal'
  ),
  (
    'd1100000-0000-4000-8000-000000000003',
    'Merchant Alert Other Legal'
  );

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
    'd1200000-0000-4000-8000-000000000001',
    'd1100000-0000-4000-8000-000000000001',
    'Home',
    'Merchant Alert Customer',
    '9000000101',
    'Customer Alert Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  ),
  (
    'd1200000-0000-4000-8000-000000000002',
    'd1100000-0000-4000-8000-000000000002',
    'Shop',
    'Merchant Alert Owner',
    '9000000102',
    'Owner Alert Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'd1200000-0000-4000-8000-000000000003',
    'd1100000-0000-4000-8000-000000000003',
    'Shop',
    'Merchant Alert Other',
    '9000000103',
    'Other Alert Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4210 13.6300)'::extensions.geography
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
  accepts_online_orders
)
values
  (
    'd1300000-0000-4000-8000-000000000001',
    'd1100000-0000-4000-8000-000000000002',
    'd1200000-0000-4000-8000-000000000002',
    'ALERT-OWNER',
    'Merchant Alert Owner Shop',
    'merchant-alert-owner-shop',
    '9000000104',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true
  ),
  (
    'd1300000-0000-4000-8000-000000000002',
    'd1100000-0000-4000-8000-000000000003',
    'd1200000-0000-4000-8000-000000000003',
    'ALERT-OTHER',
    'Merchant Alert Other Shop',
    'merchant-alert-other-shop',
    '9000000105',
    'SRID=4326;POINT(79.4210 13.6300)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true
  );

insert into public.carts (
  id,
  customer_id,
  shop_id,
  status
)
values (
  'd1400000-0000-4000-8000-000000000001',
  'd1100000-0000-4000-8000-000000000001',
  'd1300000-0000-4000-8000-000000000001',
  'CONVERTED'
);

insert into public.orders (
  id,
  order_number,
  idempotency_key,
  customer_id,
  shop_id,
  cart_id,
  delivery_address_id,
  address_snapshot,
  status,
  payment_status,
  fulfilment_type,
  total_paise
)
values (
  'd1500000-0000-4000-8000-000000000001',
  'MERCHANT-ALERT-ORDER',
  'merchant-alert-order-key',
  'd1100000-0000-4000-8000-000000000001',
  'd1300000-0000-4000-8000-000000000001',
  'd1400000-0000-4000-8000-000000000001',
  'd1200000-0000-4000-8000-000000000001',
  '{"id":"d1200000-0000-4000-8000-000000000001","label":"Home","recipientName":"Merchant Alert Customer","phoneNumber":"9000000101","line1":"Customer Alert Street","line2":null,"landmark":null,"area":"Tirupati","city":"Tirupati","state":"Andhra Pradesh","postalCode":"517501","countryCode":"IN","latitude":13.629,"longitude":79.42}'::jsonb,
  'PAYMENT_PENDING',
  'COD_PENDING',
  'DELIVERY',
  0
);

select is(
  (
    select (private.transition_order_state(
      'd1500000-0000-4000-8000-000000000001',
      'WAITING_FOR_MERCHANT',
      'd1100000-0000-4000-8000-000000000001',
      'CUSTOMER',
      null,
      'Customer placed a COD order'
    )).status::text
  ),
  'WAITING_FOR_MERCHANT',
  'order enters the merchant response state'
);

select is(
  (
    select count(*)::integer
    from public.merchant_order_alerts
    where order_id = 'd1500000-0000-4000-8000-000000000001'
  ),
  1,
  'waiting transition creates one durable alert'
);

select is(
  (
    select alert_status::text
    from public.merchant_order_alerts
    where order_id = 'd1500000-0000-4000-8000-000000000001'
  ),
  'PENDING',
  'new merchant alert starts pending'
);

select ok(
  (
    select expires_at > created_at
    from public.merchant_order_alerts
    where order_id = 'd1500000-0000-4000-8000-000000000001'
  ),
  'merchant response deadline is in the future'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events event
    join public.merchant_order_alerts alert
      on alert.id = event.aggregate_id
    where alert.order_id = 'd1500000-0000-4000-8000-000000000001'
      and event.event_type = 'merchant.order.alert.created'
      and event.aggregate_type = 'MERCHANT_ORDER_ALERT'
  ),
  1,
  'alert-created event is written transactionally'
);

select is(
  (
    select (private.transition_order_state(
      'd1500000-0000-4000-8000-000000000001',
      'WAITING_FOR_MERCHANT',
      'd1100000-0000-4000-8000-000000000001',
      'CUSTOMER',
      null,
      'Repeated transition request'
    )).status::text
  ),
  'WAITING_FOR_MERCHANT',
  'repeating the current state is harmless'
);

select is(
  (
    select count(*)::integer
    from public.merchant_order_alerts
    where order_id = 'd1500000-0000-4000-8000-000000000001'
  ),
  1,
  'repeated state requests do not duplicate the alert'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'd1100000-0000-4000-8000-000000000002',
  true
);

select is(
  (
    select count(*)::integer
    from public.orders
    where id = 'd1500000-0000-4000-8000-000000000001'
  ),
  1,
  'owning merchant can read the incoming order'
);

select is(
  (
    select count(*)::integer
    from public.merchant_order_alerts
    where order_id = 'd1500000-0000-4000-8000-000000000001'
  ),
  1,
  'owning merchant can read the durable alert'
);

select set_config(
  'request.jwt.claim.sub',
  'd1100000-0000-4000-8000-000000000003',
  true
);

select is(
  (
    select count(*)::integer
    from public.orders
    where id = 'd1500000-0000-4000-8000-000000000001'
  ),
  0,
  'unrelated merchant cannot read another shop order'
);

select is(
  (
    select count(*)::integer
    from public.merchant_order_alerts
    where order_id = 'd1500000-0000-4000-8000-000000000001'
  ),
  0,
  'unrelated merchant cannot read another shop alert'
);

select * from finish();

rollback;
