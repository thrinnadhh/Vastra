begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(24);

select ok(
  to_regprocedure('public.acknowledge_merchant_order_alert(uuid,uuid)') is not null,
  'merchant alert acknowledgement function exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.acknowledge_merchant_order_alert(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the trusted acknowledgement function directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.acknowledge_merchant_order_alert(uuid,uuid)',
    'EXECUTE'
  ),
  'backend service role can acknowledge merchant alerts'
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
    'e1100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'alert-ack-customer@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'e1100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'alert-ack-owner@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'e1100000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'alert-ack-other@example.test',
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
    'e1100000-0000-4000-8000-000000000001',
    'CUSTOMER',
    'Alert Ack Customer',
    'ACTIVE'
  ),
  (
    'e1100000-0000-4000-8000-000000000002',
    'MERCHANT',
    'Alert Ack Owner',
    'ACTIVE'
  ),
  (
    'e1100000-0000-4000-8000-000000000003',
    'MERCHANT',
    'Alert Ack Other',
    'ACTIVE'
  );

insert into public.customer_profiles (user_id)
values ('e1100000-0000-4000-8000-000000000001');

insert into public.merchant_profiles (user_id, legal_name)
values
  (
    'e1100000-0000-4000-8000-000000000002',
    'Alert Ack Owner Legal'
  ),
  (
    'e1100000-0000-4000-8000-000000000003',
    'Alert Ack Other Legal'
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
    'e1200000-0000-4000-8000-000000000001',
    'e1100000-0000-4000-8000-000000000001',
    'Home',
    'Alert Ack Customer',
    '9000000201',
    'Customer Ack Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  ),
  (
    'e1200000-0000-4000-8000-000000000002',
    'e1100000-0000-4000-8000-000000000002',
    'Shop',
    'Alert Ack Owner',
    '9000000202',
    'Owner Ack Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'e1200000-0000-4000-8000-000000000003',
    'e1100000-0000-4000-8000-000000000003',
    'Shop',
    'Alert Ack Other',
    '9000000203',
    'Other Ack Street',
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
    'e1300000-0000-4000-8000-000000000001',
    'e1100000-0000-4000-8000-000000000002',
    'e1200000-0000-4000-8000-000000000002',
    'ACK-OWNER',
    'Alert Ack Owner Shop',
    'alert-ack-owner-shop',
    '9000000204',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true
  ),
  (
    'e1300000-0000-4000-8000-000000000002',
    'e1100000-0000-4000-8000-000000000003',
    'e1200000-0000-4000-8000-000000000003',
    'ACK-OTHER',
    'Alert Ack Other Shop',
    'alert-ack-other-shop',
    '9000000205',
    'SRID=4326;POINT(79.4210 13.6300)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true
  );

insert into public.carts (id, customer_id, shop_id, status)
values
  (
    'e1400000-0000-4000-8000-000000000001',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    'CONVERTED'
  ),
  (
    'e1400000-0000-4000-8000-000000000002',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    'CONVERTED'
  ),
  (
    'e1400000-0000-4000-8000-000000000003',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
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
values
  (
    'e1500000-0000-4000-8000-000000000001',
    'ALERT-ACK-ORDER-ONE',
    'alert-ack-order-one-key',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    'e1400000-0000-4000-8000-000000000001',
    'e1200000-0000-4000-8000-000000000001',
    '{"id":"e1200000-0000-4000-8000-000000000001","label":"Home","recipientName":"Alert Ack Customer","phoneNumber":"9000000201","line1":"Customer Ack Street","line2":null,"landmark":null,"area":"Tirupati","city":"Tirupati","state":"Andhra Pradesh","postalCode":"517501","countryCode":"IN","latitude":13.629,"longitude":79.42}'::jsonb,
    'PAYMENT_PENDING',
    'COD_PENDING',
    'DELIVERY',
    0
  ),
  (
    'e1500000-0000-4000-8000-000000000002',
    'ALERT-ACK-ORDER-EXPIRED',
    'alert-ack-order-expired-key',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    'e1400000-0000-4000-8000-000000000002',
    'e1200000-0000-4000-8000-000000000001',
    '{"id":"e1200000-0000-4000-8000-000000000001","label":"Home","recipientName":"Alert Ack Customer","phoneNumber":"9000000201","line1":"Customer Ack Street","line2":null,"landmark":null,"area":"Tirupati","city":"Tirupati","state":"Andhra Pradesh","postalCode":"517501","countryCode":"IN","latitude":13.629,"longitude":79.42}'::jsonb,
    'PAYMENT_PENDING',
    'COD_PENDING',
    'DELIVERY',
    0
  ),
  (
    'e1500000-0000-4000-8000-000000000003',
    'ALERT-ACK-ORDER-ACCEPTED',
    'alert-ack-order-accepted-key',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    'e1400000-0000-4000-8000-000000000003',
    'e1200000-0000-4000-8000-000000000001',
    '{"id":"e1200000-0000-4000-8000-000000000001","label":"Home","recipientName":"Alert Ack Customer","phoneNumber":"9000000201","line1":"Customer Ack Street","line2":null,"landmark":null,"area":"Tirupati","city":"Tirupati","state":"Andhra Pradesh","postalCode":"517501","countryCode":"IN","latitude":13.629,"longitude":79.42}'::jsonb,
    'PAYMENT_PENDING',
    'COD_PENDING',
    'DELIVERY',
    0
  );

select is(
  (select (private.transition_order_state(
    'e1500000-0000-4000-8000-000000000001',
    'WAITING_FOR_MERCHANT',
    'e1100000-0000-4000-8000-000000000001',
    'CUSTOMER',
    null,
    'Customer placed order'
  )).status::text),
  'WAITING_FOR_MERCHANT',
  'first order enters merchant response state'
);

select is(
  (select (private.transition_order_state(
    'e1500000-0000-4000-8000-000000000002',
    'WAITING_FOR_MERCHANT',
    'e1100000-0000-4000-8000-000000000001',
    'CUSTOMER',
    null,
    'Customer placed order'
  )).status::text),
  'WAITING_FOR_MERCHANT',
  'expired-case order enters merchant response state'
);

select is(
  (select (private.transition_order_state(
    'e1500000-0000-4000-8000-000000000003',
    'WAITING_FOR_MERCHANT',
    'e1100000-0000-4000-8000-000000000001',
    'CUSTOMER',
    null,
    'Customer placed order'
  )).status::text),
  'WAITING_FOR_MERCHANT',
  'state-conflict order enters merchant response state'
);

select is(
  (select count(*)::integer from public.merchant_order_alerts where shop_id = 'e1300000-0000-4000-8000-000000000001'),
  3,
  'waiting transitions create three durable alerts'
);

select is(
  (
    select alert_status::text
    from public.merchant_order_alerts
    where order_id = 'e1500000-0000-4000-8000-000000000001'
  ),
  'PENDING',
  'acknowledgement may begin from a pending polling-visible alert'
);

create temporary table merchant_alert_ack_state (
  key text primary key,
  value jsonb not null
);

insert into merchant_alert_ack_state (key, value)
values (
  'first',
  public.acknowledge_merchant_order_alert(
    'e1100000-0000-4000-8000-000000000002',
    (
      select id
      from public.merchant_order_alerts
      where order_id = 'e1500000-0000-4000-8000-000000000001'
    )
  )
);

select is(
  (select value->>'status' from merchant_alert_ack_state where key = 'first'),
  'ACKNOWLEDGED',
  'owned active alert is acknowledged'
);

select is(
  (select (value->>'replayed')::boolean from merchant_alert_ack_state where key = 'first'),
  false,
  'first acknowledgement is not a replay'
);

select is(
  (select (value->>'reminderEligible')::boolean from merchant_alert_ack_state where key = 'first'),
  false,
  'acknowledgement stops reminder eligibility'
);

select is(
  (select (value->>'soundShouldStop')::boolean from merchant_alert_ack_state where key = 'first'),
  true,
  'acknowledgement tells the merchant client to stop alert sound'
);

select is(
  (
    select alert_status::text
    from public.merchant_order_alerts
    where order_id = 'e1500000-0000-4000-8000-000000000001'
  ),
  'ACKNOWLEDGED',
  'durable alert state is acknowledged'
);

select is(
  (
    select acknowledged_by
    from public.merchant_order_alerts
    where order_id = 'e1500000-0000-4000-8000-000000000001'
  ),
  'e1100000-0000-4000-8000-000000000002'::uuid,
  'acknowledgement records the owning merchant actor'
);

select is(
  (
    select first_sent_at
    from public.merchant_order_alerts
    where order_id = 'e1500000-0000-4000-8000-000000000001'
  ),
  null::timestamptz,
  'polling-visible pending alerts can be acknowledged without inventing a send timestamp'
);

select is(
  (
    select status::text
    from public.orders
    where id = 'e1500000-0000-4000-8000-000000000001'
  ),
  'WAITING_FOR_MERCHANT',
  'alert acknowledgement does not change order state'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events event
    join public.merchant_order_alerts alert
      on alert.id = event.aggregate_id
    where alert.order_id = 'e1500000-0000-4000-8000-000000000001'
      and event.event_type = 'merchant.order.alert.acknowledged'
      and event.aggregate_type = 'MERCHANT_ORDER_ALERT'
  ),
  1,
  'first acknowledgement writes one transactional outbox event'
);

insert into merchant_alert_ack_state (key, value)
values (
  'replay',
  public.acknowledge_merchant_order_alert(
    'e1100000-0000-4000-8000-000000000002',
    (
      select id
      from public.merchant_order_alerts
      where order_id = 'e1500000-0000-4000-8000-000000000001'
    )
  )
);

select is(
  (select (value->>'replayed')::boolean from merchant_alert_ack_state where key = 'replay'),
  true,
  'repeated acknowledgement safely replays the final state'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events event
    join public.merchant_order_alerts alert
      on alert.id = event.aggregate_id
    where alert.order_id = 'e1500000-0000-4000-8000-000000000001'
      and event.event_type = 'merchant.order.alert.acknowledged'
  ),
  1,
  'replay writes no duplicate acknowledgement event'
);

select throws_ok(
  (
    select format(
      $f$select public.acknowledge_merchant_order_alert(
        'e1100000-0000-4000-8000-000000000003',
        %L::uuid
      )$f$,
      id
    )
    from public.merchant_order_alerts
    where order_id = 'e1500000-0000-4000-8000-000000000002'
  ),
  'P0014',
  'merchant order alert not found',
  'another merchant cannot acknowledge the alert'
);

update public.merchant_order_alerts
set
  created_at = statement_timestamp() - interval '20 minutes',
  expires_at = statement_timestamp() - interval '1 minute'
where order_id = 'e1500000-0000-4000-8000-000000000002';

select throws_ok(
  (
    select format(
      $f$select public.acknowledge_merchant_order_alert(
        'e1100000-0000-4000-8000-000000000002',
        %L::uuid
      )$f$,
      id
    )
    from public.merchant_order_alerts
    where order_id = 'e1500000-0000-4000-8000-000000000002'
  ),
  'P0015',
  'merchant response window has expired',
  'expired response window cannot be acknowledged'
);

select is(
  (select (private.transition_order_state(
    'e1500000-0000-4000-8000-000000000003',
    'MERCHANT_ACCEPTED',
    'e1100000-0000-4000-8000-000000000002',
    'MERCHANT',
    null,
    'Merchant accepted order'
  )).status::text),
  'MERCHANT_ACCEPTED',
  'state-conflict order advances before acknowledgement'
);

select throws_ok(
  (
    select format(
      $f$select public.acknowledge_merchant_order_alert(
        'e1100000-0000-4000-8000-000000000002',
        %L::uuid
      )$f$,
      id
    )
    from public.merchant_order_alerts
    where order_id = 'e1500000-0000-4000-8000-000000000003'
  ),
  'P0016',
  'merchant order alert is not acknowledgeable',
  'non-waiting order alert cannot be acknowledged'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events event
    where event.event_type = 'merchant.order.alert.acknowledged'
  ),
  1,
  'failed acknowledgement attempts write no outbox events'
);

select * from finish();

rollback;
