-- S3-10: customer cart inventory reservations, release, and expiry.
--
-- Customer reads are first constrained by RLS in the backend. Trusted RPCs
-- then validate the same customer/cart/variant relationship, lock the
-- authoritative balance row through the private inventory primitives, write
-- immutable movements, and enqueue availability changes in the transaction.

create table private.inventory_reservation_requests (
  idempotency_key uuid primary key,
  cart_id uuid not null,
  variant_id uuid not null,
  actor_id uuid not null,
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint inventory_reservation_requests_cart_id_fkey
    foreign key (cart_id)
    references public.carts (id)
    on update cascade
    on delete restrict,

  constraint inventory_reservation_requests_variant_id_fkey
    foreign key (variant_id)
    references public.product_variants (id)
    on update cascade
    on delete restrict,

  constraint inventory_reservation_requests_actor_id_fkey
    foreign key (actor_id)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint inventory_reservation_requests_request_object
    check (jsonb_typeof(request_payload) = 'object'),

  constraint inventory_reservation_requests_result_object
    check (
      result_payload is null
      or jsonb_typeof(result_payload) = 'object'
    ),

  constraint inventory_reservation_requests_completion_shape
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

comment on table private.inventory_reservation_requests is
  'Backend-only idempotency receipts for customer cart inventory reservations.';

revoke all privileges
on table private.inventory_reservation_requests
from public, anon, authenticated;

create unique index inventory_movements_reservation_transition_idx
on public.inventory_movements (
  reference_id,
  movement_type
)
where reference_type = 'INVENTORY_RESERVATION'
  and reference_id is not null
  and movement_type in (
    'ONLINE_ORDER_RESERVED',
    'ONLINE_ORDER_RELEASED'
  );

create or replace function private.build_cart_reservation_result(
  p_reservation_id uuid,
  p_replayed boolean,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.inventory_reservations;
  movement_row public.inventory_movements;
  balance_row public.inventory_balances;
  expected_movement public.inventory_movement_type;
begin
  select *
  into strict reservation_row
  from public.inventory_reservations reservation
  where reservation.id = p_reservation_id;

  expected_movement :=
    case
      when reservation_row.status = 'ACTIVE'
        then 'ONLINE_ORDER_RESERVED'
      when reservation_row.status in ('RELEASED', 'EXPIRED')
        then 'ONLINE_ORDER_RELEASED'
      else
        'ONLINE_ORDER_RESERVED'
    end;

  select *
  into strict movement_row
  from public.inventory_movements movement
  where movement.reference_type = 'INVENTORY_RESERVATION'
    and movement.reference_id = reservation_row.id
    and movement.movement_type = expected_movement;

  select *
  into strict balance_row
  from public.inventory_balances balance
  where balance.shop_id = reservation_row.shop_id
    and balance.variant_id = reservation_row.variant_id;

  return jsonb_build_object(
    'id', reservation_row.id,
    'idempotencyKey', p_idempotency_key,
    'replayed', p_replayed,
    'shopId', reservation_row.shop_id,
    'variantId', reservation_row.variant_id,
    'cartId', reservation_row.cart_id,
    'quantity', reservation_row.quantity,
    'status', reservation_row.status,
    'expiresAt', reservation_row.expires_at,
    'createdAt', reservation_row.created_at,
    'releasedAt', reservation_row.released_at,
    'movement', jsonb_build_object(
      'id', movement_row.id::text,
      'shopId', movement_row.shop_id,
      'variantId', movement_row.variant_id,
      'movementType', movement_row.movement_type,
      'quantityChange', movement_row.quantity_change,
      'reservedChange', movement_row.reserved_change,
      'damagedChange', movement_row.damaged_change,
      'stockBefore', movement_row.stock_before,
      'stockAfter', movement_row.stock_after,
      'reservedBefore', movement_row.reserved_before,
      'reservedAfter', movement_row.reserved_after,
      'damagedBefore', movement_row.damaged_before,
      'damagedAfter', movement_row.damaged_after,
      'referenceType', movement_row.reference_type,
      'referenceId', movement_row.reference_id,
      'reason', movement_row.reason,
      'performedBy', movement_row.performed_by,
      'sourceMethod', movement_row.source_method,
      'createdAt', movement_row.created_at
    ),
    'balance', jsonb_build_object(
      'persisted', true,
      'stockOnHand', balance_row.stock_on_hand,
      'reservedQuantity', balance_row.reserved_quantity,
      'damagedQuantity', balance_row.damaged_quantity,
      'availableQuantity',
        balance_row.stock_on_hand
        - balance_row.reserved_quantity
        - balance_row.damaged_quantity,
      'reorderLevel', balance_row.reorder_level,
      'version', balance_row.version,
      'lastCountedAt', balance_row.last_counted_at,
      'updatedAt', balance_row.updated_at
    )
  );
end;
$$;

revoke all
on function private.build_cart_reservation_result(
  uuid,
  boolean,
  uuid
)
from public, anon, authenticated;

create or replace function public.create_customer_cart_reservation(
  p_cart_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_ttl_seconds integer,
  p_idempotency_key uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cart_row public.carts;
  request_row private.inventory_reservation_requests;
  reservation_row public.inventory_reservations;
  movement_row public.inventory_movements;
  balance_row public.inventory_balances;
  request_payload jsonb;
  response_payload jsonb;
begin
  if p_cart_id is null
    or p_variant_id is null
    or p_actor is null
    or p_idempotency_key is null
  then
    raise exception
      'cart, variant, actor, and idempotency key are required'
      using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception
      'reservation quantity must be positive'
      using errcode = '22023';
  end if;

  if p_ttl_seconds is null
    or p_ttl_seconds < 60
    or p_ttl_seconds > 1800
  then
    raise exception
      'reservation TTL must be between 60 and 1800 seconds'
      using errcode = '22023';
  end if;

  select *
  into cart_row
  from public.carts cart
  where cart.id = p_cart_id
    and cart.customer_id = p_actor
    and cart.status = 'ACTIVE'
  for update;

  if not found then
    raise exception
      'active cart % does not belong to customer %',
      p_cart_id,
      p_actor
      using errcode = '23503';
  end if;

  perform 1
  from public.product_variants variant
  join public.products product
    on product.id = variant.product_id
  where variant.id = p_variant_id
    and variant.shop_id = cart_row.shop_id
    and variant.is_active
    and product.shop_id = cart_row.shop_id
    and product.is_active
    and product.deleted_at is null
    and product.moderation_status = 'APPROVED';

  if not found then
    raise exception
      'active public variant % does not belong to cart shop %',
      p_variant_id,
      cart_row.shop_id
      using errcode = '23503';
  end if;

  request_payload := jsonb_build_object(
    'cartId', p_cart_id,
    'variantId', p_variant_id,
    'quantity', p_quantity,
    'ttlSeconds', p_ttl_seconds,
    'actorId', p_actor
  );

  insert into private.inventory_reservation_requests (
    idempotency_key,
    cart_id,
    variant_id,
    actor_id,
    request_payload
  )
  values (
    p_idempotency_key,
    p_cart_id,
    p_variant_id,
    p_actor,
    request_payload
  )
  on conflict (idempotency_key) do nothing
  returning * into request_row;

  if not found then
    select *
    into strict request_row
    from private.inventory_reservation_requests request
    where request.idempotency_key = p_idempotency_key
    for update;

    if request_row.request_payload <> request_payload then
      raise exception
        'idempotency key reused with a different reservation'
        using errcode = 'P0002';
    end if;

    if request_row.result_payload is null then
      raise exception
        'inventory reservation idempotency receipt is incomplete'
        using errcode = '55000';
    end if;

    return jsonb_set(
      request_row.result_payload,
      '{replayed}',
      to_jsonb(true),
      true
    );
  end if;

  select *
  into strict reservation_row
  from private.reserve_inventory(
    cart_row.shop_id,
    p_variant_id,
    p_quantity,
    statement_timestamp()
      + make_interval(secs => p_ttl_seconds),
    p_cart_id,
    null,
    p_actor
  );

  select *
  into strict movement_row
  from public.inventory_movements movement
  where movement.reference_type = 'INVENTORY_RESERVATION'
    and movement.reference_id = reservation_row.id
    and movement.movement_type = 'ONLINE_ORDER_RESERVED';

  select *
  into strict balance_row
  from public.inventory_balances balance
  where balance.shop_id = reservation_row.shop_id
    and balance.variant_id = reservation_row.variant_id;

  perform private.enqueue_outbox_event(
    'inventory.balance.changed',
    'PRODUCT_VARIANT',
    reservation_row.variant_id,
    jsonb_build_object(
      'shopId', reservation_row.shop_id,
      'variantId', reservation_row.variant_id,
      'reservationId', reservation_row.id,
      'cartId', reservation_row.cart_id,
      'movementId', movement_row.id::text,
      'action', 'RESERVE',
      'stockOnHand', balance_row.stock_on_hand,
      'reservedQuantity', balance_row.reserved_quantity,
      'damagedQuantity', balance_row.damaged_quantity,
      'availableQuantity',
        balance_row.stock_on_hand
        - balance_row.reserved_quantity
        - balance_row.damaged_quantity,
      'version', balance_row.version
    ),
    movement_row.created_at,
    movement_row.created_at
  );

  response_payload := private.build_cart_reservation_result(
    reservation_row.id,
    false,
    p_idempotency_key
  );

  update private.inventory_reservation_requests request
  set
    result_payload = response_payload,
    completed_at = now()
  where request.idempotency_key = p_idempotency_key;

  return response_payload;
end;
$$;

comment on function public.create_customer_cart_reservation(
  uuid,
  uuid,
  integer,
  integer,
  uuid,
  uuid
) is
  'Creates one idempotent customer cart reservation after locking and validating available stock.';

create or replace function public.release_customer_cart_reservation(
  p_reservation_id uuid,
  p_reason text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_before public.inventory_reservations;
  reservation_after public.inventory_reservations;
  movement_row public.inventory_movements;
  balance_row public.inventory_balances;
  normalized_reason text;
  was_active boolean;
begin
  if p_reservation_id is null or p_actor is null then
    raise exception
      'reservation and actor are required'
      using errcode = '22023';
  end if;

  normalized_reason := btrim(
    coalesce(
      p_reason,
      'Customer released cart reservation'
    )
  );

  if length(normalized_reason) = 0
    or length(normalized_reason) > 500
  then
    raise exception
      'reservation release reason is invalid'
      using errcode = '22023';
  end if;

  select reservation.*
  into reservation_before
  from public.inventory_reservations reservation
  join public.carts cart
    on cart.id = reservation.cart_id
  where reservation.id = p_reservation_id
    and reservation.cart_id is not null
    and reservation.order_id is null
    and cart.customer_id = p_actor
  for update of reservation;

  if not found then
    raise exception
      'cart reservation % does not belong to customer %',
      p_reservation_id,
      p_actor
      using errcode = '23503';
  end if;

  if reservation_before.status = 'CONVERTED' then
    raise exception
      'converted reservations cannot be released by the customer'
      using errcode = '55000';
  end if;

  was_active := reservation_before.status = 'ACTIVE';

  if was_active then
    select *
    into strict reservation_after
    from private.release_inventory_reservation(
      p_reservation_id,
      'RELEASED',
      normalized_reason,
      p_actor
    );
  else
    reservation_after := reservation_before;
  end if;

  select *
  into strict movement_row
  from public.inventory_movements movement
  where movement.reference_type = 'INVENTORY_RESERVATION'
    and movement.reference_id = reservation_after.id
    and movement.movement_type = 'ONLINE_ORDER_RELEASED';

  select *
  into strict balance_row
  from public.inventory_balances balance
  where balance.shop_id = reservation_after.shop_id
    and balance.variant_id = reservation_after.variant_id;

  if was_active then
    perform private.enqueue_outbox_event(
      'inventory.balance.changed',
      'PRODUCT_VARIANT',
      reservation_after.variant_id,
      jsonb_build_object(
        'shopId', reservation_after.shop_id,
        'variantId', reservation_after.variant_id,
        'reservationId', reservation_after.id,
        'cartId', reservation_after.cart_id,
        'movementId', movement_row.id::text,
        'action', 'RELEASE',
        'stockOnHand', balance_row.stock_on_hand,
        'reservedQuantity', balance_row.reserved_quantity,
        'damagedQuantity', balance_row.damaged_quantity,
        'availableQuantity',
          balance_row.stock_on_hand
          - balance_row.reserved_quantity
          - balance_row.damaged_quantity,
        'version', balance_row.version
      ),
      movement_row.created_at,
      movement_row.created_at
    );
  end if;

  return private.build_cart_reservation_result(
    reservation_after.id,
    not was_active,
    null
  );
end;
$$;

comment on function public.release_customer_cart_reservation(
  uuid,
  text,
  uuid
) is
  'Idempotently releases one customer-owned active cart reservation.';

create or replace function public.expire_inventory_reservations(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_candidate public.inventory_reservations;
  reservation_after public.inventory_reservations;
  movement_row public.inventory_movements;
  balance_row public.inventory_balances;
  expired_ids jsonb := '[]'::jsonb;
  expired_count integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception
      'expiry sweep limit must be between 1 and 500'
      using errcode = '22023';
  end if;

  for reservation_candidate in
    select *
    from public.inventory_reservations reservation
    where reservation.status = 'ACTIVE'
      and reservation.expires_at <= statement_timestamp()
    order by reservation.expires_at, reservation.id
    limit p_limit
    for update skip locked
  loop
    select *
    into strict reservation_after
    from private.release_inventory_reservation(
      reservation_candidate.id,
      'EXPIRED',
      'Reservation expired',
      null
    );

    select *
    into strict movement_row
    from public.inventory_movements movement
    where movement.reference_type = 'INVENTORY_RESERVATION'
      and movement.reference_id = reservation_after.id
      and movement.movement_type = 'ONLINE_ORDER_RELEASED';

    select *
    into strict balance_row
    from public.inventory_balances balance
    where balance.shop_id = reservation_after.shop_id
      and balance.variant_id = reservation_after.variant_id;

    perform private.enqueue_outbox_event(
      'inventory.balance.changed',
      'PRODUCT_VARIANT',
      reservation_after.variant_id,
      jsonb_build_object(
        'shopId', reservation_after.shop_id,
        'variantId', reservation_after.variant_id,
        'reservationId', reservation_after.id,
        'cartId', reservation_after.cart_id,
        'movementId', movement_row.id::text,
        'action', 'EXPIRE',
        'stockOnHand', balance_row.stock_on_hand,
        'reservedQuantity', balance_row.reserved_quantity,
        'damagedQuantity', balance_row.damaged_quantity,
        'availableQuantity',
          balance_row.stock_on_hand
          - balance_row.reserved_quantity
          - balance_row.damaged_quantity,
        'version', balance_row.version
      ),
      movement_row.created_at,
      movement_row.created_at
    );

    expired_ids := expired_ids || to_jsonb(reservation_after.id);
    expired_count := expired_count + 1;
  end loop;

  return jsonb_build_object(
    'expiredCount', expired_count,
    'reservationIds', expired_ids
  );
end;
$$;

comment on function public.expire_inventory_reservations(integer) is
  'Claims and expires active reservations whose UTC expiry has passed.';

revoke all
on function public.create_customer_cart_reservation(
  uuid,
  uuid,
  integer,
  integer,
  uuid,
  uuid
)
from public, anon, authenticated;

revoke all
on function public.release_customer_cart_reservation(
  uuid,
  text,
  uuid
)
from public, anon, authenticated;

revoke all
on function public.expire_inventory_reservations(integer)
from public, anon, authenticated;

grant execute
on function public.create_customer_cart_reservation(
  uuid,
  uuid,
  integer,
  integer,
  uuid,
  uuid
)
to service_role;

grant execute
on function public.release_customer_cart_reservation(
  uuid,
  text,
  uuid
)
to service_role;

grant execute
on function public.expire_inventory_reservations(integer)
to service_role;
