-- Vastra variant-level inventory balances, immutable movement ledger,
-- reservations, and trusted concurrency-safe inventory primitives.
--
-- Cart and order foreign keys are added later when their owning tables exist.
-- Direct client updates remain denied. Only trusted server-side workflows may
-- execute the private inventory functions.

create schema if not exists private;

revoke all on schema private
from public, anon, authenticated;

grant usage on schema private
to service_role;

create type public.inventory_movement_type as enum (
  'STOCK_RECEIVED',
  'OFFLINE_SALE',
  'ONLINE_ORDER_RESERVED',
  'ONLINE_ORDER_RELEASED',
  'ONLINE_ORDER_COMPLETED',
  'RETURN_TO_STOCK',
  'MARKED_DAMAGED',
  'STOCK_CORRECTION',
  'STOCK_AUDIT'
);

create type public.inventory_source_method as enum (
  'BARCODE',
  'PHOTO_MATCH',
  'MANUAL_SEARCH',
  'SYSTEM',
  'ADMIN'
);

create type public.inventory_reservation_status as enum (
  'ACTIVE',
  'CONVERTED',
  'RELEASED',
  'EXPIRED'
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  variant_id uuid not null,
  stock_on_hand public.non_negative_quantity not null default 0,
  reserved_quantity public.non_negative_quantity not null default 0,
  damaged_quantity public.non_negative_quantity not null default 0,
  reorder_level public.non_negative_quantity not null default 0,
  version public.positive_quantity not null default 1,
  last_counted_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint inventory_balances_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint inventory_balances_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint inventory_balances_shop_variant_key
    unique (shop_id, variant_id),

  constraint inventory_balances_available_quantity_check
    check (
      stock_on_hand >= reserved_quantity + damaged_quantity
    )
);

comment on table public.inventory_balances is
  'Authoritative variant-level physical, reserved, damaged, and available stock.';

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  shop_id uuid not null,
  variant_id uuid not null,
  movement_type public.inventory_movement_type not null,
  quantity_change integer not null,
  reserved_change integer not null default 0,
  damaged_change integer not null default 0,
  stock_before public.non_negative_quantity not null,
  stock_after public.non_negative_quantity not null,
  reserved_before public.non_negative_quantity not null,
  reserved_after public.non_negative_quantity not null,
  damaged_before public.non_negative_quantity not null,
  damaged_after public.non_negative_quantity not null,
  reference_type text,
  reference_id uuid,
  reason text,
  performed_by uuid,
  source_method public.inventory_source_method
    not null
    default 'SYSTEM',
  created_at timestamptz not null default now(),

  constraint inventory_movements_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint inventory_movements_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint inventory_movements_performed_by_fkey
    foreign key (performed_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint inventory_movements_stock_arithmetic_check
    check (stock_after = stock_before + quantity_change),

  constraint inventory_movements_reserved_arithmetic_check
    check (reserved_after = reserved_before + reserved_change),

  constraint inventory_movements_damaged_arithmetic_check
    check (damaged_after = damaged_before + damaged_change),

  constraint inventory_movements_before_available_check
    check (
      stock_before >= reserved_before + damaged_before
    ),

  constraint inventory_movements_after_available_check
    check (
      stock_after >= reserved_after + damaged_after
    ),

  constraint inventory_movements_reference_type_nonempty
    check (
      reference_type is null
      or length(btrim(reference_type)) > 0
    ),

  constraint inventory_movements_reason_nonempty
    check (
      reason is null
      or length(btrim(reason)) > 0
    )
);

comment on table public.inventory_movements is
  'Immutable ledger containing every inventory balance change and its snapshots.';

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  variant_id uuid not null,
  cart_id uuid,
  order_id uuid,
  quantity public.positive_quantity not null,
  status public.inventory_reservation_status
    not null
    default 'ACTIVE',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,

  constraint inventory_reservations_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint inventory_reservations_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint inventory_reservations_reference_check
    check (
      cart_id is not null
      or order_id is not null
    ),

  constraint inventory_reservations_expiry_check
    check (expires_at > created_at),

  constraint inventory_reservations_lifecycle_check
    check (
      (
        status in ('ACTIVE', 'CONVERTED')
        and released_at is null
      )
      or (
        status in ('RELEASED', 'EXPIRED')
        and released_at is not null
        and released_at >= created_at
      )
    )
);

comment on table public.inventory_reservations is
  'Cart or order-linked reservations preventing double-selling of stock.';

create unique index inventory_reservations_active_cart_variant_idx
on public.inventory_reservations (cart_id, variant_id)
where status = 'ACTIVE'
  and cart_id is not null;

create unique index inventory_reservations_active_order_variant_idx
on public.inventory_reservations (order_id, variant_id)
where status = 'ACTIVE'
  and order_id is not null;

create trigger set_inventory_balances_updated_at
before update on public.inventory_balances
for each row
execute function public.set_updated_at();

create or replace function private.prevent_inventory_movement_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    'inventory_movements is immutable; insert a compensating movement instead'
    using errcode = '55000';
end;
$$;

revoke all
on function private.prevent_inventory_movement_mutation()
from public, anon, authenticated;

create trigger prevent_inventory_movement_mutation
before update or delete on public.inventory_movements
for each row
execute function private.prevent_inventory_movement_mutation();

create or replace function private.apply_inventory_delta(
  p_shop_id uuid,
  p_variant_id uuid,
  p_stock_delta integer,
  p_reserved_delta integer,
  p_damaged_delta integer,
  p_movement_type public.inventory_movement_type,
  p_source_method public.inventory_source_method,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null,
  p_actor uuid default null
)
returns public.inventory_balances
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row public.inventory_balances;
  after_row public.inventory_balances;
  next_stock integer;
  next_reserved integer;
  next_damaged integer;
begin
  if not exists (
    select 1
    from public.product_variants pv
    where pv.id = p_variant_id
      and pv.shop_id = p_shop_id
  ) then
    raise exception
      'variant % does not belong to shop %',
      p_variant_id,
      p_shop_id
      using errcode = '23503';
  end if;

  insert into public.inventory_balances (
    shop_id,
    variant_id
  )
  values (
    p_shop_id,
    p_variant_id
  )
  on conflict (shop_id, variant_id) do nothing;

  select *
  into strict before_row
  from public.inventory_balances ib
  where ib.shop_id = p_shop_id
    and ib.variant_id = p_variant_id
  for update;

  next_stock := before_row.stock_on_hand + p_stock_delta;
  next_reserved := before_row.reserved_quantity + p_reserved_delta;
  next_damaged := before_row.damaged_quantity + p_damaged_delta;

  if next_stock < 0
    or next_reserved < 0
    or next_damaged < 0
    or next_stock < next_reserved + next_damaged
  then
    raise exception
      'invalid inventory delta for variant %',
      p_variant_id
      using errcode = '23514';
  end if;

  update public.inventory_balances
  set
    stock_on_hand = next_stock,
    reserved_quantity = next_reserved,
    damaged_quantity = next_damaged,
    version = version + 1
  where id = before_row.id
  returning * into after_row;

  insert into public.inventory_movements (
    shop_id,
    variant_id,
    movement_type,
    quantity_change,
    reserved_change,
    damaged_change,
    stock_before,
    stock_after,
    reserved_before,
    reserved_after,
    damaged_before,
    damaged_after,
    reference_type,
    reference_id,
    reason,
    performed_by,
    source_method
  )
  values (
    p_shop_id,
    p_variant_id,
    p_movement_type,
    p_stock_delta,
    p_reserved_delta,
    p_damaged_delta,
    before_row.stock_on_hand,
    after_row.stock_on_hand,
    before_row.reserved_quantity,
    after_row.reserved_quantity,
    before_row.damaged_quantity,
    after_row.damaged_quantity,
    p_reference_type,
    p_reference_id,
    p_reason,
    p_actor,
    p_source_method
  );

  return after_row;
end;
$$;

create or replace function private.reserve_inventory(
  p_shop_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_expires_at timestamptz,
  p_cart_id uuid default null,
  p_order_id uuid default null,
  p_actor uuid default null
)
returns public.inventory_reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row public.inventory_balances;
  after_row public.inventory_balances;
  reservation_row public.inventory_reservations;
  available_quantity integer;
begin
  if p_quantity <= 0 then
    raise exception
      'reservation quantity must be positive'
      using errcode = '22023';
  end if;

  if p_cart_id is null and p_order_id is null then
    raise exception
      'a cart_id or order_id is required'
      using errcode = '22023';
  end if;

  if p_expires_at <= now() then
    raise exception
      'reservation expiry must be in the future'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.product_variants pv
    where pv.id = p_variant_id
      and pv.shop_id = p_shop_id
      and pv.is_active
  ) then
    raise exception
      'active variant % does not belong to shop %',
      p_variant_id,
      p_shop_id
      using errcode = '23503';
  end if;

  insert into public.inventory_balances (
    shop_id,
    variant_id
  )
  values (
    p_shop_id,
    p_variant_id
  )
  on conflict (shop_id, variant_id) do nothing;

  select *
  into strict before_row
  from public.inventory_balances ib
  where ib.shop_id = p_shop_id
    and ib.variant_id = p_variant_id
  for update;

  available_quantity :=
    before_row.stock_on_hand
    - before_row.reserved_quantity
    - before_row.damaged_quantity;

  if available_quantity < p_quantity then
    raise exception
      'insufficient inventory for variant %: requested %, available %',
      p_variant_id,
      p_quantity,
      available_quantity
      using errcode = 'P0001';
  end if;

  insert into public.inventory_reservations (
    shop_id,
    variant_id,
    cart_id,
    order_id,
    quantity,
    status,
    expires_at
  )
  values (
    p_shop_id,
    p_variant_id,
    p_cart_id,
    p_order_id,
    p_quantity,
    'ACTIVE',
    p_expires_at
  )
  returning * into reservation_row;

  update public.inventory_balances
  set
    reserved_quantity = reserved_quantity + p_quantity,
    version = version + 1
  where id = before_row.id
  returning * into after_row;

  insert into public.inventory_movements (
    shop_id,
    variant_id,
    movement_type,
    quantity_change,
    reserved_change,
    damaged_change,
    stock_before,
    stock_after,
    reserved_before,
    reserved_after,
    damaged_before,
    damaged_after,
    reference_type,
    reference_id,
    performed_by,
    source_method
  )
  values (
    p_shop_id,
    p_variant_id,
    'ONLINE_ORDER_RESERVED',
    0,
    p_quantity,
    0,
    before_row.stock_on_hand,
    after_row.stock_on_hand,
    before_row.reserved_quantity,
    after_row.reserved_quantity,
    before_row.damaged_quantity,
    after_row.damaged_quantity,
    'INVENTORY_RESERVATION',
    reservation_row.id,
    p_actor,
    'SYSTEM'
  );

  return reservation_row;
end;
$$;

create or replace function private.release_inventory_reservation(
  p_reservation_id uuid,
  p_final_status public.inventory_reservation_status
    default 'RELEASED',
  p_reason text default null,
  p_actor uuid default null
)
returns public.inventory_reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.inventory_reservations;
  before_row public.inventory_balances;
  after_row public.inventory_balances;
begin
  if p_final_status not in ('RELEASED', 'EXPIRED') then
    raise exception
      'final reservation status must be RELEASED or EXPIRED'
      using errcode = '22023';
  end if;

  select *
  into strict reservation_row
  from public.inventory_reservations ir
  where ir.id = p_reservation_id
  for update;

  if reservation_row.status in ('RELEASED', 'EXPIRED') then
    return reservation_row;
  end if;

  select *
  into strict before_row
  from public.inventory_balances ib
  where ib.shop_id = reservation_row.shop_id
    and ib.variant_id = reservation_row.variant_id
  for update;

  if before_row.reserved_quantity < reservation_row.quantity then
    raise exception
      'reservation quantity exceeds reserved inventory'
      using errcode = '23514';
  end if;

  update public.inventory_balances
  set
    reserved_quantity =
      reserved_quantity - reservation_row.quantity,
    version = version + 1
  where id = before_row.id
  returning * into after_row;

  update public.inventory_reservations
  set
    status = p_final_status,
    released_at = now()
  where id = reservation_row.id
  returning * into reservation_row;

  insert into public.inventory_movements (
    shop_id,
    variant_id,
    movement_type,
    quantity_change,
    reserved_change,
    damaged_change,
    stock_before,
    stock_after,
    reserved_before,
    reserved_after,
    damaged_before,
    damaged_after,
    reference_type,
    reference_id,
    reason,
    performed_by,
    source_method
  )
  values (
    reservation_row.shop_id,
    reservation_row.variant_id,
    'ONLINE_ORDER_RELEASED',
    0,
    -reservation_row.quantity,
    0,
    before_row.stock_on_hand,
    after_row.stock_on_hand,
    before_row.reserved_quantity,
    after_row.reserved_quantity,
    before_row.damaged_quantity,
    after_row.damaged_quantity,
    'INVENTORY_RESERVATION',
    reservation_row.id,
    p_reason,
    p_actor,
    'SYSTEM'
  );

  return reservation_row;
end;
$$;

revoke all
on function private.apply_inventory_delta(
  uuid,
  uuid,
  integer,
  integer,
  integer,
  public.inventory_movement_type,
  public.inventory_source_method,
  text,
  uuid,
  text,
  uuid
)
from public, anon, authenticated;

revoke all
on function private.reserve_inventory(
  uuid,
  uuid,
  integer,
  timestamptz,
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;

revoke all
on function private.release_inventory_reservation(
  uuid,
  public.inventory_reservation_status,
  text,
  uuid
)
from public, anon, authenticated;

grant execute
on function private.apply_inventory_delta(
  uuid,
  uuid,
  integer,
  integer,
  integer,
  public.inventory_movement_type,
  public.inventory_source_method,
  text,
  uuid,
  text,
  uuid
)
to service_role;

grant execute
on function private.reserve_inventory(
  uuid,
  uuid,
  integer,
  timestamptz,
  uuid,
  uuid,
  uuid
)
to service_role;

grant execute
on function private.release_inventory_reservation(
  uuid,
  public.inventory_reservation_status,
  text,
  uuid
)
to service_role;

alter table public.inventory_balances enable row level security;
alter table public.inventory_balances force row level security;

alter table public.inventory_movements enable row level security;
alter table public.inventory_movements force row level security;

alter table public.inventory_reservations enable row level security;
alter table public.inventory_reservations force row level security;

revoke all privileges
on table
  public.inventory_balances,
  public.inventory_movements,
  public.inventory_reservations
from anon, authenticated;

revoke all privileges
on sequence public.inventory_movements_id_seq
from anon, authenticated;
