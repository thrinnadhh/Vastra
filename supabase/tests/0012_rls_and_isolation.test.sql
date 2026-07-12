begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(20);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and (
        not c.relrowsecurity
        or not c.relforcerowsecurity
      )
  ),
  0,
  'every public table enables and forces RLS'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not exists (
        select 1
        from pg_policy p
        where p.polrelid = c.oid
      )
  ),
  0,
  'every public table has at least one policy'
);

select ok(
  to_regprocedure('authz.is_admin()') is not null,
  'administrator predicate exists'
);

select ok(
  to_regprocedure('authz.has_permission(text)') is not null,
  'permission predicate exists'
);

select ok(
  to_regprocedure('authz.owns_shop(uuid)') is not null,
  'shop ownership predicate exists'
);

select ok(
  to_regprocedure('authz.can_access_order(uuid)') is not null,
  'order authorization predicate exists'
);

select ok(
  not has_schema_privilege(
    'public',
    'authz',
    'USAGE'
  ),
  'public cannot use the authorization schema'
);

select ok(
  has_schema_privilege(
    'authenticated',
    'authz',
    'USAGE'
  ),
  'authenticated users may invoke authorization predicates'
);

select is(
  (
    select count(*)::integer
    from public.roles
    where code in (
      'SUPER_ADMIN',
      'OPERATIONS_ADMIN',
      'FINANCE_ADMIN',
      'SUPPORT_AGENT'
    )
  ),
  4,
  'development system roles are seeded'
);

select is(
  (
    select count(*)::integer
    from public.permissions
    where code in (
      'platform.read',
      'platform.write',
      'operations.manage',
      'finance.manage',
      'support.manage',
      'catalogue.moderate',
      'settings.manage'
    )
  ),
  7,
  'development permissions are seeded'
);

select is(
  (
    select count(*)::integer
    from public.categories
    where slug in (
      'men',
      'women',
      'kids',
      'footwear',
      'accessories'
    )
  ),
  5,
  'base catalogue categories are seeded'
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
    '81000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'rls-customer-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'rls-customer-two@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'rls-merchant-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'rls-merchant-two@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'rls-captain-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000006',
    'authenticated',
    'authenticated',
    'rls-captain-two@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-0000-0000-000000000007',
    'authenticated',
    'authenticated',
    'rls-admin@example.test',
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
    '81000000-0000-0000-0000-000000000001',
    'CUSTOMER',
    'RLS Customer One',
    'ACTIVE'
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    'CUSTOMER',
    'RLS Customer Two',
    'ACTIVE'
  ),
  (
    '81000000-0000-0000-0000-000000000003',
    'MERCHANT',
    'RLS Merchant One',
    'ACTIVE'
  ),
  (
    '81000000-0000-0000-0000-000000000004',
    'MERCHANT',
    'RLS Merchant Two',
    'ACTIVE'
  ),
  (
    '81000000-0000-0000-0000-000000000005',
    'CAPTAIN',
    'RLS Captain One',
    'ACTIVE'
  ),
  (
    '81000000-0000-0000-0000-000000000006',
    'CAPTAIN',
    'RLS Captain Two',
    'ACTIVE'
  ),
  (
    '81000000-0000-0000-0000-000000000007',
    'ADMIN',
    'RLS Administrator',
    'ACTIVE'
  );

insert into public.customer_profiles (user_id)
values
  ('81000000-0000-0000-0000-000000000001'),
  ('81000000-0000-0000-0000-000000000002');

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values
  (
    '81000000-0000-0000-0000-000000000003',
    'RLS Merchant One Legal'
  ),
  (
    '81000000-0000-0000-0000-000000000004',
    'RLS Merchant Two Legal'
  );

insert into public.captain_profiles (
  user_id,
  captain_code
)
values
  (
    '81000000-0000-0000-0000-000000000005',
    'RLS-CAPTAIN-ONE'
  ),
  (
    '81000000-0000-0000-0000-000000000006',
    'RLS-CAPTAIN-TWO'
  );

insert into public.admin_profiles (
  user_id,
  employee_code,
  department
)
values (
  '81000000-0000-0000-0000-000000000007',
  'RLS-ADMIN-ONE',
  'PLATFORM'
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
    '82000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    'Home',
    'Customer One',
    '9000000001',
    'Customer One Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    '82000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000002',
    'Home',
    'Customer Two',
    '9000000002',
    'Customer Two Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517502',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  ),
  (
    '82000000-0000-0000-0000-000000000003',
    '81000000-0000-0000-0000-000000000003',
    'Shop',
    'Merchant One',
    '9000000003',
    'Merchant One Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517503',
    'IN',
    'SRID=4326;POINT(79.4210 13.6300)'::extensions.geography
  ),
  (
    '82000000-0000-0000-0000-000000000004',
    '81000000-0000-0000-0000-000000000004',
    'Shop',
    'Merchant Two',
    '9000000004',
    'Merchant Two Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517504',
    'IN',
    'SRID=4326;POINT(79.4220 13.6310)'::extensions.geography
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
    '83000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000003',
    '82000000-0000-0000-0000-000000000003',
    'RLS-SHOP-ONE',
    'RLS Shop One',
    'rls-shop-one',
    '9000000011',
    'SRID=4326;POINT(79.4210 13.6300)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true
  ),
  (
    '83000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000004',
    '82000000-0000-0000-0000-000000000004',
    'RLS-SHOP-TWO',
    'RLS Shop Two',
    'rls-shop-two',
    '9000000012',
    'SRID=4326;POINT(79.4220 13.6310)'::extensions.geography,
    'PENDING',
    'CLOSED_FOR_DAY',
    false
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
values
  (
    '84000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'RLS Public Product',
    'rls-public-product',
    'APPROVED',
    true
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'RLS Hidden Product',
    'rls-hidden-product',
    'APPROVED',
    true
  );

insert into public.orders (
  id,
  order_number,
  idempotency_key,
  customer_id,
  shop_id,
  delivery_address_id,
  address_snapshot
)
values
  (
    '85000000-0000-0000-0000-000000000001',
    'RLS-ORDER-ONE',
    'rls-order-key-one',
    '81000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    '{"label":"Home"}'::jsonb
  ),
  (
    '85000000-0000-0000-0000-000000000002',
    'RLS-ORDER-TWO',
    'rls-order-key-two',
    '81000000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000002',
    '82000000-0000-0000-0000-000000000002',
    '{"label":"Home"}'::jsonb
  );

insert into public.delivery_tasks (
  id,
  order_id,
  task_type,
  pickup_shop_id,
  pickup_address_snapshot,
  drop_address_snapshot,
  pickup_location,
  drop_location,
  status,
  assigned_captain_id,
  assigned_at
)
values
  (
    '86000000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000001',
    'FORWARD_DELIVERY',
    '83000000-0000-0000-0000-000000000001',
    '{"shop":"one"}'::jsonb,
    '{"customer":"one"}'::jsonb,
    'SRID=4326;POINT(79.4210 13.6300)'::extensions.geography,
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'ASSIGNED',
    '81000000-0000-0000-0000-000000000005',
    now()
  ),
  (
    '86000000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000002',
    'FORWARD_DELIVERY',
    '83000000-0000-0000-0000-000000000002',
    '{"shop":"two"}'::jsonb,
    '{"customer":"two"}'::jsonb,
    'SRID=4326;POINT(79.4220 13.6310)'::extensions.geography,
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
    'ASSIGNED',
    '81000000-0000-0000-0000-000000000006',
    now()
  );

set local role anon;

select is(
  (
    select count(*)::integer
    from public.shops
    where id in (
      '83000000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'anonymous users see verified shops only'
);

select is(
  (
    select count(*)::integer
    from public.products
    where id in (
      '84000000-0000-0000-0000-000000000001',
      '84000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'anonymous users see products from public shops only'
);

reset role;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-0000-0000-000000000001',
  true
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '81000000-0000-0000-0000-000000000001',
      '81000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'customers see only their own profile'
);

select is(
  (
    select count(*)::integer
    from public.addresses
    where id in (
      '82000000-0000-0000-0000-000000000001',
      '82000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'customers see only their own addresses'
);

select is(
  (
    select count(*)::integer
    from public.orders
    where id in (
      '85000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'customers see only their own orders'
);

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-0000-0000-000000000003',
  true
);

select is(
  (
    select count(*)::integer
    from public.shops
    where id in (
      '83000000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'merchants cannot read another merchant private shop'
);

select is(
  (
    select count(*)::integer
    from public.orders
    where id in (
      '85000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'merchants see orders for their shops only'
);

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-0000-0000-000000000005',
  true
);

select is(
  (
    select count(*)::integer
    from public.delivery_tasks
    where id in (
      '86000000-0000-0000-0000-000000000001',
      '86000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'captains see only assigned delivery tasks'
);

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-0000-0000-000000000007',
  true
);

select is(
  (
    select count(*)::integer
    from public.orders
    where id in (
      '85000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000002'
    )
  ),
  2,
  'administrators can read cross-tenant orders'
);

reset role;

select * from finish();

rollback;
