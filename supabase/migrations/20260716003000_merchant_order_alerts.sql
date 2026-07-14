-- S5-03: durable merchant incoming-order alerts.
--
-- Entering WAITING_FOR_MERCHANT creates exactly one durable merchant alert and
-- one transactional outbox event. Push delivery, acknowledgement, and merchant
-- accept/reject actions are implemented in later tickets.

create unique index merchant_order_alerts_one_per_order_idx
on public.merchant_order_alerts (order_id);

create or replace function private.create_waiting_order_merchant_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alert_row public.merchant_order_alerts;
  alert_expires_at timestamptz;
begin
  select greatest(
    coalesce(
      max(reservation.expires_at) filter (
        where reservation.status = 'ACTIVE'
      ),
      coalesce(new.placed_at, new.created_at) + interval '15 minutes'
    ),
    statement_timestamp() + interval '1 second'
  )
  into alert_expires_at
  from public.inventory_reservations reservation
  where reservation.order_id = new.id;

  insert into public.merchant_order_alerts (
    order_id,
    shop_id,
    alert_status,
    expires_at,
    sound_name
  )
  values (
    new.id,
    new.shop_id,
    'PENDING',
    alert_expires_at,
    'vastra_new_order'
  )
  on conflict (order_id) do nothing
  returning * into alert_row;

  if not found then
    return new;
  end if;

  perform private.enqueue_outbox_event(
    'merchant.order.alert.created',
    'MERCHANT_ORDER_ALERT',
    alert_row.id,
    jsonb_build_object(
      'alertId', alert_row.id,
      'orderId', alert_row.order_id,
      'shopId', alert_row.shop_id,
      'alertStatus', alert_row.alert_status,
      'expiresAt', alert_row.expires_at,
      'soundName', alert_row.sound_name
    ),
    alert_row.created_at,
    alert_row.created_at
  );

  return new;
end;
$$;

revoke all
on function private.create_waiting_order_merchant_alert()
from public, anon, authenticated;

create trigger create_waiting_order_merchant_alert
after update of status on public.orders
for each row
when (
  old.status is distinct from new.status
  and new.status = 'WAITING_FOR_MERCHANT'
)
execute function private.create_waiting_order_merchant_alert();

with waiting_orders as (
  select
    placed_order.id as order_id,
    placed_order.shop_id,
    greatest(
      coalesce(
        max(reservation.expires_at) filter (
          where reservation.status = 'ACTIVE'
        ),
        coalesce(placed_order.placed_at, placed_order.created_at)
          + interval '15 minutes'
      ),
      statement_timestamp() + interval '1 second'
    ) as expires_at
  from public.orders placed_order
  left join public.inventory_reservations reservation
    on reservation.order_id = placed_order.id
  where placed_order.status = 'WAITING_FOR_MERCHANT'
  group by placed_order.id
),
inserted_alerts as (
  insert into public.merchant_order_alerts (
    order_id,
    shop_id,
    alert_status,
    expires_at,
    sound_name
  )
  select
    waiting_order.order_id,
    waiting_order.shop_id,
    'PENDING',
    waiting_order.expires_at,
    'vastra_new_order'
  from waiting_orders waiting_order
  on conflict (order_id) do nothing
  returning *
)
select private.enqueue_outbox_event(
  'merchant.order.alert.created',
  'MERCHANT_ORDER_ALERT',
  alert.id,
  jsonb_build_object(
    'alertId', alert.id,
    'orderId', alert.order_id,
    'shopId', alert.shop_id,
    'alertStatus', alert.alert_status,
    'expiresAt', alert.expires_at,
    'soundName', alert.sound_name
  ),
  alert.created_at,
  alert.created_at
)
from inserted_alerts alert;

comment on function private.create_waiting_order_merchant_alert() is
  'Creates one durable merchant alert and transactional outbox event when an order begins waiting for merchant response.';
