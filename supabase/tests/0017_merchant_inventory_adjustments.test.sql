begin;

select plan(20);

select ok(
  to_regclass('private.inventory_adjustment_requests') is not null,
  'private inventory adjustment idempotency receipts exist'
);

select ok(
  to_regprocedure(
    'public.apply_merchant_inventory_adjustment(uuid,uuid,text,integer,text,integer,uuid,uuid)'
  ) is not null,
  'atomic merchant inventory adjustment RPC exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.apply_merchant_inventory_adjustment(uuid,uuid,text,integer,text,integer,uuid,uuid)',
    'EXECUTE'
  ),
  'service role can execute the inventory adjustment RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_merchant_inventory_adjustment(uuid,uuid,text,integer,text,integer,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the trusted adjustment RPC directly'
);

select ok(
  to_regclass(
    'public.inventory_movements_merchant_adjustment_request_idx'
  ) is not null,
  'one movement is allowed per merchant adjustment idempotency key'
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
  'd1000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'inventory-writer@example.test',
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
  'd1000000-0000-4000-8000-000000000001',
  'MERCHANT',
  'Inventory Writer',
  'ACTIVE'
);

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'd1000000-0000-4000-8000-000000000001',
  'Inventory Writer Legal'
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
  'd2000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'Shop',
  'Inventory Writer',
  '9000000015',
  'Inventory Write Street',
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
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'INVENTORY-WRITE-SHOP',
  'Inventory Write Shop',
  'inventory-write-shop',
  '9000000016',
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
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Inventory Write Kurta',
  'inventory-write-kurta',
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
values (
  'd5000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'INV-WRITE-KURTA-M',
  'Blue',
  'M',
  199900,
  149900,
  true
);

create temporary table adjustment_results (
  label text primary key,
  payload jsonb not null
);

insert into adjustment_results (label, payload)
select
  'first',
  public.apply_merchant_inventory_adjustment(
    'd5000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'ADD_STOCK',
    15,
    'Initial stock receipt',
    null,
    'd7000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001'
  );

select is(
  (
    select stock_on_hand::integer
    from public.inventory_balances
    where variant_id = 'd5000000-0000-4000-8000-000000000001'
  ),
  15,
  'first adjustment creates and updates the authoritative balance'
);

select is(
  (
    select version::integer
    from public.inventory_balances
    where variant_id = 'd5000000-0000-4000-8000-000000000001'
  ),
  2,
  'first adjustment advances the inventory version'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where reference_id = 'd7000000-0000-4000-8000-000000000001'
  ),
  1,
  'one immutable movement is written for the adjustment'
);

select is(
  (
    select payload #>> '{movement,movementType}'
    from adjustment_results
    where label = 'first'
  ),
  'STOCK_RECEIVED',
  'add-stock maps to the stock-received movement type'
);

select is(
  (
    select count(*)::integer
    from public.outbox_events
    where event_type = 'inventory.balance.changed'
      and aggregate_id = 'd5000000-0000-4000-8000-000000000001'
  ),
  1,
  'availability change is enqueued in the same transaction'
);

insert into adjustment_results (label, payload)
select
  'replay',
  public.apply_merchant_inventory_adjustment(
    'd5000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'ADD_STOCK',
    15,
    'Initial stock receipt',
    null,
    'd7000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001'
  );

select is(
  (
    select (payload ->> 'replayed')::boolean
    from adjustment_results
    where label = 'replay'
  ),
  true,
  'same idempotency key and payload replays the stored result'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where reference_id = 'd7000000-0000-4000-8000-000000000001'
  ),
  1,
  'idempotent replay does not create a second movement'
);

create temporary table adjustment_errors (
  label text primary key,
  sqlstate text not null
);

do $$
begin
  begin
    perform public.apply_merchant_inventory_adjustment(
      'd5000000-0000-4000-8000-000000000001',
      'd3000000-0000-4000-8000-000000000001',
      'ADD_STOCK',
      16,
      'Different payload',
      null,
      'd7000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001'
    );

    insert into adjustment_errors values ('idempotency', 'NONE');
  exception
    when others then
      insert into adjustment_errors values ('idempotency', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from adjustment_errors
    where label = 'idempotency'
  ),
  'P0002',
  'same idempotency key with a different payload is rejected'
);

do $$
begin
  begin
    perform public.apply_merchant_inventory_adjustment(
      'd5000000-0000-4000-8000-000000000001',
      'd3000000-0000-4000-8000-000000000001',
      'ADD_STOCK',
      1,
      'Stale version',
      1,
      'd7000000-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000001'
    );

    insert into adjustment_errors values ('version', 'NONE');
  exception
    when others then
      insert into adjustment_errors values ('version', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from adjustment_errors
    where label = 'version'
  ),
  '40001',
  'stale expected versions are rejected before mutation'
);

insert into adjustment_results (label, payload)
select
  'damaged',
  public.apply_merchant_inventory_adjustment(
    'd5000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'MARK_DAMAGED',
  2,
  'Two items damaged',
  2,
  'd7000000-0000-4000-8000-000000000003',
  'd1000000-0000-4000-8000-000000000001'
);

select is(
  (
    select damaged_quantity::integer
    from public.inventory_balances
    where variant_id = 'd5000000-0000-4000-8000-000000000001'
  ),
  2,
  'mark-damaged moves sellable availability into damaged quantity'
);

do $$
begin
  begin
    perform public.apply_merchant_inventory_adjustment(
      'd5000000-0000-4000-8000-000000000001',
      'd3000000-0000-4000-8000-000000000001',
      'MARK_DAMAGED',
      20,
      'Impossible damaged quantity',
      3,
      'd7000000-0000-4000-8000-000000000004',
      'd1000000-0000-4000-8000-000000000001'
    );

    insert into adjustment_errors values ('negative', 'NONE');
  exception
    when others then
      insert into adjustment_errors values ('negative', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from adjustment_errors
    where label = 'negative'
  ),
  '23514',
  'adjustments that would create invalid available stock are rejected'
);

insert into adjustment_results (label, payload)
select
  'stock-check',
  public.apply_merchant_inventory_adjustment(
    'd5000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'STOCK_CHECK',
  12,
  'Physical stock count',
  3,
  'd7000000-0000-4000-8000-000000000005',
  'd1000000-0000-4000-8000-000000000001'
);

select is(
  (
    select stock_on_hand::integer
    from public.inventory_balances
    where variant_id = 'd5000000-0000-4000-8000-000000000001'
  ),
  12,
  'stock check reconciles stock on hand to the counted quantity'
);

select ok(
  (
    select last_counted_at is not null
    from public.inventory_balances
    where variant_id = 'd5000000-0000-4000-8000-000000000001'
  ),
  'stock check records the physical count timestamp'
);

select is(
  (
    select movement_type::text
    from public.inventory_movements
    where reference_id = 'd7000000-0000-4000-8000-000000000005'
  ),
  'STOCK_AUDIT',
  'stock check creates an immutable stock-audit movement'
);

select is(
  (
    select count(*)::integer
    from private.inventory_adjustment_requests
    where result_payload is not null
      and completed_at is not null
  ),
  3,
  'only successful unique adjustments retain completed idempotency receipts'
);

select * from finish();

rollback;
