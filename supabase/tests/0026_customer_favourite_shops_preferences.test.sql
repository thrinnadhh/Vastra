begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(21);

select has_table('public', 'customer_favourite_shops', 'customer favourite shops table exists');
select has_table('public', 'customer_preferences', 'customer preferences table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_favourite_shops'::regclass),
  'customer favourite shops enable RLS'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.customer_favourite_shops'::regclass),
  'customer favourite shops force RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_preferences'::regclass),
  'customer preferences enable RLS'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.customer_preferences'::regclass),
  'customer preferences force RLS'
);

select ok(
  to_regprocedure('public.list_customer_favourite_shops()') is not null,
  'favourite-shop list RPC exists'
);
select ok(
  to_regprocedure('public.set_customer_favourite_shop(uuid,boolean)') is not null,
  'favourite-shop mutation RPC exists'
);
select ok(
  has_function_privilege('authenticated', 'public.list_customer_favourite_shops()', 'EXECUTE'),
  'authenticated customers may list favourites'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.set_customer_favourite_shop(uuid,boolean)',
    'EXECUTE'
  ),
  'authenticated customers may mutate favourites'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.set_customer_favourite_shop(uuid,boolean)',
    'EXECUTE'
  ),
  'anonymous callers cannot mutate favourites'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.customer_favourite_shops'::regclass
      and tgname = 'adjust_shop_follower_count_after_favourite'
      and not tgisinternal
  ),
  'favourite changes maintain follower counts'
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
    'f5100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'preferences-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'f5100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'preferences-customer-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'f5100000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'preferences-customer-two@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, account_type, full_name, status)
values
  ('f5100000-0000-4000-8000-000000000001', 'MERCHANT', 'Preferences Merchant', 'ACTIVE'),
  ('f5100000-0000-4000-8000-000000000002', 'CUSTOMER', 'Preferences Customer One', 'ACTIVE'),
  ('f5100000-0000-4000-8000-000000000003', 'CUSTOMER', 'Preferences Customer Two', 'ACTIVE');

insert into public.merchant_profiles (user_id, legal_name)
values ('f5100000-0000-4000-8000-000000000001', 'Preferences Merchant Legal');

insert into public.customer_profiles (user_id)
values
  ('f5100000-0000-4000-8000-000000000002'),
  ('f5100000-0000-4000-8000-000000000003');

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
  'f5200000-0000-4000-8000-000000000001',
  'f5100000-0000-4000-8000-000000000001',
  'Shop',
  'Preferences Merchant',
  '9000000091',
  'Favourite Street',
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
  accepts_online_orders,
  service_radius_meters
)
values (
  'f5300000-0000-4000-8000-000000000001',
  'f5100000-0000-4000-8000-000000000001',
  'f5200000-0000-4000-8000-000000000001',
  'PREF-FAVOURITE',
  'Preferences Favourite Shop',
  'preferences-favourite-shop',
  '9000000092',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  'VERIFIED',
  'OPEN',
  true,
  5000
);

insert into public.customer_preferences (customer_id, gender_categories, style_tags)
values (
  'f5100000-0000-4000-8000-000000000003',
  array['MEN']::public.product_gender_category[],
  array['Formal']::text[]
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f5100000-0000-4000-8000-000000000002', true);

select *
from public.set_customer_favourite_shop(
  'f5300000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.customer_favourite_shops),
  1,
  'customer adds a favourite shop'
);
select is(
  (select count(*)::integer from public.list_customer_favourite_shops()),
  1,
  'customer lists the favourite shop'
);
select is(
  (
    select follower_count::integer
    from public.shops
    where id = 'f5300000-0000-4000-8000-000000000001'
  ),
  1,
  'adding a favourite increments follower count'
);

select *
from public.set_customer_favourite_shop(
  'f5300000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.customer_favourite_shops),
  1,
  'adding the same favourite is idempotent'
);
select is(
  (
    select follower_count::integer
    from public.shops
    where id = 'f5300000-0000-4000-8000-000000000001'
  ),
  1,
  'idempotent add does not double-count followers'
);

select *
from public.set_customer_favourite_shop(
  'f5300000-0000-4000-8000-000000000001',
  false
);

select is(
  (select count(*)::integer from public.customer_favourite_shops),
  0,
  'customer removes a favourite shop'
);
select is(
  (
    select follower_count::integer
    from public.shops
    where id = 'f5300000-0000-4000-8000-000000000001'
  ),
  0,
  'removing a favourite decrements follower count'
);

insert into public.customer_preferences (
  customer_id,
  gender_categories,
  style_tags,
  occasion_tags,
  preferred_colours,
  preferred_sizes,
  min_price_paise,
  max_price_paise
)
values (
  'f5100000-0000-4000-8000-000000000002',
  array['WOMEN', 'UNISEX']::public.product_gender_category[],
  array['Casual']::text[],
  array['Daily']::text[],
  array['#AABBCC']::text[],
  array['M']::text[],
  10000,
  50000
)
on conflict (customer_id) do update
set
  gender_categories = excluded.gender_categories,
  style_tags = excluded.style_tags,
  occasion_tags = excluded.occasion_tags,
  preferred_colours = excluded.preferred_colours,
  preferred_sizes = excluded.preferred_sizes,
  min_price_paise = excluded.min_price_paise,
  max_price_paise = excluded.max_price_paise;

select is(
  (
    select style_tags[1]
    from public.customer_preferences
    where customer_id = 'f5100000-0000-4000-8000-000000000002'
  ),
  'Casual',
  'customer persists discovery preferences'
);
select is(
  (
    select count(*)::integer
    from public.customer_preferences
    where customer_id in (
      'f5100000-0000-4000-8000-000000000002',
      'f5100000-0000-4000-8000-000000000003'
    )
  ),
  1,
  'customer preference RLS hides another customer row'
);

reset role;
select * from finish();
rollback;
