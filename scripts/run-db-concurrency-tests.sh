#!/usr/bin/env bash

set -euo pipefail

db_container="$(
  docker ps \
    --filter "label=com.supabase.cli.project=vastra" \
    --format '{{.Names}}' \
    | grep '^supabase_db_' \
    | head -1
)"

if [ -z "$db_container" ]; then
  db_container="$(
    docker ps \
      --format '{{.Names}}' \
      | grep '^supabase_db_vastra$' \
      | head -1
  )"
fi

if [ -z "$db_container" ]; then
  echo "ERROR: Could not find the Vastra Supabase database container"
  exit 1
fi

tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}

trap cleanup EXIT

psql_exec() {
  docker exec -i "$db_container" \
    psql \
    -X \
    -v ON_ERROR_STOP=1 \
    -U postgres \
    -d postgres \
    "$@"
}

printf '\n--- DATABASE CONCURRENCY TESTS ---\n'

psql_exec -q <<'SQL'
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
    '91000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'concurrency-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'concurrency-customer-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'concurrency-customer-two@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'concurrency-captain-one@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'concurrency-captain-two@example.test',
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
    '91000000-0000-0000-0000-000000000001',
    'MERCHANT',
    'Concurrency Merchant',
    'ACTIVE'
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'CUSTOMER',
    'Concurrency Customer One',
    'ACTIVE'
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    'CUSTOMER',
    'Concurrency Customer Two',
    'ACTIVE'
  ),
  (
    '91000000-0000-0000-0000-000000000004',
    'CAPTAIN',
    'Concurrency Captain One',
    'ACTIVE'
  ),
  (
    '91000000-0000-0000-0000-000000000005',
    'CAPTAIN',
    'Concurrency Captain Two',
    'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id,
  legal_name
)
values (
  '91000000-0000-0000-0000-000000000001',
  'Concurrency Merchant Legal'
);

insert into public.customer_profiles (user_id)
values
  ('91000000-0000-0000-0000-000000000002'),
  ('91000000-0000-0000-0000-000000000003');

insert into public.captain_profiles (
  user_id,
  captain_code
)
values
  (
    '91000000-0000-0000-0000-000000000004',
    'CONCURRENCY-CAPTAIN-ONE'
  ),
  (
    '91000000-0000-0000-0000-000000000005',
    'CONCURRENCY-CAPTAIN-TWO'
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
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'Shop',
    'Concurrency Merchant',
    '9111111111',
    'Merchant Test Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517501',
    'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000002',
    'Home',
    'Concurrency Customer One',
    '9222222222',
    'Customer One Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517502',
    'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  ),
  (
    '92000000-0000-0000-0000-000000000003',
    '91000000-0000-0000-0000-000000000003',
    'Home',
    'Concurrency Customer Two',
    '9333333333',
    'Customer Two Street',
    'Tirupati',
    'Tirupati',
    'Andhra Pradesh',
    '517503',
    'IN',
    'SRID=4326;POINT(79.4210 13.6300)'::extensions.geography
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
  '93000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  'CONCURRENCY-SHOP',
  'Concurrency Shop',
  'concurrency-shop',
  '9444444444',
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
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Concurrency Product',
  'concurrency-product',
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
  '95000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'CONCURRENCY-SKU',
  'Blue',
  'M',
  100000,
  90000,
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
  '95000000-0000-4000-8000-000000000002',
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'OFFLINE-CONCURRENCY-SKU',
  'Black',
  'L',
  100000,
  90000,
  true
);

select private.apply_inventory_delta(
  '93000000-0000-0000-0000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  1,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'OFFLINE_SALE_CONCURRENCY_FIXTURE',
  null,
  'offline sale final-unit fixture',
  null
);

insert into public.carts (
  id,
  customer_id,
  shop_id,
  status
)
values
  (
    '96000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000001',
    'ACTIVE'
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000003',
    '93000000-0000-0000-0000-000000000001',
    'ACTIVE'
  );

select private.apply_inventory_delta(
  '93000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  1,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'CONCURRENCY_TEST',
  null,
  'final-unit fixture',
  null
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
values (
  '97000000-0000-0000-0000-000000000001',
  'CONCURRENCY-ORDER',
  'concurrency-order-key',
  '91000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002',
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
  status
)
values (
  '98000000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000001',
  'FORWARD_DELIVERY',
  '93000000-0000-0000-0000-000000000001',
  '{"shop":"fixture"}'::jsonb,
  '{"customer":"fixture"}'::jsonb,
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
  'OFFERED'
);

insert into public.delivery_assignments (
  id,
  delivery_task_id,
  captain_id,
  assignment_status,
  expires_at,
  assigned_by
)
values
  (
    '99000000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000004',
    'OFFERED',
    now() + interval '10 minutes',
    'AUTO'
  ),
  (
    '99000000-0000-0000-0000-000000000002',
    '98000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000005',
    'OFFERED',
    now() + interval '10 minutes',
    'AUTO'
  );

insert into public.outbox_events (
  event_type,
  aggregate_type,
  aggregate_id,
  payload
)
select
  'concurrency.test',
  'CONCURRENCY_TEST',
  '9a000000-0000-0000-0000-000000000001',
  jsonb_build_object('sequence', value)
from generate_series(1, 4) value;
SQL

inventory_sql_one="
select (
  public.create_customer_cart_reservation(
    '96000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    1,
    900,
    '9c000000-0000-4000-8000-000000000001',
    '91000000-0000-0000-0000-000000000002'
  )
)->>'id';
"

inventory_sql_two="
select (
  public.create_customer_cart_reservation(
    '96000000-0000-0000-0000-000000000002',
    '95000000-0000-0000-0000-000000000001',
    1,
    900,
    '9c000000-0000-4000-8000-000000000002',
    '91000000-0000-0000-0000-000000000003'
  )
)->>'id';
"

set +e

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$inventory_sql_one" \
  >"$tmp_dir/inventory-one.out" \
  2>"$tmp_dir/inventory-one.err" &
inventory_pid_one=$!

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$inventory_sql_two" \
  >"$tmp_dir/inventory-two.out" \
  2>"$tmp_dir/inventory-two.err" &
inventory_pid_two=$!

wait "$inventory_pid_one"
inventory_status_one=$?

wait "$inventory_pid_two"
inventory_status_two=$?

set -e

inventory_successes=0

if [ "$inventory_status_one" -eq 0 ]; then
  inventory_successes=$((inventory_successes + 1))
fi

if [ "$inventory_status_two" -eq 0 ]; then
  inventory_successes=$((inventory_successes + 1))
fi

if [ "$inventory_successes" -ne 1 ]; then
  echo "ERROR: Expected exactly one final-unit reservation"
  echo "--- reservation one ---"
  cat "$tmp_dir/inventory-one.err"
  echo "--- reservation two ---"
  cat "$tmp_dir/inventory-two.err"
  exit 1
fi

reserved_quantity="$(
  psql_exec -Atq -c "
    select reserved_quantity
    from public.inventory_balances
    where shop_id =
      '93000000-0000-0000-0000-000000000001'
      and variant_id =
      '95000000-0000-0000-0000-000000000001';
  "
)"

active_reservations="$(
  psql_exec -Atq -c "
    select count(*)
    from public.inventory_reservations
    where variant_id =
      '95000000-0000-0000-0000-000000000001'
      and status = 'ACTIVE';
  "
)"

test "$reserved_quantity" = "1"
test "$active_reservations" = "1"

echo "PASS: final unit cannot be reserved twice"

offline_sale_sql_one="
select public.create_merchant_offline_sale(
  '93000000-0000-0000-0000-000000000001',
  null,
  0,
  'CASH',
  '[{\"variantId\":\"95000000-0000-4000-8000-000000000002\",\"quantity\":1,\"unitPricePaise\":90000,\"discountPaise\":0,\"identificationMethod\":\"MANUAL_SEARCH\"}]'::jsonb,
  '9b000000-0000-4000-8000-000000000001',
  '91000000-0000-0000-0000-000000000001'
)->>'id';
"

offline_sale_sql_two="
select public.create_merchant_offline_sale(
  '93000000-0000-0000-0000-000000000001',
  null,
  0,
  'CASH',
  '[{\"variantId\":\"95000000-0000-4000-8000-000000000002\",\"quantity\":1,\"unitPricePaise\":90000,\"discountPaise\":0,\"identificationMethod\":\"MANUAL_SEARCH\"}]'::jsonb,
  '9b000000-0000-4000-8000-000000000002',
  '91000000-0000-0000-0000-000000000001'
)->>'id';
"

set +e

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$offline_sale_sql_one" \
  >"$tmp_dir/offline-sale-one.out" \
  2>"$tmp_dir/offline-sale-one.err" &
offline_sale_pid_one=$!

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$offline_sale_sql_two" \
  >"$tmp_dir/offline-sale-two.out" \
  2>"$tmp_dir/offline-sale-two.err" &
offline_sale_pid_two=$!

wait "$offline_sale_pid_one"
offline_sale_status_one=$?

wait "$offline_sale_pid_two"
offline_sale_status_two=$?

set -e

offline_sale_successes=0

if [ "$offline_sale_status_one" -eq 0 ]; then
  offline_sale_successes=$((offline_sale_successes + 1))
fi

if [ "$offline_sale_status_two" -eq 0 ]; then
  offline_sale_successes=$((offline_sale_successes + 1))
fi

if [ "$offline_sale_successes" -ne 1 ]; then
  echo "ERROR: Expected exactly one final-unit offline sale"
  echo "--- offline sale one ---"
  cat "$tmp_dir/offline-sale-one.err"
  echo "--- offline sale two ---"
  cat "$tmp_dir/offline-sale-two.err"
  exit 1
fi

offline_sale_stock="$(
  psql_exec -Atq -c "
    select stock_on_hand
    from public.inventory_balances
    where shop_id =
      '93000000-0000-0000-0000-000000000001'
      and variant_id =
      '95000000-0000-4000-8000-000000000002';
  "
)"

offline_sale_headers="$(
  psql_exec -Atq -c "
    select count(*)
    from public.offline_sales sale
    join public.offline_sale_items item
      on item.offline_sale_id = sale.id
    where item.variant_id =
      '95000000-0000-4000-8000-000000000002';
  "
)"

offline_sale_movements="$(
  psql_exec -Atq -c "
    select count(*)
    from public.inventory_movements
    where variant_id =
      '95000000-0000-4000-8000-000000000002'
      and reference_type = 'OFFLINE_SALE';
  "
)"

test "$offline_sale_stock" = "0"
test "$offline_sale_headers" = "1"
test "$offline_sale_movements" = "1"

echo "PASS: final unit cannot be sold offline twice"


printf '\n--- COD ORDER FINAL-UNIT CONCURRENCY ---\n'

psql_exec -q <<'SQL'
do $$
declare
  reservation_row record;
begin
  for reservation_row in
    select reservation.id, cart.customer_id
    from public.inventory_reservations reservation
    join public.carts cart
      on cart.id = reservation.cart_id
    where reservation.status = 'ACTIVE'
      and cart.id in (
        '96000000-0000-0000-0000-000000000001',
        '96000000-0000-0000-0000-000000000002'
      )
    order by reservation.id
  loop
    perform public.release_customer_cart_reservation(
      reservation_row.id,
      'Reset before COD order concurrency',
      reservation_row.customer_id
    );
  end loop;
end;
$$;

update public.carts
set status = 'ABANDONED'
where id in (
  '96000000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000002'
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
  '95000000-0000-4000-8000-000000000003',
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'COD-ORDER-CONCURRENCY-SKU',
  'Green',
  'XL',
  100000,
  90000,
  true
);

select private.apply_inventory_delta(
  '93000000-0000-0000-0000-000000000001',
  '95000000-0000-4000-8000-000000000003',
  1,
  0,
  0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'COD_ORDER_CONCURRENCY',
  null,
  'COD order final-unit fixture',
  null
);

insert into public.carts (
  id,
  customer_id,
  shop_id,
  status
)
values
  (
    '96000000-0000-4000-8000-000000000003',
    '91000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000001',
    'ACTIVE'
  ),
  (
    '96000000-0000-4000-8000-000000000004',
    '91000000-0000-0000-0000-000000000003',
    '93000000-0000-0000-0000-000000000001',
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
values
  (
    '96000000-0000-4000-8000-000000000013',
    '96000000-0000-4000-8000-000000000003',
    '93000000-0000-0000-0000-000000000001',
    '95000000-0000-4000-8000-000000000003',
    1,
    90000
  ),
  (
    '96000000-0000-4000-8000-000000000014',
    '96000000-0000-4000-8000-000000000004',
    '93000000-0000-0000-0000-000000000001',
    '95000000-0000-4000-8000-000000000003',
    1,
    90000
  );
SQL

order_quote_one="$(
  psql_exec -Atq -c "
    select (
      public.create_customer_checkout_quote(
        '91000000-0000-0000-0000-000000000002',
        '92000000-0000-0000-0000-000000000002'
      )
    )->>'id';
  "
)"

order_quote_two="$(
  psql_exec -Atq -c "
    select (
      public.create_customer_checkout_quote(
        '91000000-0000-0000-0000-000000000003',
        '92000000-0000-0000-0000-000000000003'
      )
    )->>'id';
  "
)"

order_sql_one="
select public.place_customer_cod_order(
  '91000000-0000-0000-0000-000000000002',
  '96000000-0000-4000-8000-000000000003',
  '$order_quote_one',
  '92000000-0000-0000-0000-000000000002',
  null,
  '9d000000-0000-4000-8000-000000000001'
)->>'id';
"

order_sql_two="
select public.place_customer_cod_order(
  '91000000-0000-0000-0000-000000000003',
  '96000000-0000-4000-8000-000000000004',
  '$order_quote_two',
  '92000000-0000-0000-0000-000000000003',
  null,
  '9d000000-0000-4000-8000-000000000002'
)->>'id';
"

set +e

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$order_sql_one" \
  >"$tmp_dir/order-one.out" \
  2>"$tmp_dir/order-one.err" &
order_pid_one=$!

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$order_sql_two" \
  >"$tmp_dir/order-two.out" \
  2>"$tmp_dir/order-two.err" &
order_pid_two=$!

wait "$order_pid_one"
order_status_one=$?

wait "$order_pid_two"
order_status_two=$?

set -e

order_successes=0

if [ "$order_status_one" -eq 0 ]; then
  order_successes=$((order_successes + 1))
fi

if [ "$order_status_two" -eq 0 ]; then
  order_successes=$((order_successes + 1))
fi

if [ "$order_successes" -ne 1 ]; then
  echo "ERROR: Expected exactly one final-unit COD order"
  echo "--- order one ---"
  cat "$tmp_dir/order-one.err"
  echo "--- order two ---"
  cat "$tmp_dir/order-two.err"
  exit 1
fi

order_headers="$(
  psql_exec -Atq -c "
    select count(*)
    from public.orders placed_order
    join public.order_items item
      on item.order_id = placed_order.id
    where item.variant_id =
      '95000000-0000-4000-8000-000000000003';
  "
)"

order_reservations="$(
  psql_exec -Atq -c "
    select count(*)
    from public.inventory_reservations
    where variant_id =
      '95000000-0000-4000-8000-000000000003'
      and order_id is not null
      and status = 'ACTIVE';
  "
)"

order_reserved_quantity="$(
  psql_exec -Atq -c "
    select reserved_quantity
    from public.inventory_balances
    where shop_id =
      '93000000-0000-0000-0000-000000000001'
      and variant_id =
      '95000000-0000-4000-8000-000000000003';
  "
)"

order_outbox_events="$(
  psql_exec -Atq -c "
    select count(*)
    from public.outbox_events event
    join public.orders placed_order
      on placed_order.id = event.aggregate_id
    join public.order_items item
      on item.order_id = placed_order.id
    where event.event_type = 'order.placed'
      and item.variant_id =
        '95000000-0000-4000-8000-000000000003';
  "
)"

test "$order_headers" = "1"
test "$order_reservations" = "1"
test "$order_reserved_quantity" = "1"
test "$order_outbox_events" = "1"

echo "PASS: final unit cannot create two COD orders"

assignment_sql_one="
select (
  private.accept_delivery_assignment(
    '99000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000004',
    '91000000-0000-0000-0000-000000000004'
  )
).id;
"

assignment_sql_two="
select (
  private.accept_delivery_assignment(
    '99000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000005',
    '91000000-0000-0000-0000-000000000005'
  )
).id;
"

set +e

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$assignment_sql_one" \
  >"$tmp_dir/assignment-one.out" \
  2>"$tmp_dir/assignment-one.err" &
assignment_pid_one=$!

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$assignment_sql_two" \
  >"$tmp_dir/assignment-two.out" \
  2>"$tmp_dir/assignment-two.err" &
assignment_pid_two=$!

wait "$assignment_pid_one"
assignment_status_one=$?

wait "$assignment_pid_two"
assignment_status_two=$?

set -e

assignment_successes=0

if [ "$assignment_status_one" -eq 0 ]; then
  assignment_successes=$((assignment_successes + 1))
fi

if [ "$assignment_status_two" -eq 0 ]; then
  assignment_successes=$((assignment_successes + 1))
fi

if [ "$assignment_successes" -ne 1 ]; then
  echo "ERROR: Expected exactly one captain assignment"
  echo "--- assignment one ---"
  cat "$tmp_dir/assignment-one.err"
  echo "--- assignment two ---"
  cat "$tmp_dir/assignment-two.err"
  exit 1
fi

accepted_assignments="$(
  psql_exec -Atq -c "
    select count(*)
    from public.delivery_assignments
    where delivery_task_id =
      '98000000-0000-0000-0000-000000000001'
      and assignment_status = 'ACCEPTED';
  "
)"

assigned_captains="$(
  psql_exec -Atq -c "
    select count(*)
    from public.delivery_tasks
    where id =
      '98000000-0000-0000-0000-000000000001'
      and assigned_captain_id is not null
      and status = 'ASSIGNED';
  "
)"

test "$accepted_assignments" = "1"
test "$assigned_captains" = "1"

echo "PASS: delivery task cannot be assigned to two captains"

worker_sql_one="
select id
from private.claim_outbox_events(
  'concurrency-worker-one',
  3
)
where aggregate_id =
  '9a000000-0000-0000-0000-000000000001';
"

worker_sql_two="
select id
from private.claim_outbox_events(
  'concurrency-worker-two',
  3
)
where aggregate_id =
  '9a000000-0000-0000-0000-000000000001';
"

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$worker_sql_one" \
  >"$tmp_dir/worker-one.out" \
  2>"$tmp_dir/worker-one.err" &
worker_pid_one=$!

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq \
  -U postgres -d postgres \
  -c "$worker_sql_two" \
  >"$tmp_dir/worker-two.out" \
  2>"$tmp_dir/worker-two.err" &
worker_pid_two=$!

wait "$worker_pid_one"
wait "$worker_pid_two"

claimed_total="$(
  cat \
    "$tmp_dir/worker-one.out" \
    "$tmp_dir/worker-two.out" \
    | sed '/^[[:space:]]*$/d' \
    | wc -l \
    | tr -d ' '
)"

claimed_unique="$(
  cat \
    "$tmp_dir/worker-one.out" \
    "$tmp_dir/worker-two.out" \
    | sed '/^[[:space:]]*$/d' \
    | sort -u \
    | wc -l \
    | tr -d ' '
)"

test "$claimed_total" = "4"
test "$claimed_unique" = "4"

processing_total="$(
  psql_exec -Atq -c "
    select count(*)
    from public.outbox_events
    where aggregate_id =
      '9a000000-0000-0000-0000-000000000001'
      and status = 'PROCESSING';
  "
)"

test "$processing_total" = "4"

echo "PASS: concurrent outbox workers claim distinct events"
