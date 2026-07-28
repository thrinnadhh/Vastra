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
    docker ps --format '{{.Names}}' \
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
    psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}

printf '\n--- PHASE 2D ATOMIC CHECKOUT CONCURRENCY ---\n'

psql_exec -q <<'SQL'
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'ca100000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'phase-2d-race-merchant@test.local',
    crypt('test', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{}', now(), now()
  ),
  (
    'ca100000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'phase-2d-race-customer-1@test.local',
    crypt('test', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{}', now(), now()
  ),
  (
    'ca100000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated',
    'phase-2d-race-customer-2@test.local',
    crypt('test', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{}', now(), now()
  );

insert into public.profiles (
  id, account_type, full_name, status
)
values
  (
    'ca100000-0000-4000-8000-000000000001',
    'MERCHANT', 'Phase 2D Race Merchant', 'ACTIVE'
  ),
  (
    'ca100000-0000-4000-8000-000000000002',
    'CUSTOMER', 'Phase 2D Race Customer 1', 'ACTIVE'
  ),
  (
    'ca100000-0000-4000-8000-000000000003',
    'CUSTOMER', 'Phase 2D Race Customer 2', 'ACTIVE'
  );

insert into public.merchant_profiles (
  user_id, legal_name, onboarding_status, kyc_status
)
values (
  'ca100000-0000-4000-8000-000000000001',
  'Phase 2D Race Merchant Legal',
  'ACTIVE',
  'VERIFIED'
);

insert into public.customer_profiles (user_id)
values
  ('ca100000-0000-4000-8000-000000000002'),
  ('ca100000-0000-4000-8000-000000000003');

insert into public.addresses (
  id, user_id, label, recipient_name, phone_number, line1, area,
  city, state, postal_code, country_code, location
)
values
  (
    'ca200000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000001',
    'Merchant', 'Race Merchant', '9000000401',
    '1 Race Branch Road', 'Central', 'Tirupati',
    'Andhra Pradesh', '517501', 'IN',
    'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography
  ),
  (
    'ca200000-0000-4000-8000-000000000002',
    'ca100000-0000-4000-8000-000000000002',
    'Home', 'Race Customer 1', '9000000402',
    '2 Race Customer Road', 'Central', 'Tirupati',
    'Andhra Pradesh', '517502', 'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  ),
  (
    'ca200000-0000-4000-8000-000000000003',
    'ca100000-0000-4000-8000-000000000003',
    'Home', 'Race Customer 2', '9000000403',
    '3 Race Customer Road', 'Central', 'Tirupati',
    'Andhra Pradesh', '517503', 'IN',
    'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography
  );

insert into public.cities (
  id, code, slug, name, state_code
)
values (
  'ca600000-0000-4000-8000-000000000001',
  'PHASE_2D_CONCURRENCY_CITY',
  'phase-2d-concurrency-city',
  'Phase 2D Concurrency City',
  'AP'
);

update public.cities
set status='CONFIGURING'
where id='ca600000-0000-4000-8000-000000000001';
update public.cities
set status='READY_FOR_VALIDATION'
where id='ca600000-0000-4000-8000-000000000001';
update public.cities
set status='ACTIVE'
where id='ca600000-0000-4000-8000-000000000001';

update public.city_configurations
set
  default_delivery_radius_meters=5000,
  maximum_delivery_radius_meters=10000,
  base_delivery_fee_paise=0,
  per_km_delivery_fee_paise=0,
  default_cod_limit_paise=200000,
  local_delivery_enabled=true
where city_id='ca600000-0000-4000-8000-000000000001';

insert into public.service_zones (
  id, city_id, code, slug, name, center_point,
  default_delivery_radius_meters
)
values (
  'ca610000-0000-4000-8000-000000000001',
  'ca600000-0000-4000-8000-000000000001',
  'PHASE_2D_CONCURRENCY_ZONE',
  'phase-2d-concurrency-zone',
  'Phase 2D Concurrency Zone',
  'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
  6000
);

update public.service_zones
set status='CONFIGURING'
where id='ca610000-0000-4000-8000-000000000001';
update public.service_zones
set status='READY_FOR_VALIDATION'
where id='ca610000-0000-4000-8000-000000000001';
update public.service_zones
set status='ACTIVE'
where id='ca610000-0000-4000-8000-000000000001';

insert into public.service_zone_pincodes (
  city_id, service_zone_id, pincode, priority, is_primary, is_active
)
values
  (
    'ca600000-0000-4000-8000-000000000001',
    'ca610000-0000-4000-8000-000000000001',
    '517502', 10, true, true
  ),
  (
    'ca600000-0000-4000-8000-000000000001',
    'ca610000-0000-4000-8000-000000000001',
    '517503', 20, false, true
  );

insert into public.shops (
  id, merchant_id, address_id, shop_code, name, slug, phone_number,
  location, verification_status, operational_status,
  accepts_online_orders, minimum_order_paise
)
values (
  'ca300000-0000-4000-8000-000000000001',
  'ca100000-0000-4000-8000-000000000001',
  'ca200000-0000-4000-8000-000000000001',
  'PHASE-2D-RACE-SHOP',
  'Phase 2D Race Shop',
  'phase-2d-race-shop',
  '9100000401',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  'VERIFIED', 'OPEN', true, 10000
);

insert into public.products (
  id, shop_id, category_id, name, slug, moderation_status, is_active
)
values (
  'ca400000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Phase 2D Final Unit Product',
  'phase-2d-final-unit-product',
  'APPROVED',
  true
);

insert into public.product_variants (
  id, product_id, shop_id, sku, colour_name, size_label,
  mrp_paise, selling_price_paise, is_active
)
values (
  'ca500000-0000-4000-8000-000000000001',
  'ca400000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000001',
  'PHASE-2D-FINAL-UNIT',
  'Red',
  'M',
  100000,
  90000,
  true
);

insert into public.merchant_branches (
  id, shop_id, merchant_id, city_id, primary_service_zone_id,
  branch_code, name, branch_type, address_id, return_address_id,
  pincode, location, local_delivery_enabled, postal_delivery_enabled,
  all_india_postal_enabled, accepts_walk_in
)
values (
  'ca310000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000001',
  'ca100000-0000-4000-8000-000000000001',
  'ca600000-0000-4000-8000-000000000001',
  'ca610000-0000-4000-8000-000000000001',
  'PHASE-2D-CONCURRENCY',
  'Phase 2D Concurrency Branch',
  'PHYSICAL_STORE',
  'ca200000-0000-4000-8000-000000000001',
  'ca200000-0000-4000-8000-000000000001',
  '517501',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  true,
  false,
  false,
  true
);

insert into public.branch_service_zones (
  branch_id, city_id, service_zone_id, is_primary, is_active
)
values (
  'ca310000-0000-4000-8000-000000000001',
  'ca600000-0000-4000-8000-000000000001',
  'ca610000-0000-4000-8000-000000000001',
  true,
  true
);

update public.merchant_branches
set
  verification_status='VERIFIED',
  geography_status='VERIFIED',
  status='VERIFICATION_PENDING'
where id='ca310000-0000-4000-8000-000000000001';
update public.merchant_branches
set status='APPROVED'
where id='ca310000-0000-4000-8000-000000000001';
update public.merchant_branches
set status='ACTIVE'
where id='ca310000-0000-4000-8000-000000000001';

select private.apply_branch_inventory_delta(
  'ca310000-0000-4000-8000-000000000001',
  'ca500000-0000-4000-8000-000000000001',
  1, 0, 0, 0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'PHASE_2D_CHECKOUT_CONCURRENCY',
  null,
  'final unit for atomic checkout race',
  null
);

insert into public.carts (
  id, customer_id, shop_id
)
values
  (
    'ca700000-0000-4000-8000-000000000002',
    'ca100000-0000-4000-8000-000000000002',
    'ca300000-0000-4000-8000-000000000001'
  ),
  (
    'ca700000-0000-4000-8000-000000000003',
    'ca100000-0000-4000-8000-000000000003',
    'ca300000-0000-4000-8000-000000000001'
  );

insert into public.cart_items (
  cart_id, shop_id, variant_id, quantity, unit_price_snapshot_paise
)
values
  (
    'ca700000-0000-4000-8000-000000000002',
    'ca300000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000001',
    1,
    90000
  ),
  (
    'ca700000-0000-4000-8000-000000000003',
    'ca300000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000001',
    1,
    90000
  );
SQL

quote_one="$(
  psql_exec -Atq -c "
    select public.create_customer_branch_checkout_quote(
      'ca100000-0000-4000-8000-000000000002',
      'ca200000-0000-4000-8000-000000000002'
    )->>'id';
  "
)"

quote_two="$(
  psql_exec -Atq -c "
    select public.create_customer_branch_checkout_quote(
      'ca100000-0000-4000-8000-000000000003',
      'ca200000-0000-4000-8000-000000000003'
    )->>'id';
  "
)"

test -n "$quote_one"
test -n "$quote_two"

order_sql_one="
select public.place_customer_branch_cod_order(
  'ca100000-0000-4000-8000-000000000002',
  'ca700000-0000-4000-8000-000000000002',
  '$quote_one',
  'ca200000-0000-4000-8000-000000000002',
  null,
  'ca800000-0000-4000-8000-000000000002'
)->>'id';
"

order_sql_two="
select public.place_customer_branch_cod_order(
  'ca100000-0000-4000-8000-000000000003',
  'ca700000-0000-4000-8000-000000000003',
  '$quote_two',
  'ca200000-0000-4000-8000-000000000003',
  null,
  'ca800000-0000-4000-8000-000000000003'
)->>'id';
"

set +e

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq -U postgres -d postgres \
  -c "$order_sql_one" \
  >"$tmp_dir/order-one.out" 2>"$tmp_dir/order-one.err" &
pid_one=$!

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq -U postgres -d postgres \
  -c "$order_sql_two" \
  >"$tmp_dir/order-two.out" 2>"$tmp_dir/order-two.err" &
pid_two=$!

wait "$pid_one"
status_one=$?
wait "$pid_two"
status_two=$?

set -e

successes=0
if [ "$status_one" -eq 0 ]; then
  successes=$((successes + 1))
fi
if [ "$status_two" -eq 0 ]; then
  successes=$((successes + 1))
fi

if [ "$successes" -ne 1 ]; then
  echo "ERROR: Expected exactly one final-unit Phase 2D order"
  echo "--- order one ---"
  cat "$tmp_dir/order-one.err"
  echo "--- order two ---"
  cat "$tmp_dir/order-two.err"
  exit 1
fi

if [ "$status_one" -ne 0 ]; then
  grep -Eq \
    'INSUFFICIENT_BRANCH_STOCK|checkout quote no longer matches current state' \
    "$tmp_dir/order-one.err"
fi
if [ "$status_two" -ne 0 ]; then
  grep -Eq \
    'INSUFFICIENT_BRANCH_STOCK|checkout quote no longer matches current state' \
    "$tmp_dir/order-two.err"
fi

order_count="$(
  psql_exec -Atq -c "
    select count(*)
    from public.orders
    where order_contract_version=2
      and merchant_branch_id='ca310000-0000-4000-8000-000000000001'
      and customer_id in (
        'ca100000-0000-4000-8000-000000000002',
        'ca100000-0000-4000-8000-000000000003'
      );
  "
)"

stock_on_hand="$(
  psql_exec -Atq -c "
    select stock_on_hand
    from public.branch_inventory
    where branch_id='ca310000-0000-4000-8000-000000000001'
      and variant_id='ca500000-0000-4000-8000-000000000001';
  "
)"

reserved_quantity="$(
  psql_exec -Atq -c "
    select reserved_quantity
    from public.branch_inventory
    where branch_id='ca310000-0000-4000-8000-000000000001'
      and variant_id='ca500000-0000-4000-8000-000000000001';
  "
)"

converted_reservations="$(
  psql_exec -Atq -c "
    select count(*)
    from public.branch_inventory_reservations
    where branch_id='ca310000-0000-4000-8000-000000000001'
      and variant_id='ca500000-0000-4000-8000-000000000001'
      and status='CONVERTED';
  "
)"

converted_carts="$(
  psql_exec -Atq -c "
    select count(*)
    from public.carts
    where id in (
      'ca700000-0000-4000-8000-000000000002',
      'ca700000-0000-4000-8000-000000000003'
    )
      and status='CONVERTED';
  "
)"

completion_movements="$(
  psql_exec -Atq -c "
    select count(*)
    from public.branch_inventory_movements
    where branch_id='ca310000-0000-4000-8000-000000000001'
      and variant_id='ca500000-0000-4000-8000-000000000001'
      and movement_type='ONLINE_ORDER_COMPLETED';
  "
)"

test "$order_count" = "1"
test "$stock_on_hand" = "0"
test "$reserved_quantity" = "0"
test "$converted_reservations" = "1"
test "$converted_carts" = "1"
test "$completion_movements" = "1"

echo "PASS: two customers cannot place orders for the same final branch unit"
