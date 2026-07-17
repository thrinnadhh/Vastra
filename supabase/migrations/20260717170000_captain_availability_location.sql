-- S8-02: authoritative captain availability, deduplicated location writes,
-- dispatch-readiness projection, and bounded durable location sampling.

alter table public.captain_current_locations
  add column recorded_at timestamptz,
  add column sample_id uuid;

update public.captain_current_locations
set recorded_at = updated_at
where recorded_at is null;

alter table public.captain_current_locations
  alter column recorded_at set not null,
  alter column recorded_at set default now();

alter table public.captain_location_history
  drop constraint captain_location_history_received_order;

alter table public.captain_location_history
  add constraint captain_location_history_clock_skew_check
  check (recorded_at <= received_at + interval '30 seconds');

create table private.captain_location_update_receipts (
  captain_id uuid not null,
  sample_id uuid not null,
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (captain_id, sample_id),
  constraint captain_location_update_receipts_captain_fkey
    foreign key (captain_id)
    references public.captain_profiles (user_id)
    on update cascade
    on delete cascade,
  constraint captain_location_update_receipts_request_object
    check (jsonb_typeof(request_payload) = 'object'),
  constraint captain_location_update_receipts_result_object
    check (result_payload is null or jsonb_typeof(result_payload) = 'object'),
  constraint captain_location_update_receipts_completion_shape
    check (
      (result_payload is null and completed_at is null)
      or (result_payload is not null and completed_at is not null)
    )
);

comment on table private.captain_location_update_receipts is
  'Backend-only S8-02 deduplication receipts for captain GPS samples.';

revoke all
on table private.captain_location_update_receipts
from public, anon, authenticated;

grant select, insert, update
on table private.captain_location_update_receipts
to service_role;

create or replace view private.captain_dispatch_readiness
with (security_invoker = true)
as
select
  captain.user_id as captain_id,
  captain.availability_status,
  location.location,
  location.recorded_at,
  location.accuracy_meters,
  location.active_delivery_task_id,
  profile.status = 'ACTIVE' as profile_active,
  captain.kyc_status = 'VERIFIED' and captain.approved_at is not null as captain_approved,
  location.recorded_at >= now() - interval '120 seconds' as location_fresh,
  location.accuracy_meters is not null
    and location.accuracy_meters <= 100 as location_accurate,
  exists (
    select 1
    from public.user_devices device
    where device.user_id = captain.user_id
      and device.app_name = 'CAPTAIN'
      and device.platform = 'ANDROID'
      and device.push_provider = 'FCM'
      and device.push_token is not null
      and length(btrim(device.push_token)) > 0
      and device.notification_enabled
      and device.revoked_at is null
  ) as device_ready,
  not exists (
    select 1
    from public.delivery_tasks task
    where task.assigned_captain_id = captain.user_id
      and task.task_type = 'FORWARD_DELIVERY'
      and task.status not in ('COMPLETED', 'FAILED', 'CANCELLED')
  ) as no_active_task,
  (
    profile.status = 'ACTIVE'
    and captain.kyc_status = 'VERIFIED'
    and captain.approved_at is not null
    and captain.availability_status = 'AVAILABLE'
    and location.recorded_at >= now() - interval '120 seconds'
    and location.accuracy_meters is not null
    and location.accuracy_meters <= 100
    and location.active_delivery_task_id is null
    and exists (
      select 1
      from public.user_devices device
      where device.user_id = captain.user_id
        and device.app_name = 'CAPTAIN'
        and device.platform = 'ANDROID'
        and device.push_provider = 'FCM'
        and device.push_token is not null
        and length(btrim(device.push_token)) > 0
        and device.notification_enabled
        and device.revoked_at is null
    )
    and not exists (
      select 1
      from public.delivery_tasks task
      where task.assigned_captain_id = captain.user_id
        and task.task_type = 'FORWARD_DELIVERY'
        and task.status not in ('COMPLETED', 'FAILED', 'CANCELLED')
    )
  ) as dispatch_eligible
from public.captain_profiles captain
join public.profiles profile on profile.id = captain.user_id
left join public.captain_current_locations location
  on location.captain_id = captain.user_id;

comment on view private.captain_dispatch_readiness is
  'Service-role S8-02 projection used by later dispatch waves to exclude stale or ineligible captains.';

revoke all
on table private.captain_dispatch_readiness
from public, anon, authenticated;

grant select
on table private.captain_dispatch_readiness
to service_role;

create or replace function public.set_captain_availability(
  p_actor uuid,
  p_requested_status public.captain_availability_status
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles;
  captain_row public.captain_profiles;
  location_row public.captain_current_locations;
  active_task_id uuid;
  previous_status public.captain_availability_status;
  changed_at timestamptz := transaction_timestamp();
  location_fresh boolean := false;
  location_accurate boolean := false;
  device_ready boolean := false;
  dispatch_eligible boolean := false;
  changed boolean := false;
begin
  if p_actor is null or p_requested_status is null then
    raise exception using
      errcode = 'P0040',
      message = 'captain availability request is invalid';
  end if;

  if p_requested_status not in ('OFFLINE', 'AVAILABLE', 'ON_BREAK') then
    raise exception using
      errcode = 'P0040',
      message = 'captain availability request is invalid';
  end if;

  select *
  into strict profile_row
  from public.profiles profile
  where profile.id = p_actor;

  if profile_row.account_type <> 'CAPTAIN'
    or profile_row.status <> 'ACTIVE'
  then
    raise exception using
      errcode = 'P0041',
      message = 'captain is not operationally eligible';
  end if;

  select task.id
  into active_task_id
  from public.delivery_tasks task
  where task.assigned_captain_id = p_actor
    and task.task_type = 'FORWARD_DELIVERY'
    and task.status not in ('COMPLETED', 'FAILED', 'CANCELLED')
  order by task.id
  limit 1
  for update;

  select *
  into strict captain_row
  from public.captain_profiles captain
  where captain.user_id = p_actor
  for update;

  select *
  into location_row
  from public.captain_current_locations location
  where location.captain_id = p_actor
  for update;

  previous_status := captain_row.availability_status;

  if captain_row.kyc_status <> 'VERIFIED'
    or captain_row.approved_at is null
    or captain_row.availability_status = 'SUSPENDED'
  then
    raise exception using
      errcode = 'P0041',
      message = 'captain is not operationally eligible';
  end if;

  if active_task_id is not null
    or location_row.active_delivery_task_id is not null
    or captain_row.availability_status in ('ASSIGNED', 'AT_PICKUP', 'DELIVERING')
  then
    raise exception using
      errcode = 'P0042',
      message = 'active delivery controls captain availability';
  end if;

  if captain_row.availability_status = 'OFFERED'
    and p_requested_status <> 'AVAILABLE'
  then
    raise exception using
      errcode = 'P0042',
      message = 'open delivery offers control captain availability';
  end if;

  if location_row.captain_id is not null then
    location_fresh := location_row.recorded_at >= changed_at - interval '120 seconds';
    location_accurate := location_row.accuracy_meters is not null
      and location_row.accuracy_meters <= 100;
  end if;

  select exists (
    select 1
    from public.user_devices device
    where device.user_id = p_actor
      and device.app_name = 'CAPTAIN'
      and device.platform = 'ANDROID'
      and device.push_provider = 'FCM'
      and device.push_token is not null
      and length(btrim(device.push_token)) > 0
      and device.notification_enabled
      and device.revoked_at is null
  )
  into device_ready;

  if p_requested_status = 'AVAILABLE' then
    if not location_fresh or not location_accurate then
      raise exception using
        errcode = 'P0043',
        message = 'captain location is not dispatch eligible';
    end if;

    if not device_ready then
      raise exception using
        errcode = 'P0041',
        message = 'captain push registration is not operationally eligible';
    end if;
  end if;

  if captain_row.availability_status in ('OFFLINE', 'AVAILABLE', 'ON_BREAK')
    and captain_row.availability_status <> p_requested_status
  then
    update public.captain_profiles captain
    set availability_status = p_requested_status
    where captain.user_id = p_actor
    returning * into captain_row;

    changed := true;

    perform private.enqueue_outbox_event(
      'captain.availability.changed',
      'CAPTAIN',
      p_actor,
      jsonb_build_object(
        'captainId', p_actor,
        'previousStatus', previous_status,
        'availabilityStatus', captain_row.availability_status,
        'changedAt', changed_at
      ),
      changed_at,
      changed_at
    );
  end if;

  dispatch_eligible := captain_row.availability_status = 'AVAILABLE'
    and location_fresh
    and location_accurate
    and device_ready
    and active_task_id is null
    and location_row.active_delivery_task_id is null;

  return jsonb_build_object(
    'captainId', p_actor,
    'requestedStatus', p_requested_status,
    'availabilityStatus', captain_row.availability_status,
    'changed', changed,
    'dispatchEligible', dispatch_eligible,
    'location', case
      when location_row.captain_id is null then null
      else jsonb_build_object(
        'recordedAt', location_row.recorded_at,
        'accuracyMeters', location_row.accuracy_meters,
        'fresh', location_fresh,
        'activeDeliveryTaskId', location_row.active_delivery_task_id
      )
    end,
    'changedAt', changed_at
  );
exception
  when no_data_found then
    raise exception using
      errcode = 'P0041',
      message = 'captain is not operationally eligible';
end;
$$;

comment on function public.set_captain_availability(uuid, public.captain_availability_status) is
  'S8-02 service-role set-state command for OFFLINE, AVAILABLE, or ON_BREAK.';

create or replace function public.update_captain_current_location(
  p_actor uuid,
  p_sample_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters numeric,
  p_recorded_at timestamptz,
  p_heading numeric default null,
  p_speed_mps numeric default null,
  p_battery_percent smallint default null,
  p_active_delivery_task_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_sample uuid;
  receipt_row private.captain_location_update_receipts;
  profile_row public.profiles;
  captain_row public.captain_profiles;
  current_row public.captain_current_locations;
  latest_history public.captain_location_history;
  location_value extensions.geography;
  request_json jsonb;
  result_json jsonb;
  received_at timestamptz := transaction_timestamp();
  history_sampled boolean := false;
  moved_meters double precision;
begin
  if p_actor is null
    or p_sample_id is null
    or p_latitude is null
    or p_longitude is null
    or p_accuracy_meters is null
    or p_recorded_at is null
    or p_latitude < -90
    or p_latitude > 90
    or p_longitude < -180
    or p_longitude > 180
    or p_accuracy_meters < 0
    or (p_heading is not null and (p_heading < 0 or p_heading >= 360))
    or (p_speed_mps is not null and p_speed_mps < 0)
    or (p_battery_percent is not null and (p_battery_percent < 0 or p_battery_percent > 100))
    or p_recorded_at > received_at + interval '30 seconds'
  then
    raise exception using
      errcode = 'P0040',
      message = 'captain location request is invalid';
  end if;

  request_json := jsonb_build_object(
    'sampleId', p_sample_id,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'accuracyMeters', p_accuracy_meters,
    'recordedAt', p_recorded_at,
    'heading', p_heading,
    'speedMps', p_speed_mps,
    'batteryPercent', p_battery_percent,
    'activeDeliveryTaskId', p_active_delivery_task_id
  );

  insert into private.captain_location_update_receipts (
    captain_id,
    sample_id,
    request_payload
  )
  values (
    p_actor,
    p_sample_id,
    request_json
  )
  on conflict (captain_id, sample_id) do nothing
  returning sample_id into claimed_sample;

  select *
  into strict receipt_row
  from private.captain_location_update_receipts receipt
  where receipt.captain_id = p_actor
    and receipt.sample_id = p_sample_id
  for update;

  if claimed_sample is null then
    if receipt_row.request_payload <> request_json then
      raise exception using
        errcode = 'P0045',
        message = 'location sample identifier was reused';
    end if;

    if receipt_row.completed_at is null or receipt_row.result_payload is null then
      raise exception using
        errcode = 'P0046',
        message = 'location sample receipt is incomplete';
    end if;

    return receipt_row.result_payload || jsonb_build_object('replayed', true);
  end if;

  select *
  into strict profile_row
  from public.profiles profile
  where profile.id = p_actor;

  select *
  into strict captain_row
  from public.captain_profiles captain
  where captain.user_id = p_actor;

  if profile_row.account_type <> 'CAPTAIN'
    or profile_row.status <> 'ACTIVE'
    or captain_row.kyc_status <> 'VERIFIED'
    or captain_row.approved_at is null
    or captain_row.availability_status = 'SUSPENDED'
  then
    raise exception using
      errcode = 'P0041',
      message = 'captain is not operationally eligible';
  end if;

  if p_active_delivery_task_id is not null then
    perform 1
    from public.delivery_tasks task
    where task.id = p_active_delivery_task_id
      and task.assigned_captain_id = p_actor
      and task.task_type = 'FORWARD_DELIVERY'
      and task.status in ('ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROP');

    if not found then
      raise exception using
        errcode = 'P0042',
        message = 'delivery task is not active for captain';
    end if;
  elsif captain_row.availability_status in ('ASSIGNED', 'AT_PICKUP', 'DELIVERING') then
    raise exception using
      errcode = 'P0042',
      message = 'active delivery task identifier is required';
  end if;

  location_value := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
  )::extensions.geography;

  select *
  into current_row
  from public.captain_current_locations location
  where location.captain_id = p_actor
  for update;

  if current_row.captain_id is not null then
    if p_recorded_at <= current_row.recorded_at then
      raise exception using
        errcode = 'P0043',
        message = 'captain location sample is stale';
    end if;

    if received_at < current_row.updated_at + interval '5 seconds' then
      raise exception using
        errcode = 'P0044',
        message = 'captain location update is rate limited';
    end if;
  end if;

  select *
  into latest_history
  from public.captain_location_history history
  where history.captain_id = p_actor
  order by history.recorded_at desc, history.id desc
  limit 1;

  if latest_history.id is null then
    history_sampled := true;
  else
    moved_meters := extensions.st_distance(latest_history.location, location_value);
    history_sampled := p_recorded_at >= latest_history.recorded_at + interval '30 seconds'
      or moved_meters >= 100
      or latest_history.delivery_task_id is distinct from p_active_delivery_task_id;
  end if;

  insert into public.captain_current_locations (
    captain_id,
    location,
    heading,
    speed_mps,
    accuracy_meters,
    battery_percent,
    active_delivery_task_id,
    recorded_at,
    sample_id,
    updated_at
  )
  values (
    p_actor,
    location_value,
    p_heading,
    p_speed_mps,
    p_accuracy_meters,
    p_battery_percent,
    p_active_delivery_task_id,
    p_recorded_at,
    p_sample_id,
    received_at
  )
  on conflict (captain_id)
  do update set
    location = excluded.location,
    heading = excluded.heading,
    speed_mps = excluded.speed_mps,
    accuracy_meters = excluded.accuracy_meters,
    battery_percent = excluded.battery_percent,
    active_delivery_task_id = excluded.active_delivery_task_id,
    recorded_at = excluded.recorded_at,
    sample_id = excluded.sample_id,
    updated_at = excluded.updated_at
  returning * into current_row;

  if history_sampled then
    insert into public.captain_location_history (
      captain_id,
      delivery_task_id,
      location,
      heading,
      speed_mps,
      accuracy_meters,
      recorded_at,
      received_at
    )
    values (
      p_actor,
      p_active_delivery_task_id,
      location_value,
      p_heading,
      p_speed_mps,
      p_accuracy_meters,
      p_recorded_at,
      greatest(received_at, p_recorded_at)
    );
  end if;

  result_json := jsonb_build_object(
    'captainId', p_actor,
    'sampleId', p_sample_id,
    'recordedAt', current_row.recorded_at,
    'acceptedAt', current_row.updated_at,
    'accuracyMeters', current_row.accuracy_meters,
    'activeDeliveryTaskId', current_row.active_delivery_task_id,
    'historySampled', history_sampled,
    'replayed', false
  );

  update private.captain_location_update_receipts receipt
  set
    result_payload = result_json,
    completed_at = received_at
  where receipt.captain_id = p_actor
    and receipt.sample_id = p_sample_id;

  return result_json;
exception
  when no_data_found then
    raise exception using
      errcode = 'P0041',
      message = 'captain is not operationally eligible';
end;
$$;

comment on function public.update_captain_current_location(
  uuid,
  uuid,
  double precision,
  double precision,
  numeric,
  timestamptz,
  numeric,
  numeric,
  smallint,
  uuid
) is
  'S8-02 service-role captain GPS upsert with sample dedupe, stale protection, rate limiting, and bounded history.';

revoke all
on function public.set_captain_availability(
  uuid,
  public.captain_availability_status
)
from public, anon, authenticated;

grant execute
on function public.set_captain_availability(
  uuid,
  public.captain_availability_status
)
to service_role;

revoke all
on function public.update_captain_current_location(
  uuid,
  uuid,
  double precision,
  double precision,
  numeric,
  timestamptz,
  numeric,
  numeric,
  smallint,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.update_captain_current_location(
  uuid,
  uuid,
  double precision,
  double precision,
  numeric,
  timestamptz,
  numeric,
  numeric,
  smallint,
  uuid
)
to service_role;
