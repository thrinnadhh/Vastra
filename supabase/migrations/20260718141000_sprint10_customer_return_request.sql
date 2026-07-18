create table if not exists private.customer_return_request_receipts (
  customer_id uuid not null references public.customer_profiles(user_id),
  idempotency_key uuid not null,
  request_payload jsonb not null,
  return_request_id uuid references public.return_requests(id),
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (customer_id, idempotency_key),
  constraint customer_return_receipt_request_object check (
    jsonb_typeof(request_payload) = 'object'
  ),
  constraint customer_return_receipt_result_object check (
    result_payload is null or jsonb_typeof(result_payload) = 'object'
  ),
  constraint customer_return_receipt_completion_shape check (
    (return_request_id is null and result_payload is null and completed_at is null)
    or
    (return_request_id is not null and result_payload is not null
      and completed_at is not null and completed_at >= created_at)
  )
);

revoke all on private.customer_return_request_receipts from public, anon, authenticated;
grant select, insert, update on private.customer_return_request_receipts to service_role;

create or replace function private.build_customer_return_request(
  p_return_id uuid,
  p_replayed boolean
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'returnId', r.id,
    'returnNumber', r.return_number,
    'orderId', r.order_id,
    'shopId', r.shop_id,
    'reasonCode', r.reason_code,
    'customerNote', r.customer_note,
    'status', r.status,
    'refundMethod', r.refund_method,
    'requestedAt', r.requested_at,
    'approvedAt', r.approved_at,
    'completedAt', r.completed_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'returnItemId', i.id,
        'orderItemId', i.order_item_id,
        'quantity', i.quantity,
        'reasonCode', i.reason_code,
        'requestedRefundPaise', i.requested_refund_paise,
        'inspectionStatus', i.inspection_status,
        'merchantDecision', i.merchant_decision
      ) order by i.id)
      from public.return_items i where i.return_request_id = r.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'previousStatus', h.previous_status,
        'newStatus', h.new_status,
        'changedBy', h.changed_by,
        'reasonCode', h.reason_code,
        'note', h.note,
        'createdAt', h.created_at
      ) order by h.created_at, h.id)
      from public.return_status_history h where h.return_request_id = r.id
    ), '[]'::jsonb),
    'replayed', p_replayed
  )
  from public.return_requests r
  where r.id = p_return_id
$$;

revoke all on function private.build_customer_return_request(uuid,boolean)
  from public, anon, authenticated;
grant execute on function private.build_customer_return_request(uuid,boolean)
  to service_role;

create or replace function public.get_customer_return_eligibility(
  p_actor_id uuid,
  p_order_id uuid
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'orderId', o.id,
    'orderNumber', o.order_number,
    'deliveredAt', o.delivered_at,
    'returnDeadline', o.delivered_at + interval '7 days',
    'eligible', o.status in ('DELIVERED','COMPLETED')
      and o.delivered_at is not null
      and statement_timestamp() <= o.delivered_at + interval '7 days'
      and exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id
          and oi.quantity > coalesce((
            select sum(ri.quantity)::integer
            from public.return_items ri
            join public.return_requests rr on rr.id = ri.return_request_id
            where ri.order_item_id = oi.id
          ), 0)
      ),
    'reason', case
      when o.status not in ('DELIVERED','COMPLETED') or o.delivered_at is null
        then 'ORDER_NOT_DELIVERED'
      when statement_timestamp() > o.delivered_at + interval '7 days'
        then 'RETURN_WINDOW_CLOSED'
      when not exists (
        select 1 from public.order_items oi
        where oi.order_id = o.id
          and oi.quantity > coalesce((
            select sum(ri.quantity)::integer
            from public.return_items ri
            join public.return_requests rr on rr.id = ri.return_request_id
            where ri.order_item_id = oi.id
          ), 0)
      ) then 'NO_REMAINING_QUANTITY'
      else null
    end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'orderItemId', oi.id,
        'productName', oi.product_name_snapshot,
        'sku', oi.sku_snapshot,
        'colourName', oi.colour_snapshot,
        'sizeLabel', oi.size_snapshot,
        'purchasedQuantity', oi.quantity,
        'requestedQuantity', coalesce(used.quantity, 0),
        'remainingQuantity', greatest(oi.quantity - coalesce(used.quantity, 0), 0),
        'maximumRefundPaise', round(
          oi.total_paise::numeric
          * greatest(oi.quantity - coalesce(used.quantity, 0), 0)
          / oi.quantity
        )::bigint
      ) order by oi.created_at, oi.id)
      from public.order_items oi
      left join lateral (
        select sum(ri.quantity)::integer as quantity
        from public.return_items ri
        join public.return_requests rr on rr.id = ri.return_request_id
        where ri.order_item_id = oi.id
      ) used on true
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id and o.customer_id = p_actor_id
$$;

create or replace function public.get_customer_return_request(
  p_actor_id uuid,
  p_return_id uuid
) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select private.build_customer_return_request(r.id, true)
  from public.return_requests r
  where r.id = p_return_id and r.customer_id = p_actor_id
$$;

create or replace function public.create_customer_return_request(
  p_actor_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_customer_note text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt private.customer_return_request_receipts;
  v_order public.orders;
  v_order_item public.order_items;
  v_return public.return_requests;
  v_line record;
  v_request_payload jsonb;
  v_result jsonb;
  v_note text;
  v_existing_quantity integer;
  v_reason public.return_reason_code;
  v_requested_refund bigint;
  v_return_id uuid := gen_random_uuid();
  v_item_count integer;
begin
  if p_actor_id is null or p_order_id is null or p_idempotency_key is null
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 25 then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  v_note := nullif(btrim(coalesce(p_customer_note, '')), '');
  if v_note is not null and length(v_note) > 1000 then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  select count(*), count(distinct item_id)
  into v_item_count, v_existing_quantity
  from (
    select (value->>'orderItemId')::uuid as item_id
    from jsonb_array_elements(p_items)
    where jsonb_typeof(value) = 'object'
  ) parsed;
  if v_item_count <> jsonb_array_length(p_items)
    or v_existing_quantity <> v_item_count then
    raise exception 'FINANCE_REQUEST_INVALID';
  end if;
  perform 1 from public.customer_profiles
  where user_id = p_actor_id for update;
  if not found then raise exception 'FINANCE_ACCESS_DENIED'; end if;

  v_request_payload := jsonb_build_object(
    'orderId', p_order_id,
    'items', p_items,
    'customerNote', v_note,
    'refundMethod', 'ORIGINAL'
  );
  insert into private.customer_return_request_receipts(
    customer_id, idempotency_key, request_payload
  ) values (p_actor_id, p_idempotency_key, v_request_payload)
  on conflict do nothing returning * into v_receipt;
  if not found then
    select * into strict v_receipt
    from private.customer_return_request_receipts
    where customer_id = p_actor_id and idempotency_key = p_idempotency_key
    for update;
    if v_receipt.request_payload <> v_request_payload then
      raise exception 'FINANCE_IDEMPOTENCY_CONFLICT';
    end if;
    if v_receipt.return_request_id is null then
      raise exception 'FINANCE_REQUEST_INCOMPLETE';
    end if;
    return private.build_customer_return_request(v_receipt.return_request_id, true);
  end if;

  select * into v_order from public.orders
  where id = p_order_id and customer_id = p_actor_id for update;
  if not found then raise exception 'FINANCE_RETURN_NOT_FOUND'; end if;
  if v_order.status not in ('DELIVERED','COMPLETED')
    or v_order.delivered_at is null
    or statement_timestamp() > v_order.delivered_at + interval '7 days' then
    raise exception 'FINANCE_RETURN_NOT_ELIGIBLE';
  end if;
  perform 1 from public.order_items oi
  where oi.order_id = v_order.id
    and oi.id in (
      select (value->>'orderItemId')::uuid from jsonb_array_elements(p_items)
    )
  order by oi.id for update;
  if not found then raise exception 'FINANCE_RETURN_QUANTITY_CONFLICT'; end if;

  insert into public.return_requests(
    id, return_number, idempotency_key, order_id, customer_id, shop_id,
    reason_code, customer_note, status, refund_method
  ) values (
    v_return_id, 'RET-' || upper(replace(v_return_id::text, '-', '')),
    p_idempotency_key::text, v_order.id, p_actor_id, v_order.shop_id,
    (p_items->0->>'reasonCode')::public.return_reason_code,
    v_note, 'REQUESTED', 'ORIGINAL'
  ) returning * into v_return;

  for v_line in
    select
      (value->>'orderItemId')::uuid as order_item_id,
      (value->>'quantity')::integer as quantity,
      value->>'reasonCode' as reason_code
    from jsonb_array_elements(p_items)
  loop
    if v_line.quantity is null or v_line.quantity < 1 then
      raise exception 'FINANCE_REQUEST_INVALID';
    end if;
    begin
      v_reason := v_line.reason_code::public.return_reason_code;
    exception when invalid_text_representation then
      raise exception 'FINANCE_REQUEST_INVALID';
    end;
    select * into v_order_item from public.order_items
    where id = v_line.order_item_id and order_id = v_order.id for update;
    if not found then raise exception 'FINANCE_RETURN_QUANTITY_CONFLICT'; end if;
    select coalesce(sum(ri.quantity), 0)::integer into v_existing_quantity
    from public.return_items ri
    join public.return_requests rr on rr.id = ri.return_request_id
    where ri.order_item_id = v_order_item.id and rr.id <> v_return.id;
    if v_existing_quantity + v_line.quantity > v_order_item.quantity then
      raise exception 'FINANCE_RETURN_QUANTITY_CONFLICT';
    end if;
    v_requested_refund := round(
      v_order_item.total_paise::numeric * v_line.quantity / v_order_item.quantity
    )::bigint;
    insert into public.return_items(
      return_request_id, order_item_id, quantity, reason_code,
      requested_refund_paise, inspection_status
    ) values (
      v_return.id, v_order_item.id, v_line.quantity, v_reason,
      v_requested_refund, 'PENDING'
    );
  end loop;

  v_result := private.build_customer_return_request(v_return.id, false);
  update private.customer_return_request_receipts
  set return_request_id = v_return.id, result_payload = v_result,
      completed_at = transaction_timestamp()
  where customer_id = p_actor_id and idempotency_key = p_idempotency_key;
  perform private.enqueue_outbox_event(
    'return.requested', 'RETURN_REQUEST', v_return.id,
    jsonb_build_object(
      'returnId', v_return.id, 'returnNumber', v_return.return_number,
      'orderId', v_order.id, 'customerId', p_actor_id,
      'shopId', v_order.shop_id, 'status', v_return.status
    ), transaction_timestamp(), transaction_timestamp()
  );
  return v_result;
end;
$$;

revoke all on function public.get_customer_return_eligibility(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.get_customer_return_request(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.create_customer_return_request(uuid,uuid,jsonb,text,uuid)
  from public, anon, authenticated;
grant execute on function public.get_customer_return_eligibility(uuid,uuid)
  to service_role;
grant execute on function public.get_customer_return_request(uuid,uuid)
  to service_role;
grant execute on function public.create_customer_return_request(uuid,uuid,jsonb,text,uuid)
  to service_role;
