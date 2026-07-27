begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select has_table(
  'private',
  'customer_order_cancellation_requests',
  'customer cancellation idempotency receipts exist'
);
select ok(
  to_regprocedure('public.cancel_customer_order(uuid,uuid,uuid)') is not null,
  'customer cancellation RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.cancel_customer_order(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'clients cannot bypass the backend cancellation boundary'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.cancel_customer_order(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'service role can execute customer cancellation'
);
select ok(
  pg_get_functiondef(
    'public.cancel_customer_order(uuid,uuid,uuid)'::regprocedure
  ) like '%private.release_order_inventory_reservations%',
  'customer cancellation releases order-linked inventory'
);
select ok(
  pg_get_functiondef(
    'public.cancel_customer_order(uuid,uuid,uuid)'::regprocedure
  ) like '%private.finish_merchant_alert%',
  'customer cancellation stops the merchant ringing alert'
);
select ok(
  pg_get_functiondef(
    'private.prepare_order_cancellation_refund(uuid,uuid,text)'::regprocedure
  ) like '%insert into public.refunds%',
  'captured payments create a durable refund'
);
select ok(
  pg_get_functiondef(
    'public.reject_merchant_order(uuid,uuid,text,uuid,text)'::regprocedure
  ) like '%private.release_order_inventory_reservations%',
  'merchant rejection releases order-linked inventory'
);
select ok(
  pg_get_functiondef(
    'public.admin_cancel_order_operation(uuid,uuid,text,text,text,uuid)'::regprocedure
  ) like '%private.release_order_inventory_reservations%',
  'admin cancellation releases order-linked inventory'
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
) values
  (
    'c1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'cancel-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'cancel-customer@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, account_type, full_name, status)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Cancellation Merchant',
    'ACTIVE'
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Cancellation Customer',
    'ACTIVE'
  );

insert into public.merchant_profiles (user_id, legal_name)
values (
  'c1000000-0000-4000-8000-000000000001',
  'Cancellation Merchant Legal'
);

insert into public.customer_profiles (user_id)
values ('c1000000-0000-4000-8000-000000000002');

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
) values
  (
    'c2000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'Shop',
    'Cancellation Merchant',
    '9000000201',
    'Cancellation Shop Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000002',
    'Home',
    'Cancellation Customer',
    '9000000202',
    'Cancellation Customer Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517502',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
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
) values (
  'c3000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'CANCEL_TEST_SHOP',
  'Cancellation Test Shop',
  'cancellation-test-shop',
  '9000000211',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  'VERIFIED',
  'OPEN',
  true
);

insert into public.products (
  id,
  shop_id,
  category_id,
  name,
  slug,
  moderation_status,
  is_active
) values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Cancellation Test Kurta',
  'cancellation-test-kurta',
  'APPROVED',
  true
);

insert into public.product_variants (
  id,
  product_id,
  shop_id,
  sku,
  size_label,
  mrp_paise,
  selling_price_paise,
  is_active
) values (
  'c5000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'CANCEL-KURTA-M',
  'M',
  10000,
  10000,
  true
);

select private.apply_inventory_delta(
  'c3000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  2,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'CANCELLATION_TEST',
  null,
  'Cancellation fixture stock',
  null
);

insert into public.orders (
  id,
  order_number,
  idempotency_key,
  customer_id,
  shop_id,
  delivery_address_id,
  address_snapshot,
  status,
  payment_status,
  fulfilment_type,
  subtotal_paise,
  total_paise
) values
  (
    'c6000000-0000-4000-8000-000000000001',
    'VAS-CANCEL-COD',
    'cancel-cod-placement',
    'c1000000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000002',
    '{}'::jsonb,
    'PAYMENT_PENDING',
    'COD_PENDING',
    'DELIVERY',
    10000,
    10000
  ),
  (
    'c6000000-0000-4000-8000-000000000002',
    'VAS-CANCEL-PAID',
    'cancel-paid-placement',
    'c1000000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000002',
    '{}'::jsonb,
    'PAYMENT_PENDING',
    'CAPTURED',
    'DELIVERY',
    10000,
    10000
  );

select private.reserve_inventory(
  'c3000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  1,
  statement_timestamp() + interval '15 minutes',
  null,
  'c6000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002'
);

insert into public.payments (
  id,
  order_id,
  customer_id,
  idempotency_key,
  provider,
  provider_order_id,
  provider_payment_id,
  method,
  amount_paise,
  status,
  signature_verified,
  paid_at
) values (
  'c7000000-0000-4000-8000-000000000001',
  'c6000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000002',
  'cancel-paid-attempt',
  'cashfree',
  'CF-CANCEL-ORDER',
  'CF-CANCEL-PAYMENT',
  'CARD',
  10000,
  'CAPTURED',
  true,
  transaction_timestamp()
);

do $$
begin
  perform private.transition_order_state(
    'c6000000-0000-4000-8000-000000000001',
    'WAITING_FOR_MERCHANT',
    'c1000000-0000-4000-8000-000000000002',
    'CUSTOMER',
    null,
    'Cancellation fixture'
  );
  perform private.transition_order_state(
    'c6000000-0000-4000-8000-000000000002',
    'WAITING_FOR_MERCHANT',
    'c1000000-0000-4000-8000-000000000002',
    'CUSTOMER',
    null,
    'Cancellation fixture'
  );
end;
$$;

create temporary table cancellation_test_results (
  key text primary key,
  value jsonb not null
);

insert into cancellation_test_results (key, value)
values (
  'cod-cancel',
  public.cancel_customer_order(
    'c1000000-0000-4000-8000-000000000002',
    'c6000000-0000-4000-8000-000000000001',
    'c8000000-0000-4000-8000-000000000001'
  )
);

select is(
  (select value->>'status' from cancellation_test_results where key = 'cod-cancel'),
  'CANCELLED',
  'customer cancellation returns the cancelled state'
);
select is(
  (
    select status::text
    from public.inventory_reservations
    where order_id = 'c6000000-0000-4000-8000-000000000001'
  ),
  'RELEASED',
  'customer cancellation releases the order reservation'
);
select is(
  (
    select reserved_quantity::integer
    from public.inventory_balances
    where shop_id = 'c3000000-0000-4000-8000-000000000001'
      and variant_id = 'c5000000-0000-4000-8000-000000000001'
  ),
  0,
  'customer cancellation restores available inventory'
);
select is(
  (
    select alert_status::text
    from public.merchant_order_alerts
    where order_id = 'c6000000-0000-4000-8000-000000000001'
  ),
  'ACKNOWLEDGED',
  'customer cancellation terminates merchant alerting'
);
select is(
  (
    select count(*)::integer
    from public.order_status_history
    where order_id = 'c6000000-0000-4000-8000-000000000001'
      and previous_status = 'WAITING_FOR_MERCHANT'
      and new_status = 'CANCELLED'
      and changed_by_role = 'CUSTOMER'
  ),
  1,
  'customer cancellation appends lifecycle history'
);

insert into cancellation_test_results (key, value)
values (
  'cod-replay',
  public.cancel_customer_order(
    'c1000000-0000-4000-8000-000000000002',
    'c6000000-0000-4000-8000-000000000001',
    'c8000000-0000-4000-8000-000000000001'
  )
);

select is(
  (
    select (value->>'replayed')::boolean
    from cancellation_test_results
    where key = 'cod-replay'
  ),
  true,
  'identical customer cancellation safely replays'
);
select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where reference_id = (
      select id
      from public.inventory_reservations
      where order_id = 'c6000000-0000-4000-8000-000000000001'
    )
      and movement_type = 'ONLINE_ORDER_RELEASED'
  ),
  1,
  'idempotent replay does not release inventory twice'
);

select throws_ok(
  $$
    select public.cancel_customer_order(
      'c1000000-0000-4000-8000-000000000002',
      'c6000000-0000-4000-8000-000000000001',
      'c8000000-0000-4000-8000-000000000099'
    )
  $$,
  'P0035',
  'customer order already cancelled',
  'a new command cannot cancel an already cancelled order'
);

insert into cancellation_test_results (key, value)
values (
  'paid-cancel',
  public.cancel_customer_order(
    'c1000000-0000-4000-8000-000000000002',
    'c6000000-0000-4000-8000-000000000002',
    'c8000000-0000-4000-8000-000000000002'
  )
);

select is(
  (
    select value->>'refundStatus'
    from cancellation_test_results
    where key = 'paid-cancel'
  ),
  'INITIATED',
  'captured-payment cancellation starts refund processing'
);
select is(
  (
    select amount_paise::bigint
    from public.refunds
    where order_id = 'c6000000-0000-4000-8000-000000000002'
  ),
  10000::bigint,
  'captured-payment cancellation refunds the unrefunded payment amount'
);
select is(
  (
    select count(*)::integer
    from public.outbox_events
    where event_type = 'refund.initiated'
      and payload->>'orderId' = 'c6000000-0000-4000-8000-000000000002'
  ),
  1,
  'captured-payment cancellation emits one durable refund event'
);

select throws_ok(
  $$
    select public.apply_return_refund_result(
      'c1000000-0000-4000-8000-000000000001',
      (
        select id
        from public.refunds
        where order_id = 'c6000000-0000-4000-8000-000000000002'
      ),
      'CF-UNAUTHORIZED-REFUND',
      'SUCCESS',
      transaction_timestamp(),
      null
    )
  $$,
  'P0001',
  'FINANCE_ACCESS_DENIED',
  'an unrelated active account cannot apply another actor refund result'
);
select lives_ok(
  $$
    select public.apply_return_refund_result(
      'c1000000-0000-4000-8000-000000000002',
      (
        select id
        from public.refunds
        where order_id = 'c6000000-0000-4000-8000-000000000002'
      ),
      'CF-CANCEL-REFUND',
      'SUCCESS',
      transaction_timestamp(),
      null
    )
  $$,
  'automatic execution may apply a cancellation refund as its immutable initiating actor'
);
select is(
  (
    select status::text
    from public.refunds
    where order_id = 'c6000000-0000-4000-8000-000000000002'
  ),
  'COMPLETED',
  'automatic cancellation refund execution reaches a terminal state'
);
select is(
  (
    select payment_status::text
    from public.orders
    where id = 'c6000000-0000-4000-8000-000000000002'
  ),
  'REFUNDED',
  'successful automatic cancellation refund updates the order payment state'
);

select * from finish();
rollback;
