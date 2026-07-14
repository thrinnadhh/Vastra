begin;

select plan(18);

select ok(
  to_regprocedure(
    'public.build_product_discovery_search_vector(text,text,text,text,text[],text[])'
  ) is not null,
  'product discovery search-vector builder exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'discovery_search_vector'
      and is_generated = 'ALWAYS'
  ),
  'products have a generated discovery search vector'
);

select ok(
  to_regclass(
    'public.products_discovery_search_vector_gin_idx'
  ) is not null,
  'product discovery vector has a GIN index'
);

select ok(
  to_regprocedure(
    'public.search_public_products(text,double precision,double precision,uuid,text,uuid,bigint,bigint,text,integer,integer)'
  ) is not null,
  'public product-search RPC exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.search_public_products(text,double precision,double precision,uuid,text,uuid,bigint,bigint,text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated customers may execute product search'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.search_public_products(text,double precision,double precision,uuid,text,uuid,bigint,bigint,text,integer,integer)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute product search'
);

select ok(
  exists (
    select 1
    from pg_proc procedure
    where procedure.oid =
      'public.search_public_products(text,double precision,double precision,uuid,text,uuid,bigint,bigint,text,integer,integer)'::regprocedure
      and not procedure.prosecdef
      and procedure.provolatile = 's'
  ),
  'product-search RPC is stable and security invoker'
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
    'search-merchant@example.test',
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
    'search-customer@example.test',
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
    'e1100000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Search Merchant',
    'ACTIVE'
  ),
  (
    'e1100000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Search Customer',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'e1100000-0000-4000-8000-000000000001',
  'Search Merchant Legal'
);

insert into public.customer_profiles (user_id)
values ('e1100000-0000-4000-8000-000000000002');

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
    'Near',
    'Search Merchant',
    '9000000081',
    'Near Search Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'e1200000-0000-4000-8000-000000000002',
    'e1100000-0000-4000-8000-000000000001',
    'Second',
    'Search Merchant',
    '9000000082',
    'Second Search Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4250 13.6300)'::extensions.geography
  ),
  (
    'e1200000-0000-4000-8000-000000000003',
    'e1100000-0000-4000-8000-000000000001',
    'Paused',
    'Search Merchant',
    '9000000083',
    'Paused Search Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4193 13.6289)'::extensions.geography
  ),
  (
    'e1200000-0000-4000-8000-000000000004',
    'e1100000-0000-4000-8000-000000000001',
    'Far',
    'Search Merchant',
    '9000000084',
    'Far Search Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.5000 13.7000)'::extensions.geography
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
    'e1300000-0000-4000-8000-000000000001',
    'e1100000-0000-4000-8000-000000000001',
    'e1200000-0000-4000-8000-000000000001',
    'SEARCH-NEAR',
    'Near Search Shop',
    'near-search-shop',
    '9000000085',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true,
    5000
  ),
  (
    'e1300000-0000-4000-8000-000000000002',
    'e1100000-0000-4000-8000-000000000001',
    'e1200000-0000-4000-8000-000000000002',
    'SEARCH-SECOND',
    'Second Search Shop',
    'second-search-shop',
    '9000000086',
    'SRID=4326;POINT(79.4250 13.6300)'::extensions.geography,
    'VERIFIED',
    'BUSY',
    true,
    5000
  ),
  (
    'e1300000-0000-4000-8000-000000000003',
    'e1100000-0000-4000-8000-000000000001',
    'e1200000-0000-4000-8000-000000000003',
    'SEARCH-PAUSED',
    'Paused Search Shop',
    'paused-search-shop',
    '9000000087',
    'SRID=4326;POINT(79.4193 13.6289)'::extensions.geography,
    'VERIFIED',
    'PAUSED',
    true,
    5000
  ),
  (
    'e1300000-0000-4000-8000-000000000004',
    'e1100000-0000-4000-8000-000000000001',
    'e1200000-0000-4000-8000-000000000004',
    'SEARCH-FAR',
    'Far Search Shop',
    'far-search-shop',
    '9000000088',
    'SRID=4326;POINT(79.5000 13.7000)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true,
    500
  );

insert into public.categories (
  id,
  name,
  slug,
  display_order,
  is_active
)
values
  (
    'e1400000-0000-4000-8000-000000000001',
    'Kurtas',
    'search-kurtas',
    1,
    true
  ),
  (
    'e1400000-0000-4000-8000-000000000002',
    'Shirts',
    'search-shirts',
    2,
    true
  );

insert into public.products (
  id,
  shop_id,
  category_id,
  name,
  slug,
  description,
  brand,
  material,
  gender_category,
  style_tags,
  occasion_tags,
  moderation_status,
  is_active
)
values
  (
    'e1500000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    'e1400000-0000-4000-8000-000000000001',
    'Silk Kurta',
    'search-silk-kurta',
    'Local fashion collection',
    'Vastra Local',
    'Silk',
    'WOMEN',
    array['traditional'],
    array['festival'],
    'APPROVED',
    true
  ),
  (
    'e1500000-0000-4000-8000-000000000002',
    'e1300000-0000-4000-8000-000000000002',
    'e1400000-0000-4000-8000-000000000002',
    'Cotton Shirt',
    'search-cotton-shirt',
    'Local fashion collection',
    'Vastra Local',
    'Cotton',
    'MEN',
    array['casual'],
    array['daily'],
    'APPROVED',
    true
  ),
  (
    'e1500000-0000-4000-8000-000000000003',
    'e1300000-0000-4000-8000-000000000001',
    'e1400000-0000-4000-8000-000000000001',
    'Pending Fashion',
    'search-pending-fashion',
    'Local fashion collection',
    null,
    'Cotton',
    'WOMEN',
    array['traditional'],
    array['festival'],
    'PENDING',
    true
  ),
  (
    'e1500000-0000-4000-8000-000000000004',
    'e1300000-0000-4000-8000-000000000003',
    'e1400000-0000-4000-8000-000000000001',
    'Paused Fashion',
    'search-paused-fashion',
    'Local fashion collection',
    null,
    'Cotton',
    'WOMEN',
    array['traditional'],
    array['festival'],
    'APPROVED',
    true
  ),
  (
    'e1500000-0000-4000-8000-000000000005',
    'e1300000-0000-4000-8000-000000000004',
    'e1400000-0000-4000-8000-000000000001',
    'Far Fashion',
    'search-far-fashion',
    'Local fashion collection',
    null,
    'Cotton',
    'WOMEN',
    array['traditional'],
    array['festival'],
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
)
values
  (
    'e1600000-0000-4000-8000-000000000001',
    'e1500000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    'SEARCH-KURTA-M',
    'M',
    150000,
    120000,
    true
  ),
  (
    'e1600000-0000-4000-8000-000000000002',
    'e1500000-0000-4000-8000-000000000002',
    'e1300000-0000-4000-8000-000000000002',
    'SEARCH-SHIRT-M',
    'M',
    100000,
    80000,
    true
  ),
  (
    'e1600000-0000-4000-8000-000000000003',
    'e1500000-0000-4000-8000-000000000003',
    'e1300000-0000-4000-8000-000000000001',
    'SEARCH-PENDING-M',
    'M',
    100000,
    90000,
    true
  ),
  (
    'e1600000-0000-4000-8000-000000000004',
    'e1500000-0000-4000-8000-000000000004',
    'e1300000-0000-4000-8000-000000000003',
    'SEARCH-PAUSED-M',
    'M',
    100000,
    90000,
    true
  ),
  (
    'e1600000-0000-4000-8000-000000000005',
    'e1500000-0000-4000-8000-000000000005',
    'e1300000-0000-4000-8000-000000000004',
    'SEARCH-FAR-M',
    'M',
    100000,
    90000,
    true
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'e1100000-0000-4000-8000-000000000002',
  true
);

select is(
  (
    select count(*)::integer
    from public.search_public_products(
      'fashion',
      13.6288,
      79.4192
    )
  ),
  2,
  'search returns only public products from serviceable shops'
);

select is(
  (
    select product_id
    from public.search_public_products(
      'traditional',
      13.6288,
      79.4192
    )
  ),
  'e1500000-0000-4000-8000-000000000001'::uuid,
  'style tags participate in search'
);

select is(
  (
    select count(*)::integer
    from public.search_public_products(
      'pending',
      13.6288,
      79.4192
    )
  ),
  0,
  'pending products remain hidden'
);

select is(
  (
    select count(*)::integer
    from public.search_public_products(
      'paused',
      13.6288,
      79.4192
    )
  ),
  0,
  'products from paused shops remain hidden'
);

select is(
  (
    select count(*)::integer
    from public.search_public_products(
      'far',
      13.6288,
      79.4192
    )
  ),
  0,
  'products outside the shop service radius remain hidden'
);

select is(
  (
    select count(*)::integer
    from public.search_public_products(
      'fashion',
      13.6288,
      79.4192,
      'e1400000-0000-4000-8000-000000000001'
    )
  ),
  1,
  'category filter is enforced'
);

select is(
  (
    select count(*)::integer
    from public.search_public_products(
      p_query := 'fashion',
      p_latitude := 13.6288,
      p_longitude := 79.4192,
      p_gender := 'MEN'
    )
  ),
  1,
  'gender filter is enforced'
);

select is(
  (
    select count(*)::integer
    from public.search_public_products(
      p_query := 'fashion',
      p_latitude := 13.6288,
      p_longitude := 79.4192,
      p_min_price_paise := 100000,
      p_max_price_paise := 130000
    )
  ),
  1,
  'variant price filter is enforced'
);

select is(
  (
    select product_id
    from public.search_public_products(
      p_query := 'fashion',
      p_latitude := 13.6288,
      p_longitude := 79.4192,
      p_sort := 'PRICE_ASC'
    )
    limit 1
  ),
  'e1500000-0000-4000-8000-000000000002'::uuid,
  'price ascending sort uses the matching active variant price'
);

select is(
  (
    select count(*)::integer
    from public.search_public_products(
      p_query := 'fashion',
      p_latitude := 13.6288,
      p_longitude := 79.4192,
      p_offset := 1,
      p_limit := 1
    )
  ),
  1,
  'bounded offset pagination is respected'
);

select throws_ok(
  $$
    select *
    from public.search_public_products(
      'x',
      13.6288,
      79.4192
    )
  $$,
  '22023',
  'invalid public product-search query',
  'invalid search terms are rejected'
);

select * from finish();

rollback;
