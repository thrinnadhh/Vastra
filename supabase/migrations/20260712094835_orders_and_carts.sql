-- Vastra carts, orders, merchant fulfilment, item verification, and
-- concurrency-safe order lifecycle foundations.
--
-- The order status enum was created in the shared-types migration.
-- Payments, refunds, notifications, audit events, and the durable outbox are
-- added in later migrations.
--
-- Direct clients receive no table or function privileges in this migration.

create schema if not exists private;

revoke all on schema private
from public, anon, authenticated;

grant usage on schema private
to service_role;

create type public.cart_status as enum (
  'ACTIVE',
  'CONVERTED',
  'ABANDONED',
  'EXPIRED'
);

create type public.order_payment_status as enum (
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'COD_PENDING',
  'COD_COLLECTED'
);

create type public.order_fulfilment_type as enum (
  'DELIVERY',
  'CUSTOMER_PICKUP'
);

create type public.order_item_fulfilment_status as enum (
  'PENDING',
  'VERIFIED',
  'PACKED',
  'HANDED_OVER',
  'RETURNED',
  'CANCELLED'
);

create type public.order_actor_role as enum (
  'SYSTEM',
  'CUSTOMER',
  'MERCHANT',
  'CAPTAIN',
  'ADMIN'
);

create type public.merchant_alert_status as enum (
  'PENDING',
  'SENT',
  'DELIVERED',
  'ACKNOWLEDGED',
  'EXPIRED',
  'FAILED'
);

create type public.merchant_issue_resolution_status as enum (
  'OPEN',
  'ACCEPTED',
  'RESOLVED',
  'REJECTED'
);

create type public.order_item_verification_method as enum (
  'BARCODE',
  'MANUAL'
);

create type public.order_item_verification_result as enum (
  'MATCH',
  'MISMATCH',
  'OVERRIDDEN'
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  shop_id uuid not null,
  status public.cart_status not null default 'ACTIVE',
  coupon_code text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint carts_customer_id_fkey
    foreign key (customer_id)
    references public.customer_profiles (user_id)
    on update cascade
    on delete cascade,

  constraint carts_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint carts_id_customer_shop_key
    unique (id, customer_id, shop_id),

  constraint carts_id_shop_id_key
    unique (id, shop_id),

  constraint carts_coupon_code_nonempty
    check (
      coupon_code is null
      or length(btrim(coupon_code)) > 0
    ),

  constraint carts_expiry_after_creation
    check (
      expires_at is null
      or expires_at > created_at
    )
);

comment on table public.carts is
  'One active single-shop cart for a customer in the MVP.';

create unique index carts_one_active_per_customer_idx
on public.carts (customer_id)
where status = 'ACTIVE';

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null,
  shop_id uuid not null,
  variant_id uuid not null,
  quantity public.positive_quantity not null default 1,
  unit_price_snapshot_paise public.money_paise not null,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cart_items_cart_shop_fkey
    foreign key (cart_id, shop_id)
    references public.carts (id, shop_id)
    on update cascade
    on delete cascade,

  constraint cart_items_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint cart_items_cart_variant_key
    unique (cart_id, variant_id)
);

comment on table public.cart_items is
  'Variant-level cart lines with display-price snapshots.';

alter table public.addresses
add constraint addresses_id_user_id_key
unique (id, user_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  idempotency_key text not null,
  customer_id uuid not null,
  shop_id uuid not null,
  cart_id uuid,
  delivery_address_id uuid,
  address_snapshot jsonb not null default '{}'::jsonb,
  status public.order_status not null default 'PAYMENT_PENDING',
  payment_status public.order_payment_status not null default 'PENDING',
  fulfilment_type public.order_fulfilment_type
    not null
    default 'DELIVERY',
  subtotal_paise public.money_paise not null default 0,
  product_discount_paise public.money_paise not null default 0,
  coupon_discount_paise public.money_paise not null default 0,
  delivery_fee_paise public.money_paise not null default 0,
  platform_fee_paise public.money_paise not null default 0,
  tax_paise public.money_paise not null default 0,
  total_paise public.money_paise not null default 0,
  merchant_preparation_minutes public.non_negative_quantity,
  estimated_delivery_at timestamptz,
  customer_note text,
  cancellation_reason_code text,
  cancellation_note text,
  version public.positive_quantity not null default 1,
  placed_at timestamptz,
  accepted_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_customer_id_fkey
    foreign key (customer_id)
    references public.customer_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint orders_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint orders_cart_customer_shop_fkey
    foreign key (cart_id, customer_id, shop_id)
    references public.carts (id, customer_id, shop_id)
    on update cascade
    on delete set null,

  constraint orders_delivery_address_customer_fkey
    foreign key (delivery_address_id, customer_id)
    references public.addresses (id, user_id)
    on update cascade
    on delete restrict,

  constraint orders_order_number_key
    unique (order_number),

  constraint orders_id_shop_id_key
    unique (id, shop_id),

  constraint orders_order_number_format
    check (order_number ~ '^[A-Z0-9][A-Z0-9-]*$'),

  constraint orders_idempotency_key_nonempty
    check (length(btrim(idempotency_key)) > 0),

  constraint orders_address_snapshot_object
    check (jsonb_typeof(address_snapshot) = 'object'),

  constraint orders_delivery_address_shape
    check (
      (
        fulfilment_type = 'DELIVERY'
        and delivery_address_id is not null
      )
      or (
        fulfilment_type = 'CUSTOMER_PICKUP'
        and delivery_address_id is null
      )
    ),

  constraint orders_discounts_within_subtotal
    check (
      product_discount_paise
      + coupon_discount_paise
      <= subtotal_paise
    ),

  constraint orders_total_arithmetic
    check (
      total_paise =
        subtotal_paise
        - product_discount_paise
        - coupon_discount_paise
        + delivery_fee_paise
        + platform_fee_paise
        + tax_paise
    ),

  constraint orders_customer_note_nonempty
    check (
      customer_note is null
      or length(btrim(customer_note)) > 0
    ),

  constraint orders_cancellation_consistency
    check (
      (
        status = 'CANCELLED'
        and cancelled_at is not null
        and cancellation_reason_code is not null
        and length(btrim(cancellation_reason_code)) > 0
      )
      or (
        status <> 'CANCELLED'
        and cancelled_at is null
      )
    ),

  constraint orders_completed_at_consistency
    check (
      (
        status = 'COMPLETED'
        and completed_at is not null
      )
      or status <> 'COMPLETED'
    ),

  constraint orders_timestamps_after_creation
    check (
      (placed_at is null or placed_at >= created_at)
      and (accepted_at is null or accepted_at >= created_at)
      and (ready_at is null or ready_at >= created_at)
      and (picked_up_at is null or picked_up_at >= created_at)
      and (delivered_at is null or delivered_at >= created_at)
      and (completed_at is null or completed_at >= created_at)
      and (cancelled_at is null or cancelled_at >= created_at)
    )
);

comment on table public.orders is
  'Authoritative order header and current lifecycle state.';

create unique index orders_customer_idempotency_key_idx
on public.orders (customer_id, idempotency_key);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  shop_id uuid not null,
  product_id uuid not null,
  variant_id uuid not null,
  product_name_snapshot text not null,
  sku_snapshot text not null,
  colour_snapshot text,
  size_snapshot text,
  image_object_key_snapshot text,
  quantity public.positive_quantity not null,
  unit_mrp_paise public.money_paise not null,
  unit_selling_price_paise public.money_paise not null,
  discount_paise public.money_paise not null default 0,
  total_paise public.money_paise not null,
  fulfilment_status public.order_item_fulfilment_status
    not null
    default 'PENDING',
  created_at timestamptz not null default now(),

  constraint order_items_order_shop_fkey
    foreign key (order_id, shop_id)
    references public.orders (id, shop_id)
    on update cascade
    on delete cascade,

  constraint order_items_product_shop_fkey
    foreign key (product_id, shop_id)
    references public.products (id, shop_id)
    on update cascade
    on delete restrict,

  constraint order_items_variant_product_fkey
    foreign key (variant_id, product_id)
    references public.product_variants (id, product_id)
    on update cascade
    on delete restrict,

  constraint order_items_order_variant_key
    unique (order_id, variant_id),

  constraint order_items_product_name_nonempty
    check (length(btrim(product_name_snapshot)) > 0),

  constraint order_items_sku_nonempty
    check (length(btrim(sku_snapshot)) > 0),

  constraint order_items_price_ordering
    check (unit_selling_price_paise <= unit_mrp_paise),

  constraint order_items_discount_within_line
    check (
      discount_paise
      <= quantity::bigint * unit_selling_price_paise
    ),

  constraint order_items_total_arithmetic
    check (
      total_paise =
        quantity::bigint * unit_selling_price_paise
        - discount_paise
    )
);

comment on table public.order_items is
  'Immutable product, variant, and price snapshots for ordered items.';

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null,
  previous_status public.order_status,
  new_status public.order_status not null,
  changed_by_user_id uuid,
  changed_by_role public.order_actor_role
    not null
    default 'SYSTEM',
  reason_code text,
  note text,
  location extensions.geography(point, 4326),
  created_at timestamptz not null default now(),

  constraint order_status_history_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint order_status_history_changed_by_user_id_fkey
    foreign key (changed_by_user_id)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint order_status_history_status_changed
    check (
      previous_status is null
      or previous_status <> new_status
    ),

  constraint order_status_history_reason_nonempty
    check (
      reason_code is null
      or length(btrim(reason_code)) > 0
    ),

  constraint order_status_history_note_nonempty
    check (
      note is null
      or length(btrim(note)) > 0
    )
);

comment on table public.order_status_history is
  'Append-only order lifecycle transition history.';

create table public.merchant_order_alerts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  shop_id uuid not null,
  device_id uuid,
  alert_status public.merchant_alert_status
    not null
    default 'PENDING',
  attempt_count public.non_negative_quantity not null default 0,
  first_sent_at timestamptz,
  last_sent_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  expires_at timestamptz not null,
  sound_name text not null default 'vastra_new_order',
  failure_reason text,
  created_at timestamptz not null default now(),

  constraint merchant_order_alerts_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint merchant_order_alerts_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint merchant_order_alerts_device_id_fkey
    foreign key (device_id)
    references public.user_devices (id)
    on update cascade
    on delete set null,

  constraint merchant_order_alerts_acknowledged_by_fkey
    foreign key (acknowledged_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint merchant_order_alerts_expiry_check
    check (expires_at > created_at),

  constraint merchant_order_alerts_sound_nonempty
    check (length(btrim(sound_name)) > 0),

  constraint merchant_order_alerts_lifecycle_check
    check (
      (
        alert_status = 'PENDING'
        and first_sent_at is null
        and acknowledged_at is null
      )
      or (
        alert_status in ('SENT', 'DELIVERED')
        and first_sent_at is not null
        and acknowledged_at is null
      )
      or (
        alert_status = 'ACKNOWLEDGED'
        and first_sent_at is not null
        and acknowledged_at is not null
        and acknowledged_by is not null
      )
      or alert_status in ('EXPIRED', 'FAILED')
    ),

  constraint merchant_order_alerts_failure_reason_check
    check (
      (
        alert_status = 'FAILED'
        and failure_reason is not null
        and length(btrim(failure_reason)) > 0
      )
      or alert_status <> 'FAILED'
    )
);

comment on table public.merchant_order_alerts is
  'Merchant new-order alert delivery and acknowledgement attempts.';

create table public.merchant_order_issues (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  order_item_id uuid,
  issue_type text not null,
  description text,
  evidence_object_key text,
  reported_by uuid not null,
  resolution_status public.merchant_issue_resolution_status
    not null
    default 'OPEN',
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint merchant_order_issues_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint merchant_order_issues_order_item_id_fkey
    foreign key (order_item_id)
    references public.order_items (id)
    on update cascade
    on delete set null,

  constraint merchant_order_issues_reported_by_fkey
    foreign key (reported_by)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint merchant_order_issues_resolved_by_fkey
    foreign key (resolved_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint merchant_order_issues_issue_type_check
    check (
      issue_type in (
        'OUT_OF_STOCK',
        'SIZE_UNAVAILABLE',
        'COLOUR_UNAVAILABLE',
        'DAMAGED_ITEM',
        'INVENTORY_MISMATCH',
        'ITEM_NOT_FOUND',
        'SHOP_BUSY',
        'SHOP_CLOSING',
        'OTHER'
      )
    ),

  constraint merchant_order_issues_description_nonempty
    check (
      description is null
      or length(btrim(description)) > 0
    ),

  constraint merchant_order_issues_resolution_consistency
    check (
      (
        resolution_status = 'OPEN'
        and resolved_by is null
        and resolved_at is null
        and resolution_note is null
      )
      or (
        resolution_status <> 'OPEN'
        and resolved_by is not null
        and resolved_at is not null
        and resolved_at >= created_at
        and resolution_note is not null
        and length(btrim(resolution_note)) > 0
      )
    )
);

comment on table public.merchant_order_issues is
  'Merchant fulfilment problems using the frozen MVP rejection reasons.';

create table public.order_item_verifications (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null,
  verification_method public.order_item_verification_method not null,
  scanned_barcode text,
  verified_variant_id uuid,
  result public.order_item_verification_result not null,
  verified_by uuid not null,
  verified_at timestamptz not null default now(),
  override_reason text,

  constraint order_item_verifications_order_item_id_fkey
    foreign key (order_item_id)
    references public.order_items (id)
    on update cascade
    on delete restrict,

  constraint order_item_verifications_verified_variant_id_fkey
    foreign key (verified_variant_id)
    references public.product_variants (id)
    on update cascade
    on delete set null,

  constraint order_item_verifications_verified_by_fkey
    foreign key (verified_by)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint order_item_verifications_method_shape
    check (
      (
        verification_method = 'BARCODE'
        and scanned_barcode is not null
        and length(btrim(scanned_barcode)) > 0
      )
      or (
        verification_method = 'MANUAL'
        and scanned_barcode is null
      )
    ),

  constraint order_item_verifications_result_shape
    check (
      (
        result in ('MATCH', 'MISMATCH')
        and override_reason is null
      )
      or (
        result = 'OVERRIDDEN'
        and override_reason is not null
        and length(btrim(override_reason)) > 0
      )
    )
);

comment on table public.order_item_verifications is
  'Barcode or manual confirmation performed while packing an order.';

create unique index order_item_verifications_success_idx
on public.order_item_verifications (order_item_id)
where result in ('MATCH', 'OVERRIDDEN');

create trigger set_carts_updated_at
before update on public.carts
for each row
execute function public.set_updated_at();

create trigger set_cart_items_updated_at
before update on public.cart_items
for each row
execute function public.set_updated_at();

create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create or replace function private.prevent_append_only_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    '% is append-only; insert a compensating record instead',
    tg_table_name
    using errcode = '55000';
end;
$$;

revoke all
on function private.prevent_append_only_mutation()
from public, anon, authenticated;

create trigger prevent_order_status_history_mutation
before update or delete on public.order_status_history
for each row
execute function private.prevent_append_only_mutation();

create or replace function private.is_order_transition_allowed(
  p_current public.order_status,
  p_next public.order_status
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    p_current = p_next
    or (
      p_current = 'PAYMENT_PENDING'
      and p_next in ('WAITING_FOR_MERCHANT', 'CANCELLED')
    )
    or (
      p_current = 'WAITING_FOR_MERCHANT'
      and p_next in (
        'MERCHANT_ACCEPTED',
        'PROBLEM_REPORTED',
        'CANCELLED'
      )
    )
    or (
      p_current = 'MERCHANT_ACCEPTED'
      and p_next in ('PACKING', 'PROBLEM_REPORTED', 'CANCELLED')
    )
    or (
      p_current = 'PACKING'
      and p_next in (
        'READY_FOR_PICKUP',
        'PROBLEM_REPORTED',
        'CANCELLED'
      )
    )
    or (
      p_current = 'READY_FOR_PICKUP'
      and p_next in (
        'CAPTAIN_SEARCHING',
        'CAPTAIN_ASSIGNED',
        'CANCELLED'
      )
    )
    or (
      p_current = 'CAPTAIN_SEARCHING'
      and p_next in (
        'CAPTAIN_ASSIGNED',
        'PROBLEM_REPORTED',
        'CANCELLED'
      )
    )
    or (
      p_current = 'CAPTAIN_ASSIGNED'
      and p_next in (
        'CAPTAIN_AT_STORE',
        'CAPTAIN_SEARCHING',
        'PROBLEM_REPORTED',
        'CANCELLED'
      )
    )
    or (
      p_current = 'CAPTAIN_AT_STORE'
      and p_next in (
        'PICKED_UP',
        'CAPTAIN_SEARCHING',
        'PROBLEM_REPORTED',
        'CANCELLED'
      )
    )
    or (
      p_current = 'PICKED_UP'
      and p_next in ('OUT_FOR_DELIVERY', 'PROBLEM_REPORTED')
    )
    or (
      p_current = 'OUT_FOR_DELIVERY'
      and p_next in (
        'CAPTAIN_AT_CUSTOMER',
        'PROBLEM_REPORTED'
      )
    )
    or (
      p_current = 'CAPTAIN_AT_CUSTOMER'
      and p_next in ('DELIVERED', 'PROBLEM_REPORTED')
    )
    or (
      p_current = 'DELIVERED'
      and p_next in ('COMPLETED', 'PROBLEM_REPORTED')
    )
    or (
      p_current = 'PROBLEM_REPORTED'
      and p_next in (
        'WAITING_FOR_MERCHANT',
        'MERCHANT_ACCEPTED',
        'PACKING',
        'READY_FOR_PICKUP',
        'CAPTAIN_SEARCHING',
        'CAPTAIN_ASSIGNED',
        'CAPTAIN_AT_STORE',
        'PICKED_UP',
        'OUT_FOR_DELIVERY',
        'CAPTAIN_AT_CUSTOMER',
        'DELIVERED',
        'CANCELLED'
      )
    );
$$;

revoke all
on function private.is_order_transition_allowed(
  public.order_status,
  public.order_status
)
from public, anon, authenticated;

create or replace function private.guard_order_status_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and coalesce(
      current_setting('vastra.order_transition', true),
      'blocked'
    ) <> 'allowed'
  then
    raise exception
      'order status must be changed through private.transition_order_state'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all
on function private.guard_order_status_update()
from public, anon, authenticated;

create trigger guard_order_status_update
before update of status on public.orders
for each row
execute function private.guard_order_status_update();

create or replace function private.record_initial_order_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by_role
  )
  values (
    new.id,
    null,
    new.status,
    'SYSTEM'
  );

  return new;
end;
$$;

revoke all
on function private.record_initial_order_status()
from public, anon, authenticated;

create trigger record_initial_order_status
after insert on public.orders
for each row
execute function private.record_initial_order_status();

create or replace function private.transition_order_state(
  p_order_id uuid,
  p_new_status public.order_status,
  p_actor_user_id uuid default null,
  p_actor_role public.order_actor_role default 'SYSTEM',
  p_reason_code text default null,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders;
  updated_order public.orders;
begin
  select *
  into strict current_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if current_order.status = p_new_status then
    return current_order;
  end if;

  if not private.is_order_transition_allowed(
    current_order.status,
    p_new_status
  ) then
    raise exception
      'invalid order transition: % -> %',
      current_order.status,
      p_new_status
      using errcode = '23514';
  end if;

  if (
    p_new_status in ('CANCELLED', 'PROBLEM_REPORTED')
    or current_order.status = 'PROBLEM_REPORTED'
  )
  and (
    p_reason_code is null
    or length(btrim(p_reason_code)) = 0
  )
  then
    raise exception
      'reason_code is required for cancellation, problems, and recovery'
      using errcode = '22023';
  end if;

  perform set_config(
    'vastra.order_transition',
    'allowed',
    true
  );

  update public.orders
  set
    status = p_new_status,
    version = version + 1,
    placed_at = case
      when p_new_status = 'WAITING_FOR_MERCHANT'
        then coalesce(placed_at, now())
      else placed_at
    end,
    accepted_at = case
      when p_new_status = 'MERCHANT_ACCEPTED'
        then coalesce(accepted_at, now())
      else accepted_at
    end,
    ready_at = case
      when p_new_status = 'READY_FOR_PICKUP'
        then coalesce(ready_at, now())
      else ready_at
    end,
    picked_up_at = case
      when p_new_status = 'PICKED_UP'
        then coalesce(picked_up_at, now())
      else picked_up_at
    end,
    delivered_at = case
      when p_new_status = 'DELIVERED'
        then coalesce(delivered_at, now())
      else delivered_at
    end,
    completed_at = case
      when p_new_status = 'COMPLETED'
        then coalesce(completed_at, now())
      else completed_at
    end,
    cancelled_at = case
      when p_new_status = 'CANCELLED'
        then coalesce(cancelled_at, now())
      else null
    end,
    cancellation_reason_code = case
      when p_new_status = 'CANCELLED'
        then p_reason_code
      else cancellation_reason_code
    end,
    cancellation_note = case
      when p_new_status = 'CANCELLED'
        then p_note
      else cancellation_note
    end
  where id = p_order_id
  returning * into updated_order;

  perform set_config(
    'vastra.order_transition',
    'blocked',
    true
  );

  insert into public.order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by_user_id,
    changed_by_role,
    reason_code,
    note
  )
  values (
    p_order_id,
    current_order.status,
    p_new_status,
    p_actor_user_id,
    p_actor_role,
    p_reason_code,
    p_note
  );

  return updated_order;
end;
$$;

revoke all
on function private.transition_order_state(
  uuid,
  public.order_status,
  uuid,
  public.order_actor_role,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function private.transition_order_state(
  uuid,
  public.order_status,
  uuid,
  public.order_actor_role,
  text,
  text
)
to service_role;

alter table public.inventory_reservations
add constraint inventory_reservations_cart_id_fkey
foreign key (cart_id)
references public.carts (id)
on update cascade
on delete restrict;

alter table public.inventory_reservations
add constraint inventory_reservations_order_id_fkey
foreign key (order_id)
references public.orders (id)
on update cascade
on delete restrict;

alter table public.inventory_reservations
add constraint inventory_reservations_exactly_one_reference
check (num_nonnulls(cart_id, order_id) = 1);

alter table public.carts enable row level security;
alter table public.carts force row level security;

alter table public.cart_items enable row level security;
alter table public.cart_items force row level security;

alter table public.orders enable row level security;
alter table public.orders force row level security;

alter table public.order_items enable row level security;
alter table public.order_items force row level security;

alter table public.order_status_history enable row level security;
alter table public.order_status_history force row level security;

alter table public.merchant_order_alerts enable row level security;
alter table public.merchant_order_alerts force row level security;

alter table public.merchant_order_issues enable row level security;
alter table public.merchant_order_issues force row level security;

alter table public.order_item_verifications enable row level security;
alter table public.order_item_verifications force row level security;

revoke all privileges
on table
  public.carts,
  public.cart_items,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.merchant_order_alerts,
  public.merchant_order_issues,
  public.order_item_verifications
from anon, authenticated;

revoke all privileges
on sequence public.order_status_history_id_seq
from anon, authenticated;
