-- S7-10: service-role observability reads for merchant alert delivery.

create or replace function public.get_merchant_alert_delivery_metrics(
  p_window_minutes integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz;
  result jsonb;
begin
  if p_window_minutes is null or p_window_minutes < 5 or p_window_minutes > 10080 then
    raise exception 'metrics window must be between 5 and 10080 minutes' using errcode = '22023';
  end if;

  window_start := statement_timestamp() - make_interval(mins => p_window_minutes);

  select jsonb_build_object(
    'windowMinutes', p_window_minutes,
    'generatedAt', statement_timestamp(),
    'alertsCreated', count(*) filter (where alert.created_at >= window_start),
    'alertsSent', count(*) filter (where alert.alert_status = 'SENT' and alert.created_at >= window_start),
    'alertsAcknowledged', count(*) filter (where alert.acknowledged_at >= window_start),
    'alertsExpired', count(*) filter (where alert.expired_at >= window_start),
    'alertsFailed', count(*) filter (where alert.alert_status = 'FAILED' and alert.created_at >= window_start),
    'averageAcknowledgementSeconds', coalesce(
      round(avg(extract(epoch from (alert.acknowledged_at - alert.created_at))) filter (
        where alert.acknowledged_at is not null and alert.acknowledged_at >= window_start
      ))::integer,
      0
    ),
    'activeAlerts', count(*) filter (
      where alert.alert_status in ('PENDING', 'SENT', 'DELIVERED', 'FAILED')
        and alert.expires_at > statement_timestamp()
    ),
    'remindersQueued', (
      select count(*)
      from public.outbox_events event
      where event.created_at >= window_start
        and event.event_type = 'merchant.order.alert.created'
        and event.payload ->> 'deliveryKind' = 'REMINDER'
    ),
    'deliveryAttempts', (
      select count(*)
      from public.merchant_alert_delivery_attempts attempt
      where attempt.attempted_at >= window_start
    ),
    'successfulAttempts', (
      select count(*)
      from public.merchant_alert_delivery_attempts attempt
      where attempt.attempted_at >= window_start
        and attempt.status = 'SENT'
    ),
    'failedAttempts', (
      select count(*)
      from public.merchant_alert_delivery_attempts attempt
      where attempt.attempted_at >= window_start
        and attempt.status = 'FAILED'
    ),
    'retryableFailures', (
      select count(*)
      from public.merchant_alert_delivery_attempts attempt
      where attempt.attempted_at >= window_start
        and attempt.status = 'FAILED'
        and attempt.retryable
    ),
    'unregisteredTokens', (
      select count(*)
      from public.merchant_alert_delivery_attempts attempt
      where attempt.attempted_at >= window_start
        and attempt.failure_code = 'UNREGISTERED'
    ),
    'outboxBacklog', (
      select count(*)
      from public.outbox_events event
      where event.aggregate_type = 'MERCHANT_ORDER_ALERT'
        and event.event_type = 'merchant.order.alert.created'
        and event.status in ('PENDING', 'PROCESSING', 'FAILED')
    )
  )
  into result
  from public.merchant_order_alerts alert;

  return result;
end;
$$;

create or replace function public.list_merchant_alert_delivery_activity(
  p_limit integer default 50,
  p_before timestamptz default null
)
returns setof jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'alertId', alert.id,
    'orderId', alert.order_id,
    'orderNumber', placed_order.order_number,
    'shopId', alert.shop_id,
    'shopName', shop.name,
    'alertStatus', alert.alert_status,
    'attemptCount', alert.attempt_count,
    'reminderCount', alert.reminder_count,
    'createdAt', alert.created_at,
    'expiresAt', alert.expires_at,
    'acknowledgedAt', alert.acknowledged_at,
    'expiredAt', alert.expired_at,
    'failureReason', alert.failure_reason,
    'successfulDeviceAttempts', coalesce(attempts.successful, 0),
    'failedDeviceAttempts', coalesce(attempts.failed, 0),
    'retryableDeviceFailures', coalesce(attempts.retryable, 0),
    'lastAttemptAt', attempts.last_attempt_at,
    'lastFailureCode', attempts.last_failure_code
  )
  from public.merchant_order_alerts alert
  join public.orders placed_order
    on placed_order.id = alert.order_id
   and placed_order.shop_id = alert.shop_id
  join public.shops shop
    on shop.id = alert.shop_id
  left join lateral (
    select
      count(*) filter (where attempt.status = 'SENT') as successful,
      count(*) filter (where attempt.status = 'FAILED') as failed,
      count(*) filter (where attempt.status = 'FAILED' and attempt.retryable) as retryable,
      max(attempt.attempted_at) as last_attempt_at,
      (array_agg(attempt.failure_code order by attempt.attempted_at desc)
        filter (where attempt.failure_code is not null))[1] as last_failure_code
    from public.merchant_alert_delivery_attempts attempt
    where attempt.alert_id = alert.id
  ) attempts on true
  where p_before is null or alert.created_at < p_before
  order by alert.created_at desc, alert.id desc
  limit case
    when p_limit between 1 and 100 then p_limit
    else 0
  end;
$$;

comment on function public.get_merchant_alert_delivery_metrics(integer) is
  'Returns bounded operations metrics for merchant alert delivery, reminders, expiry, and FCM outcomes.';
comment on function public.list_merchant_alert_delivery_activity(integer, timestamptz) is
  'Returns recent merchant alert delivery activity for the authenticated operations administration API.';

revoke all
on function public.get_merchant_alert_delivery_metrics(integer),
  public.list_merchant_alert_delivery_activity(integer, timestamptz)
from public, anon, authenticated;

grant execute
on function public.get_merchant_alert_delivery_metrics(integer),
  public.list_merchant_alert_delivery_activity(integer, timestamptz)
to service_role;
