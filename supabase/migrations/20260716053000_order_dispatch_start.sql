-- S5-08: atomically create the forward task and begin trusted captain search.

create table private.order_dispatch_requests (
  idempotency_key uuid primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  request_payload jsonb not null,
  delivery_task_id uuid references public.delivery_tasks(id) on delete restrict,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint order_dispatch_requests_request_object check (jsonb_typeof(request_payload) = 'object'),
  constraint order_dispatch_requests_result_object check (result_payload is null or jsonb_typeof(result_payload) = 'object'),
  constraint order_dispatch_requests_completion_shape check (
    (delivery_task_id is null and result_payload is null and completed_at is null)
    or (delivery_task_id is not null and result_payload is not null and completed_at is not null)
  )
);

comment on table private.order_dispatch_requests is
  'Backend-only idempotency receipts for trusted dispatch initiation.';

revoke all on table private.order_dispatch_requests from public, anon, authenticated;

create or replace function public.start_order_dispatch(
  p_order_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_key uuid;
  request_json jsonb;
  receipt_row private.order_dispatch_requests;
  order_row public.orders;
  shop_row public.shops;
  address_row public.addresses;
  task_row public.delivery_tasks;
  pickup_snapshot jsonb;
  result_json jsonb;
  started_at timestamptz := transaction_timestamp();
  drop_latitude double precision;
  drop_longitude double precision;
  item_count integer;
  transition_count integer;
  event_count integer;
  replayed boolean := false;
begin
  if p_order_id is null or p_idempotency_key is null then
    raise exception 'order and idempotency key are required' using errcode = '22023';
  end if;

  request_json := jsonb_build_object('orderId', p_order_id);
  -- S5-08: validate order before idempotency receipt
  perform 1
  from public.orders candidate_order
  where candidate_order.id = p_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0029',
      message = 'order not found';
  end if;

  insert into private.order_dispatch_requests(idempotency_key, order_id, request_payload)
  values (p_idempotency_key, p_order_id, request_json)
  on conflict (idempotency_key) do nothing
  returning idempotency_key into claimed_key;

  select * into strict receipt_row
  from private.order_dispatch_requests request
  where request.idempotency_key = p_idempotency_key
  for update;

  if receipt_row.order_id <> p_order_id or receipt_row.request_payload <> request_json then
    raise exception 'idempotency key belongs to another dispatch request' using errcode = 'P0028';
  end if;

  if claimed_key is null then
    if receipt_row.completed_at is null
      or receipt_row.delivery_task_id is null
      or receipt_row.result_payload is null
    then
      raise exception 'dispatch receipt is incomplete' using errcode = 'P0032';
    end if;
    return receipt_row.result_payload || jsonb_build_object('replayed', true);
  end if;

  select * into order_row from public.orders placed_order
  where placed_order.id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0029';
  end if;

  select * into shop_row from public.shops shop
  where shop.id = order_row.shop_id and shop.deleted_at is null for update;
  if not found then
    raise exception 'dispatch shop is unavailable' using errcode = 'P0032';
  end if;

  select * into address_row from public.addresses address
  where address.id = shop_row.address_id for update;
  if not found then
    raise exception 'dispatch pickup address is unavailable' using errcode = 'P0032';
  end if;

  perform 1 from public.order_items item
  where item.order_id = order_row.id order by item.id for update;

  select count(*)::integer into item_count
  from public.order_items item where item.order_id = order_row.id;

  select * into task_row from public.delivery_tasks task
  where task.order_id = order_row.id
    and task.task_type = 'FORWARD_DELIVERY'
    and task.status not in ('FAILED', 'CANCELLED')
  order by task.id for update;

  if order_row.fulfilment_type <> 'DELIVERY' then
    raise exception 'customer pickup orders are not dispatch eligible' using errcode = 'P0031';
  end if;
  if order_row.status not in ('READY_FOR_PICKUP', 'CAPTAIN_SEARCHING') then
    raise exception 'order state is not eligible for dispatch start' using errcode = 'P0030';
  end if;
  if order_row.ready_at is null then
    raise exception 'ready timestamp is missing' using errcode = 'P0032';
  end if;
  if item_count = 0 or exists (
    select 1 from public.order_items item
    where item.order_id = order_row.id
      and (item.shop_id <> order_row.shop_id or item.fulfilment_status <> 'PACKED')
  ) then
    raise exception 'dispatch order items are internally inconsistent' using errcode = 'P0032';
  end if;
  if jsonb_typeof(order_row.address_snapshot) <> 'object'
    or jsonb_typeof(order_row.address_snapshot->'latitude') <> 'number'
    or jsonb_typeof(order_row.address_snapshot->'longitude') <> 'number'
  then
    raise exception 'drop snapshot is invalid' using errcode = 'P0032';
  end if;

  drop_latitude := (order_row.address_snapshot->>'latitude')::double precision;
  drop_longitude := (order_row.address_snapshot->>'longitude')::double precision;
  if not extensions.st_isvalid(
      extensions.st_setsrid(extensions.st_makepoint(drop_longitude, drop_latitude), 4326)
    ) or drop_latitude < -90 or drop_latitude > 90
      or drop_longitude < -180 or drop_longitude > 180
  then
    raise exception 'drop snapshot coordinates are invalid' using errcode = 'P0032';
  end if;

  if order_row.status = 'CAPTAIN_SEARCHING' then
    replayed := true;
    if task_row.id is null or task_row.status <> 'SEARCHING'
      or task_row.pickup_shop_id <> order_row.shop_id
      or task_row.assigned_captain_id is not null
      or task_row.scheduled_at is null
    then
      raise exception 'captain-search replay state is inconsistent' using errcode = 'P0032';
    end if;

    select count(*)::integer into transition_count
    from public.order_status_history history
    where history.order_id = order_row.id
      and history.previous_status = 'READY_FOR_PICKUP'
      and history.new_status = 'CAPTAIN_SEARCHING'
      and history.changed_by_user_id is null
      and history.changed_by_role = 'SYSTEM';

    select count(*)::integer into event_count
    from public.outbox_events event
    where event.aggregate_type = 'DELIVERY_TASK'
      and event.aggregate_id = task_row.id
      and event.event_type = 'delivery.task.search_started'
      and event.payload->>'deliveryTaskId' = task_row.id::text
      and event.payload->>'orderId' = order_row.id::text
      and event.payload->>'shopId' = order_row.shop_id::text
      and event.payload->>'orderNumber' = order_row.order_number
      and event.payload->>'taskType' = 'FORWARD_DELIVERY'
      and event.payload->>'status' = 'SEARCHING'
      and event.payload->>'orderStatus' = 'CAPTAIN_SEARCHING';

    if transition_count <> 1 or event_count <> 1 then
      raise exception 'captain-search replay effects are inconsistent' using errcode = 'P0032';
    end if;
    started_at := task_row.scheduled_at;
  else
    if task_row.id is not null then
      raise exception 'ready order already has an active forward task' using errcode = 'P0032';
    end if;

    pickup_snapshot := jsonb_build_object(
      'shopId', shop_row.id,
      'shopName', shop_row.name,
      'phoneNumber', shop_row.phone_number,
      'addressId', address_row.id,
      'label', address_row.label,
      'line1', address_row.line1,
      'line2', address_row.line2,
      'landmark', address_row.landmark,
      'area', address_row.area,
      'city', address_row.city,
      'state', address_row.state,
      'postalCode', address_row.postal_code,
      'countryCode', address_row.country_code,
      'latitude', extensions.st_y(shop_row.location::extensions.geometry),
      'longitude', extensions.st_x(shop_row.location::extensions.geometry)
    );

    begin
      -- S5-08: reject an invalid drop snapshot
      declare
        validated_drop_snapshot jsonb;
        validated_drop_latitude double precision;
        validated_drop_longitude double precision;
      begin
        select candidate_order.address_snapshot
        into validated_drop_snapshot
        from public.orders candidate_order
        where candidate_order.id = p_order_id;

        begin
          validated_drop_latitude :=
            nullif(
              btrim(validated_drop_snapshot ->> 'latitude'),
              ''
            )::double precision;

          validated_drop_longitude :=
            nullif(
              btrim(validated_drop_snapshot ->> 'longitude'),
              ''
            )::double precision;
        exception
          when invalid_text_representation
            or numeric_value_out_of_range
          then
            raise exception using
              errcode = 'P0032',
              message = 'drop snapshot is invalid';
        end;

        if jsonb_typeof(validated_drop_snapshot) is distinct from 'object'
          or validated_drop_latitude is null
          or validated_drop_longitude is null
          or validated_drop_latitude < -90
          or validated_drop_latitude > 90
          or validated_drop_longitude < -180
          or validated_drop_longitude > 180
        then
          raise exception using
            errcode = 'P0032',
            message = 'drop snapshot is invalid';
        end if;
      end;

      insert into public.delivery_tasks(
        order_id, task_type, pickup_shop_id, pickup_address_snapshot,
        drop_address_snapshot, pickup_location, drop_location, status,
        delivery_fee_paise, captain_earning_paise, scheduled_at
      ) values (
        order_row.id, 'FORWARD_DELIVERY', order_row.shop_id, pickup_snapshot,
        order_row.address_snapshot, shop_row.location,
        extensions.st_setsrid(extensions.st_makepoint(drop_longitude, drop_latitude), 4326)::extensions.geography,
        'SEARCHING', order_row.delivery_fee_paise, 0, started_at
      ) returning * into task_row;
    exception when unique_violation then
      raise exception 'active forward task uniqueness conflict' using errcode = 'P0032';
    end;

    select * into strict order_row from private.transition_order_state(
      order_row.id, 'CAPTAIN_SEARCHING', null, 'SYSTEM', null,
      'Forward delivery task created; captain search started'
    );

    perform private.enqueue_outbox_event(
      'delivery.task.search_started', 'DELIVERY_TASK', task_row.id,
      jsonb_build_object(
        'deliveryTaskId', task_row.id,
        'orderId', order_row.id,
        'orderNumber', order_row.order_number,
        'shopId', order_row.shop_id,
        'taskType', task_row.task_type,
        'status', task_row.status,
        'orderStatus', order_row.status,
        'startedAt', started_at
      ), started_at, started_at
    );
  end if;

  result_json := jsonb_build_object(
    'orderId', order_row.id,
    'orderNumber', order_row.order_number,
    'deliveryTaskId', task_row.id,
    'orderStatus', 'CAPTAIN_SEARCHING',
    'deliveryTaskStatus', 'SEARCHING',
    'taskType', 'FORWARD_DELIVERY',
    'startedAt', started_at,
    'replayed', false
  );

  update private.order_dispatch_requests request set
    delivery_task_id = task_row.id,
    result_payload = result_json,
    completed_at = transaction_timestamp()
  where request.idempotency_key = p_idempotency_key;

  return result_json || jsonb_build_object('replayed', replayed);
end;
$$;

comment on function public.start_order_dispatch(uuid, uuid) is
  'Atomically creates or safely replays trusted forward-delivery captain search.';

revoke all on function public.start_order_dispatch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_order_dispatch(uuid, uuid) to service_role;
