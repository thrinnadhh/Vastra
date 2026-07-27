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

printf '\n--- BRANCH INVENTORY FINAL-UNIT CONCURRENCY ---\n'

psql_exec -q <<'SQL'
update public.merchant_profiles
set onboarding_status='ACTIVE', kyc_status='VERIFIED'
where user_id='91000000-0000-0000-0000-000000000001';

insert into public.cities (id, code, slug, name, state_code)
values (
  'b1000000-0000-4000-8000-000000000001',
  'BRANCH_CONCURRENCY_CITY',
  'branch-concurrency-city',
  'Branch Concurrency City',
  'AP'
);

update public.cities set status='CONFIGURING'
where id='b1000000-0000-4000-8000-000000000001';
update public.cities set status='READY_FOR_VALIDATION'
where id='b1000000-0000-4000-8000-000000000001';
update public.cities set status='ACTIVE'
where id='b1000000-0000-4000-8000-000000000001';

insert into public.service_zones (id, city_id, code, slug, name)
values (
  'b1100000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'BRANCH_CONCURRENCY_ZONE',
  'branch-concurrency-zone',
  'Branch Concurrency Zone'
);

update public.service_zones set status='CONFIGURING'
where id='b1100000-0000-4000-8000-000000000001';
update public.service_zones set status='READY_FOR_VALIDATION'
where id='b1100000-0000-4000-8000-000000000001';
update public.service_zones set status='ACTIVE'
where id='b1100000-0000-4000-8000-000000000001';

insert into public.merchant_branches (
  id, shop_id, merchant_id, city_id, primary_service_zone_id,
  branch_code, name, branch_type, address_id, return_address_id,
  pincode, location, local_delivery_enabled, postal_delivery_enabled,
  all_india_postal_enabled, accepts_walk_in, is_primary
)
values (
  'b1200000-0000-4000-8000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b1100000-0000-4000-8000-000000000001',
  'BRANCH-CONCURRENCY',
  'Branch Concurrency Location',
  'PHYSICAL_STORE',
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '517501',
  'SRID=4326;POINT(79.4192 13.6288)'::extensions.geography,
  true,
  false,
  false,
  true,
  false
);

insert into public.branch_service_zones (
  branch_id, city_id, service_zone_id, is_primary, is_active
)
values (
  'b1200000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b1100000-0000-4000-8000-000000000001',
  true,
  true
);

update public.merchant_branches
set verification_status='VERIFIED', geography_status='VERIFIED',
    status='VERIFICATION_PENDING'
where id='b1200000-0000-4000-8000-000000000001';
update public.merchant_branches set status='APPROVED'
where id='b1200000-0000-4000-8000-000000000001';
update public.merchant_branches set status='ACTIVE'
where id='b1200000-0000-4000-8000-000000000001';

insert into public.product_variants (
  id, product_id, shop_id, sku, colour_name, size_label,
  mrp_paise, selling_price_paise, is_active
)
values (
  'b1300000-0000-4000-8000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  'BRANCH-CONCURRENCY-SKU',
  'Green',
  'XL',
  100000,
  90000,
  true
);

select private.apply_branch_inventory_delta(
  'b1200000-0000-4000-8000-000000000001',
  'b1300000-0000-4000-8000-000000000001',
  1,0,0,0,
  'STOCK_RECEIVED',
  'SYSTEM',
  'BRANCH_CONCURRENCY_TEST',
  null,
  'final-unit branch concurrency fixture',
  null
);
SQL

reservation_sql_one="
select (
  private.reserve_branch_inventory(
    'b1200000-0000-4000-8000-000000000001',
    'b1300000-0000-4000-8000-000000000001',
    1,
    '2099-01-01 00:00:00+00'::timestamptz,
    'b1400000-0000-4000-8000-000000000001',
    '96000000-0000-0000-0000-000000000001',
    null,
    '91000000-0000-0000-0000-000000000002'
  )
)->>'id';
"

reservation_sql_two="
select (
  private.reserve_branch_inventory(
    'b1200000-0000-4000-8000-000000000001',
    'b1300000-0000-4000-8000-000000000001',
    1,
    '2099-01-01 00:00:00+00'::timestamptz,
    'b1400000-0000-4000-8000-000000000002',
    '96000000-0000-0000-0000-000000000002',
    null,
    '91000000-0000-0000-0000-000000000003'
  )
)->>'id';
"

set +e

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq -U postgres -d postgres \
  -c "$reservation_sql_one" \
  >"$tmp_dir/branch-one.out" 2>"$tmp_dir/branch-one.err" &
pid_one=$!

docker exec "$db_container" \
  psql -X -v ON_ERROR_STOP=1 -Atq -U postgres -d postgres \
  -c "$reservation_sql_two" \
  >"$tmp_dir/branch-two.out" 2>"$tmp_dir/branch-two.err" &
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
  echo "ERROR: Expected exactly one final-unit branch reservation"
  echo "--- branch reservation one ---"
  cat "$tmp_dir/branch-one.err"
  echo "--- branch reservation two ---"
  cat "$tmp_dir/branch-two.err"
  exit 1
fi

if [ "$status_one" -ne 0 ]; then
  grep -q 'INSUFFICIENT_BRANCH_STOCK' "$tmp_dir/branch-one.err"
fi
if [ "$status_two" -ne 0 ]; then
  grep -q 'INSUFFICIENT_BRANCH_STOCK' "$tmp_dir/branch-two.err"
fi

reserved_quantity="$(
  psql_exec -Atq -c "
    select reserved_quantity
    from public.branch_inventory
    where branch_id='b1200000-0000-4000-8000-000000000001'
      and variant_id='b1300000-0000-4000-8000-000000000001';
  "
)"

active_reservations="$(
  psql_exec -Atq -c "
    select count(*)
    from public.branch_inventory_reservations
    where branch_id='b1200000-0000-4000-8000-000000000001'
      and variant_id='b1300000-0000-4000-8000-000000000001'
      and status='ACTIVE';
  "
)"

reserve_movements="$(
  psql_exec -Atq -c "
    select count(*)
    from public.branch_inventory_movements
    where branch_id='b1200000-0000-4000-8000-000000000001'
      and variant_id='b1300000-0000-4000-8000-000000000001'
      and movement_type='ONLINE_ORDER_RESERVED';
  "
)"

test "$reserved_quantity" = "1"
test "$active_reservations" = "1"
test "$reserve_movements" = "1"

echo "PASS: final unit cannot be reserved by two customers at one branch"
