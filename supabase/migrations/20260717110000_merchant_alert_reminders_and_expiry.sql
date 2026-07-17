-- S7-06: durable merchant alert reminders and expiry scheduling.

alter table public.merchant_order_alerts
add column reminder_count public.non_negative_quantity not null default 0,
add column last_reminder_at timestamptz,
add column next_reminder_at timestamptz,
add column expired_at timestamptz;

update public.merchant_order_alerts alert
set
  next_reminder_at = case
    when alert.alert_status in ('PENDING', 'SENT', 'DELIVERED', 'FAILED')
      then least(alert.expires_at, coalesce(alert.last_sent_at, alert.created_at) + interval '60 seconds')
    else null
  end,
  expired_at = case
    when alert.alert_status = 'EXPIRED'
      then coalesce(alert.last_sent_at, alert.expires_at)
    else null
  end;

alter table public.merchant_order_alerts
add constraint merchant_order_alerts_reminder_lifecycle_check
check (
  reminder_count >= 0
  and (last_reminder_at is null or last_reminder_at >= created_at)
  and (next_reminder_at is null or next_reminder_at >= created_at)
  and (expired_at is null or expired_at >= created_at)
  and (
    alert_status <> 'EXPIRED'
    or expired_at is not null
  )
  and (
    alert_status not in ('ACKNOWLEDGED', 'EXPIRED')
    or next_reminder_at is null
  )
);

create index merchant_order_alerts_schedule_idx
on public.merchant_order_alerts (next_reminder_at, expires_at, created_at)
where alert_status in ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

create or replace function private.initialize_merchant_alert_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.alert_status in ('ACKNOWLEDGED', 'EXPIRED') then
    new.next_reminder_at := null;

    if new.alert_status = 'EXPIRED' and new.expired_at is null then
      new.expired_at := statement_timestamp();
    end if;
  elsif new.next_reminder_at is null then
    new.next_reminder_at := least(
      new.expires_at,
      coalesce(new.last_sent_at, new.created_at, statement_timestamp()) + interval '60 seconds'
    );
  end if;

  return new;
end;
$$;

revoke all
on function private.initialize_merchant_alert_schedule()
from public, anon, authenticated;

create trigger initialize_merchant_alert_schedule
before insert on public.merchant_order_alerts
for each row
execute function private.initialize_merchant_alert_schedule();

create trigger synchronize_merchant_alert_schedule
before update of alert_status, expires_at on public.merchant_order_alerts
for each row
execute function private.initialize_merchant_alert_schedule();

create or replace function public.process_due_merchant_order_alerts(
  p_worker_id text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_row record;
  updated_alert public.merchant_order_alerts;
  processed_count integer := 0;
  reminders_queued integer := 0;
  expired_count integer := 0;
  stopped_count integer := 0;
  due_at timestamptz := statement_timestamp();
  stop_reason text;
begin
  if p_worker_id is null or length(btrim(p_worker_id)) = 0 then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 250 then
    raise exception 'schedule limit must be between 1 and 250' using errcode = '22023';
  end if;

  for due_row in
    select
      alert.id as alert_id,
      placed_order.status as order_status
    from public.merchant_order_alerts alert
    join public.orders placed_order
      on placed_order.id = alert.order_id
     and placed_order.shop_id = alert.shop_id
    where alert.alert_status in ('PENDING', 'SENT', 'DELIVERED', 'FAILED')
      and (
        alert.expires_at <= due_at
        or placed_order.status <> 'WAITING_FOR_MERCHANT'
        or (
          alert.next_reminder_at is not null
          and alert.next_reminder_at <= due_at
          and alert.reminder_count < 3
        )
      )
    order by
      least(alert.expires_at, coalesce(alert.next_reminder_at, alert.expires_at)),
      alert.created_at,
      alert.id
    for update of placed_order skip locked
    limit p_limit
  loop
    select alert.*
    into updated_alert
    from public.merchant_order_alerts alert
    where alert.id = due_row.alert_id
    for update;

    if not found
      or updated_alert.alert_status not in ('PENDING', 'SENT', 'DELIVERED', 'FAILED')
      or (
        due_row.order_status = 'WAITING_FOR_MERCHANT'
        and updated_alert.expires_at > due_at
        and (
          updated_alert.next_reminder_at is null
          or updated_alert.next_reminder_at > due_at
          or updated_alert.reminder_count >= 3
        )
      )
    then
      continue;
    end if;

    processed_count := processed_count + 1;

    if due_row.order_status <> 'WAITING_FOR_MERCHANT'
      or updated_alert.expires_at <= due_at
    then
      stop_reason := case
        when due_row.order_status <> 'WAITING_FOR_MERCHANT'
          then 'ORDER_NOT_WAITING'
        else 'EXPIRED'
      end;

      update public.merchant_order_alerts alert
      set
        alert_status = 'EXPIRED',
        next_reminder_at = null,
        expired_at = due_at,
        failure_reason = null
      where alert.id = due_row.alert_id
      returning * into strict updated_alert;

      perform private.enqueue_outbox_event(
        'merchant.order.alert.expired',
        'MERCHANT_ORDER_ALERT',
        updated_alert.id,
        jsonb_build_object(
          'alertId', updated_alert.id,
          'orderId', updated_alert.order_id,
          'shopId', updated_alert.shop_id,
          'alertStatus', updated_alert.alert_status,
          'expiredAt', updated_alert.expired_at,
          'stopReason', stop_reason,
          'soundShouldStop', true,
          'workerId', btrim(p_worker_id)
        ),
        due_at,
        due_at
      );

      expired_count := expired_count + 1;
      if stop_reason = 'ORDER_NOT_WAITING' then
        stopped_count := stopped_count + 1;
      end if;
    else
      update public.merchant_order_alerts alert
      set
        reminder_count = alert.reminder_count + 1,
        last_reminder_at = due_at,
        next_reminder_at = case
          when alert.reminder_count + 1 < 3
            and due_at + interval '60 seconds' < alert.expires_at
            then due_at + interval '60 seconds'
          else null
        end
      where alert.id = due_row.alert_id
      returning * into strict updated_alert;

      perform private.enqueue_outbox_event(
        'merchant.order.alert.created',
        'MERCHANT_ORDER_ALERT',
        updated_alert.id,
        jsonb_build_object(
          'alertId', updated_alert.id,
          'orderId', updated_alert.order_id,
          'shopId', updated_alert.shop_id,
          'alertStatus', updated_alert.alert_status,
          'expiresAt', updated_alert.expires_at,
          'soundName', updated_alert.sound_name,
          'deliveryKind', 'REMINDER',
          'reminderNumber', updated_alert.reminder_count,
          'workerId', btrim(p_worker_id)
        ),
        due_at,
        due_at
      );

      reminders_queued := reminders_queued + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'processed', processed_count,
    'remindersQueued', reminders_queued,
    'expired', expired_count,
    'stopped', stopped_count
  );
end;
$$;

comment on function public.process_due_merchant_order_alerts(text, integer) is
  'Claims due merchant alerts with SKIP LOCKED, queues bounded reminders, and expires alerts whose order is no longer waiting or whose response window elapsed.';

revoke all
on function public.process_due_merchant_order_alerts(text, integer)
from public, anon, authenticated;

grant execute
on function public.process_due_merchant_order_alerts(text, integer)
to service_role;
