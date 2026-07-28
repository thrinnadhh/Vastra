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
update public.merchant_profiles
set onboarding_status='ACTIVE', kyc_status='VERIFIED'
where user_id='91000000-0000-0000-0000-000000000001';

insert into public.cities (id, code, slug, name, state_code)
values (
  'c1000000-0000-4000-8000-000000000001',
  'PHASE_2D_CONCURRENCY_CITY',
  'phase-2d-concurrency-city',
  'Phase 2D Concurrency City',
  'AP'
);
update public.cities set status='CONFIGURING'
where id='c1000000-0000-4000-8000-000000000001';
update public.cities set status='READY_FOR_VALIDATION'
where id='c1000000-0000-4000-8000-000000000001';
update public.cities set status='ACTIVE'
where id='c1000000-0000-4000-8000-000000000001';

update public.city_configurations
set default_delivery_radius_meters=5000,
    maximum_delivery_radius_meters=10000,
    base_delivery_fee_paise=0,
    per_km_delivery_fee_paise=0,
    default_cod_limit_paise=200000,
    local_delivery_enabled=true
where city_id='c1000000-0000-4000-8000-000000000001';

insert into public.service_zones (
  id, city_id, code, slug, name, center_point,
  default_delivery_radius_meters
)
values (
  'c1100000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'PHASE_2D_CONCURRENCY_ZONE',
  'phase-2d-concurrency-zone',
  'Phase 2D Concurrency Zone',
  'SRID=4326;POINT(79.4200 13.6290)'::extensions.geography,
  6000
);
update public.service_zones set status='CONFIGURING'
where id='c1100000-0000-4000-8000-000000000001';
update public.service_zones set status='READY_FOR_VALIDATION'
where id='c1100000-0000-4000-8000-000000000001';
update public.service_zones set status='ACTIVE'
where id='c1100000-0000-4000-8000-000000000001';

insert into public.service_zone_pincodes (
  city_id, service_zone_id, pincode, priority, is_primary, is_active
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'c1100000-0000-4000-8000-000000000001',
    '517502', 10, true, true
  ),
  (
    'c1000000-0000-4000-8000-000000000001',
    'c1100000-0000-4000-8000-000000000001',
    '517503', 20, false, true
  );

insert into public.product_variants (
  id, product_id, shop_id, sku, colour_name, size_label,
  mrp_paise, selling_price_paise, is_active
)
values (
  'c1300000-0000-4000-8000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
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
  'c1200000-0000-4000-8000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1100000-0000-4000-8000-000000000001',
  'PHASE-2D-CONCURRENCY',
  'Phase 2D Concurrency Branch',
  'PHYSICAL_STORE',
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
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
  'c1200000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c1100000-0000-4000-8000-000000000001',
  true,
  true
);

update public.merchant_branches
set verification_status='VERIFIED', geography_status='VERIFIED',
    status='VERIFICATION_PENDING'
where id='c1200000-0000-4000-8000-000000000001';
update public.merchant_branches set status='APPROVED'
where id='c1200000-0000-4000-8000-000000000001';
update public.merchant_branches set status='ACTIVE'
where id='c1200000-0000-4000-8000-000000000001';

select private.apply_branch_inventory_delta(
  'c1200000-0000-4000-8000-000000000001',
  'c1300000-0000-4000-8000-000000000001',
  1,0,0,0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'PHASE_2D_CHECKOUT_CONCURRENCY',
  null,
  'final unit for atomic checkout race',
  null
);

insert into public.cart_items (
  cart_id, shop_id, variant_id, quantity, unit_price_snapshot_paise
)
values
  (
    '96000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    'c1300000-0000-4000-8000-000000000001',
    1,
    90000
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000001',
    'c1300000-0000-4000-8000-000000000001',
    1,
    90000
  );
SQL

quote_one="$(
  psql_exec -Atq -c "
    select public.create_customer_branch_checkout_quote(
      '91000000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000002'
    )->>'id';
  "
)"

quote_two="$(
  psql_exec -Atq -c "
    select public.create_customer_branch_checkout_quote(
      '91000000-0000-0000-0000-000000000003',
      '92000000-0000-0000-0000-000000000003'
    )->>'id';
  "
)"

test -n "$quote_one"
test -n "$quote_two"

order_sql_one="
select public.place_customer_branch_cod_order(
  '91000000-0000-0000-0000-000000000002',
  '96000000-0000-0000-0000-000000000001',
  '$quote_one',
  '92000000-0000-0000-0000-000000000002',
  null,
  'c1400000-0000-4000-8000-000000000001'
)->>'id';
"

order_sql_two="
select public.place_customer_branch_cod_order(
  '91000000-0000-0000-0000-000000000003',
  '96000000-0000-0000-0000-000000000002',
  '$quote_two',
  '92000000-0000-0000-0000-000000000003',
  null,
  'c1400000-0000-4000-8000-000000000002'
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
  grep -Eq 'INSUFFICIENT_BRANCH_STOCK|checkout quote no longer matches current state' \
    "$tmp_dir/order-one.err"
fi
if [ "$status_two" -ne 0 ]; then
  grep -Eq 'INSUFFICIENT_BRANCH_STOCK|checkout quote no longer matches current state' \
    "$tmp_dir/order-two.err"
fi

order_count="$(
  psql_exec -Atq -c "
    select count(*)
    from public.orders
    where order_contract_version=2
      and merchant_branch_id='c1200000-0000-4000-8000-000000000001'
      and customer_id in (
        '91000000-0000-0000-0000-000000000002',
        '91000000-0000-0000-0000-000000000003'
      );
  "
)"

stock_on_hand="$(
  psql_exec -Atq -c "
    select stock_on_hand
    from public.branch_inventory
    where branch_id='c1200000-0000-4000-8000-000000000001'
      and variant_id='c1300000-0000-4000-8000-000000000001';
  "
)"

reserved_quantity="$(
  psql_exec -Atq -c "
    select reserved_quantity
    from public.branch_inventory
    where branch_id='c1200000-0000-4000-8000-000000000001'
      and variant_id='c1300000-0000-4000-8000-000000000001';
  "
)"

converted_reservations="$(
  psql_exec -Atq -c "
    select count(*)
    from public.branch_inventory_reservations
    where branch_id='c1200000-0000-4000-8000-000000000001'
      and variant_id='c1300000-0000-4000-8000-000000000001'
      and status='CONVERTED';
  "
)"

converted_carts="$(
  psql_exec -Atq -c "
    select count(*)
    from public.carts
    where id in (
      '96000000-0000-0000-0000-000000000001',
      '96000000-0000-0000-0000-000000000002'
    )
      and status='CONVERTED';
  "
)"

completion_movements="$(
  psql_exec -Atq -c "
    select count(*)
    from public.branch_inventory_movements
    where branch_id='c1200000-0000-4000-8000-000000000001'
      and variant_id='c1300000-0000-4000-8000-000000000001'
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
