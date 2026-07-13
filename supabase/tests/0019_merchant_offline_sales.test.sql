begin;

select plan(26);

select ok(
  to_regclass('private.offline_sale_requests') is not null,
  'private offline sale idempotency receipts exist'
);

select ok(
  to_regclass('public.offline_sales') is not null,
  'offline sale header table exists'
);

select ok(
  to_regclass('public.offline_sale_items') is not null,
  'offline sale item table exists'
);

select ok(
  to_regprocedure(
    'public.create_merchant_offline_sale(uuid,text,bigint,text,jsonb,uuid,uuid)'
  ) is not null,
  'atomic merchant offline sale RPC exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_merchant_offline_sale(uuid,text,bigint,text,jsonb,uuid,uuid)',
    'EXECUTE'
  ),
  'service role can execute the offline sale RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_merchant_offline_sale(uuid,text,bigint,text,jsonb,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the trusted offline sale RPC'
);

select ok(
  to_regclass('public.inventory_movements_offline_sale_variant_idx') is not null,
  'one inventory movement is allowed per offline sale variant'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'offline_sales'
      and policyname = 'offline_sales_authorized_read'
      and cmd = 'SELECT'
  ),
  'offline sale headers have authorized read RLS'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'offline_sale_items'
      and policyname = 'offline_sale_items_authorized_read'
      and cmd = 'SELECT'
  ),
  'offline sale items have authorized read RLS'
);

select ok(
  has_table_privilege('authenticated', 'public.offline_sales', 'SELECT'),
  'authenticated actors can exercise offline sale RLS'
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
  'e1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'offline-sale-merchant@example.test',
  crypt('local-test-only', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (id, account_type, full_name, status)
values (
  'e1000000-0000-4000-8000-000000000001',
  'MERCHANT',
  'Offline Sale Merchant',
  'ACTIVE'
);

insert into public.merchant_profiles (user_id, legal_name)
values (
  'e1000000-0000-4000-8000-000000000001',
  'Offline Sale Merchant Legal'
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
  'e2000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'Shop',
  'Offline Sale Merchant',
  '9000000020',
  'Offline Sale Street',
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
  'e3000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'OFFLINE-SALE-SHOP',
  'Offline Sale Shop',
  'offline-sale-shop',
  '9000000021',
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
  brand,
  moderation_status,
  is_active
)
values (
  'e4000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Offline Sale Kurta',
  'offline-sale-kurta',
  'Vastra',
  'PENDING',
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
    'OFFLINE-KURTA-M',
    'Blue',
    'M',
    120000,
    100000,
    true
  ),
  (
    'e5000000-0000-4000-8000-000000000002',
    'e4000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'OFFLINE-KURTA-L',
    'Blue',
    'L',
    70000,
    50000,
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
values
  (
    'e3000000-0000-4000-8000-000000000001',
    'e5000000-0000-4000-8000-000000000001',
    5,
    0,
    0,
    1
  ),
  (
    'e3000000-0000-4000-8000-000000000001',
    'e5000000-0000-4000-8000-000000000002',
    3,
    0,
    0,
    1
  );

create temporary table offline_sale_results (
  label text primary key,
  payload jsonb not null
);

insert into offline_sale_results (label, payload)
select
  'first',
  public.create_merchant_offline_sale(
    'e3000000-0000-4000-8000-000000000001',
    '9000000022',
    5000,
    'UPI',
    '[
      {
        "variantId":"e5000000-0000-4000-8000-000000000001",
        "quantity":2,
        "unitPricePaise":100000,
        "discountPaise":10000,
        "identificationMethod":"BARCODE"
      },
      {
        "variantId":"e5000000-0000-4000-8000-000000000002",
        "quantity":1,
        "unitPricePaise":50000,
        "discountPaise":0,
        "identificationMethod":"MANUAL_SEARCH"
      }
    ]'::jsonb,
    'e7000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001'
  );

select is(
  (
    select (payload ->> 'replayed')::boolean
    from offline_sale_results
    where label = 'first'
  ),
  false,
  'first offline sale request is not a replay'
);

select is(
  (
    select (payload ->> 'subtotalPaise')::bigint
    from offline_sale_results
    where label = 'first'
  ),
  250000::bigint,
  'offline sale subtotal is derived from line prices'
);

select is(
  (
    select (payload ->> 'discountPaise')::bigint
    from offline_sale_results
    where label = 'first'
  ),
  10000::bigint,
  'offline sale discount is the sum of line discounts'
);

select is(
  (
    select (payload ->> 'totalPaise')::bigint
    from offline_sale_results
    where label = 'first'
  ),
  245000::bigint,
  'offline sale total includes tax after discounts'
);

select is(
  (select count(*)::integer from public.offline_sale_items),
  2,
  'one immutable sale line is stored for each variant'
);

select is(
  (
    select stock_on_hand::integer
    from public.inventory_balances
    where variant_id = 'e5000000-0000-4000-8000-000000000001'
  ),
  3,
  'first variant stock is reduced by its sold quantity'
);

select is(
  (
    select stock_on_hand::integer
    from public.inventory_balances
    where variant_id = 'e5000000-0000-4000-8000-000000000002'
  ),
  2,
  'second variant stock is reduced by its sold quantity'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where reference_type = 'OFFLINE_SALE'
      and reference_id = (
        select id
        from public.offline_sales
        where idempotency_key = 'e7000000-0000-4000-8000-000000000001'
      )
  ),
  2,
  'each sold variant creates exactly one immutable movement'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events
    where event_type = 'inventory.balance.changed'
      and payload ->> 'offlineSaleId' = (
        select id::text
        from public.offline_sales
        where idempotency_key = 'e7000000-0000-4000-8000-000000000001'
      )
  ),
  2,
  'each sold variant enqueues an availability event'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events
    where event_type = 'offline.sale.created'
      and aggregate_id = (
        select id
        from public.offline_sales
        where idempotency_key = 'e7000000-0000-4000-8000-000000000001'
      )
  ),
  1,
  'sale creation is enqueued in the same transaction'
);

insert into offline_sale_results (label, payload)
select
  'replay',
  public.create_merchant_offline_sale(
    'e3000000-0000-4000-8000-000000000001',
    '9000000022',
    5000,
    'UPI',
    '[
      {
        "variantId":"e5000000-0000-4000-8000-000000000002",
        "quantity":1,
        "unitPricePaise":50000,
        "discountPaise":0,
        "identificationMethod":"MANUAL_SEARCH"
      },
      {
        "variantId":"e5000000-0000-4000-8000-000000000001",
        "quantity":2,
        "unitPricePaise":100000,
        "discountPaise":10000,
        "identificationMethod":"BARCODE"
      }
    ]'::jsonb,
    'e7000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001'
  );

select is(
  (
    select (payload ->> 'replayed')::boolean
    from offline_sale_results
    where label = 'replay'
  ),
  true,
  'same canonical sale request replays when item order differs'
);

select is(
  (select count(*)::integer from public.offline_sales),
  1,
  'idempotent replay does not create another sale header'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where reference_type = 'OFFLINE_SALE'
  ),
  2,
  'idempotent replay does not create more movements'
);

create temporary table offline_sale_errors (
  label text primary key,
  sqlstate text not null
);

do $$
begin
  begin
    perform public.create_merchant_offline_sale(
      'e3000000-0000-4000-8000-000000000001',
      '9000000022',
      5000,
      'UPI',
      '[{
        "variantId":"e5000000-0000-4000-8000-000000000001",
        "quantity":1,
        "unitPricePaise":100000,
        "discountPaise":0,
        "identificationMethod":"BARCODE"
      }]'::jsonb,
      'e7000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001'
    );

    insert into offline_sale_errors values ('idempotency', 'NONE');
  exception
    when others then
      insert into offline_sale_errors values ('idempotency', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from offline_sale_errors
    where label = 'idempotency'
  ),
  'P0002',
  'idempotency key reuse with different sale data is rejected'
);

do $$
begin
  begin
    perform public.create_merchant_offline_sale(
      'e3000000-0000-4000-8000-000000000001',
      null,
      0,
      'CASH',
      '[{
        "variantId":"e5000000-0000-4000-8000-000000000002",
        "quantity":20,
        "unitPricePaise":50000,
        "discountPaise":0,
        "identificationMethod":"MANUAL_SEARCH"
      }]'::jsonb,
      'e7000000-0000-4000-8000-000000000002',
      'e1000000-0000-4000-8000-000000000001'
    );

    insert into offline_sale_errors values ('inventory', 'NONE');
  exception
    when others then
      insert into offline_sale_errors values ('inventory', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from offline_sale_errors
    where label = 'inventory'
  ),
  '23514',
  'offline sales cannot consume unavailable inventory'
);

select is(
  (select count(*)::integer from public.offline_sales),
  1,
  'a failed sale transaction leaves no sale header'
);

select * from finish();

rollback;
