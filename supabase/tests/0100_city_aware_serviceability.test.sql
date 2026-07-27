begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(48);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'fulfilment_mode'
  ),
  'LOCAL_DELIVERY,POSTAL_DELIVERY',
  'fulfilment modes are defined'
);
select ok(
  to_regclass('private.variant_serviceability_quotes') is not null,
  'private serviceability quote table exists'
);
select ok(
  to_regprocedure(
    'public.resolve_customer_service_area(double precision,double precision,text)'
  ) is not null,
  'service area resolver exists'
);
select ok(
  to_regprocedure(
    'public.get_variant_serviceability_quote(uuid,integer,double precision,double precision,text)'
  ) is not null,
  'variant quote function exists'
);
select ok(
  to_regprocedure(
    'public.revalidate_serviceability_quote(uuid,uuid,integer)'
  ) is not null,
  'quote revalidation function exists'
);
select is(
  has_table_privilege(
    'authenticated',
    'private.variant_serviceability_quotes',
    'SELECT'
  ),
  false,
  'authenticated clients cannot read private quote snapshots'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.resolve_customer_service_area(double precision,double precision,text)',
    'EXECUTE'
  ),
  true,
  'authenticated clients can resolve service areas'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.get_variant_serviceability_quote(uuid,integer,double precision,double precision,text)',
    'EXECUTE'
  ),
  true,
  'authenticated clients can request serviceability quotes'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.revalidate_serviceability_quote(uuid,uuid,integer)',
    'EXECUTE'
  ),
  true,
  'authenticated clients can revalidate quotes'
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
    'e1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'serviceability-merchant@test.local',
    crypt('test', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'serviceability-customer@test.local',
    crypt('test', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
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
    'e1000000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Serviceability Merchant',
    'ACTIVE'
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Serviceability Customer',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name,
  onboarding_status,
  kyc_status
)
values (
  'e1000000-0000-4000-8000-000000000001',
  'Serviceability Merchant Legal',
  'ACTIVE',
  'VERIFIED'
);

insert into public.customer_profiles (user_id)
values ('e1000000-0000-4000-8000-000000000002');

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
    'e2000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'Merchant',
    'Merchant',
    '9000000201',
    '1 Tirupati Road',
    'Central',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    'Bengaluru',
    'Merchant',
    '9000000202',
    '2 Bengaluru Road',
    'Indiranagar',
    'Bengaluru',
    'Karnataka',
    '560038',
    'IN',
    'SRID=4326;POINT(77.6408 12.9784)'::extensions.geography
  );

insert into public.cities (
  id,
  code,
  slug,
  name,
  state_code
)
values
  (
    'e6000000-0000-4000-8000-000000000001',
    'SVC_TIRUPATI',
    'svc-tirupati',
    'Tirupati',
    'AP'
  ),
  (
    'e6000000-0000-4000-8000-000000000002',
    'SVC_BENGALURU',
    'svc-bengaluru',
    'Bengaluru',
    'KA'
  );

update public.cities
set status = 'CONFIGURING'
where id in (
  'e6000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000002'
);
update public.cities
set status = 'READY_FOR_VALIDATION'
where id in (
  'e6000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000002'
);
update public.cities
set status = 'ACTIVE'
where id in (
  'e6000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000002'
);

update public.city_configurations
set
  default_delivery_radius_meters = 5000,
  maximum_delivery_radius_meters = 10000,
  base_delivery_fee_paise = 3000,
  per_km_delivery_fee_paise = 500,
  local_delivery_enabled = true,
  postal_delivery_enabled = true
where city_id in (
  'e6000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000002'
);

select is(
  (
    select version
    from public.city_configurations
    where city_id = 'e6000000-0000-4000-8000-000000000001'
  ),
  2,
  'city configuration updates increment the quote version'
);

insert into public.service_zones (
  id,
  city_id,
  code,
  slug,
  name,
  boundary,
  center_point,
  default_delivery_radius_meters
)
values
  (
    'e6100000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000001',
    'SVC_TIR_ZONE',
    'svc-tir-zone',
    'Tirupati Service Zone',
    extensions.st_multi(
      extensions.st_geomfromtext(
        'POLYGON((79.35 13.55,79.50 13.55,79.50 13.70,79.35 13.70,79.35 13.55))',
        4326
      )
    ),
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    6000
  ),
  (
    'e6100000-0000-4000-8000-000000000002',
    'e6000000-0000-4000-8000-000000000002',
    'SVC_BLR_ZONE',
    'svc-blr-zone',
    'Bengaluru Service Zone',
    extensions.st_multi(
      extensions.st_geomfromtext(
        'POLYGON((77.55 12.90,77.75 12.90,77.75 13.05,77.55 13.05,77.55 12.90))',
        4326
      )
    ),
    'SRID=4326;POINT(77.6408 12.9784)'::extensions.geography,
    7000
  );

update public.service_zones
set status = 'CONFIGURING'
where id in (
  'e6100000-0000-4000-8000-000000000001',
  'e6100000-0000-4000-8000-000000000002'
);
update public.service_zones
set status = 'READY_FOR_VALIDATION'
where id in (
  'e6100000-0000-4000-8000-000000000001',
  'e6100000-0000-4000-8000-000000000002'
);
update public.service_zones
set status = 'ACTIVE'
where id in (
  'e6100000-0000-4000-8000-000000000001',
  'e6100000-0000-4000-8000-000000000002'
);

insert into public.service_zone_pincodes (
  city_id,
  service_zone_id,
  pincode,
  priority,
  is_primary,
  is_active
)
values
  (
    'e6000000-0000-4000-8000-000000000001',
    'e6100000-0000-4000-8000-000000000001',
    '517501',
    10,
    true,
    true
  ),
  (
    'e6000000-0000-4000-8000-000000000002',
    'e6100000-0000-4000-8000-000000000002',
    '560038',
    10,
    true,
    true
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
values (
  'e3000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'SVC-SHOP',
  'Serviceability Shop',
  'serviceability-shop',
  '9100000201',
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
)
values (
  'e4000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Serviceability Kurta',
  'serviceability-kurta',
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
values
  (
    'e5000000-0000-4000-8000-000000000001',
    'e4000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'SVC-KURTA-M',
    'Blue',
    'M',
    210000,
    190000,
    true
  ),
  (
    'e5000000-0000-4000-8000-000000000002',
    'e4000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'SVC-KURTA-L',
    'Blue',
    'L',
    150000,
    100000,
    true
  );

insert into public.merchant_branches (
  id,
  shop_id,
  merchant_id,
  city_id,
  primary_service_zone_id,
  branch_code,
  name,
  branch_type,
  address_id,
  return_address_id,
  pincode,
  location,
  local_delivery_enabled,
  postal_delivery_enabled,
  all_india_postal_enabled,
  accepts_walk_in,
  postal_dispatch_sla_hours
)
values
  (
    'e3100000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000001',
    'e6100000-0000-4000-8000-000000000001',
    'SVC-TIR-NEAR',
    'Tirupati Near Branch',
    'PHYSICAL_STORE',
    'e2000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    '517501',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    true,
    false,
    false,
    true,
    48
  ),
  (
    'e3100000-0000-4000-8000-000000000002',
    'e3000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000001',
    'e6100000-0000-4000-8000-000000000001',
    'SVC-TIR-FAR',
    'Tirupati Far Branch',
    'PHYSICAL_STORE',
    'e2000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    '517501',
    'SRID=4326;POINT(79.4500 13.6500)'::extensions.geography,
    true,
    false,
    false,
    true,
    48
  ),
  (
    'e3100000-0000-4000-8000-000000000003',
    'e3000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000002',
    'e6100000-0000-4000-8000-000000000002',
    'SVC-BLR-LOCAL',
    'Bengaluru Local Branch',
    'PHYSICAL_STORE',
    'e2000000-0000-4000-8000-000000000002',
    'e2000000-0000-4000-8000-000000000002',
    '560038',
    'SRID=4326;POINT(77.6408 12.9784)'::extensions.geography,
    true,
    false,
    false,
    true,
    48
  ),
  (
    'e3100000-0000-4000-8000-000000000004',
    'e3000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000002',
    'e6100000-0000-4000-8000-000000000002',
    'SVC-BLR-POSTAL',
    'Bengaluru Postal Cloud',
    'CLOUD_SHOP',
    'e2000000-0000-4000-8000-000000000002',
    'e2000000-0000-4000-8000-000000000002',
    '560038',
    'SRID=4326;POINT(77.6408 12.9784)'::extensions.geography,
    false,
    true,
    false,
    true,
    24
  ),
  (
    'e3100000-0000-4000-8000-000000000005',
    'e3000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000001',
    'e6100000-0000-4000-8000-000000000001',
    'SVC-REVIEW',
    'Review Required Branch',
    'PHYSICAL_STORE',
    'e2000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    '517501',
    'SRID=4326;POINT(79.4191 13.6287)'::extensions.geography,
    true,
    false,
    false,
    true,
    48
  );

insert into public.branch_service_zones (
  branch_id,
  city_id,
  service_zone_id,
  is_primary,
  is_active
)
values
  (
    'e3100000-0000-4000-8000-000000000001',
    'e6000000-0000-4000-8000-000000000001',
    'e6100000-0000-4000-8000-000000000001',
    true,
    true
  ),
  (
    'e3100000-0000-4000-8000-000000000002',
    'e6000000-0000-4000-8000-000000000001',
    'e6100000-0000-4000-8000-000000000001',
    true,
    true
  ),
  (
    'e3100000-0000-4000-8000-000000000003',
    'e6000000-0000-4000-8000-000000000002',
    'e6100000-0000-4000-8000-000000000002',
    true,
    true
  ),
  (
    'e3100000-0000-4000-8000-000000000005',
    'e6000000-0000-4000-8000-000000000001',
    'e6100000-0000-4000-8000-000000000001',
    true,
    true
  );

insert into public.branch_postal_serviceability (
  branch_id,
  pincode,
  is_active
)
values (
  'e3100000-0000-4000-8000-000000000004',
  '517501',
  true
);

update public.merchant_branches
set
  verification_status = 'VERIFIED',
  geography_status = 'VERIFIED',
  status = 'VERIFICATION_PENDING'
where id in (
  'e3100000-0000-4000-8000-000000000001',
  'e3100000-0000-4000-8000-000000000002',
  'e3100000-0000-4000-8000-000000000003',
  'e3100000-0000-4000-8000-000000000004'
);
update public.merchant_branches
set status = 'APPROVED'
where id in (
  'e3100000-0000-4000-8000-000000000001',
  'e3100000-0000-4000-8000-000000000002',
  'e3100000-0000-4000-8000-000000000003',
  'e3100000-0000-4000-8000-000000000004'
);
update public.merchant_branches
set status = 'ACTIVE'
where id in (
  'e3100000-0000-4000-8000-000000000001',
  'e3100000-0000-4000-8000-000000000002',
  'e3100000-0000-4000-8000-000000000003',
  'e3100000-0000-4000-8000-000000000004'
);

select private.apply_branch_inventory_delta(
  'e3100000-0000-4000-8000-000000000001',
  'e5000000-0000-4000-8000-000000000001',
  6,
  0,
  0,
  1,
  'STOCK_RECEIVED',
  'SYSTEM',
  'SERVICEABILITY_TEST',
  null,
  'near branch fixture',
  null
);
select private.apply_branch_inventory_delta(
  'e3100000-0000-4000-8000-000000000002',
  'e5000000-0000-4000-8000-000000000001',
  20,
  0,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'SERVICEABILITY_TEST',
  null,
  'far branch fixture',
  null
);
select private.apply_branch_inventory_delta(
  'e3100000-0000-4000-8000-000000000003',
  'e5000000-0000-4000-8000-000000000001',
  30,
  0,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'SERVICEABILITY_TEST',
  null,
  'Bengaluru local fixture',
  null
);
select private.apply_branch_inventory_delta(
  'e3100000-0000-4000-8000-000000000004',
  'e5000000-0000-4000-8000-000000000001',
  40,
  0,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'SERVICEABILITY_TEST',
  null,
  'postal fixture',
  null
);
select private.apply_branch_inventory_delta(
  'e3100000-0000-4000-8000-000000000005',
  'e5000000-0000-4000-8000-000000000001',
  100,
  0,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'SERVICEABILITY_TEST',
  null,
  'review branch fixture',
  null
);
select private.apply_branch_inventory_delta(
  'e3100000-0000-4000-8000-000000000001',
  'e5000000-0000-4000-8000-000000000002',
  10,
  0,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'SERVICEABILITY_TEST',
  null,
  'second variant fixture',
  null
);

create temporary table serviceability_results (
  label text primary key,
  payload jsonb not null
);

insert into serviceability_results
select
  'resolved',
  public.resolve_customer_service_area(
    13.6288,
    79.4192,
    '517501'
  );

select is(
  (
    select payload ->> 'cityId'
    from serviceability_results
    where label = 'resolved'
  ),
  'e6000000-0000-4000-8000-000000000001',
  'Tirupati coordinates and pincode resolve to Tirupati'
);
select is(
  (
    select payload ->> 'serviceZoneId'
    from serviceability_results
    where label = 'resolved'
  ),
  'e6100000-0000-4000-8000-000000000001',
  'Tirupati service zone is selected'
);
select is(
  (
    select (payload ->> 'resolved')::boolean
    from serviceability_results
    where label = 'resolved'
  ),
  true,
  'supported service area resolves successfully'
);
select is(
  public.resolve_customer_service_area(
    13.8000,
    79.4192,
    '517501'
  ) ->> 'reasonCode',
  'LOCATION_OUTSIDE_ZONE',
  'geofence rejects coordinates outside the mapped zone'
);
select is(
  public.resolve_customer_service_area(
    13.6288,
    79.4192,
    '517599'
  ) ->> 'reasonCode',
  'PINCODE_NOT_SUPPORTED',
  'coordinates inside a zone still require a supported pincode'
);
select is(
  public.resolve_customer_service_area(
    null,
    79.4192,
    '517501'
  ) ->> 'reasonCode',
  'INVALID_LOCATION',
  'invalid coordinates fail deterministically'
);

update public.cities
set status = 'PAUSED'
where id = 'e6000000-0000-4000-8000-000000000001';
select is(
  public.resolve_customer_service_area(
    13.6288,
    79.4192,
    '517501'
  ) ->> 'reasonCode',
  'CITY_PAUSED',
  'paused city fails closed'
);
update public.cities
set status = 'ACTIVE'
where id = 'e6000000-0000-4000-8000-000000000001';

update public.service_zones
set status = 'PAUSED'
where id = 'e6100000-0000-4000-8000-000000000001';
select is(
  public.resolve_customer_service_area(
    13.6288,
    79.4192,
    '517501'
  ) ->> 'reasonCode',
  'ZONE_PAUSED',
  'paused zone fails closed'
);
update public.service_zones
set status = 'ACTIVE'
where id = 'e6100000-0000-4000-8000-000000000001';

insert into serviceability_results
select
  'local-quote',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000001',
    1,
    13.6288,
    79.4192,
    '517501'
  );

select is(
  (
    select payload ->> 'fulfilmentMode'
    from serviceability_results
    where label = 'local-quote'
  ),
  'LOCAL_DELIVERY',
  'local delivery is preferred over postal fallback'
);
select is(
  (
    select payload ->> 'branchId'
    from serviceability_results
    where label = 'local-quote'
  ),
  'e3100000-0000-4000-8000-000000000001',
  'nearest eligible Tirupati branch is selected'
);
select isnt(
  (
    select payload ->> 'branchId'
    from serviceability_results
    where label = 'local-quote'
  ),
  'e3100000-0000-4000-8000-000000000003',
  'Bengaluru branch is never selected for Tirupati local delivery'
);
select isnt(
  (
    select payload ->> 'branchId'
    from serviceability_results
    where label = 'local-quote'
  ),
  'e3100000-0000-4000-8000-000000000005',
  'review-required branch is excluded'
);
select is(
  (
    select (payload ->> 'availableQuantity')::integer
    from serviceability_results
    where label = 'local-quote'
  ),
  5,
  'safety stock is excluded from customer availability'
);
select is(
  (
    select (payload ->> 'deliveryFeePaise')::bigint
    from serviceability_results
    where label = 'local-quote'
  ),
  3000::bigint,
  'server calculates local delivery fee from city configuration'
);
select is(
  (
    select (payload ->> 'codLimitPaise')::bigint
    from serviceability_results
    where label = 'local-quote'
  ),
  200000::bigint,
  'quote uses the city COD limit'
);
select is(
  (
    select (payload ->> 'codEligible')::boolean
    from serviceability_results
    where label = 'local-quote'
  ),
  true,
  'order below the city limit is COD eligible'
);
select is(
  (
    select count(*)::integer
    from public.branch_inventory_reservations
    where variant_id = 'e5000000-0000-4000-8000-000000000001'
  ),
  0,
  'catalogue quote does not reserve branch inventory'
);
select is(
  (
    select reserved_quantity::integer
    from public.branch_inventory
    where branch_id = 'e3100000-0000-4000-8000-000000000001'
      and variant_id = 'e5000000-0000-4000-8000-000000000001'
  ),
  0,
  'catalogue quote leaves reserved quantity unchanged'
);

insert into serviceability_results
select
  'repeat-local',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000001',
    1,
    13.6288,
    79.4192,
    '517501'
  );
select is(
  (
    select payload ->> 'branchId'
    from serviceability_results
    where label = 'repeat-local'
  ),
  (
    select payload ->> 'branchId'
    from serviceability_results
    where label = 'local-quote'
  ),
  'branch selection is deterministic'
);

insert into serviceability_results
select
  'cod-over-limit',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000001',
    2,
    13.6288,
    79.4192,
    '517501'
  );
select is(
  (
    select (payload ->> 'codEligible')::boolean
    from serviceability_results
    where label = 'cod-over-limit'
  ),
  false,
  'quote above the city limit is not COD eligible'
);

insert into serviceability_results
select
  'insufficient',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000001',
    50,
    13.6288,
    79.4192,
    '517501'
  );
select is(
  (
    select payload ->> 'reasonCode'
    from serviceability_results
    where label = 'insufficient'
  ),
  'INSUFFICIENT_BRANCH_STOCK',
  'insufficient stock returns a stable reason'
);
select is(
  (
    select (payload ->> 'serviceable')::boolean
    from serviceability_results
    where label = 'insufficient'
  ),
  false,
  'insufficient stock is not serviceable'
);

update public.merchant_branches
set status = 'PAUSED'
where id in (
  'e3100000-0000-4000-8000-000000000001',
  'e3100000-0000-4000-8000-000000000002'
);
insert into serviceability_results
select
  'postal-restricted',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000001',
    1,
    13.6288,
    79.4192,
    '517501'
  );
select is(
  (
    select payload ->> 'fulfilmentMode'
    from serviceability_results
    where label = 'postal-restricted'
  ),
  'POSTAL_DELIVERY',
  'postal branch is used when local branches are unavailable'
);
select is(
  (
    select payload ->> 'branchId'
    from serviceability_results
    where label = 'postal-restricted'
  ),
  'e3100000-0000-4000-8000-000000000004',
  'explicit postal pincode branch is selected'
);
select is(
  (
    select payload ->> 'paymentMode'
    from serviceability_results
    where label = 'postal-restricted'
  ),
  'PREPAID_ONLY',
  'postal quote is prepaid only'
);
select is(
  (
    select payload ->> 'deliveryFeeStatus'
    from serviceability_results
    where label = 'postal-restricted'
  ),
  'CALCULATED_AT_CHECKOUT',
  'postal delivery fee is explicitly deferred'
);

insert into serviceability_results
select
  'postal-unsupported',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000001',
    1,
    13.6288,
    79.4192,
    '517502'
  );
select is(
  (
    select payload ->> 'reasonCode'
    from serviceability_results
    where label = 'postal-unsupported'
  ),
  'PINCODE_NOT_SUPPORTED',
  'restricted postal branch rejects an unsupported pincode'
);

update public.merchant_branches
set all_india_postal_enabled = true
where id = 'e3100000-0000-4000-8000-000000000004';
insert into serviceability_results
select
  'postal-all-india',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000001',
    1,
    13.6288,
    79.4192,
    '517502'
  );
select is(
  (
    select payload ->> 'fulfilmentMode'
    from serviceability_results
    where label = 'postal-all-india'
  ),
  'POSTAL_DELIVERY',
  'all-India postal fallback supports an unmapped pincode'
);

update public.merchant_branches
set status = 'ACTIVE'
where id in (
  'e3100000-0000-4000-8000-000000000001',
  'e3100000-0000-4000-8000-000000000002'
);

select is(
  public.revalidate_serviceability_quote(
    (
      select (payload ->> 'quoteId')::uuid
      from serviceability_results
      where label = 'local-quote'
    ),
    'e5000000-0000-4000-8000-000000000001',
    1
  ) ->> 'valid',
  'true',
  'unchanged local quote revalidates successfully'
);
select is(
  public.revalidate_serviceability_quote(
    (
      select (payload ->> 'quoteId')::uuid
      from serviceability_results
      where label = 'local-quote'
    ),
    'e5000000-0000-4000-8000-000000000001',
    2
  ) ->> 'reasonCode',
  'QUOTE_REQUEST_MISMATCH',
  'revalidation rejects changed quantity'
);

insert into serviceability_results
select
  'configuration-stale',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000002',
    1,
    13.6288,
    79.4192,
    '517501'
  );
update public.city_configurations
set base_delivery_fee_paise = base_delivery_fee_paise + 1
where city_id = 'e6000000-0000-4000-8000-000000000001';
select is(
  public.revalidate_serviceability_quote(
    (
      select (payload ->> 'quoteId')::uuid
      from serviceability_results
      where label = 'configuration-stale'
    ),
    'e5000000-0000-4000-8000-000000000002',
    1
  ) ->> 'reasonCode',
  'CITY_CONFIGURATION_CHANGED',
  'changed city configuration invalidates quote'
);

insert into serviceability_results
select
  'inventory-stale',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000002',
    1,
    13.6288,
    79.4192,
    '517501'
  );
select private.apply_branch_inventory_delta(
  'e3100000-0000-4000-8000-000000000001',
  'e5000000-0000-4000-8000-000000000002',
  1,
  0,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'SERVICEABILITY_TEST',
  null,
  'version change',
  null
);
select is(
  public.revalidate_serviceability_quote(
    (
      select (payload ->> 'quoteId')::uuid
      from serviceability_results
      where label = 'inventory-stale'
    ),
    'e5000000-0000-4000-8000-000000000002',
    1
  ) ->> 'reasonCode',
  'BRANCH_INVENTORY_CHANGED',
  'changed inventory version invalidates quote'
);

insert into serviceability_results
select
  'expired',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000002',
    1,
    13.6288,
    79.4192,
    '517501'
  );
update private.variant_serviceability_quotes
set
  created_at = now() - interval '10 minutes',
  expires_at = now() - interval '5 minutes'
where id = (
  select (payload ->> 'quoteId')::uuid
  from serviceability_results
  where label = 'expired'
);
select is(
  public.revalidate_serviceability_quote(
    (
      select (payload ->> 'quoteId')::uuid
      from serviceability_results
      where label = 'expired'
    ),
    'e5000000-0000-4000-8000-000000000002',
    1
  ) ->> 'reasonCode',
  'QUOTE_EXPIRED',
  'expired quote is rejected'
);

insert into serviceability_results
select
  'city-pause-quote',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000002',
    1,
    13.6288,
    79.4192,
    '517501'
  );
update public.cities
set status = 'PAUSED'
where id = 'e6000000-0000-4000-8000-000000000001';
select is(
  public.revalidate_serviceability_quote(
    (
      select (payload ->> 'quoteId')::uuid
      from serviceability_results
      where label = 'city-pause-quote'
    ),
    'e5000000-0000-4000-8000-000000000002',
    1
  ) ->> 'reasonCode',
  'CITY_PAUSED',
  'paused city invalidates existing quote'
);
update public.cities
set status = 'ACTIVE'
where id = 'e6000000-0000-4000-8000-000000000001';

insert into serviceability_results
select
  'zone-pause-quote',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000002',
    1,
    13.6288,
    79.4192,
    '517501'
  );
update public.service_zones
set status = 'PAUSED'
where id = 'e6100000-0000-4000-8000-000000000001';
select is(
  public.revalidate_serviceability_quote(
    (
      select (payload ->> 'quoteId')::uuid
      from serviceability_results
      where label = 'zone-pause-quote'
    ),
    'e5000000-0000-4000-8000-000000000002',
    1
  ) ->> 'reasonCode',
  'ZONE_PAUSED',
  'paused zone invalidates local quote'
);
update public.service_zones
set status = 'ACTIVE'
where id = 'e6100000-0000-4000-8000-000000000001';

insert into serviceability_results
select
  'branch-pause-quote',
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000002',
    1,
    13.6288,
    79.4192,
    '517501'
  );
update public.merchant_branches
set status = 'PAUSED'
where id = 'e3100000-0000-4000-8000-000000000001';
select is(
  public.revalidate_serviceability_quote(
    (
      select (payload ->> 'quoteId')::uuid
      from serviceability_results
      where label = 'branch-pause-quote'
    ),
    'e5000000-0000-4000-8000-000000000002',
    1
  ) ->> 'reasonCode',
  'BRANCH_UNAVAILABLE',
  'paused branch invalidates quote'
);
update public.merchant_branches
set status = 'ACTIVE'
where id = 'e3100000-0000-4000-8000-000000000001';

select is(
  public.revalidate_serviceability_quote(
    'e9000000-0000-4000-8000-000000000001',
    'e5000000-0000-4000-8000-000000000001',
    1
  ) ->> 'reasonCode',
  'QUOTE_NOT_FOUND',
  'unknown quote ID fails deterministically'
);

select throws_ok(
  $$
    select public.get_variant_serviceability_quote(
      'e5000000-0000-4000-8000-000000000001',
      0,
      13.6288,
      79.4192,
      '517501'
    )
  $$,
  '22023',
  'INVALID_SERVICEABILITY_QUOTE_INPUT',
  'zero quantity is rejected'
);
select throws_ok(
  $$
    select public.get_variant_serviceability_quote(
      null,
      1,
      13.6288,
      79.4192,
      '517501'
    )
  $$,
  '22023',
  'INVALID_SERVICEABILITY_QUOTE_INPUT',
  'missing variant is rejected'
);
select is(
  public.get_variant_serviceability_quote(
    'e5000000-0000-4000-8000-000000000099',
    1,
    13.6288,
    79.4192,
    '517501'
  ) ->> 'reasonCode',
  'VARIANT_NOT_AVAILABLE',
  'unknown variant returns unavailable without creating a quote'
);
select is(
  (
    select count(*)::integer
    from private.variant_serviceability_quotes
    where variant_id = 'e5000000-0000-4000-8000-000000000099'
  ),
  0,
  'unavailable variant does not persist a quote snapshot'
);

select * from finish();
rollback;
