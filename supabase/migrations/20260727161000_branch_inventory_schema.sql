-- Vastra Phase 2B branch-level inventory and concurrency-safe reservations.
--
-- Existing shop-scoped inventory remains operational during the transition.
-- Legitimate legacy balance and movement changes are mirrored into the primary
-- legacy branch. New branch-aware workflows use the functions in this migration.

create table public.branch_inventory (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  shop_id uuid not null,
  variant_id uuid not null,
  stock_on_hand public.non_negative_quantity not null default 0,
  reserved_quantity public.non_negative_quantity not null default 0,
  damaged_quantity public.non_negative_quantity not null default 0,
  safety_stock public.non_negative_quantity not null default 0,
  reorder_level public.non_negative_quantity not null default 0,
  available_quantity integer generated always as (
    stock_on_hand
    - reserved_quantity
    - damaged_quantity
    - safety_stock
  ) stored,
  version public.positive_quantity not null default 1,
  last_counted_at timestamptz,
  legacy_inventory_balance_id uuid,
  updated_at timestamptz not null default now(),

  constraint branch_inventory_branch_shop_fkey
    foreign key (branch_id, shop_id)
    references public.merchant_branches (id, shop_id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_legacy_balance_fkey
    foreign key (legacy_inventory_balance_id)
    references public.inventory_balances (id)
    on update cascade
    on delete set null,

  constraint branch_inventory_branch_variant_key
    unique (branch_id, variant_id),

  constraint branch_inventory_legacy_balance_key
    unique (legacy_inventory_balance_id),

  constraint branch_inventory_available_nonnegative
    check (
      stock_on_hand
      >= reserved_quantity + damaged_quantity + safety_stock
    )
);

comment on table public.branch_inventory is
  'Authoritative inventory for one product variant at one physical or cloud branch.';

create index branch_inventory_variant_available_idx
  on public.branch_inventory (variant_id, available_quantity desc)
  where available_quantity > 0;

create index branch_inventory_branch_available_idx
  on public.branch_inventory (branch_id, available_quantity desc);

create table public.branch_inventory_movements (
  id bigint generated always as identity primary key,
  branch_id uuid not null,
  shop_id uuid not null,
  variant_id uuid not null,
  movement_type public.inventory_movement_type not null,
  quantity_change integer not null,
  reserved_change integer not null default 0,
  damaged_change integer not null default 0,
  safety_stock_change integer not null default 0,
  stock_before public.non_negative_quantity not null,
  stock_after public.non_negative_quantity not null,
  reserved_before public.non_negative_quantity not null,
  reserved_after public.non_negative_quantity not null,
  damaged_before public.non_negative_quantity not null,
  damaged_after public.non_negative_quantity not null,
  safety_stock_before public.non_negative_quantity not null,
  safety_stock_after public.non_negative_quantity not null,
  reference_type text,
  reference_id uuid,
  reason text,
  performed_by uuid,
  source_method public.inventory_source_method not null default 'SYSTEM',
  legacy_inventory_movement_id bigint,
  created_at timestamptz not null default now(),

  constraint branch_inventory_movements_branch_shop_fkey
    foreign key (branch_id, shop_id)
    references public.merchant_branches (id, shop_id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_movements_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_movements_performed_by_fkey
    foreign key (performed_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint branch_inventory_movements_legacy_fkey
    foreign key (legacy_inventory_movement_id)
    references public.inventory_movements (id)
    on update cascade
    on delete set null,

  constraint branch_inventory_movements_legacy_key
    unique (legacy_inventory_movement_id),

  constraint branch_inventory_movements_stock_arithmetic
    check (stock_after = stock_before + quantity_change),

  constraint branch_inventory_movements_reserved_arithmetic
    check (reserved_after = reserved_before + reserved_change),

  constraint branch_inventory_movements_damaged_arithmetic
    check (damaged_after = damaged_before + damaged_change),

  constraint branch_inventory_movements_safety_arithmetic
    check (
      safety_stock_after
      = safety_stock_before + safety_stock_change
    ),

  constraint branch_inventory_movements_before_available
    check (
      stock_before
      >= reserved_before + damaged_before + safety_stock_before
    ),

  constraint branch_inventory_movements_after_available
    check (
      stock_after
      >= reserved_after + damaged_after + safety_stock_after
    ),

  constraint branch_inventory_movements_reference_nonempty
    check (
      reference_type is null
      or length(btrim(reference_type)) > 0
    ),

  constraint branch_inventory_movements_reason_nonempty
    check (
      reason is null
      or length(btrim(reason)) > 0
    )
);

comment on table public.branch_inventory_movements is
  'Immutable branch inventory ledger with complete before and after snapshots.';

create index branch_inventory_movements_branch_variant_idx
  on public.branch_inventory_movements (
    branch_id,
    variant_id,
    created_at desc,
    id desc
  );

create table public.branch_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  shop_id uuid not null,
  variant_id uuid not null,
  cart_id uuid,
  order_id uuid,
  idempotency_key uuid not null,
  quantity public.positive_quantity not null,
  status public.inventory_reservation_status not null default 'ACTIVE',
  expires_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  converted_at timestamptz,

  constraint branch_inventory_reservations_branch_shop_fkey
    foreign key (branch_id, shop_id)
    references public.merchant_branches (id, shop_id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_reservations_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_reservations_cart_id_fkey
    foreign key (cart_id)
    references public.carts (id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_reservations_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_reservations_created_by_fkey
    foreign key (created_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint branch_inventory_reservations_idempotency_key
    unique (idempotency_key),

  constraint branch_inventory_reservations_reference_required
    check (cart_id is not null or order_id is not null),

  constraint branch_inventory_reservations_expiry
    check (expires_at > created_at),

  constraint branch_inventory_reservations_lifecycle
    check (
      (
        status = 'ACTIVE'
        and released_at is null
        and converted_at is null
      )
      or (
        status = 'CONVERTED'
        and released_at is null
        and converted_at is not null
        and converted_at >= created_at
      )
      or (
        status in ('RELEASED', 'EXPIRED')
        and released_at is not null
        and released_at >= created_at
        and converted_at is null
      )
    )
);

comment on table public.branch_inventory_reservations is
  'Idempotent cart or order stock holds scoped to an exact fulfilment branch.';

create unique index branch_inventory_reservations_active_cart_variant_idx
  on public.branch_inventory_reservations (
    branch_id,
    cart_id,
    variant_id
  )
  where status = 'ACTIVE' and cart_id is not null;

create unique index branch_inventory_reservations_active_order_variant_idx
  on public.branch_inventory_reservations (
    branch_id,
    order_id,
    variant_id
  )
  where status = 'ACTIVE' and order_id is not null;

create index branch_inventory_reservations_expiry_idx
  on public.branch_inventory_reservations (expires_at, id)
  where status = 'ACTIVE';

create table private.branch_inventory_reservation_requests (
  idempotency_key uuid primary key,
  branch_id uuid not null,
  variant_id uuid not null,
  actor_id uuid,
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint branch_inventory_requests_branch_id_fkey
    foreign key (branch_id)
    references public.merchant_branches (id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_requests_variant_id_fkey
    foreign key (variant_id)
    references public.product_variants (id)
    on update cascade
    on delete restrict,

  constraint branch_inventory_requests_actor_id_fkey
    foreign key (actor_id)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint branch_inventory_requests_request_object
    check (jsonb_typeof(request_payload) = 'object'),

  constraint branch_inventory_requests_result_object
    check (
      result_payload is null
      or jsonb_typeof(result_payload) = 'object'
    ),

  constraint branch_inventory_requests_completion
    check (
      (
        result_payload is null
        and completed_at is null
      )
      or (
        result_payload is not null
        and completed_at is not null
        and completed_at >= created_at
      )
    )
);

revoke all privileges
on table private.branch_inventory_reservation_requests
from public, anon, authenticated;

create trigger branch_inventory_set_updated_at
before update on public.branch_inventory
for each row execute function public.set_updated_at();

create or replace function private.prevent_branch_inventory_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'branch_inventory_movements is immutable; insert a compensating movement instead'
    using errcode = '55000';
end;
$$;

create trigger branch_inventory_movements_immutable
before update or delete on public.branch_inventory_movements
for each row execute function private.prevent_branch_inventory_movement_mutation();

create or replace function private.primary_branch_for_shop(
  p_shop_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select mb.id
  from public.merchant_branches mb
  where mb.shop_id = p_shop_id
    and mb.is_primary
    and mb.migration_source = 'LEGACY_SHOP'
    and mb.status <> 'CLOSED'
  order by
    mb.created_at,
    mb.id
  limit 1;
$$;

create or replace function private.sync_legacy_inventory_balance_to_branch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_branch_id uuid;
begin
  target_branch_id := private.primary_branch_for_shop(new.shop_id);

  if target_branch_id is null then
    return new;
  end if;

  insert into public.branch_inventory (
    branch_id,
    shop_id,
    variant_id,
    stock_on_hand,
    reserved_quantity,
    damaged_quantity,
    safety_stock,
    reorder_level,
    version,
    last_counted_at,
    legacy_inventory_balance_id
  )
  values (
    target_branch_id,
    new.shop_id,
    new.variant_id,
    new.stock_on_hand,
    new.reserved_quantity,
    new.damaged_quantity,
    0,
    new.reorder_level,
    new.version,
    new.last_counted_at,
    new.id
  )
  on conflict (branch_id, variant_id) do update
  set
    stock_on_hand = excluded.stock_on_hand,
    reserved_quantity = excluded.reserved_quantity,
    damaged_quantity = excluded.damaged_quantity,
    safety_stock = least(
      public.branch_inventory.safety_stock,
      greatest(
        0,
        excluded.stock_on_hand
        - excluded.reserved_quantity
        - excluded.damaged_quantity
      )
    ),
    reorder_level = excluded.reorder_level,
    version = greatest(
      public.branch_inventory.version + 1,
      excluded.version
    ),
    last_counted_at = excluded.last_counted_at,
    legacy_inventory_balance_id = excluded.legacy_inventory_balance_id;

  return new;
end;
$$;

create trigger inventory_balances_sync_primary_branch
after insert or update on public.inventory_balances
for each row execute function private.sync_legacy_inventory_balance_to_branch();

create or replace function private.mirror_legacy_inventory_movement_to_branch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_branch_id uuid;
  safety_value integer;
begin
  target_branch_id := private.primary_branch_for_shop(new.shop_id);

  if target_branch_id is null then
    return new;
  end if;

  select bi.safety_stock
  into safety_value
  from public.branch_inventory bi
  where bi.branch_id = target_branch_id
    and bi.variant_id = new.variant_id;

  safety_value := coalesce(safety_value, 0);

  insert into public.branch_inventory_movements (
    branch_id,
    shop_id,
    variant_id,
    movement_type,
    quantity_change,
    reserved_change,
    damaged_change,
    safety_stock_change,
    stock_before,
    stock_after,
    reserved_before,
    reserved_after,
    damaged_before,
    damaged_after,
    safety_stock_before,
    safety_stock_after,
    reference_type,
    reference_id,
    reason,
    performed_by,
    source_method,
    legacy_inventory_movement_id,
    created_at
  )
  values (
    target_branch_id,
    new.shop_id,
    new.variant_id,
    new.movement_type,
    new.quantity_change,
    new.reserved_change,
    new.damaged_change,
    0,
    new.stock_before,
    new.stock_after,
    new.reserved_before,
    new.reserved_after,
    new.damaged_before,
    new.damaged_after,
    safety_value,
    safety_value,
    new.reference_type,
    new.reference_id,
    new.reason,
    new.performed_by,
    new.source_method,
    new.id,
    new.created_at
  )
  on conflict (legacy_inventory_movement_id) do nothing;

  return new;
end;
$$;

create trigger inventory_movements_mirror_primary_branch
after insert on public.inventory_movements
for each row execute function private.mirror_legacy_inventory_movement_to_branch();

insert into public.branch_inventory (
  branch_id,
  shop_id,
  variant_id,
  stock_on_hand,
  reserved_quantity,
  damaged_quantity,
  safety_stock,
  reorder_level,
  version,
  last_counted_at,
  legacy_inventory_balance_id
)
select
  private.primary_branch_for_shop(ib.shop_id),
  ib.shop_id,
  ib.variant_id,
  ib.stock_on_hand,
  ib.reserved_quantity,
  ib.damaged_quantity,
  0,
  ib.reorder_level,
  ib.version,
  ib.last_counted_at,
  ib.id
from public.inventory_balances ib
where private.primary_branch_for_shop(ib.shop_id) is not null
on conflict (branch_id, variant_id) do update
set
  stock_on_hand = excluded.stock_on_hand,
  reserved_quantity = excluded.reserved_quantity,
  damaged_quantity = excluded.damaged_quantity,
  reorder_level = excluded.reorder_level,
  version = greatest(public.branch_inventory.version, excluded.version),
  last_counted_at = excluded.last_counted_at,
  legacy_inventory_balance_id = excluded.legacy_inventory_balance_id;

insert into public.branch_inventory_movements (
  branch_id,
  shop_id,
  variant_id,
  movement_type,
  quantity_change,
  reserved_change,
  damaged_change,
  safety_stock_change,
  stock_before,
  stock_after,
  reserved_before,
  reserved_after,
  damaged_before,
  damaged_after,
  safety_stock_before,
  safety_stock_after,
  reference_type,
  reference_id,
  reason,
  source_method
)
select
  bi.branch_id,
  bi.shop_id,
  bi.variant_id,
  'STOCK_AUDIT',
  bi.stock_on_hand,
  bi.reserved_quantity,
  bi.damaged_quantity,
  bi.safety_stock,
  0,
  bi.stock_on_hand,
  0,
  bi.reserved_quantity,
  0,
  bi.damaged_quantity,
  0,
  bi.safety_stock,
  'LEGACY_INVENTORY_BALANCE',
  bi.legacy_inventory_balance_id,
  'Initial Phase 2B branch inventory migration',
  'SYSTEM'
from public.branch_inventory bi
where bi.legacy_inventory_balance_id is not null
  and not exists (
    select 1
    from public.branch_inventory_movements bim
    where bim.branch_id = bi.branch_id
      and bim.variant_id = bi.variant_id
      and bim.reference_type = 'LEGACY_INVENTORY_BALANCE'
      and bim.reference_id = bi.legacy_inventory_balance_id
  );

create or replace function private.build_branch_inventory_result(
  p_reservation_id uuid,
  p_replayed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.branch_inventory_reservations;
  balance_row public.branch_inventory;
begin
  select *
  into strict reservation_row
  from public.branch_inventory_reservations bir
  where bir.id = p_reservation_id;

  select *
  into strict balance_row
  from public.branch_inventory bi
  where bi.branch_id = reservation_row.branch_id
    and bi.variant_id = reservation_row.variant_id;

  return jsonb_build_object(
    'id', reservation_row.id,
    'idempotencyKey', reservation_row.idempotency_key,
    'replayed', p_replayed,
    'branchId', reservation_row.branch_id,
    'shopId', reservation_row.shop_id,
    'variantId', reservation_row.variant_id,
    'cartId', reservation_row.cart_id,
    'orderId', reservation_row.order_id,
    'quantity', reservation_row.quantity,
    'status', reservation_row.status,
    'expiresAt', reservation_row.expires_at,
    'createdAt', reservation_row.created_at,
    'releasedAt', reservation_row.released_at,
    'convertedAt', reservation_row.converted_at,
    'balance', jsonb_build_object(
      'stockOnHand', balance_row.stock_on_hand,
      'reservedQuantity', balance_row.reserved_quantity,
      'damagedQuantity', balance_row.damaged_quantity,
      'safetyStock', balance_row.safety_stock,
      'availableQuantity', balance_row.available_quantity,
      'reorderLevel', balance_row.reorder_level,
      'version', balance_row.version,
      'updatedAt', balance_row.updated_at
    )
  );
end;
$$;
