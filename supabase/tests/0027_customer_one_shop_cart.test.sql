begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(31);

select ok(
  to_regprocedure('public.get_customer_cart()') is not null,
  'customer cart read RPC exists'
);

select ok(
  to_regprocedure(
    'public.set_customer_cart_item(uuid,uuid,integer,boolean)'
  ) is not null,
  'customer cart set-item RPC exists'
);

select ok(
  to_regprocedure(
    'public.update_customer_cart_item(uuid,uuid,integer)'
  ) is not null,
  'customer cart update-item RPC exists'
);

select ok(
  to_regprocedure(
    'public.remove_customer_cart_item(uuid,uuid)'
  ) is not null,
  'customer cart remove-item RPC exists'
);

select ok(
  to_regprocedure('public.clear_customer_cart(uuid)') is not null,
  'customer cart clear RPC exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_customer_cart()',
    'EXECUTE'
  ),
  'authenticated customers may read their cart'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.set_customer_cart_item(uuid,uuid,integer,boolean)',
    'EXECUTE'
  ),
  'trusted backend may mutate customer carts'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.set_customer_cart_item(uuid,uuid,integer,boolean)',
    'EXECUTE'
  ),
  'authenticated clients cannot call trusted cart mutations directly'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.set_customer_cart_item(uuid,uuid,integer,boolean)',
    'EXECUTE'
  ),
  'anonymous callers cannot mutate carts'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.carts',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.carts',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.carts',
    'DELETE'
  ),
  'authenticated clients cannot bypass backend cart mutations'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.cart_items',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.cart_items',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.cart_items',
    'DELETE'
  ),
  'authenticated clients cannot bypass backend cart-item mutations'
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
    'c6100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'cart-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'c6100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'cart-customer-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'c6100000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'cart-customer-two@example.test',
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
    'c6100000-0000-4000-8000-000000000001',
    'MERCHANT',
    'Cart Merchant',
    'ACTIVE'
  ),
  (
    'c6100000-0000-4000-8000-000000000002',
    'CUSTOMER',
    'Cart Customer One',
    'ACTIVE'
  ),
  (
    'c6100000-0000-4000-8000-000000000003',
    'CUSTOMER',
    'Cart Customer Two',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  'c6100000-0000-4000-8000-000000000001',
  'Cart Merchant Legal'
);

insert into public.customer_profiles (user_id)
values
  ('c6100000-0000-4000-8000-000000000002'),
  ('c6100000-0000-4000-8000-000000000003');

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
    'c6200000-0000-4000-8000-000000000001',
    'c6100000-0000-4000-8000-000000000001',
    'Shop A',
    'Cart Merchant',
    '9000000111',
    'Cart Street A',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'c6200000-0000-4000-8000-000000000002',
    'c6100000-0000-4000-8000-000000000001',
    'Shop B',
    'Cart Merchant',
    '9000000112',
    'Cart Street B',
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
  service_radius_meters
)
values
  (
    'c6300000-0000-4000-8000-000000000001',
    'c6100000-0000-4000-8000-000000000001',
    'c6200000-0000-4000-8000-000000000001',
    'CART-SHOP-A',
    'Cart Shop A',
    'cart-shop-a',
    '9000000113',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true,
    5000
  ),
  (
    'c6300000-0000-4000-8000-000000000002',
    'c6100000-0000-4000-8000-000000000001',
    'c6200000-0000-4000-8000-000000000002',
    'CART-SHOP-B',
    'Cart Shop B',
    'cart-shop-b',
    '9000000114',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
    'VERIFIED',
    'OPEN',
    true,
    5000
  );

insert into public.categories (
  id,
  name,
  slug,
  display_order,
  is_active
)
values (
  'c6400000-0000-4000-8000-000000000001',
  'Cart Test Clothing',
  'cart-test-clothing',
  901,
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
    'c6500000-0000-4000-8000-000000000001',
    'c6300000-0000-4000-8000-000000000001',
    'c6400000-0000-4000-8000-000000000001',
    'Cart Kurta',
    'cart-kurta',
    'Vastra',
    'APPROVED',
    true
  ),
  (
    'c6500000-0000-4000-8000-000000000002',
    'c6300000-0000-4000-8000-000000000002',
    'c6400000-0000-4000-8000-000000000001',
    'Cart Shirt',
    'cart-shirt',
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
    'c6600000-0000-4000-8000-000000000001',
    'c6500000-0000-4000-8000-000000000001',
    'c6300000-0000-4000-8000-000000000001',
    'CART-KURTA-M',
    'Blue',
    'M',
    90000,
    75000,
    true
  ),
  (
    'c6600000-0000-4000-8000-000000000002',
    'c6500000-0000-4000-8000-000000000002',
    'c6300000-0000-4000-8000-000000000002',
    'CART-SHIRT-M',
    'White',
    'M',
    80000,
    60000,
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
    'c6300000-0000-4000-8000-000000000001',
    'c6600000-0000-4000-8000-000000000001',
    5,
    0,
    0,
    1
  ),
  (
    'c6300000-0000-4000-8000-000000000002',
    'c6600000-0000-4000-8000-000000000002',
    5,
    0,
    0,
    1
  );

insert into public.carts (
  id,
  customer_id,
  shop_id,
  status
)
values (
  'c6700000-0000-4000-8000-000000000099',
  'c6100000-0000-4000-8000-000000000003',
  'c6300000-0000-4000-8000-000000000001',
  'ACTIVE'
);

create temporary table cart_results (
  label text primary key,
  payload jsonb not null
);

grant select, insert, update, delete
on table cart_results
to authenticated, service_role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'c6100000-0000-4000-8000-000000000002',
  true
);

insert into cart_results (label, payload)
values ('initial', public.get_customer_cart());

select is(
  (
    select payload -> 'cart'
    from cart_results
    where label = 'initial'
  ),
  'null'::jsonb,
  'a customer starts with no active cart'
);

select is(
  (
    select count(*)::integer
    from public.carts cart
    where cart.customer_id =
      'c6100000-0000-4000-8000-000000000003'
  ),
  0,
  'cart RLS hides another customer cart'
);

reset role;
-- Trusted mutation RPC privileges for service_role are asserted above.
-- Invoke them as the migration owner so direct verification queries do not
-- inherit service-role table ACL or RLS restrictions.

insert into cart_results (label, payload)
values (
  'shop-a',
  public.set_customer_cart_item(
    'c6100000-0000-4000-8000-000000000002',
    'c6600000-0000-4000-8000-000000000001',
    2,
    false
  )
);

select is(
  (
    select payload #>> '{cart,shop,id}'
    from cart_results
    where label = 'shop-a'
  ),
  'c6300000-0000-4000-8000-000000000001',
  'first item creates a cart for its shop'
);

select is(
  (
    select (payload #>> '{cart,items,0,quantity}')::integer
    from cart_results
    where label = 'shop-a'
  ),
  2,
  'cart stores the desired quantity'
);

select is(
  (
    select (payload #>> '{cart,itemCount}')::integer
    from cart_results
    where label = 'shop-a'
  ),
  2,
  'cart item count sums line quantities'
);

select is(
  (
    select (payload #>> '{cart,items,0,unitPricePaise}')::bigint
    from cart_results
    where label = 'shop-a'
  ),
  75000::bigint,
  'cart snapshots the add-time price in paise'
);

select is(
  (
    select count(*)::integer
    from public.carts cart
    where cart.customer_id =
      'c6100000-0000-4000-8000-000000000002'
      and cart.status = 'ACTIVE'
  ),
  1,
  'customer has exactly one active cart'
);

create temporary table cart_errors (
  label text primary key,
  sqlstate text not null,
  message text not null
);

do $$
begin
  begin
    perform public.set_customer_cart_item(
      'c6100000-0000-4000-8000-000000000002',
      'c6600000-0000-4000-8000-000000000002',
      1,
      false
    );

    insert into cart_errors values (
      'cross-shop',
      'NONE',
      'no exception raised'
    );
  exception
    when others then
      insert into cart_errors values (
        'cross-shop',
        sqlstate,
        sqlerrm
      );
  end;
end;
$$;

select is(
  (
    select sqlstate || ':' || message
    from cart_errors
    where label = 'cross-shop'
  ),
  'P0003:active cart belongs to another shop',
  'cross-shop add requires explicit replacement confirmation'
);

select is(
  (
    select shop_id::text
    from public.carts cart
    where cart.customer_id =
      'c6100000-0000-4000-8000-000000000002'
      and cart.status = 'ACTIVE'
  ),
  'c6300000-0000-4000-8000-000000000001',
  'rejected cross-shop add does not silently replace the cart'
);

insert into cart_results (label, payload)
values (
  'shop-b',
  public.set_customer_cart_item(
    'c6100000-0000-4000-8000-000000000002',
    'c6600000-0000-4000-8000-000000000002',
    1,
    true
  )
);

select is(
  (
    select payload #>> '{cart,shop,id}'
    from cart_results
    where label = 'shop-b'
  ),
  'c6300000-0000-4000-8000-000000000002',
  'confirmed replacement creates the other shop cart'
);

select is(
  (
    select count(*)::integer
    from public.carts cart
    where cart.customer_id =
      'c6100000-0000-4000-8000-000000000002'
      and cart.shop_id =
        'c6300000-0000-4000-8000-000000000001'
      and cart.status = 'ABANDONED'
  ),
  1,
  'replaced cart is retained as abandoned history'
);

select is(
  (
    select count(*)::integer
    from public.carts cart
    where cart.customer_id =
      'c6100000-0000-4000-8000-000000000002'
      and cart.status = 'ACTIVE'
  ),
  1,
  'replacement still leaves exactly one active cart'
);

insert into cart_results (label, payload)
select
  'updated',
  public.update_customer_cart_item(
    'c6100000-0000-4000-8000-000000000002',
    (payload #>> '{cart,items,0,id}')::uuid,
    3
  )
from cart_results
where label = 'shop-b';

select is(
  (
    select (payload #>> '{cart,items,0,quantity}')::integer
    from cart_results
    where label = 'updated'
  ),
  3,
  'customer updates an owned cart item quantity'
);

select is(
  (
    select (payload #>> '{cart,subtotalPaise}')::bigint
    from cart_results
    where label = 'updated'
  ),
  180000::bigint,
  'snapshot subtotal uses integer paise'
);

reset role;

update public.product_variants variant
set selling_price_paise = 70000
where variant.id =
  'c6600000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'c6100000-0000-4000-8000-000000000002',
  true
);

insert into cart_results (label, payload)
values ('repriced', public.get_customer_cart());

select is(
  (
    select (payload #>> '{cart,hasPriceChanges}')::boolean
    from cart_results
    where label = 'repriced'
  ),
  true,
  'cart read detects a changed catalogue price'
);

select is(
  (
    select (payload #>> '{cart,currentSubtotalPaise}')::bigint
    from cart_results
    where label = 'repriced'
  ),
  210000::bigint,
  'cart read hydrates the current subtotal'
);

reset role;
-- Trusted mutation RPC privileges for service_role are asserted above.
-- Invoke them as the migration owner so direct verification queries do not
-- inherit service-role table ACL or RLS restrictions.

insert into cart_results (label, payload)
select
  'removed',
  public.remove_customer_cart_item(
    'c6100000-0000-4000-8000-000000000002',
    (payload #>> '{cart,items,0,id}')::uuid
  )
from cart_results
where label = 'repriced';

select is(
  (
    select payload -> 'cart'
    from cart_results
    where label = 'removed'
  ),
  'null'::jsonb,
  'removing the final item returns an empty cart'
);

select is(
  (
    select count(*)::integer
    from public.carts cart
    where cart.customer_id =
      'c6100000-0000-4000-8000-000000000002'
      and cart.status = 'ACTIVE'
  ),
  0,
  'removing the final item abandons the empty active cart'
);

insert into cart_results (label, payload)
values (
  'before-clear',
  public.set_customer_cart_item(
    'c6100000-0000-4000-8000-000000000002',
    'c6600000-0000-4000-8000-000000000001',
    1,
    false
  )
);

insert into cart_results (label, payload)
values (
  'cleared',
  public.clear_customer_cart(
    'c6100000-0000-4000-8000-000000000002'
  )
);

select is(
  (
    select payload -> 'cart'
    from cart_results
    where label = 'cleared'
  ),
  'null'::jsonb,
  'clear cart is idempotent and returns no active cart'
);

select is(
  (
    select count(*)::integer
    from public.carts cart
    where cart.customer_id =
      'c6100000-0000-4000-8000-000000000002'
      and cart.status = 'ACTIVE'
  ),
  0,
  'clear cart leaves no active customer cart'
);

reset role;
select * from finish();
rollback;
