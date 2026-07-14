begin;

select plan(10);

select ok(
  to_regprocedure(
    'public.list_serviceable_shops(double precision,double precision,integer)'
  ) is not null,
  'serviceable nearby-shop RPC exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.list_serviceable_shops(double precision,double precision,integer)',
    'EXECUTE'
  ),
  'authenticated customers may execute nearby-shop discovery'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.list_serviceable_shops(double precision,double precision,integer)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute nearby-shop discovery'
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
    'c1100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'nearby-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'c1100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'nearby-customer@example.test',
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
    'c1100000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Nearby Merchant',
    'ACTIVE'
  ),
  (
    'c1100000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Nearby Customer',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'c1100000-0000-4000-8000-000000000001',
  'Nearby Merchant Legal'
);

insert into public.customer_profiles (user_id)
values ('c1100000-0000-4000-8000-000000000002');

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
    'c1200000-0000-4000-8000-000000000001',
    'c1100000-0000-4000-8000-000000000001',
    'Nearest',
    'Nearby Merchant',
    '9000000051',
    'Nearest Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'c1200000-0000-4000-8000-000000000002',
    'c1100000-0000-4000-8000-000000000001',
    'Second',
    'Nearby Merchant',
    '9000000052',
    'Second Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  ),
  (
    'c1200000-0000-4000-8000-000000000003',
    'c1100000-0000-4000-8000-000000000001',
    'Far',
    'Nearby Merchant',
    '9000000053',
    'Far Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.5000 13.7000)'::extensions.geography
  ),
  (
    'c1200000-0000-4000-8000-000000000004',
    'c1100000-0000-4000-8000-000000000001',
    'Paused',
    'Nearby Merchant',
    '9000000054',
    'Paused Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4193 13.6289)'::extensions.geography
  ),
  (
    'c1200000-0000-4000-8000-000000000005',
    'c1100000-0000-4000-8000-000000000001',
    'Unverified',
    'Nearby Merchant',
    '9000000055',
    'Unverified Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4194 13.6290)'::extensions.geography
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
  service_radius_meters
)
values
  (
    'c1300000-0000-4000-8000-000000000001',
    'c1100000-0000-4000-8000-000000000001',
    'c1200000-0000-4000-8000-000000000001',
    'NEARBY-NEAREST',
    'Nearest Serviceable Shop',
    'nearest-serviceable-shop',
    '9000000056',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true,
    1000
  ),
  (
    'c1300000-0000-4000-8000-000000000002',
    'c1100000-0000-4000-8000-000000000001',
    'c1200000-0000-4000-8000-000000000002',
    'NEARBY-SECOND',
    'Second Serviceable Shop',
    'second-serviceable-shop',
    '9000000057',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
    'VERIFIED',
    'BUSY',
    true,
    1000
  ),
  (
    'c1300000-0000-4000-8000-000000000003',
    'c1100000-0000-4000-8000-000000000001',
    'c1200000-0000-4000-8000-000000000003',
    'NEARBY-FAR',
    'Far Unserviceable Shop',
    'far-unserviceable-shop',
    '9000000058',
    'SRID=4326;POINT(79.5000 13.7000)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true,
    500
  ),
  (
    'c1300000-0000-4000-8000-000000000004',
    'c1100000-0000-4000-8000-000000000001',
    'c1200000-0000-4000-8000-000000000004',
    'NEARBY-PAUSED',
    'Paused Nearby Shop',
    'paused-nearby-shop',
    '9000000059',
    'SRID=4326;POINT(79.4193 13.6289)'::extensions.geography,
    'VERIFIED',
    'PAUSED',
    true,
    1000
  ),
  (
    'c1300000-0000-4000-8000-000000000005',
    'c1100000-0000-4000-8000-000000000001',
    'c1200000-0000-4000-8000-000000000005',
    'NEARBY-UNVERIFIED',
    'Unverified Nearby Shop',
    'unverified-nearby-shop',
    '9000000060',
    'SRID=4326;POINT(79.4194 13.6290)'::extensions.geography,
    'PENDING',
    'OPEN',
    true,
    1000
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'c1100000-0000-4000-8000-000000000002',
  true
);

select is(
  (
    select count(*)::integer
    from public.list_serviceable_shops(
      13.6288,
      79.4192,
      20
    )
  ),
  2,
  'only public shops covering the customer location are returned'
);

select is(
  (
    select name
    from public.list_serviceable_shops(
      13.6288,
      79.4192,
      20
    )
    limit 1
  ),
  'Nearest Serviceable Shop',
  'shops are ordered nearest first'
);

select ok(
  not exists (
    select 1
    from public.list_serviceable_shops(
      13.6288,
      79.4192,
      20
    )
    where distance_meters > service_radius_meters
  ),
  'every returned shop is serviceable for the requested location'
);

select is(
  (
    select count(*)::integer
    from public.list_serviceable_shops(
      13.6288,
      79.4192,
      20
    )
    where id = 'c1300000-0000-4000-8000-000000000004'
  ),
  0,
  'paused shops are excluded'
);

select is(
  (
    select count(*)::integer
    from public.list_serviceable_shops(
      13.6288,
      79.4192,
      20
    )
    where id = 'c1300000-0000-4000-8000-000000000005'
  ),
  0,
  'unverified shops are excluded'
);

select is(
  (
    select count(*)::integer
    from public.list_serviceable_shops(
      13.6288,
      79.4192,
      20
    )
    where id = 'c1300000-0000-4000-8000-000000000003'
  ),
  0,
  'shops outside their own service radius are excluded'
);

select is(
  (
    select count(*)::integer
    from public.list_serviceable_shops(
      13.6288,
      79.4192,
      1
    )
  ),
  1,
  'the bounded result limit is respected'
);

select * from finish();

rollback;
