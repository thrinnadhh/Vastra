begin;

select plan(9);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'products_public_read'
      and cmd = 'SELECT'
  ),
  'products retain an approved public-read RLS policy'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_variants'
      and policyname = 'product_variants_public_read'
      and cmd = 'SELECT'
  ),
  'variants retain an active public-read RLS policy'
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
    'b1100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'catalogue-read-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'b1100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'catalogue-read-customer@example.test',
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
    'b1100000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Catalogue Read Merchant',
    'ACTIVE'
  ),
  (
    'b1100000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Catalogue Read Customer',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'b1100000-0000-4000-8000-000000000001',
  'Catalogue Read Merchant Legal'
);

insert into public.customer_profiles (user_id)
values ('b1100000-0000-4000-8000-000000000002');

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
    'b1200000-0000-4000-8000-000000000001',
    'b1100000-0000-4000-8000-000000000001',
    'Public Shop',
    'Catalogue Read Merchant',
    '9000000041',
    'Public Catalogue Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'b1200000-0000-4000-8000-000000000002',
    'b1100000-0000-4000-8000-000000000001',
    'Paused Shop',
    'Catalogue Read Merchant',
    '9000000042',
    'Paused Catalogue Street',
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
  location,
  verification_status,
  operational_status,
  accepts_online_orders
)
values
  (
    'b1300000-0000-4000-8000-000000000001',
    'b1100000-0000-4000-8000-000000000001',
    'b1200000-0000-4000-8000-000000000001',
    'CUSTOMER-CATALOGUE-PUBLIC',
    'Customer Catalogue Public Shop',
    'customer-catalogue-public-shop',
    '9000000043',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true
  ),
  (
    'b1300000-0000-4000-8000-000000000002',
    'b1100000-0000-4000-8000-000000000001',
    'b1200000-0000-4000-8000-000000000002',
    'CUSTOMER-CATALOGUE-PAUSED',
    'Customer Catalogue Paused Shop',
    'customer-catalogue-paused-shop',
    '9000000044',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
    'VERIFIED',
    'PAUSED',
    true
  );

insert into public.products (
  id,
  shop_id,
  category_id,
  name,
  slug,
  brand,
  moderation_status,
  is_active
)
values
  (
    'b1400000-0000-4000-8000-000000000001',
    'b1300000-0000-4000-8000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    'Approved Active Kurta',
    'approved-active-kurta',
    'Vastra',
    'APPROVED',
    true
  ),
  (
    'b1400000-0000-4000-8000-000000000002',
    'b1300000-0000-4000-8000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    'Pending Kurta',
    'pending-kurta',
    'Vastra',
    'PENDING',
    true
  ),
  (
    'b1400000-0000-4000-8000-000000000003',
    'b1300000-0000-4000-8000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    'Inactive Kurta',
    'inactive-kurta',
    'Vastra',
    'APPROVED',
    false
  ),
  (
    'b1400000-0000-4000-8000-000000000004',
    'b1300000-0000-4000-8000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'Paused Shop Kurta',
    'paused-shop-kurta',
    'Vastra',
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
    'b1500000-0000-4000-8000-000000000001',
    'b1400000-0000-4000-8000-000000000001',
    'b1300000-0000-4000-8000-000000000001',
    'CUSTOMER-PUBLIC-M',
    'Blue',
    'M',
    100000,
    90000,
    true
  ),
  (
    'b1500000-0000-4000-8000-000000000002',
    'b1400000-0000-4000-8000-000000000001',
    'b1300000-0000-4000-8000-000000000001',
    'CUSTOMER-INACTIVE-L',
    'Blue',
    'L',
    100000,
    90000,
    false
  ),
  (
    'b1500000-0000-4000-8000-000000000003',
    'b1400000-0000-4000-8000-000000000002',
    'b1300000-0000-4000-8000-000000000001',
    'CUSTOMER-PENDING-M',
    'Black',
    'M',
    100000,
    90000,
    true
  );

insert into public.product_images (
  id,
  product_id,
  variant_id,
  storage_object_key,
  thumbnail_object_key,
  image_type,
  alt_text,
  display_order,
  is_primary
)
values
  (
    'b1600000-0000-4000-8000-000000000001',
    'b1400000-0000-4000-8000-000000000001',
    null,
    'shops/b1300000/public.jpg',
    null,
    'FRONT',
    'Approved active kurta',
    0,
    true
  ),
  (
    'b1600000-0000-4000-8000-000000000002',
    'b1400000-0000-4000-8000-000000000002',
    null,
    'shops/b1300000/pending.jpg',
    null,
    'FRONT',
    'Pending kurta',
    0,
    true
  );

insert into public.inventory_balances (
  shop_id,
  variant_id,
  stock_on_hand,
  reserved_quantity,
  damaged_quantity,
  reorder_level
)
values (
  'b1300000-0000-4000-8000-000000000001',
  'b1500000-0000-4000-8000-000000000001',
  5,
  1,
  1,
  1
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b1100000-0000-4000-8000-000000000002',
  true
);

select is(
  (
    select count(*)::integer
    from public.shops
    where id in (
      'b1300000-0000-4000-8000-000000000001',
      'b1300000-0000-4000-8000-000000000002'
    )
  ),
  1,
  'customer sees the verified public shop but not the paused shop'
);

select is(
  (
    select count(*)::integer
    from public.products
    where id in (
      'b1400000-0000-4000-8000-000000000001',
      'b1400000-0000-4000-8000-000000000002',
      'b1400000-0000-4000-8000-000000000003',
      'b1400000-0000-4000-8000-000000000004'
    )
  ),
  1,
  'customer sees only the approved active product from a public shop'
);

select is(
  (
    select count(*)::integer
    from public.product_variants
    where id in (
      'b1500000-0000-4000-8000-000000000001',
      'b1500000-0000-4000-8000-000000000002',
      'b1500000-0000-4000-8000-000000000003'
    )
  ),
  1,
  'customer sees only active variants of public products'
);

select is(
  (
    select count(*)::integer
    from public.product_images
    where id in (
      'b1600000-0000-4000-8000-000000000001',
      'b1600000-0000-4000-8000-000000000002'
    )
  ),
  1,
  'customer sees images only for public products'
);

select is(
  (
    select count(*)::integer
    from public.inventory_balances
    where variant_id =
      'b1500000-0000-4000-8000-000000000001'
  ),
  0,
  'customer cannot directly read merchant inventory balance internals'
);

select is(
  (
    select count(*)::integer
    from public.products
    where id =
      'b1400000-0000-4000-8000-000000000001'
      and moderation_status = 'APPROVED'
      and is_active
      and deleted_at is null
  ),
  1,
  'visible product satisfies the approved active catalogue contract'
);

select is(
  (
    select count(*)::integer
    from public.product_variants
    where id =
      'b1500000-0000-4000-8000-000000000001'
      and is_active
  ),
  1,
  'visible variant satisfies the active sellable contract'
);

select * from finish();

rollback;
