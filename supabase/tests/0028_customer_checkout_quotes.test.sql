begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(34);

select has_table(
  'public',
  'checkout_quotes',
  'checkout quotes table exists'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.checkout_quotes'::regclass
  ),
  'checkout quotes enable RLS'
);

select ok(
  (
    select relforcerowsecurity
    from pg_class
    where oid = 'public.checkout_quotes'::regclass
  ),
  'checkout quotes force RLS'
);

select ok(
  to_regprocedure(
    'public.create_customer_checkout_quote(uuid,uuid)'
  ) is not null,
  'customer checkout quote RPC exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_customer_checkout_quote(uuid,uuid)',
    'EXECUTE'
  ),
  'service role can create checkout quotes'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_customer_checkout_quote(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute trusted quote RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_customer_checkout_quote(uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous clients cannot execute trusted quote RPC'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.checkout_quotes',
    'SELECT'
  ),
  'authenticated clients cannot read checkout quote snapshots directly'
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
    'a7100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'quote-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'a7100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'quote-customer-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'a7100000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'quote-customer-two@example.test',
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
    'a7100000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Quote Merchant',
    'ACTIVE'
  ),
  (
    'a7100000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Quote Customer One',
    'ACTIVE'
  ),
  (
    'a7100000-0000-4000-8000-000000000003',
    'CUSTOMER',
    'Quote Customer Two',
    'ACTIVE'
  );

insert into public.merchant_profiles (user_id, legal_name)
values (
  'a7100000-0000-4000-8000-000000000001',
  'Quote Merchant Legal'
);

insert into public.customer_profiles (user_id)
values
  ('a7100000-0000-4000-8000-000000000002'),
  ('a7100000-0000-4000-8000-000000000003');

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
    'a7200000-0000-4000-8000-000000000001',
    'a7100000-0000-4000-8000-000000000001',
    'Shop',
    'Quote Merchant',
    '9000000101',
    'Quote Shop Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'a7200000-0000-4000-8000-000000000002',
    'a7100000-0000-4000-8000-000000000002',
    'Home',
    'Quote Customer One',
    '9000000102',
    'Near Quote Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  ),
  (
    'a7200000-0000-4000-8000-000000000003',
    'a7100000-0000-4000-8000-000000000002',
    'Far',
    'Quote Customer One',
    '9000000103',
    'Far Quote Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.5200 13.7200)'::extensions.geography
  ),
  (
    'a7200000-0000-4000-8000-000000000004',
    'a7100000-0000-4000-8000-000000000003',
    'Other',
    'Quote Customer Two',
    '9000000104',
    'Other Quote Street',
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
  accepts_online_orders,
  service_radius_meters,
  minimum_order_paise,
  average_preparation_minutes
)
values (
  'a7300000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000001',
  'a7200000-0000-4000-8000-000000000001',
  'QUOTE-SHOP',
  'Quote Shop',
  'quote-shop',
  '9000000105',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  'VERIFIED',
  'OPEN',
  true,
  5000,
  50000,
  20
);

insert into public.categories (
  id,
  name,
  slug,
  display_order,
  is_active
)
values (
  'a7400000-0000-4000-8000-000000000001',
  'Quote Kurtas',
  'quote-kurtas',
  1,
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
  'a7500000-0000-4000-8000-000000000001',
  'a7300000-0000-4000-8000-000000000001',
  'a7400000-0000-4000-8000-000000000001',
  'Quote Kurta',
  'quote-kurta',
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
values (
  'a7600000-0000-4000-8000-000000000001',
  'a7500000-0000-4000-8000-000000000001',
  'a7300000-0000-4000-8000-000000000001',
  'QUOTE-KURTA-M',
  'Blue',
  'M',
  70000,
  50000,
  true
);

insert into public.carts (
  id,
  customer_id,
  shop_id,
  status
)
values (
  'a7700000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000002',
  'a7300000-0000-4000-8000-000000000001',
  'ACTIVE'
);

insert into public.cart_items (
  id,
  cart_id,
  shop_id,
  variant_id,
  quantity,
  unit_price_snapshot_paise
)
values (
  'a7800000-0000-4000-8000-000000000001',
  'a7700000-0000-4000-8000-000000000001',
  'a7300000-0000-4000-8000-000000000001',
  'a7600000-0000-4000-8000-000000000001',
  2,
  50000
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
  'a7300000-0000-4000-8000-000000000001',
  'a7600000-0000-4000-8000-000000000001',
  5,
  0,
  0,
  1
);

create temporary table quote_results (
  label text primary key,
  payload jsonb not null
);

insert into quote_results (label, payload)
select
  'initial',
  public.create_customer_checkout_quote(
    'a7100000-0000-4000-8000-000000000002',
    'a7200000-0000-4000-8000-000000000002'
  );

select ok(
  (
    select (payload ->> 'id')::uuid is not null
    from quote_results
    where label = 'initial'
  ),
  'quote returns a generated identifier'
);

select is(
  (
    select payload ->> 'cartId'
    from quote_results
    where label = 'initial'
  ),
  'a7700000-0000-4000-8000-000000000001',
  'quote belongs to the active customer cart'
);

select is(
  (
    select payload #>> '{address,id}'
    from quote_results
    where label = 'initial'
  ),
  'a7200000-0000-4000-8000-000000000002',
  'quote uses the owned delivery address'
);

select is(
  (
    select (payload #>> '{totals,subtotalPaise}')::bigint
    from quote_results
    where label = 'initial'
  ),
  100000::bigint,
  'quote recalculates the live subtotal'
);

select is(
  (
    select (payload #>> '{totals,deliveryFeePaise}')::bigint
    from quote_results
    where label = 'initial'
  ),
  0::bigint,
  'undefined pilot delivery fee is explicitly zero'
);

select is(
  (
    select (payload #>> '{totals,totalPaise}')::bigint
    from quote_results
    where label = 'initial'
  ),
  100000::bigint,
  'quote total arithmetic is stable'
);

select ok(
  (
    select
      (payload #>> '{shop,distanceMeters}')::integer
      <=
      (payload #>> '{shop,serviceRadiusMeters}')::integer
    from quote_results
    where label = 'initial'
  ),
  'quote confirms address serviceability'
);

select is(
  (
    select jsonb_array_length(payload -> 'items')
    from quote_results
    where label = 'initial'
  ),
  1,
  'quote contains the active cart lines'
);

select is(
  (
    select (payload #>> '{items,0,unitPricePaise}')::bigint
    from quote_results
    where label = 'initial'
  ),
  50000::bigint,
  'quote item uses the current variant price'
);

select is(
  (
    select (payload #>> '{items,0,availableQuantity}')::integer
    from quote_results
    where label = 'initial'
  ),
  5,
  'quote item reports effective live availability'
);

select ok(
  (
    select
      (payload ->> 'expiresAt')::timestamptz
      >
      (payload ->> 'createdAt')::timestamptz
    from quote_results
    where label = 'initial'
  ),
  'quote has a future expiry'
);

select ok(
  (
    select
      (payload ->> 'estimatedDeliveryAt')::timestamptz
      >
      (payload ->> 'createdAt')::timestamptz
    from quote_results
    where label = 'initial'
  ),
  'quote returns a future delivery ETA'
);

select is(
  (
    select count(*)::integer
    from public.checkout_quotes
    where customer_id =
      'a7100000-0000-4000-8000-000000000002'
  ),
  1,
  'quote snapshot is persisted for later order validation'
);

select ok(
  (
    select cart_snapshot_hash ~ '^[0-9a-f]{64}$'
    from public.checkout_quotes
    where customer_id =
      'a7100000-0000-4000-8000-000000000002'
    order by created_at
    limit 1
  ),
  'quote persists a deterministic SHA-256 cart snapshot hash'
);

select is(
  (
    select count(*)::integer
    from public.inventory_reservations
    where cart_id =
      'a7700000-0000-4000-8000-000000000001'
  ),
  0,
  'quote creation does not reserve inventory'
);

select is(
  (
    select count(*)::integer
    from public.orders
    where cart_id =
      'a7700000-0000-4000-8000-000000000001'
  ),
  0,
  'quote creation does not create an order'
);

update public.product_variants
set selling_price_paise = 60000
where id = 'a7600000-0000-4000-8000-000000000001';

insert into quote_results (label, payload)
select
  'repriced',
  public.create_customer_checkout_quote(
    'a7100000-0000-4000-8000-000000000002',
    'a7200000-0000-4000-8000-000000000002'
  );

select is(
  (
    select (payload #>> '{items,0,unitPricePaise}')::bigint
    from quote_results
    where label = 'repriced'
  ),
  60000::bigint,
  'quote refreshes a changed catalogue price'
);

select is(
  (
    select (payload #>> '{items,0,previousUnitPricePaise}')::bigint
    from quote_results
    where label = 'repriced'
  ),
  50000::bigint,
  'quote preserves the prior cart price for disclosure'
);

select is(
  (
    select (payload #>> '{items,0,priceChanged}')::boolean
    from quote_results
    where label = 'repriced'
  ),
  true,
  'quote marks a changed price'
);

select is(
  (
    select unit_price_snapshot_paise::bigint
    from public.cart_items
    where id = 'a7800000-0000-4000-8000-000000000001'
  ),
  50000::bigint,
  'quote creation does not mutate the cart price snapshot'
);

create temporary table quote_errors (
  label text primary key,
  sqlstate text not null
);

do $$
begin
  begin
    perform public.create_customer_checkout_quote(
      'a7100000-0000-4000-8000-000000000002',
      'a7200000-0000-4000-8000-000000000004'
    );
    insert into quote_errors values ('other_address', 'NONE');
  exception
    when others then
      insert into quote_errors values ('other_address', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from quote_errors
    where label = 'other_address'
  ),
  'P0006',
  'another customer address is not visible to checkout'
);

do $$
begin
  begin
    perform public.create_customer_checkout_quote(
      'a7100000-0000-4000-8000-000000000002',
      'a7200000-0000-4000-8000-000000000003'
    );
    insert into quote_errors values ('service_area', 'NONE');
  exception
    when others then
      insert into quote_errors values ('service_area', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from quote_errors
    where label = 'service_area'
  ),
  'P0008',
  'address outside the service radius is rejected'
);

update public.shops
set minimum_order_paise = 200000
where id = 'a7300000-0000-4000-8000-000000000001';

do $$
begin
  begin
    perform public.create_customer_checkout_quote(
      'a7100000-0000-4000-8000-000000000002',
      'a7200000-0000-4000-8000-000000000002'
    );
    insert into quote_errors values ('minimum_order', 'NONE');
  exception
    when others then
      insert into quote_errors values ('minimum_order', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from quote_errors
    where label = 'minimum_order'
  ),
  'P0009',
  'minimum order is revalidated'
);

update public.shops
set minimum_order_paise = 50000
where id = 'a7300000-0000-4000-8000-000000000001';

update public.inventory_balances
set stock_on_hand = 1
where variant_id = 'a7600000-0000-4000-8000-000000000001';

do $$
begin
  begin
    perform public.create_customer_checkout_quote(
      'a7100000-0000-4000-8000-000000000002',
      'a7200000-0000-4000-8000-000000000002'
    );
    insert into quote_errors values ('inventory', 'NONE');
  exception
    when others then
      insert into quote_errors values ('inventory', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from quote_errors
    where label = 'inventory'
  ),
  'P0014',
  'insufficient live stock is rejected'
);

update public.inventory_balances
set stock_on_hand = 5
where variant_id = 'a7600000-0000-4000-8000-000000000001';

update public.shops
set operational_status = 'CLOSED_FOR_DAY'
where id = 'a7300000-0000-4000-8000-000000000001';

do $$
begin
  begin
    perform public.create_customer_checkout_quote(
      'a7100000-0000-4000-8000-000000000002',
      'a7200000-0000-4000-8000-000000000002'
    );
    insert into quote_errors values ('shop', 'NONE');
  exception
    when others then
      insert into quote_errors values ('shop', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from quote_errors
    where label = 'shop'
  ),
  'P0007',
  'closed shop cannot produce a checkout quote'
);

update public.shops
set operational_status = 'OPEN'
where id = 'a7300000-0000-4000-8000-000000000001';

do $$
begin
  begin
    perform public.create_customer_checkout_quote(
      'a7100000-0000-4000-8000-000000000003',
      'a7200000-0000-4000-8000-000000000004'
    );
    insert into quote_errors values ('cart', 'NONE');
  exception
    when others then
      insert into quote_errors values ('cart', sqlstate);
  end;
end;
$$;

select is(
  (
    select sqlstate
    from quote_errors
    where label = 'cart'
  ),
  'P0002',
  'customer without an active cart cannot create a quote'
);

select * from finish();
rollback;
