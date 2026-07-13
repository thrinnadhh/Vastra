begin;

select plan(9);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_shop_sku_key'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'u'
  ),
  'SKUs are unique within a shop'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_price_check'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'c'
  ),
  'selling price cannot exceed MRP'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_colour_hex_format'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'c'
  ),
  'variant colour hex values are constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'product_variants_attributes_object'
      and conrelid = 'public.product_variants'::regclass
      and contype = 'c'
  ),
  'variant attributes must be a JSON object'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.product_variants'::regclass
      and tgname = 'set_product_variants_updated_at'
      and not tgisinternal
  ),
  'variant updates refresh updated_at'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_variants'
      and policyname = 'product_variants_merchant_read'
      and cmd = 'SELECT'
  ),
  'merchants have owner-scoped variant reads'
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
  'b1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'variant-merchant@example.test',
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
  'b1000000-0000-4000-8000-000000000001',
  'MERCHANT',
  'Variant Merchant',
  'ACTIVE'
);

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'b1000000-0000-4000-8000-000000000001',
  'Variant Merchant Legal'
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
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'Shop',
  'Variant Merchant',
  '9000000011',
  'Variant Test Street',
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
  'b3000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'VARIANT-SHOP',
  'Variant Test Shop',
  'variant-test-shop',
  '9000000012',
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
  'b4000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Variant Test Product',
  'variant-test-product',
  'PENDING',
  true
);

insert into public.product_variants (
  id,
  product_id,
  shop_id,
  sku,
  colour_name,
  colour_hex,
  size_label,
  mrp_paise,
  selling_price_paise,
  cost_price_paise,
  weight_grams,
  length_cm,
  width_cm,
  height_cm,
  attributes,
  is_active
)
values (
  'b5000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'KURTA-BLUE-M',
  'Blue',
  '#0000FF',
  'M',
  199900,
  149900,
  90000,
  400,
  30.00,
  20.00,
  4.00,
  '{"fit":"REGULAR"}'::jsonb,
  true
);

select is(
  (
    select sku
    from public.product_variants
    where id = 'b5000000-0000-4000-8000-000000000001'
  ),
  'KURTA-BLUE-M',
  'a merchant SKU can be persisted'
);

select is(
  (
    select attributes ->> 'fit'
    from public.product_variants
    where id = 'b5000000-0000-4000-8000-000000000001'
  ),
  'REGULAR',
  'variant-specific attributes are persisted'
);

update public.product_variants
set is_active = false
where id = 'b5000000-0000-4000-8000-000000000001';

select is(
  (
    select is_active
    from public.product_variants
    where id = 'b5000000-0000-4000-8000-000000000001'
  ),
  false,
  'variants can be deactivated without deleting SKU identity'
);

select * from finish();

rollback;
