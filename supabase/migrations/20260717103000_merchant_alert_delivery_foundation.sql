-- S7-02 through S7-05: merchant urgent-alert backend delivery foundation.
--
-- The existing order transaction creates one merchant alert and one outbox event.
-- This migration adds per-device attempt history plus service-role-only claim and
-- completion functions for a concurrent, retrying FCM worker.

create type public.merchant_alert_delivery_attempt_status as enum (
  'SENT',
  'FAILED',
  'SKIPPED'
);

create table public.merchant_alert_delivery_attempts (
  id bigint generated always as identity primary key,
  outbox_event_id uuid not null,
  alert_id uuid not null,
  device_id uuid not null,
  event_attempt_number public.positive_quantity not null,
  status public.merchant_alert_delivery_attempt_status not null,
  provider text not null default 'FCM',
  provider_message_id text,
  failure_code text,
  failure_reason text,
  retryable boolean not null default false,
  worker_id text not null,
  attempted_at timestamptz not null default now(),

  constraint merchant_alert_delivery_attempts_outbox_fkey
    foreign key (outbox_event_id)
    references public.outbox_events (id)
    on update cascade
    on delete restrict,

  constraint merchant_alert_delivery_attempts_alert_fkey
    foreign key (alert_id)
    references public.merchant_order_alerts (id)
    on update cascade
    on delete restrict,

  constraint merchant_alert_delivery_attempts_device_fkey
    foreign key (device_id)
    references public.user_devices (id)
    on update cascade
    on delete restrict,

  constraint merchant_alert_delivery_attempts_attempt_key
    unique (outbox_event_id, device_id, event_attempt_number),

  constraint merchant_alert_delivery_attempts_provider_nonempty
    check (length(btrim(provider)) > 0),

  constraint merchant_alert_delivery_attempts_worker_nonempty
    check (length(btrim(worker_id)) > 0),

  constraint merchant_alert_delivery_attempts_result_shape
    check (
      (
        status = 'SENT'
        and provider_message_id is not null
        and length(btrim(provider_message_id)) > 0
        and failure_code is null
        and failure_reason is null
        and retryable = false
      )
      or (
        status = 'FAILED'
        and provider_message_id is null
        and failure_code is not null
        and length(btrim(failure_code)) > 0
        and failure_reason is not null
        and length(btrim(failure_reason)) > 0
      )
      or (
        status = 'SKIPPED'
        and provider_message_id is null
        and failure_reason is not null
        and length(btrim(failure_reason)) > 0
        and retryable = false
      )
    )
);

comment on table public.merchant_alert_delivery_attempts is
  'Append-only per-device FCM delivery history for durable merchant order alerts.';

create unique index merchant_alert_delivery_attempts_provider_message_idx
on public.merchant_alert_delivery_attempts (provider, provider_message_id)
where provider_message_id is not null;

create index merchant_alert_delivery_attempts_alert_idx
on public.merchant_alert_delivery_attempts (alert_id, attempted_at desc);

create trigger prevent_merchant_alert_delivery_attempt_mutation
before update or delete on public.merchant_alert_delivery_attempts
for each row
execute function private.prevent_append_only_mutation();

alter table public.merchant_alert_delivery_attempts enable row level security;
alter table public.merchant_alert_delivery_attempts force row level security;

revoke all privileges
on table public.merchant_alert_delivery_attempts
from anon, authenticated;

grant select, insert
on table public.merchant_alert_delivery_attempts
to service_role;

grant usage, select
on sequence public.merchant_alert_delivery_attempts_id_seq
to service_role;

create or replace function public.claim_merchant_alert_dispatches(
  p_worker_id text,
  p_limit integer default 10
)
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null or length(btrim(p_worker_id)) = 0 then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'claim limit must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with candidate_events as (
    select event.id
    from public.outbox_events event
    where event.event_type = 'merchant.order.alert.created'
      and event.aggregate_type = 'MERCHANT_ORDER_ALERT'
      and event.available_at <= statement_timestamp()
      and event.attempt_count < event.max_attempts
      and (
        event.status in ('PENDING', 'FAILED')
        or (
          event.status = 'PROCESSING'
          and event.locked_at <= statement_timestamp() - interval '5 minutes'
        )
      )
    order by event.available_at, event.created_at, event.id
    for update skip locked
    limit p_limit
  ),
  claimed_events as (
    update public.outbox_events event
    set
      status = 'PROCESSING',
      attempt_count = event.attempt_count + 1,
      locked_at = statement_timestamp(),
      locked_by = btrim(p_worker_id),
      published_at = null,
      failed_at = null,
      last_error = null,
      updated_at = statement_timestamp()
    from candidate_events candidate
    where event.id = candidate.id
    returning event.*
  ),
  hydrated as (
    select
      event.id as event_id,
      event.attempt_count as event_attempt_number,
      event.max_attempts as event_max_attempts,
      alert.id as alert_id,
      alert.alert_status,
      alert.expires_at,
      alert.sound_name,
      placed_order.id as order_id,
      placed_order.order_number,
      placed_order.status as order_status,
      placed_order.total_paise,
      shop.id as shop_id,
      shop.name as shop_name,
      coalesce(destinations.devices, '[]'::jsonb) as devices
    from claimed_events event
    join public.merchant_order_alerts alert
      on alert.id = event.aggregate_id
    join public.orders placed_order
      on placed_order.id = alert.order_id
     and placed_order.shop_id = alert.shop_id
    join public.shops shop
      on shop.id = alert.shop_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'deviceId', device.id,
          'pushToken', device.push_token
        )
        order by device.id
      ) as devices
      from public.user_devices device
      where device.user_id = shop.merchant_id
        and device.app_name = 'MERCHANT'
        and device.platform = 'ANDROID'
        and device.push_provider = 'FCM'
        and device.push_token is not null
        and length(btrim(device.push_token)) > 0
        and device.notification_enabled = true
        and device.order_sound_enabled = true
        and device.revoked_at is null
    ) destinations on true
  ),
  classified as (
    select
      hydrated.*,
      case
        when hydrated.alert_status in ('ACKNOWLEDGED', 'EXPIRED')
          then 'ALERT_TERMINAL'
        when hydrated.order_status <> 'WAITING_FOR_MERCHANT'
          then 'ORDER_NOT_WAITING'
        when hydrated.expires_at <= statement_timestamp()
          then 'EXPIRED'
        when jsonb_array_length(hydrated.devices) = 0
          then 'NO_ELIGIBLE_DEVICE'
        else null
      end as stop_reason
    from hydrated
  )
  select jsonb_build_object(
    'eventId', classified.event_id,
    'alertId', classified.alert_id,
    'orderId', classified.order_id,
    'orderNumber', classified.order_number,
    'shopId', classified.shop_id,
    'shopName', classified.shop_name,
    'totalPaise', classified.total_paise,
    'expiresAt', classified.expires_at,
    'soundName', classified.sound_name,
    'eventAttemptNumber', classified.event_attempt_number,
    'eventMaxAttempts', classified.event_max_attempts,
    'deliverable', classified.stop_reason is null,
    'stopReason', classified.stop_reason,
    'devices', classified.devices
  )
  from classified;
end;
$$;

comment on function public.claim_merchant_alert_dispatches(text, integer) is
  'Claims due merchant-alert outbox events with SKIP LOCKED and returns only eligible backend push destinations.';

create or replace function public.complete_merchant_alert_dispatch(
  p_worker_id text,
  p_event_id uuid,
  p_alert_id uuid,
  p_stop_reason text,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.outbox_events;
  alert_row public.merchant_order_alerts;
  order_row public.orders;
  result_row record;
  successful_devices integer := 0;
  failed_devices integer := 0;
  retryable_failures integer := 0;
  retry_delay_seconds integer;
  retry_at timestamptz;
  terminal_reason text;
  final_event_status public.outbox_event_status;
  stopped boolean := false;
begin
  if p_worker_id is null or length(btrim(p_worker_id)) = 0
    or p_event_id is null
    or p_alert_id is null
  then
    raise exception 'worker, event, and alert are required' using errcode = '22023';
  end if;

  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'delivery results must be a JSON array' using errcode = '22023';
  end if;

  if p_stop_reason is not null
    and p_stop_reason not in (
      'ALERT_TERMINAL',
      'ORDER_NOT_WAITING',
      'EXPIRED',
      'NO_ELIGIBLE_DEVICE'
    )
  then
    raise exception 'invalid merchant alert stop reason' using errcode = '22023';
  end if;

  select *
  into event_row
  from public.outbox_events event
  where event.id = p_event_id
    and event.aggregate_id = p_alert_id
    and event.event_type = 'merchant.order.alert.created'
    and event.aggregate_type = 'MERCHANT_ORDER_ALERT'
  for update;

  if not found then
    raise exception 'merchant alert outbox event not found' using errcode = 'P0014';
  end if;

  if event_row.status <> 'PROCESSING'
    or event_row.locked_by is distinct from btrim(p_worker_id)
  then
    raise exception 'merchant alert outbox claim is not owned by worker' using errcode = '55000';
  end if;

  select placed_order.*
  into order_row
  from public.orders placed_order
  join public.merchant_order_alerts alert
    on alert.order_id = placed_order.id
   and alert.shop_id = placed_order.shop_id
  where alert.id = p_alert_id
  for update of placed_order;

  if not found then
    raise exception 'merchant order alert not found' using errcode = 'P0014';
  end if;

  select alert.*
  into alert_row
  from public.merchant_order_alerts alert
  where alert.id = p_alert_id
    and alert.order_id = order_row.id
    and alert.shop_id = order_row.shop_id
  for update;

  if not found then
    raise exception 'merchant order alert not found' using errcode = 'P0014';
  end if;

  for result_row in
    select *
    from jsonb_to_recordset(p_results) as result(
      device_id uuid,
      outcome text,
      provider_message_id text,
      failure_code text,
      failure_reason text,
      retryable boolean
    )
  loop
    if result_row.device_id is null
      or result_row.outcome is null
      or result_row.outcome not in ('SENT', 'FAILED', 'SKIPPED')
      or result_row.retryable is null
    then
      raise exception 'invalid merchant alert device result' using errcode = '22023';
    end if;

    insert into public.merchant_alert_delivery_attempts (
      outbox_event_id,
      alert_id,
      device_id,
      event_attempt_number,
      status,
      provider_message_id,
      failure_code,
      failure_reason,
      retryable,
      worker_id,
      attempted_at
    )
    values (
      event_row.id,
      alert_row.id,
      result_row.device_id,
      event_row.attempt_count,
      result_row.outcome::public.merchant_alert_delivery_attempt_status,
      nullif(btrim(result_row.provider_message_id), ''),
      nullif(btrim(result_row.failure_code), ''),
      nullif(btrim(result_row.failure_reason), ''),
      result_row.retryable,
      btrim(p_worker_id),
      statement_timestamp()
    );

    if result_row.outcome = 'SENT' then
      successful_devices := successful_devices + 1;
    elsif result_row.outcome = 'FAILED' then
      failed_devices := failed_devices + 1;
      if result_row.retryable then
        retryable_failures := retryable_failures + 1;
      end if;

      if result_row.failure_code = 'UNREGISTERED' then
        update public.user_devices device
        set
          revoked_at = coalesce(device.revoked_at, statement_timestamp()),
          updated_at = statement_timestamp()
        where device.id = result_row.device_id;
      end if;
    end if;
  end loop;

  terminal_reason := case
    when alert_row.alert_status in ('ACKNOWLEDGED', 'EXPIRED')
      then 'ALERT_TERMINAL'
    when order_row.status <> 'WAITING_FOR_MERCHANT'
      then 'ORDER_NOT_WAITING'
    when alert_row.expires_at <= statement_timestamp()
      then 'EXPIRED'
    else p_stop_reason
  end;

  if terminal_reason in ('ALERT_TERMINAL', 'ORDER_NOT_WAITING', 'EXPIRED') then
    stopped := true;

    if alert_row.alert_status <> 'ACKNOWLEDGED' then
      update public.merchant_order_alerts alert
      set
        alert_status = 'EXPIRED',
        failure_reason = null
      where alert.id = alert_row.id
      returning * into alert_row;
    end if;

    update public.outbox_events event
    set
      status = 'PUBLISHED',
      locked_at = null,
      locked_by = null,
      published_at = statement_timestamp(),
      failed_at = null,
      last_error = null,
      updated_at = statement_timestamp()
    where event.id = event_row.id
    returning * into event_row;

    return jsonb_build_object(
      'eventId', event_row.id,
      'alertId', alert_row.id,
      'eventStatus', event_row.status,
      'alertStatus', alert_row.alert_status,
      'successfulDevices', successful_devices,
      'failedDevices', failed_devices,
      'retryAt', null,
      'stopped', true
    );
  end if;

  if successful_devices > 0 then
    update public.merchant_order_alerts alert
    set
      alert_status = 'SENT',
      attempt_count = alert.attempt_count + 1,
      first_sent_at = coalesce(alert.first_sent_at, statement_timestamp()),
      last_sent_at = statement_timestamp(),
      failure_reason = null
    where alert.id = alert_row.id
    returning * into alert_row;

    update public.outbox_events event
    set
      status = 'PUBLISHED',
      locked_at = null,
      locked_by = null,
      published_at = statement_timestamp(),
      failed_at = null,
      last_error = null,
      updated_at = statement_timestamp()
    where event.id = event_row.id
    returning * into event_row;

    final_event_status := 'PUBLISHED';
  else
    if terminal_reason = 'NO_ELIGIBLE_DEVICE' then
      retryable_failures := greatest(retryable_failures, 1);
    end if;

    if retryable_failures > 0 and event_row.attempt_count < event_row.max_attempts then
      retry_delay_seconds := least(
        300,
        5 * power(2, greatest(event_row.attempt_count - 1, 0))::integer
      );
      retry_at := statement_timestamp() + make_interval(secs => retry_delay_seconds);
      final_event_status := 'FAILED';
    else
      retry_at := null;
      final_event_status := 'DEAD_LETTER';
    end if;

    update public.merchant_order_alerts alert
    set
      alert_status = 'FAILED',
      attempt_count = alert.attempt_count + 1,
      last_sent_at = statement_timestamp(),
      failure_reason = coalesce(
        terminal_reason,
        case
          when retryable_failures > 0 then 'FCM_RETRYABLE_FAILURE'
          else 'FCM_PERMANENT_FAILURE'
        end
      )
    where alert.id = alert_row.id
    returning * into alert_row;

    update public.outbox_events event
    set
      status = final_event_status,
      available_at = coalesce(retry_at, event.available_at),
      locked_at = null,
      locked_by = null,
      published_at = null,
      failed_at = statement_timestamp(),
      last_error = alert_row.failure_reason,
      updated_at = statement_timestamp()
    where event.id = event_row.id
    returning * into event_row;
  end if;

  return jsonb_build_object(
    'eventId', event_row.id,
    'alertId', alert_row.id,
    'eventStatus', event_row.status,
    'alertStatus', alert_row.alert_status,
    'successfulDevices', successful_devices,
    'failedDevices', failed_devices,
    'retryAt', retry_at,
    'stopped', stopped
  );
end;
$$;

comment on function public.complete_merchant_alert_dispatch(text, uuid, uuid, text, jsonb) is
  'Records per-device FCM results, revokes invalid tokens, and publishes, retries, or dead-letters the claimed alert event.';

revoke all
on function public.claim_merchant_alert_dispatches(text, integer)
from public, anon, authenticated;

revoke all
on function public.complete_merchant_alert_dispatch(text, uuid, uuid, text, jsonb)
from public, anon, authenticated;

grant execute
on function public.claim_merchant_alert_dispatches(text, integer)
to service_role;

grant execute
on function public.complete_merchant_alert_dispatch(text, uuid, uuid, text, jsonb)
to service_role;
