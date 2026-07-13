begin;

select plan(15);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'catalogue-media'
  ),
  'catalogue-media bucket exists'
);

select is(
  (
    select public
    from storage.buckets
    where id = 'catalogue-media'
  ),
  true,
  'catalogue-media bucket is public'
);

select is(
  (
    select file_size_limit
    from storage.buckets
    where id = 'catalogue-media'
  ),
  10485760::bigint,
  'catalogue-media bucket has a 10 MiB limit'
);

select ok(
  (
    select allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[]
    from storage.buckets
    where id = 'catalogue-media'
  ),
  'catalogue-media bucket accepts only supported image formats'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.catalogue_create_product_image(uuid,uuid,text,public.product_image_type,text,integer,boolean,integer,integer)',
    'EXECUTE'
  ),
  'service_role can create product image metadata'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.catalogue_create_product_image(uuid,uuid,text,public.product_image_type,text,integer,boolean,integer,integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute trusted image writes'
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
values (
  'a1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'product-image-merchant@example.test',
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
values (
  'a1000000-0000-4000-8000-000000000001',
  'MERCHANT',
  'Product Image Merchant',
  'ACTIVE'
);

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'a1000000-0000-4000-8000-000000000001',
  'Product Image Merchant Legal'
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
values (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Shop',
  'Product Image Merchant',
  '9000000001',
  'Image Test Street',
  'Tirupati',
  'Tirupati',
  'Andhra Pradesh',
  '517501',
  'IN',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
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
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'IMAGE-SHOP',
  'Image Test Shop',
  'image-test-shop',
  '9000000002',
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
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Image Test Product',
  'image-test-product',
  'PENDING',
  true
);

select lives_ok(
  $$
    select public.catalogue_create_product_image(
      'a3000000-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000001',
      'catalogue/a3000000-0000-4000-8000-000000000001/a4000000-0000-4000-8000-000000000001/front.webp',
      'FRONT',
      'Front image',
      0,
      false,
      1200,
      1600
    )
  $$,
  'first product image can be created'
);

select is(
  (
    select count(*)::integer
    from public.product_images
    where product_id = 'a4000000-0000-4000-8000-000000000001'
      and is_primary
  ),
  1,
  'the first image is automatically primary'
);

select lives_ok(
  $$
    select public.catalogue_create_product_image(
      'a3000000-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000001',
      'catalogue/a3000000-0000-4000-8000-000000000001/a4000000-0000-4000-8000-000000000001/back.webp',
      'BACK',
      'Back image',
      1,
      true,
      1200,
      1600
    )
  $$,
  'a second image can atomically become primary'
);

select is(
  (
    select storage_object_key
    from public.product_images
    where product_id = 'a4000000-0000-4000-8000-000000000001'
      and is_primary
  ),
  'catalogue/a3000000-0000-4000-8000-000000000001/a4000000-0000-4000-8000-000000000001/back.webp',
  'only the requested second image is primary'
);

select lives_ok(
  $$
    select public.catalogue_update_product_image(
      'a3000000-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000001',
      (
        select id
        from public.product_images
        where storage_object_key like '%/front.webp'
      ),
      'DETAIL',
      'Updated detail image',
      5,
      false,
      1000,
      1400
    )
  $$,
  'image metadata can be updated'
);

select is(
  (
    select display_order::integer
    from public.product_images
    where storage_object_key like '%/front.webp'
  ),
  5,
  'image ordering is persisted'
);

select lives_ok(
  $$
    select public.catalogue_delete_product_image(
      'a3000000-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000001',
      (
        select id
        from public.product_images
        where storage_object_key like '%/back.webp'
      )
    )
  $$,
  'primary image metadata can be deleted'
);

select is(
  (
    select storage_object_key
    from public.product_images
    where product_id = 'a4000000-0000-4000-8000-000000000001'
      and is_primary
  ),
  'catalogue/a3000000-0000-4000-8000-000000000001/a4000000-0000-4000-8000-000000000001/front.webp',
  'deleting the primary image promotes the next ordered image'
);

select is(
  (
    select count(*)::integer
    from public.product_images
    where product_id = 'a4000000-0000-4000-8000-000000000001'
  ),
  1,
  'delete removes exactly one image record'
);

select * from finish();

rollback;
