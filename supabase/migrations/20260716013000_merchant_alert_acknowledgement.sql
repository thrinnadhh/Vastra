-- S5-04: idempotent merchant order-alert acknowledgement.
--
-- Acknowledgement is a durable alert-state change, not an order-state change.
-- It stops reminder eligibility and produces one transactional outbox event.

alter table public.merchant_order_alerts
drop constraint merchant_order_alerts_lifecycle_check;

alter table public.merchant_order_alerts
add constraint merchant_order_alerts_lifecycle_check
check (
  (
    alert_status = 'PENDING'
    and first_sent_at is null
    and acknowledged_at is null
    and acknowledged_by is null
  )
  or (
    alert_status in ('SENT', 'DELIVERED')
    and first_sent_at is not null
    and acknowledged_at is null
    and acknowledged_by is null
  )
  or (
    alert_status = 'ACKNOWLEDGED'
    and acknowledged_at is not null
    and acknowledged_by is not null
  )
  or (
    alert_status in ('EXPIRED', 'FAILED')
    and acknowledged_at is null
    and acknowledged_by is null
  )
);

alter table public.merchant_order_alerts
add constraint merchant_order_alerts_acknowledged_at_check
check (
  acknowledged_at is null
  or (
    acknowledged_at >= created_at
    and acknowledged_at <= expires_at
  )
);

create or replace function public.acknowledge_merchant_order_alert(
  p_actor uuid,
  p_alert_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := p_actor;
  alert_row public.merchant_order_alerts;
  order_row public.orders;
  acknowledged_timestamp timestamptz;
begin
  if actor_id is null or p_alert_id is null then
    raise exception 'actor and merchant order alert are required'
      using errcode = '22023';
  end if;

  select placed_order.*
  into order_row
  from public.merchant_order_alerts alert
  join public.orders placed_order
    on placed_order.id = alert.order_id
   and placed_order.shop_id = alert.shop_id
  join public.shops shop
    on shop.id = placed_order.shop_id
  where alert.id = p_alert_id
    and shop.merchant_id = actor_id
    and shop.deleted_at is null
  for update of placed_order;

  if not found then
    raise exception 'merchant order alert not found'
      using errcode = 'P0014';
  end if;

  select *
  into strict alert_row
  from public.merchant_order_alerts alert
  where alert.id = p_alert_id
  for update;

  if alert_row.alert_status = 'ACKNOWLEDGED' then
    if alert_row.acknowledged_at is null
      or alert_row.acknowledged_by is null
    then
      raise exception 'merchant order alert acknowledgement is incomplete'
        using errcode = '55000';
    end if;

    return jsonb_build_object(
      'id', alert_row.id,
      'orderId', alert_row.order_id,
      'shopId', alert_row.shop_id,
      'status', alert_row.alert_status,
      'attemptCount', alert_row.attempt_count,
      'firstSentAt', alert_row.first_sent_at,
      'lastSentAt', alert_row.last_sent_at,
      'acknowledgedAt', alert_row.acknowledged_at,
      'acknowledgedBy', alert_row.acknowledged_by,
      'expiresAt', alert_row.expires_at,
      'soundName', alert_row.sound_name,
      'failureReason', alert_row.failure_reason,
      'reminderEligible', false,
      'soundShouldStop', true,
      'replayed', true
    );
  end if;

  if alert_row.expires_at <= statement_timestamp()
    or alert_row.alert_status = 'EXPIRED'
  then
    raise exception 'merchant response window has expired'
      using errcode = 'P0015';
  end if;

  if order_row.status <> 'WAITING_FOR_MERCHANT'
    or alert_row.alert_status not in (
      'PENDING',
      'SENT',
      'DELIVERED',
      'FAILED'
    )
  then
    raise exception 'merchant order alert is not acknowledgeable'
      using errcode = 'P0016';
  end if;

  acknowledged_timestamp := statement_timestamp();

  update public.merchant_order_alerts alert
  set
    alert_status = 'ACKNOWLEDGED',
    acknowledged_at = acknowledged_timestamp,
    acknowledged_by = actor_id
  where alert.id = alert_row.id
  returning * into strict alert_row;

  perform private.enqueue_outbox_event(
    'merchant.order.alert.acknowledged',
    'MERCHANT_ORDER_ALERT',
    alert_row.id,
    jsonb_build_object(
      'alertId', alert_row.id,
      'orderId', alert_row.order_id,
      'shopId', alert_row.shop_id,
      'merchantId', actor_id,
      'alertStatus', alert_row.alert_status,
      'acknowledgedAt', alert_row.acknowledged_at,
      'expiresAt', alert_row.expires_at,
      'reminderEligible', false,
      'soundShouldStop', true
    ),
    alert_row.acknowledged_at,
    alert_row.acknowledged_at
  );

  return jsonb_build_object(
    'id', alert_row.id,
    'orderId', alert_row.order_id,
    'shopId', alert_row.shop_id,
    'status', alert_row.alert_status,
    'attemptCount', alert_row.attempt_count,
    'firstSentAt', alert_row.first_sent_at,
    'lastSentAt', alert_row.last_sent_at,
    'acknowledgedAt', alert_row.acknowledged_at,
    'acknowledgedBy', alert_row.acknowledged_by,
    'expiresAt', alert_row.expires_at,
    'soundName', alert_row.sound_name,
    'failureReason', alert_row.failure_reason,
    'reminderEligible', false,
    'soundShouldStop', true,
    'replayed', false
  );
end;
$$;

comment on function public.acknowledge_merchant_order_alert(uuid, uuid) is
  'Idempotently acknowledges one active order alert owned by the authenticated merchant and stops reminder eligibility.';

revoke all
on function public.acknowledge_merchant_order_alert(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.acknowledge_merchant_order_alert(uuid, uuid)
to service_role;
