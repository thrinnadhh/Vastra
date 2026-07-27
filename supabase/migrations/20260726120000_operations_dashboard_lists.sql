-- Production read models for the operations dashboard and merchant home.
-- Both RPCs are service-role only; application guards enforce actor scope.

create or replace function public.list_admin_operational_orders(
  p_status text default null,
  p_issue text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
) returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_result jsonb;
begin
  if p_status is not null
    and p_status not in (
      'PAYMENT_PENDING',
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
      'COMPLETED',
      'PROBLEM_REPORTED',
      'CANCELLED'
    )
  then
    raise exception 'ADMIN_ORDER_QUERY_INVALID';
  end if;

  if p_issue is not null
    and p_issue not in (
      'DELAYED',
      'UNASSIGNED',
      'MERCHANT_TIMEOUT',
      'CAPTAIN_ISSUE',
      'PAYMENT_ISSUE'
    )
  then
    raise exception 'ADMIN_ORDER_QUERY_INVALID';
  end if;

  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception 'ADMIN_ORDER_QUERY_INVALID';
  end if;

  with candidates as (
    select
      o.id,
      o.order_number,
      o.status::text as status,
      o.payment_status::text as payment_status,
      o.fulfilment_type::text as fulfilment_type,
      o.total_paise,
      customer.id as customer_id,
      customer.full_name as customer_name,
      customer.phone_number as customer_phone_number,
      s.id as shop_id,
      s.name as shop_name,
      s.merchant_id,
      delivery.id as delivery_task_id,
      delivery.status::text as delivery_status,
      coalesce(items.item_count, 0)::integer as item_count,
      case
        when o.status = 'WAITING_FOR_MERCHANT'
          and o.updated_at < now() - interval '5 minutes'
          then 'MERCHANT_TIMEOUT'
        when o.status = 'CAPTAIN_SEARCHING'
          and delivery.assigned_captain_id is null
          then 'UNASSIGNED'
        when o.status = 'PROBLEM_REPORTED'
          or delivery.problem_reported_at is not null
          then 'CAPTAIN_ISSUE'
        when o.payment_status = 'FAILED'
          or (
            o.status = 'PAYMENT_PENDING'
            and o.created_at < now() - interval '15 minutes'
          )
          then 'PAYMENT_ISSUE'
        when o.status not in ('COMPLETED', 'CANCELLED')
          and o.estimated_delivery_at is not null
          and o.estimated_delivery_at < now()
          then 'DELAYED'
        else null
      end as intervention_reason,
      o.estimated_delivery_at,
      o.placed_at,
      o.created_at,
      o.updated_at
    from public.orders o
    join public.profiles customer on customer.id = o.customer_id
    join public.shops s on s.id = o.shop_id
    left join lateral (
      select
        d.id,
        d.status,
        d.assigned_captain_id,
        d.problem_reported_at
      from public.delivery_tasks d
      where d.order_id = o.id
      order by d.created_at desc
      limit 1
    ) delivery on true
    left join lateral (
      select count(*)::integer as item_count
      from public.order_items oi
      where oi.order_id = o.id
    ) items on true
    where (p_status is null or o.status::text = p_status)
      and (
        p_cursor_created_at is null
        or (o.created_at, o.id) < (p_cursor_created_at, p_cursor_id)
      )
  ), filtered as (
    select *
    from candidates
    where p_issue is null or intervention_reason = p_issue
    order by created_at desc, id desc
    limit v_limit + 1
  ), page as (
    select *
    from filtered
    order by created_at desc, id desc
    limit v_limit
  ), page_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'orderNumber', order_number,
          'status', status,
          'paymentStatus', payment_status,
          'fulfilmentType', fulfilment_type,
          'totalPaise', total_paise,
          'itemCount', item_count,
          'customer', jsonb_build_object(
            'id', customer_id,
            'name', customer_name,
            'phoneNumber', customer_phone_number
          ),
          'shop', jsonb_build_object(
            'id', shop_id,
            'name', shop_name,
            'merchantId', merchant_id
          ),
          'deliveryTaskId', delivery_task_id,
          'deliveryStatus', delivery_status,
          'interventionReason', intervention_reason,
          'estimatedDeliveryAt', estimated_delivery_at,
          'placedAt', placed_at,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        order by created_at desc, id desc
      ),
      '[]'::jsonb
    ) as orders
    from page
  ), cursor_json as (
    select case
      when (select count(*) from filtered) > v_limit then (
        select jsonb_build_object(
          'createdAt', created_at,
          'id', id
        )
        from page
        order by created_at, id
        limit 1
      )
      else null
    end as next_cursor
  )
  select jsonb_build_object(
    'orders', page_json.orders,
    'nextCursor', cursor_json.next_cursor
  )
  into v_result
  from page_json
  cross join cursor_json;

  return v_result;
end;
$$;

create or replace function public.get_merchant_operations_dashboard(
  p_merchant_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_shop public.shops%rowtype;
begin
  perform 1
  from public.profiles
  where id = p_merchant_id
    and account_type = 'MERCHANT'
    and status = 'ACTIVE';
  if not found then
    raise exception 'MERCHANT_DASHBOARD_NOT_FOUND';
  end if;

  select *
  into v_shop
  from public.shops
  where merchant_id = p_merchant_id
    and deleted_at is null
  order by created_at
  limit 1;
  if v_shop.id is null then
    raise exception 'MERCHANT_DASHBOARD_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'shop', jsonb_build_object(
      'id', v_shop.id,
      'name', v_shop.name,
      'operationalStatus', v_shop.operational_status,
      'acceptsOnlineOrders', v_shop.accepts_online_orders
    ),
    'orders', jsonb_build_object(
      'waitingForMerchant', (
        select count(*)::integer
        from public.orders
        where shop_id = v_shop.id
          and status = 'WAITING_FOR_MERCHANT'
      ),
      'packing', (
        select count(*)::integer
        from public.orders
        where shop_id = v_shop.id
          and status in ('MERCHANT_ACCEPTED', 'PACKING')
      ),
      'readyForPickup', (
        select count(*)::integer
        from public.orders
        where shop_id = v_shop.id
          and status in ('READY_FOR_PICKUP', 'CAPTAIN_SEARCHING', 'CAPTAIN_ASSIGNED', 'CAPTAIN_AT_STORE')
      ),
      'activeDelivery', (
        select count(*)::integer
        from public.orders
        where shop_id = v_shop.id
          and status in ('PICKED_UP', 'OUT_FOR_DELIVERY', 'CAPTAIN_AT_CUSTOMER', 'DELIVERED')
      ),
      'problemReported', (
        select count(*)::integer
        from public.orders
        where shop_id = v_shop.id
          and status = 'PROBLEM_REPORTED'
      )
    ),
    'alerts', jsonb_build_object(
      'unacknowledged', (
        select count(*)::integer
        from public.merchant_order_alerts a
        join public.orders o on o.id = a.order_id
        where o.shop_id = v_shop.id
          and a.alert_status in ('PENDING', 'SENT', 'DELIVERED')
      )
    ),
    'inventory', jsonb_build_object(
      'lowStockVariants', (
        select count(*)::integer
        from public.merchant_low_stock_inventory inventory
        where inventory.shop_id = v_shop.id
      )
    ),
    'sales', jsonb_build_object(
      'completedToday', (
        select count(*)::integer
        from public.orders
        where shop_id = v_shop.id
          and status = 'COMPLETED'
          and completed_at >= date_trunc('day', now())
      ),
      'grossTodayPaise', (
        select coalesce(sum(total_paise), 0)::bigint
        from public.orders
        where shop_id = v_shop.id
          and status = 'COMPLETED'
          and completed_at >= date_trunc('day', now())
      )
    ),
    'generatedAt', now()
  );
end;
$$;

revoke all
on function public.list_admin_operational_orders(text,text,timestamptz,uuid,integer)
from public, anon, authenticated;
revoke all
on function public.get_merchant_operations_dashboard(uuid)
from public, anon, authenticated;

grant execute
on function public.list_admin_operational_orders(text,text,timestamptz,uuid,integer)
to service_role;
grant execute
on function public.get_merchant_operations_dashboard(uuid)
to service_role;
