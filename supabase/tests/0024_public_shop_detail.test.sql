begin;

select plan(12);

select ok(
  to_regprocedure(
    'public.get_public_shop_detail(uuid,double precision,double precision)'
  ) is not null,
  'public shop-detail RPC exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_public_shop_detail(uuid,double precision,double precision)',
    'EXECUTE'
  ),
  'authenticated customers may execute public shop detail'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_public_shop_detail(uuid,double precision,double precision)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute public shop detail'
);

select ok(
  exists (
    select 1
    from pg_proc procedure
    where procedure.oid =
      'public.get_public_shop_detail(uuid,double precision,double precision)'::regprocedure
      and not procedure.prosecdef
      and procedure.provolatile = 's'
  ),
  'shop-detail RPC is stable and security invoker'
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
    'shop-detail-merchant@example.test',
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
    'shop-detail-customer@example.test',
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
    'MERCHANT',
    'Shop Detail Merchant',
    'ACTIVE'
  ),
  (
    'd1100000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Shop Detail Customer',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'd1100000-0000-4000-8000-000000000001',
  'Shop Detail Merchant Legal'
);

insert into public.customer_profiles (user_id)
values ('d1100000-0000-4000-8000-000000000002');

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
    'Public Shop',
    'Shop Detail Merchant',
    '9000000071',
    'Public Detail Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'd1200000-0000-4000-8000-000000000002',
    'd1100000-0000-4000-8000-000000000001',
    'Paused Shop',
    'Shop Detail Merchant',
    '9000000072',
    'Paused Detail Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
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
  email,
  location,
  verification_status,
  operational_status,
  accepts_online_orders,
  service_radius_meters,
  minimum_order_paise,
  average_preparation_minutes
)
values
  (
    'd1300000-0000-4000-8000-000000000001',
    'd1100000-0000-4000-8000-000000000001',
    'd1200000-0000-4000-8000-000000000001',
    'PUBLIC-SHOP-DETAIL',
    'Public Shop Detail',
    'public-shop-detail',
    '9000000073',
    'public-detail@example.test',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true,
    1000,
    50000,
    20
  ),
  (
    'd1300000-0000-4000-8000-000000000002',
    'd1100000-0000-4000-8000-000000000001',
    'd1200000-0000-4000-8000-000000000002',
    'PAUSED-SHOP-DETAIL',
    'Paused Shop Detail',
    'paused-shop-detail',
    '9000000074',
    null,
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
    'VERIFIED',
    'PAUSED',
    true,
    1000,
    0,
    15
  );

insert into public.shop_hours (
  shop_id,
  schedule_type,
  day_of_week,
  special_date,
  open_time,
  close_time,
  is_closed
)
values
  (
    'd1300000-0000-4000-8000-000000000001',
    'WEEKLY',
    extract(
      dow from timezone('Asia/Kolkata', now())
    )::smallint,
    null,
    '09:00:00',
    '21:00:00',
    false
  ),
  (
    'd1300000-0000-4000-8000-000000000001',
    'SPECIAL_DATE',
    null,
    timezone('Asia/Kolkata', now())::date,
    null,
    null,
    true
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
    from public.get_public_shop_detail(
      'd1300000-0000-4000-8000-000000000001',
      13.6288,
      79.4192
    )
  ),
  1,
  'customer can load one public shop'
);

select is(
  (
    select distance_meters
    from public.get_public_shop_detail(
      'd1300000-0000-4000-8000-000000000001',
      13.6288,
      79.4192
    )
  ),
  0,
  'distance is zero at the shop location'
);

select ok(
  (
    select is_serviceable
    from public.get_public_shop_detail(
      'd1300000-0000-4000-8000-000000000001',
      13.6288,
      79.4192
    )
  ),
  'shop is serviceable inside its delivery radius'
);

select ok(
  not (
    select is_serviceable
    from public.get_public_shop_detail(
      'd1300000-0000-4000-8000-000000000001',
      13.7000,
      79.5000
    )
  ),
  'shop is not serviceable outside its delivery radius'
);

select is(
  (
    select count(*)::integer
    from public.get_public_shop_detail(
      'd1300000-0000-4000-8000-000000000002',
      13.6288,
      79.4192
    )
  ),
  0,
  'paused shops remain hidden'
);

select is(
  (
    select count(*)::integer
    from public.shop_hours
    where shop_id =
      'd1300000-0000-4000-8000-000000000001'
  ),
  2,
  'customer can read weekly and special-date public shop hours'
);

select is(
  (
    select minimum_order_paise::bigint
    from public.get_public_shop_detail(
      'd1300000-0000-4000-8000-000000000001',
      13.6288,
      79.4192
    )
  ),
  50000::bigint,
  'shop detail returns public ordering constraints'
);

select throws_ok(
  $$
    select *
    from public.get_public_shop_detail(
      'd1300000-0000-4000-8000-000000000001',
      91,
      79.4192
    )
  $$,
  '22023',
  'invalid public shop-detail query',
  'invalid coordinates are rejected'
);

select * from finish();

rollback;
