create or replace function private.apply_branch_inventory_delta(
  p_branch_id uuid,
  p_variant_id uuid,
  p_stock_delta integer,
  p_reserved_delta integer,
  p_damaged_delta integer,
  p_safety_stock_delta integer,
  p_movement_type public.inventory_movement_type,
  p_source_method public.inventory_source_method,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null,
  p_actor uuid default null
)
returns public.branch_inventory
language plpgsql
security definer
set search_path = ''
as $$
declare
  branch_row public.merchant_branches;
  before_row public.branch_inventory;
  after_row public.branch_inventory;
  next_stock integer;
  next_reserved integer;
  next_damaged integer;
  next_safety integer;
  movement_id bigint;
begin
  select *
  into strict branch_row
  from public.merchant_branches mb
  where mb.id = p_branch_id;

  if not exists (
    select 1
    from public.product_variants pv
    where pv.id = p_variant_id
      and pv.shop_id = branch_row.shop_id
  ) then
    raise exception 'BRANCH_VARIANT_SHOP_MISMATCH'
      using errcode = '23503';
  end if;

  insert into public.branch_inventory (
    branch_id,
    shop_id,
    variant_id
  )
  values (
    branch_row.id,
    branch_row.shop_id,
    p_variant_id
  )
  on conflict (branch_id, variant_id) do nothing;

  select *
  into strict before_row
  from public.branch_inventory bi
  where bi.branch_id = p_branch_id
    and bi.variant_id = p_variant_id
  for update;

  next_stock := before_row.stock_on_hand + p_stock_delta;
  next_reserved := before_row.reserved_quantity + p_reserved_delta;
  next_damaged := before_row.damaged_quantity + p_damaged_delta;
  next_safety := before_row.safety_stock + p_safety_stock_delta;

  if next_stock < 0
    or next_reserved < 0
    or next_damaged < 0
    or next_safety < 0
    or next_stock < next_reserved + next_damaged + next_safety
  then
    raise exception 'BRANCH_INVENTORY_DELTA_INVALID'
      using errcode = '23514';
  end if;

  update public.branch_inventory
  set
    stock_on_hand = next_stock,
    reserved_quantity = next_reserved,
    damaged_quantity = next_damaged,
    safety_stock = next_safety,
    version = version + 1
  where id = before_row.id
  returning * into after_row;

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
    source_method
  )
  values (
    p_branch_id,
    branch_row.shop_id,
    p_variant_id,
    p_movement_type,
    p_stock_delta,
    p_reserved_delta,
    p_damaged_delta,
    p_safety_stock_delta,
    before_row.stock_on_hand,
    after_row.stock_on_hand,
    before_row.reserved_quantity,
    after_row.reserved_quantity,
    before_row.damaged_quantity,
    after_row.damaged_quantity,
    before_row.safety_stock,
    after_row.safety_stock,
    p_reference_type,
    p_reference_id,
    p_reason,
    p_actor,
    p_source_method
  )
  returning id into movement_id;

  perform private.enqueue_outbox_event(
    'branch.inventory.changed',
    'MERCHANT_BRANCH',
    p_branch_id,
    jsonb_build_object(
      'branchId', p_branch_id,
      'shopId', branch_row.shop_id,
      'variantId', p_variant_id,
      'movementId', movement_id::text,
      'movementType', p_movement_type,
      'stockOnHand', after_row.stock_on_hand,
      'reservedQuantity', after_row.reserved_quantity,
      'damagedQuantity', after_row.damaged_quantity,
      'safetyStock', after_row.safety_stock,
      'availableQuantity', after_row.available_quantity,
      'version', after_row.version
    )
  );

  return after_row;
end;
$$;

create or replace function private.reserve_branch_inventory(
  p_branch_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_expires_at timestamptz,
  p_idempotency_key uuid,
  p_cart_id uuid default null,
  p_order_id uuid default null,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  branch_row public.merchant_branches;
  request_row private.branch_inventory_reservation_requests;
  request_payload jsonb;
  before_row public.branch_inventory;
  after_row public.branch_inventory;
  reservation_row public.branch_inventory_reservations;
  response_payload jsonb;
  movement_id bigint;
begin
  if p_branch_id is null
    or p_variant_id is null
    or p_idempotency_key is null
  then
    raise exception 'BRANCH_RESERVATION_INPUT_REQUIRED'
      using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'BRANCH_RESERVATION_QUANTITY_INVALID'
      using errcode = '22023';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'BRANCH_RESERVATION_EXPIRY_INVALID'
      using errcode = '22023';
  end if;

  if p_cart_id is null and p_order_id is null then
    raise exception 'BRANCH_RESERVATION_REFERENCE_REQUIRED'
      using errcode = '22023';
  end if;

  select *
  into strict branch_row
  from public.merchant_branches mb
  where mb.id = p_branch_id;

  if branch_row.status <> 'ACTIVE' then
    raise exception 'MERCHANT_BRANCH_NOT_ACTIVE'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.product_variants pv
    where pv.id = p_variant_id
      and pv.shop_id = branch_row.shop_id
      and pv.is_active
  ) then
    raise exception 'ACTIVE_VARIANT_NOT_AVAILABLE_AT_BRANCH_SHOP'
      using errcode = '23503';
  end if;

  request_payload := jsonb_build_object(
    'branchId', p_branch_id,
    'variantId', p_variant_id,
    'quantity', p_quantity,
    'expiresAt', p_expires_at,
    'cartId', p_cart_id,
    'orderId', p_order_id,
    'actorId', p_actor
  );

  insert into private.branch_inventory_reservation_requests (
    idempotency_key,
    branch_id,
    variant_id,
    actor_id,
    request_payload
  )
  values (
    p_idempotency_key,
    p_branch_id,
    p_variant_id,
    p_actor,
    request_payload
  )
  on conflict (idempotency_key) do nothing
  returning * into request_row;

  if not found then
    select *
    into strict request_row
    from private.branch_inventory_reservation_requests birr
    where birr.idempotency_key = p_idempotency_key
    for update;

    if request_row.request_payload <> request_payload then
      raise exception 'BRANCH_RESERVATION_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0002';
    end if;

    if request_row.result_payload is null then
      raise exception 'BRANCH_RESERVATION_RECEIPT_INCOMPLETE'
        using errcode = '55000';
    end if;

    return jsonb_set(
      request_row.result_payload,
      '{replayed}',
      to_jsonb(true),
      true
    );
  end if;

  insert into public.branch_inventory (
    branch_id,
    shop_id,
    variant_id
  )
  values (
    branch_row.id,
    branch_row.shop_id,
    p_variant_id
  )
  on conflict (branch_id, variant_id) do nothing;

  select *
  into strict before_row
  from public.branch_inventory bi
  where bi.branch_id = p_branch_id
    and bi.variant_id = p_variant_id
  for update;

  if before_row.available_quantity < p_quantity then
    raise exception 'INSUFFICIENT_BRANCH_STOCK'
      using errcode = 'P0001';
  end if;

  insert into public.branch_inventory_reservations (
    branch_id,
    shop_id,
    variant_id,
    cart_id,
    order_id,
    idempotency_key,
    quantity,
    expires_at,
    created_by
  )
  values (
    p_branch_id,
    branch_row.shop_id,
    p_variant_id,
    p_cart_id,
    p_order_id,
    p_idempotency_key,
    p_quantity,
    p_expires_at,
    p_actor
  )
  returning * into reservation_row;

  update public.branch_inventory
  set
    reserved_quantity = reserved_quantity + p_quantity,
    version = version + 1
  where id = before_row.id
  returning * into after_row;

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
    performed_by,
    source_method
  )
  values (
    p_branch_id,
    branch_row.shop_id,
    p_variant_id,
    'ONLINE_ORDER_RESERVED',
    0,
    p_quantity,
    0,
    0,
    before_row.stock_on_hand,
    after_row.stock_on_hand,
    before_row.reserved_quantity,
    after_row.reserved_quantity,
    before_row.damaged_quantity,
    after_row.damaged_quantity,
    before_row.safety_stock,
    after_row.safety_stock,
    'BRANCH_INVENTORY_RESERVATION',
    reservation_row.id,
    p_actor,
    'SYSTEM'
  )
  returning id into movement_id;

  perform private.enqueue_outbox_event(
    'branch.inventory.changed',
    'MERCHANT_BRANCH',
    p_branch_id,
    jsonb_build_object(
      'branchId', p_branch_id,
      'shopId', branch_row.shop_id,
      'variantId', p_variant_id,
      'reservationId', reservation_row.id,
      'movementId', movement_id::text,
      'action', 'RESERVE',
      'availableQuantity', after_row.available_quantity,
      'version', after_row.version
    )
  );

  response_payload := private.build_branch_inventory_result(
    reservation_row.id,
    false
  );

  update private.branch_inventory_reservation_requests birr
  set
    result_payload = response_payload,
    completed_at = now()
  where birr.idempotency_key = p_idempotency_key;

  return response_payload;
end;
$$;

create or replace function private.release_branch_inventory_reservation(
  p_reservation_id uuid,
  p_final_status public.inventory_reservation_status default 'RELEASED',
  p_reason text default null,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.branch_inventory_reservations;
  before_row public.branch_inventory;
  after_row public.branch_inventory;
  movement_id bigint;
  response_payload jsonb;
begin
  if p_final_status not in ('RELEASED', 'EXPIRED') then
    raise exception 'BRANCH_RESERVATION_RELEASE_STATUS_INVALID'
      using errcode = '22023';
  end if;

  select *
  into strict reservation_row
  from public.branch_inventory_reservations bir
  where bir.id = p_reservation_id
  for update;

  if reservation_row.status in ('RELEASED', 'EXPIRED') then
    return private.build_branch_inventory_result(
      reservation_row.id,
      true
    );
  end if;

  if reservation_row.status = 'CONVERTED' then
    raise exception 'BRANCH_RESERVATION_ALREADY_CONVERTED'
      using errcode = '23514';
  end if;

  select *
  into strict before_row
  from public.branch_inventory bi
  where bi.branch_id = reservation_row.branch_id
    and bi.variant_id = reservation_row.variant_id
  for update;

  if before_row.reserved_quantity < reservation_row.quantity then
    raise exception 'BRANCH_RESERVED_QUANTITY_INVARIANT_FAILED'
      using errcode = '23514';
  end if;

  update public.branch_inventory
  set
    reserved_quantity = reserved_quantity - reservation_row.quantity,
    version = version + 1
  where id = before_row.id
  returning * into after_row;

  update public.branch_inventory_reservations
  set
    status = p_final_status,
    released_at = now()
  where id = reservation_row.id
  returning * into reservation_row;

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
    source_method
  )
  values (
    reservation_row.branch_id,
    reservation_row.shop_id,
    reservation_row.variant_id,
    'ONLINE_ORDER_RELEASED',
    0,
    -reservation_row.quantity,
    0,
    0,
    before_row.stock_on_hand,
    after_row.stock_on_hand,
    before_row.reserved_quantity,
    after_row.reserved_quantity,
    before_row.damaged_quantity,
    after_row.damaged_quantity,
    before_row.safety_stock,
    after_row.safety_stock,
    'BRANCH_INVENTORY_RESERVATION',
    reservation_row.id,
    p_reason,
    p_actor,
    'SYSTEM'
  )
  returning id into movement_id;

  perform private.enqueue_outbox_event(
    'branch.inventory.changed',
    'MERCHANT_BRANCH',
    reservation_row.branch_id,
    jsonb_build_object(
      'branchId', reservation_row.branch_id,
      'shopId', reservation_row.shop_id,
      'variantId', reservation_row.variant_id,
      'reservationId', reservation_row.id,
      'movementId', movement_id::text,
      'action', p_final_status::text,
      'availableQuantity', after_row.available_quantity,
      'version', after_row.version
    )
  );

  response_payload := private.build_branch_inventory_result(
    reservation_row.id,
    false
  );

  update private.branch_inventory_reservation_requests birr
  set
    result_payload = response_payload,
    completed_at = now()
  where birr.idempotency_key = reservation_row.idempotency_key;

  return response_payload;
end;
$$;

create or replace function private.convert_branch_inventory_reservation(
  p_reservation_id uuid,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.branch_inventory_reservations;
  before_row public.branch_inventory;
  after_row public.branch_inventory;
  movement_id bigint;
  response_payload jsonb;
begin
  select *
  into strict reservation_row
  from public.branch_inventory_reservations bir
  where bir.id = p_reservation_id
  for update;

  if reservation_row.status = 'CONVERTED' then
    return private.build_branch_inventory_result(
      reservation_row.id,
      true
    );
  end if;

  if reservation_row.status <> 'ACTIVE' then
    raise exception 'BRANCH_RESERVATION_NOT_ACTIVE'
      using errcode = '23514';
  end if;

  select *
  into strict before_row
  from public.branch_inventory bi
  where bi.branch_id = reservation_row.branch_id
    and bi.variant_id = reservation_row.variant_id
  for update;

  if before_row.reserved_quantity < reservation_row.quantity
    or before_row.stock_on_hand < reservation_row.quantity
  then
    raise exception 'BRANCH_CONVERSION_INVARIANT_FAILED'
      using errcode = '23514';
  end if;

  update public.branch_inventory
  set
    stock_on_hand = stock_on_hand - reservation_row.quantity,
    reserved_quantity = reserved_quantity - reservation_row.quantity,
    version = version + 1
  where id = before_row.id
  returning * into after_row;

  update public.branch_inventory_reservations
  set
    status = 'CONVERTED',
    converted_at = now()
  where id = reservation_row.id
  returning * into reservation_row;

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
    performed_by,
    source_method
  )
  values (
    reservation_row.branch_id,
    reservation_row.shop_id,
    reservation_row.variant_id,
    'ONLINE_ORDER_COMPLETED',
    -reservation_row.quantity,
    -reservation_row.quantity,
    0,
    0,
    before_row.stock_on_hand,
    after_row.stock_on_hand,
    before_row.reserved_quantity,
    after_row.reserved_quantity,
    before_row.damaged_quantity,
    after_row.damaged_quantity,
    before_row.safety_stock,
    after_row.safety_stock,
    'BRANCH_INVENTORY_RESERVATION',
    reservation_row.id,
    p_actor,
    'SYSTEM'
  )
  returning id into movement_id;

  perform private.enqueue_outbox_event(
    'branch.inventory.changed',
    'MERCHANT_BRANCH',
    reservation_row.branch_id,
    jsonb_build_object(
      'branchId', reservation_row.branch_id,
      'shopId', reservation_row.shop_id,
      'variantId', reservation_row.variant_id,
      'reservationId', reservation_row.id,
      'movementId', movement_id::text,
      'action', 'CONVERT',
      'availableQuantity', after_row.available_quantity,
      'version', after_row.version
    )
  );

  response_payload := private.build_branch_inventory_result(
    reservation_row.id,
    false
  );

  update private.branch_inventory_reservation_requests birr
  set
    result_payload = response_payload,
    completed_at = now()
  where birr.idempotency_key = reservation_row.idempotency_key;

  return response_payload;
end;
$$;

create or replace function private.expire_branch_inventory_reservations(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_id uuid;
  expired_count integer := 0;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'BRANCH_RESERVATION_EXPIRY_LIMIT_INVALID'
      using errcode = '22023';
  end if;

  for reservation_id in
    select bir.id
    from public.branch_inventory_reservations bir
    where bir.status = 'ACTIVE'
      and bir.expires_at <= now()
    order by bir.expires_at, bir.id
    for update skip locked
    limit p_limit
  loop
    perform private.release_branch_inventory_reservation(
      reservation_id,
      'EXPIRED',
      'Reservation TTL expired',
      null
    );
    expired_count := expired_count + 1;
  end loop;

  return expired_count;
end;
$$;

create unique index branch_inventory_movement_transition_idx
  on public.branch_inventory_movements (
    reference_id,
    movement_type
  )
  where reference_type = 'BRANCH_INVENTORY_RESERVATION'
    and reference_id is not null
    and movement_type in (
      'ONLINE_ORDER_RESERVED',
      'ONLINE_ORDER_RELEASED',
      'ONLINE_ORDER_COMPLETED'
    );

revoke all
on function private.prevent_branch_inventory_movement_mutation()
from public, anon, authenticated;

revoke all
on function private.primary_branch_for_shop(uuid)
from public, anon, authenticated;

revoke all
on function private.sync_legacy_inventory_balance_to_branch()
from public, anon, authenticated;

revoke all
on function private.mirror_legacy_inventory_movement_to_branch()
from public, anon, authenticated;

revoke all
on function private.build_branch_inventory_result(uuid, boolean)
from public, anon, authenticated;

revoke all
on function private.apply_branch_inventory_delta(
  uuid,
  uuid,
  integer,
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
on function private.reserve_branch_inventory(
  uuid,
  uuid,
  integer,
  timestamptz,
  uuid,
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;

revoke all
on function private.release_branch_inventory_reservation(
  uuid,
  public.inventory_reservation_status,
  text,
  uuid
)
from public, anon, authenticated;

revoke all
on function private.convert_branch_inventory_reservation(uuid, uuid)
from public, anon, authenticated;

revoke all
on function private.expire_branch_inventory_reservations(integer)
from public, anon, authenticated;

grant execute
on function private.apply_branch_inventory_delta(
  uuid,
  uuid,
  integer,
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
on function private.reserve_branch_inventory(
  uuid,
  uuid,
  integer,
  timestamptz,
  uuid,
  uuid,
  uuid,
  uuid
)
to service_role;

grant execute
on function private.release_branch_inventory_reservation(
  uuid,
  public.inventory_reservation_status,
  text,
  uuid
)
to service_role;

grant execute
on function private.convert_branch_inventory_reservation(uuid, uuid)
to service_role;

grant execute
on function private.expire_branch_inventory_reservations(integer)
to service_role;

alter table public.branch_inventory enable row level security;
alter table public.branch_inventory force row level security;

alter table public.branch_inventory_movements enable row level security;
alter table public.branch_inventory_movements force row level security;

alter table public.branch_inventory_reservations enable row level security;
alter table public.branch_inventory_reservations force row level security;

revoke all privileges
on table
  public.branch_inventory,
  public.branch_inventory_movements,
  public.branch_inventory_reservations
from anon, authenticated;

revoke all privileges
on sequence public.branch_inventory_movements_id_seq
from anon, authenticated;

grant select
on table
  public.branch_inventory,
  public.branch_inventory_movements,
  public.branch_inventory_reservations
to authenticated;

grant all privileges
on table
  public.branch_inventory,
  public.branch_inventory_movements,
  public.branch_inventory_reservations
to service_role;

grant usage, select
on sequence public.branch_inventory_movements_id_seq
to service_role;

create policy branch_inventory_owner_or_admin_read
on public.branch_inventory
for select
to authenticated
using (authz.can_read_merchant_branch(branch_id));

create policy branch_inventory_movements_owner_or_admin_read
on public.branch_inventory_movements
for select
to authenticated
using (authz.can_read_merchant_branch(branch_id));

create policy branch_inventory_reservations_owner_or_admin_read
on public.branch_inventory_reservations
for select
to authenticated
using (authz.can_read_merchant_branch(branch_id));
