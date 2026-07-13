-- S3-07: atomic merchant inventory adjustments and immutable movement reads.
--
-- The public RPC is callable only by the backend service role. It owns the
-- transaction, locks the authoritative balance row, checks the client version,
-- writes one immutable movement, stores an idempotent result, and enqueues the
-- availability-change event before committing.

create table private.inventory_adjustment_requests (
  idempotency_key uuid primary key,
  shop_id uuid not null,
  variant_id uuid not null,
  actor_id uuid not null,
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint inventory_adjustment_requests_variant_shop_fkey
    foreign key (variant_id, shop_id)
    references public.product_variants (id, shop_id)
    on update cascade
    on delete restrict,

  constraint inventory_adjustment_requests_actor_id_fkey
    foreign key (actor_id)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint inventory_adjustment_requests_request_object
    check (jsonb_typeof(request_payload) = 'object'),

  constraint inventory_adjustment_requests_result_object
    check (
      result_payload is null
      or jsonb_typeof(result_payload) = 'object'
    ),

  constraint inventory_adjustment_requests_completion_shape
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

comment on table private.inventory_adjustment_requests is
  'Backend-only idempotency receipts for atomic merchant inventory adjustments.';

revoke all privileges
on table private.inventory_adjustment_requests
from public, anon, authenticated;

create unique index inventory_movements_merchant_adjustment_request_idx
on public.inventory_movements (reference_id)
where reference_type = 'MERCHANT_INVENTORY_ADJUSTMENT'
  and reference_id is not null;

create or replace function public.apply_merchant_inventory_adjustment(
  p_variant_id uuid,
  p_shop_id uuid,
  p_action text,
  p_quantity integer,
  p_reason text,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  variant_row public.product_variants;
  request_row private.inventory_adjustment_requests;
  balance_before public.inventory_balances;
  balance_after public.inventory_balances;
  movement_row public.inventory_movements;
  adjustment_request_payload jsonb;
  adjustment_result jsonb;
  normalized_reason text;
  balance_created boolean;
  stock_delta integer := 0;
  damaged_delta integer := 0;
  movement_type public.inventory_movement_type;
begin
  if p_variant_id is null
    or p_shop_id is null
    or p_actor is null
  then
    raise exception
      'variant, shop, and actor are required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception
      'idempotency key is required'
      using errcode = '22023';
  end if;

  normalized_reason := btrim(coalesce(p_reason, ''));

  if length(normalized_reason) = 0
    or length(normalized_reason) > 500
  then
    raise exception
      'inventory adjustment reason is required and limited to 500 characters'
      using errcode = '22023';
  end if;

  if p_action not in (
    'ADD_STOCK',
    'RETURN_TO_STOCK',
    'MARK_DAMAGED',
    'STOCK_CORRECTION',
    'STOCK_CHECK'
  ) then
    raise exception
      'unsupported inventory adjustment action'
      using errcode = '22023';
  end if;

  if p_quantity is null
    or p_quantity < 0
    or (
      p_action in ('ADD_STOCK', 'RETURN_TO_STOCK', 'MARK_DAMAGED')
      and p_quantity = 0
    )
  then
    raise exception
      'inventory adjustment quantity is invalid'
      using errcode = '22023';
  end if;

  if p_expected_version is not null
    and p_expected_version <= 0
  then
    raise exception
      'expected inventory version must be positive'
      using errcode = '22023';
  end if;

  select *
  into variant_row
  from public.product_variants pv
  where pv.id = p_variant_id
    and pv.shop_id = p_shop_id;

  if not found then
    raise exception
      'variant % does not belong to shop %',
      p_variant_id,
      p_shop_id
      using errcode = '23503';
  end if;

  adjustment_request_payload := jsonb_build_object(
    'variantId', p_variant_id,
    'shopId', p_shop_id,
    'action', p_action,
    'quantity', p_quantity,
    'reason', normalized_reason,
    'expectedVersion', p_expected_version,
    'actorId', p_actor
  );

  insert into private.inventory_adjustment_requests (
    idempotency_key,
    shop_id,
    variant_id,
    actor_id,
    request_payload
  )
  values (
    p_idempotency_key,
    p_shop_id,
    p_variant_id,
    p_actor,
    adjustment_request_payload
  )
  on conflict (idempotency_key) do nothing
  returning * into request_row;

  if not found then
    select *
    into strict request_row
    from private.inventory_adjustment_requests iar
    where iar.idempotency_key = p_idempotency_key
    for update;

    if request_row.request_payload <> adjustment_request_payload then
      raise exception
        'idempotency key reused with a different inventory adjustment'
        using errcode = 'P0002';
    end if;

    if request_row.result_payload is null then
      raise exception
        'inventory adjustment idempotency receipt is incomplete'
        using errcode = '55000';
    end if;

    return jsonb_set(
      request_row.result_payload,
      '{replayed}',
      to_jsonb(true),
      true
    );
  end if;

  insert into public.inventory_balances (
    shop_id,
    variant_id
  )
  values (
    p_shop_id,
    p_variant_id
  )
  on conflict (shop_id, variant_id) do nothing
  returning * into balance_before;

  balance_created := found;

  if not balance_created then
    select *
    into strict balance_before
    from public.inventory_balances ib
    where ib.shop_id = p_shop_id
      and ib.variant_id = p_variant_id
    for update;
  end if;

  if balance_created then
    if p_expected_version is not null then
      raise exception
        'inventory version conflict for newly created balance'
        using errcode = '40001';
    end if;
  elsif p_expected_version is null
    or p_expected_version <> balance_before.version
  then
    raise exception
      'inventory version conflict: expected %, current %',
      p_expected_version,
      balance_before.version
      using errcode = '40001';
  end if;

  case p_action
    when 'ADD_STOCK' then
      stock_delta := p_quantity;
      movement_type := 'STOCK_RECEIVED';
    when 'RETURN_TO_STOCK' then
      stock_delta := p_quantity;
      movement_type := 'RETURN_TO_STOCK';
    when 'MARK_DAMAGED' then
      damaged_delta := p_quantity;
      movement_type := 'MARKED_DAMAGED';
    when 'STOCK_CORRECTION' then
      stock_delta := p_quantity - balance_before.stock_on_hand;
      movement_type := 'STOCK_CORRECTION';
    when 'STOCK_CHECK' then
      stock_delta := p_quantity - balance_before.stock_on_hand;
      movement_type := 'STOCK_AUDIT';
    else
      raise exception
        'unsupported inventory adjustment action'
        using errcode = '22023';
  end case;

  select *
  into strict balance_after
  from private.apply_inventory_delta(
    p_shop_id,
    p_variant_id,
    stock_delta,
    0,
    damaged_delta,
    movement_type,
    'MANUAL_SEARCH',
    'MERCHANT_INVENTORY_ADJUSTMENT',
    p_idempotency_key,
    normalized_reason,
    p_actor
  );

  if p_action = 'STOCK_CHECK' then
    update public.inventory_balances
    set last_counted_at = now()
    where id = balance_after.id
    returning * into strict balance_after;
  end if;

  select *
  into strict movement_row
  from public.inventory_movements im
  where im.reference_type = 'MERCHANT_INVENTORY_ADJUSTMENT'
    and im.reference_id = p_idempotency_key;

  perform private.enqueue_outbox_event(
    'inventory.balance.changed',
    'PRODUCT_VARIANT',
    p_variant_id,
    jsonb_build_object(
      'shopId', p_shop_id,
      'variantId', p_variant_id,
      'movementId', movement_row.id::text,
      'action', p_action,
      'stockOnHand', balance_after.stock_on_hand,
      'reservedQuantity', balance_after.reserved_quantity,
      'damagedQuantity', balance_after.damaged_quantity,
      'availableQuantity',
        balance_after.stock_on_hand
        - balance_after.reserved_quantity
        - balance_after.damaged_quantity,
      'version', balance_after.version
    ),
    movement_row.created_at,
    movement_row.created_at
  );

  adjustment_result := jsonb_build_object(
    'idempotencyKey', p_idempotency_key,
    'replayed', false,
    'action', p_action,
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
      'stockOnHand', balance_after.stock_on_hand,
      'reservedQuantity', balance_after.reserved_quantity,
      'damagedQuantity', balance_after.damaged_quantity,
      'availableQuantity',
        balance_after.stock_on_hand
        - balance_after.reserved_quantity
        - balance_after.damaged_quantity,
      'reorderLevel', balance_after.reorder_level,
      'version', balance_after.version,
      'lastCountedAt', balance_after.last_counted_at,
      'updatedAt', balance_after.updated_at
    )
  );

  update private.inventory_adjustment_requests
  set
    result_payload = adjustment_result,
    completed_at = now()
  where idempotency_key = p_idempotency_key;

  return adjustment_result;
end;
$$;

comment on function public.apply_merchant_inventory_adjustment(
  uuid,
  uuid,
  text,
  integer,
  text,
  integer,
  uuid,
  uuid
) is
  'Applies one merchant inventory adjustment atomically with idempotency, version checks, movement history, and an outbox event.';

revoke all
on function public.apply_merchant_inventory_adjustment(
  uuid,
  uuid,
  text,
  integer,
  text,
  integer,
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.apply_merchant_inventory_adjustment(
  uuid,
  uuid,
  text,
  integer,
  text,
  integer,
  uuid,
  uuid
)
to service_role;
