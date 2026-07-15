-- S5-07: atomically complete merchant packing without starting dispatch.

create or replace function public.mark_merchant_order_ready_for_pickup(
  p_actor uuid,
  p_order_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  total_lines integer;
  packed_lines integer;
  changed_lines integer;
  inconsistent_lines integer;
  transition_count integer;
  ready_event_count integer;
  replayed boolean := false;
begin
  if p_actor is null or p_order_id is null or p_idempotency_key is null then
    raise exception 'merchant actor, order, and idempotency key are required'
      using errcode = '22023';
  end if;

  select placed_order.*
  into order_row
  from public.orders placed_order
  join public.shops shop
    on shop.id = placed_order.shop_id
  where placed_order.id = p_order_id
    and shop.merchant_id = p_actor
    and shop.deleted_at is null
  for update of placed_order;

  if not found then
    raise exception 'merchant order not found'
      using errcode = 'P0024';
  end if;

  if order_row.status not in ('PACKING', 'READY_FOR_PICKUP') then
    raise exception 'merchant order state invalid for pickup readiness'
      using errcode = 'P0025';
  end if;

  perform 1
  from public.order_items order_item
  where order_item.order_id = order_row.id
  order by order_item.id
  for update;

  perform 1
  from public.order_item_verifications verification
  join public.order_items order_item
    on order_item.id = verification.order_item_id
  where order_item.order_id = order_row.id
  order by verification.order_item_id, verification.id
  for update of verification;

  select count(*)::integer
  into total_lines
  from public.order_items order_item
  where order_item.order_id = order_row.id;

  if total_lines = 0 then
    raise exception 'merchant order has no item lines'
      using errcode = 'P0026';
  end if;

  select count(*)::integer
  into inconsistent_lines
  from public.order_items order_item
  where order_item.order_id = order_row.id
    and (
      order_item.shop_id <> order_row.shop_id
      or exists (
        select 1
        from public.order_item_verifications successful
        where successful.order_item_id = order_item.id
          and successful.result in ('MATCH', 'OVERRIDDEN')
          and successful.verified_variant_id is distinct from order_item.variant_id
      )
      or (
        order_item.fulfilment_status in ('VERIFIED', 'PACKED')
        and not exists (
          select 1
          from public.order_item_verifications successful
          where successful.order_item_id = order_item.id
            and successful.result in ('MATCH', 'OVERRIDDEN')
            and successful.verified_variant_id = order_item.variant_id
        )
      )
      or (
        order_item.fulfilment_status not in ('VERIFIED', 'PACKED')
        and exists (
          select 1
          from public.order_item_verifications successful
          where successful.order_item_id = order_item.id
            and successful.result in ('MATCH', 'OVERRIDDEN')
            and successful.verified_variant_id = order_item.variant_id
        )
      )
    );

  if inconsistent_lines > 0 then
    raise exception 'merchant packing evidence is internally inconsistent'
      using errcode = 'P0027';
  end if;

  if order_row.status = 'READY_FOR_PICKUP' then
    replayed := true;

    select count(*)::integer
    into packed_lines
    from public.order_items order_item
    where order_item.order_id = order_row.id
      and order_item.fulfilment_status = 'PACKED';

    select count(*)::integer
    into transition_count
    from public.order_status_history history
    where history.order_id = order_row.id
      and history.previous_status = 'PACKING'
      and history.new_status = 'READY_FOR_PICKUP';

    select count(*)::integer
    into ready_event_count
    from public.outbox_events event
    where event.aggregate_type = 'ORDER'
      and event.aggregate_id = order_row.id
      and event.event_type = 'order.merchant.ready_for_pickup'
      and event.payload->>'orderId' = order_row.id::text
      and event.payload->>'shopId' = order_row.shop_id::text
      and event.payload->>'orderNumber' = order_row.order_number
      and event.payload->>'readyAt' = to_jsonb(order_row.ready_at)#>>'{}'
      and (event.payload->>'totalLines')::integer = total_lines
      and (event.payload->>'packedLines')::integer = packed_lines;

    if order_row.ready_at is null
      or packed_lines <> total_lines
      or transition_count <> 1
      or ready_event_count <> 1
    then
      raise exception 'ready-for-pickup replay state is internally inconsistent'
        using errcode = 'P0027';
    end if;
  else
    if exists (
      select 1
      from public.order_items order_item
      where order_item.order_id = order_row.id
        and order_item.fulfilment_status = 'PENDING'
        and not exists (
          select 1
          from public.order_item_verifications successful
          where successful.order_item_id = order_item.id
            and successful.result in ('MATCH', 'OVERRIDDEN')
            and successful.verified_variant_id = order_item.variant_id
        )
    ) then
      raise exception 'one or more merchant order items are not verified'
        using errcode = 'P0026';
    end if;

    if exists (
      select 1
      from public.order_items order_item
      where order_item.order_id = order_row.id
        and order_item.fulfilment_status <> 'VERIFIED'
    ) then
      raise exception 'merchant packing item state is internally inconsistent'
        using errcode = 'P0027';
    end if;

    update public.order_items order_item
    set fulfilment_status = 'PACKED'
    where order_item.order_id = order_row.id
      and order_item.fulfilment_status = 'VERIFIED';
    get diagnostics changed_lines = row_count;

    if changed_lines <> total_lines then
      raise exception 'not every verified line was packed'
        using errcode = 'P0027';
    end if;

    select *
    into strict order_row
    from private.transition_order_state(
      order_row.id,
      'READY_FOR_PICKUP',
      p_actor,
      'MERCHANT',
      null,
      'Merchant completed the packing checklist'
    );

    if order_row.ready_at is null then
      raise exception 'ready timestamp was not recorded'
        using errcode = 'P0027';
    end if;

    packed_lines := total_lines;

    perform private.enqueue_outbox_event(
      'order.merchant.ready_for_pickup',
      'ORDER',
      order_row.id,
      jsonb_build_object(
        'orderId', order_row.id,
        'shopId', order_row.shop_id,
        'orderNumber', order_row.order_number,
        'readyAt', order_row.ready_at,
        'totalLines', total_lines,
        'packedLines', packed_lines
      ),
      order_row.ready_at,
      order_row.ready_at
    );
  end if;

  return jsonb_build_object(
    'orderId', order_row.id,
    'orderNumber', order_row.order_number,
    'status', order_row.status,
    'readyAt', order_row.ready_at,
    'totalLines', total_lines,
    'packedLines', packed_lines,
    'allPacked', packed_lines = total_lines,
    'replayed', replayed
  );
end;
$$;

comment on function public.mark_merchant_order_ready_for_pickup(uuid, uuid, uuid) is
  'Atomically packs every verified line and marks one owned PACKING order ready without starting dispatch.';

revoke all
on function public.mark_merchant_order_ready_for_pickup(uuid, uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.mark_merchant_order_ready_for_pickup(uuid, uuid, uuid)
to service_role;
