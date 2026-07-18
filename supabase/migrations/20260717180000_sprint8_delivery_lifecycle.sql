-- Sprint 8 S8-03 through S8-10: forward COD delivery lifecycle.
-- All mutation functions are service-role only. Mobile clients never receive direct table grants.

alter table public.delivery_tasks
  add column if not exists arrived_pickup_at timestamptz,
  add column if not exists pickup_verified_at timestamptz,
  add column if not exists departed_pickup_at timestamptz,
  add column if not exists arrived_drop_at timestamptz,
  add column if not exists pickup_code_expires_at timestamptz,
  add column if not exists delivery_otp_expires_at timestamptz,
  add column if not exists pickup_code_attempts smallint not null default 0,
  add column if not exists delivery_otp_attempts smallint not null default 0,
  add column if not exists offer_wave_number integer not null default 0,
  add column if not exists offer_radius_meters integer not null default 0,
  add column if not exists next_offer_wave_at timestamptz,
  add column if not exists problem_reported_at timestamptz;

alter table public.delivery_tasks
  drop constraint if exists delivery_tasks_s8_attempts_check;
alter table public.delivery_tasks
  add constraint delivery_tasks_s8_attempts_check
  check (
    pickup_code_attempts between 0 and 5
    and delivery_otp_attempts between 0 and 5
    and offer_wave_number >= 0
    and offer_radius_meters >= 0
  );

create unique index if not exists delivery_assignments_one_active_captain_idx
on public.delivery_assignments (captain_id)
where assignment_status = 'ACCEPTED';

create index if not exists delivery_tasks_offer_wave_due_idx
on public.delivery_tasks (next_offer_wave_at, id)
where task_type = 'FORWARD_DELIVERY'
  and status in ('SEARCHING', 'OFFERED');

create table if not exists private.delivery_command_receipts (
  actor_id uuid not null,
  http_method text not null,
  route_template text not null,
  resource_id uuid not null,
  idempotency_key uuid not null,
  request_payload jsonb not null,
  result_payload jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (actor_id, http_method, route_template, resource_id, idempotency_key),
  constraint delivery_command_receipts_payload_object
    check (jsonb_typeof(request_payload) = 'object'),
  constraint delivery_command_receipts_result_object
    check (result_payload is null or jsonb_typeof(result_payload) = 'object'),
  constraint delivery_command_receipts_completion
    check ((completed_at is null) = (result_payload is null))
);

revoke all on table private.delivery_command_receipts from public, anon, authenticated;
grant select, insert, update on table private.delivery_command_receipts to service_role;

create or replace function private.claim_delivery_command(
  p_actor uuid,
  p_method text,
  p_route text,
  p_resource uuid,
  p_key uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_key uuid;
  receipt private.delivery_command_receipts;
begin
  if p_actor is null or p_resource is null or p_key is null
    or p_method is null or p_route is null
    or jsonb_typeof(p_payload) is distinct from 'object'
  then
    raise exception using errcode = 'P0050', message = 'delivery request invalid';
  end if;

  insert into private.delivery_command_receipts(
    actor_id, http_method, route_template, resource_id, idempotency_key, request_payload
  ) values (p_actor, p_method, p_route, p_resource, p_key, p_payload)
  on conflict do nothing
  returning idempotency_key into inserted_key;

  select * into strict receipt
  from private.delivery_command_receipts r
  where r.actor_id = p_actor
    and r.http_method = p_method
    and r.route_template = p_route
    and r.resource_id = p_resource
    and r.idempotency_key = p_key
  for update;

  if receipt.request_payload <> p_payload then
    raise exception using errcode = 'P0057', message = 'idempotency key reused';
  end if;

  if inserted_key is null then
    if receipt.completed_at is null or receipt.result_payload is null then
      raise exception using errcode = 'P0054', message = 'delivery command already in progress';
    end if;
    return receipt.result_payload || jsonb_build_object('replayed', true);
  end if;

  return null;
end;
$$;

create or replace function private.complete_delivery_command(
  p_actor uuid,
  p_method text,
  p_route text,
  p_resource uuid,
  p_key uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.delivery_command_receipts r
  set result_payload = p_result || jsonb_build_object('replayed', false),
      completed_at = transaction_timestamp()
  where r.actor_id = p_actor
    and r.http_method = p_method
    and r.route_template = p_route
    and r.resource_id = p_resource
    and r.idempotency_key = p_key;

  if not found then
    raise exception using errcode = 'P0054', message = 'delivery receipt missing';
  end if;
  return p_result || jsonb_build_object('replayed', false);
end;
$$;

create or replace function private.assert_delivery_actor(
  p_actor uuid,
  p_account_type public.account_type
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor and p.account_type = p_account_type and p.status = 'ACTIVE'
  ) then
    raise exception using errcode = 'P0051', message = 'delivery access denied';
  end if;
end;
$$;

create or replace function private.delivery_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy numeric,
  p_recorded_at timestamptz
)
returns extensions.geography
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_latitude is null or p_longitude is null or p_accuracy is null or p_recorded_at is null
    or p_latitude < -90 or p_latitude > 90
    or p_longitude < -180 or p_longitude > 180
    or p_accuracy < 0
    or p_recorded_at > now() + interval '30 seconds'
  then
    raise exception using errcode = 'P0050', message = 'delivery location invalid';
  end if;
  return extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
end;
$$;

create or replace function private.record_delivery_location(
  p_actor uuid,
  p_task uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy numeric,
  p_recorded_at timestamptz
)
returns extensions.geography
language plpgsql
security definer
set search_path = ''
as $$
declare
  point extensions.geography;
  received_at timestamptz := transaction_timestamp();
begin
  point := private.delivery_location(p_latitude, p_longitude, p_accuracy, p_recorded_at);

  insert into public.captain_current_locations(
    captain_id,
    location,
    accuracy_meters,
    recorded_at,
    active_delivery_task_id,
    updated_at
  )
  values (p_actor, point, p_accuracy, p_recorded_at, p_task, received_at)
  on conflict (captain_id) do update
  set location = case
        when excluded.recorded_at >= public.captain_current_locations.recorded_at
          then excluded.location
        else public.captain_current_locations.location
      end,
      accuracy_meters = case
        when excluded.recorded_at >= public.captain_current_locations.recorded_at
          then excluded.accuracy_meters
        else public.captain_current_locations.accuracy_meters
      end,
      recorded_at = greatest(
        public.captain_current_locations.recorded_at,
        excluded.recorded_at
      ),
      active_delivery_task_id = p_task,
      updated_at = received_at;

  insert into public.captain_location_history(
    captain_id,
    delivery_task_id,
    location,
    accuracy_meters,
    recorded_at,
    received_at
  )
  values (p_actor, p_task, point, p_accuracy, p_recorded_at, received_at);

  return point;
end;
$$;

create or replace function private.captain_delivery_snapshot(
  p_task_id uuid,
  p_captain_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'taskId', task.id,
    'orderId', ordered.id,
    'orderNumber', ordered.order_number,
    'taskStatus', task.status,
    'orderStatus', ordered.status,
    'assignmentId', assignment.id,
    'assignmentStatus', assignment.assignment_status,
    'offeredEarningPaise', assignment.offered_earning_paise,
    'pickupDistanceMeters', assignment.pickup_distance_meters,
    'offeredAt', assignment.offered_at,
    'expiresAt', assignment.expires_at,
    'assignedAt', task.assigned_at,
    'pickup', jsonb_build_object(
      'label', task.pickup_address_snapshot->>'label',
      'recipientName', coalesce(task.pickup_address_snapshot->>'shopName', shop.name),
      'phoneNumber', coalesce(task.pickup_address_snapshot->>'phoneNumber', shop.phone_number),
      'line1', coalesce(task.pickup_address_snapshot->>'line1', ''),
      'line2', task.pickup_address_snapshot->>'line2',
      'landmark', task.pickup_address_snapshot->>'landmark',
      'area', coalesce(task.pickup_address_snapshot->>'area', ''),
      'city', coalesce(task.pickup_address_snapshot->>'city', ''),
      'state', coalesce(task.pickup_address_snapshot->>'state', ''),
      'postalCode', coalesce(task.pickup_address_snapshot->>'postalCode', ''),
      'countryCode', coalesce(task.pickup_address_snapshot->>'countryCode', 'IN'),
      'location', jsonb_build_object(
        'latitude', extensions.st_y(task.pickup_location::extensions.geometry),
        'longitude', extensions.st_x(task.pickup_location::extensions.geometry)
      )
    ),
    'drop', jsonb_build_object(
      'label', task.drop_address_snapshot->>'label',
      'recipientName', task.drop_address_snapshot->>'recipientName',
      'phoneNumber', task.drop_address_snapshot->>'phoneNumber',
      'line1', coalesce(task.drop_address_snapshot->>'line1', ''),
      'line2', task.drop_address_snapshot->>'line2',
      'landmark', task.drop_address_snapshot->>'landmark',
      'area', coalesce(task.drop_address_snapshot->>'area', ''),
      'city', coalesce(task.drop_address_snapshot->>'city', ''),
      'state', coalesce(task.drop_address_snapshot->>'state', ''),
      'postalCode', coalesce(task.drop_address_snapshot->>'postalCode', ''),
      'countryCode', coalesce(task.drop_address_snapshot->>'countryCode', 'IN'),
      'location', jsonb_build_object(
        'latitude', extensions.st_y(task.drop_location::extensions.geometry),
        'longitude', extensions.st_x(task.drop_location::extensions.geometry)
      )
    ),
    'totalPaise', ordered.total_paise,
    'paymentStatus', ordered.payment_status,
    'replayed', false
  ) into result
  from public.delivery_tasks task
  join public.orders ordered on ordered.id = task.order_id
  join public.shops shop on shop.id = task.pickup_shop_id
  join lateral (
    select a.* from public.delivery_assignments a
    where a.delivery_task_id = task.id
      and a.captain_id = p_captain_id
      and a.assignment_status in ('OFFERED', 'ACCEPTED')
    order by case when a.assignment_status = 'ACCEPTED' then 0 else 1 end, a.created_at desc
    limit 1
  ) assignment on true
  where task.id = p_task_id;

  return result;
end;
$$;

create or replace function public.list_captain_delivery_offers(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  return coalesce((
    select jsonb_agg(private.captain_delivery_snapshot(a.delivery_task_id, p_actor) order by a.expires_at)
    from public.delivery_assignments a
    join public.delivery_tasks t on t.id = a.delivery_task_id
    where a.captain_id = p_actor
      and a.assignment_status = 'OFFERED'
      and a.expires_at > transaction_timestamp()
      and t.status = 'OFFERED'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_captain_active_delivery(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare task_id uuid;
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  select t.id into task_id
  from public.delivery_tasks t
  join public.delivery_assignments a on a.delivery_task_id = t.id
  where a.captain_id = p_actor and a.assignment_status = 'ACCEPTED'
    and t.status in ('ASSIGNED','AT_PICKUP','PICKED_UP','IN_TRANSIT','AT_DROP')
  order by t.assigned_at desc limit 1;
  if task_id is null then return null; end if;
  return private.captain_delivery_snapshot(task_id, p_actor);
end;
$$;

create or replace function public.get_captain_delivery(p_actor uuid, p_delivery_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  result := private.captain_delivery_snapshot(p_delivery_task_id, p_actor);
  return result;
end;
$$;

create or replace function public.issue_merchant_pickup_code(p_actor uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.delivery_tasks;
  ordered public.orders;
  secret text;
  issued_at timestamptz := transaction_timestamp();
begin
  perform private.assert_delivery_actor(p_actor, 'MERCHANT');
  select * into strict ordered from public.orders o where o.id = p_order_id;
  if not exists (select 1 from public.shops s where s.id = ordered.shop_id and s.merchant_id = p_actor) then
    raise exception using errcode = 'P0051', message = 'delivery access denied';
  end if;
  select * into strict task from public.delivery_tasks t
  where t.order_id = p_order_id and t.task_type = 'FORWARD_DELIVERY'
    and t.status in ('ASSIGNED','AT_PICKUP') for update;

  secret := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0');
  update public.delivery_tasks
  set pickup_code_hash = extensions.crypt(secret, extensions.gen_salt('bf')),
      pickup_code_expires_at = issued_at + interval '30 minutes',
      pickup_code_attempts = 0
  where id = task.id;

  return jsonb_build_object(
    'orderId', ordered.id, 'deliveryTaskId', task.id, 'kind', 'PICKUP_CODE',
    'secret', secret, 'issuedAt', issued_at, 'expiresAt', issued_at + interval '30 minutes'
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.issue_customer_delivery_otp(p_actor uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  task public.delivery_tasks;
  ordered public.orders;
  secret text;
  issued_at timestamptz := transaction_timestamp();
begin
  perform private.assert_delivery_actor(p_actor, 'CUSTOMER');
  select * into strict ordered from public.orders o where o.id = p_order_id and o.customer_id = p_actor;
  select * into strict task from public.delivery_tasks t
  where t.order_id = p_order_id and t.task_type = 'FORWARD_DELIVERY'
    and t.status in ('PICKED_UP','IN_TRANSIT','AT_DROP') for update;

  secret := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0');
  update public.delivery_tasks
  set delivery_otp_hash = extensions.crypt(secret, extensions.gen_salt('bf')),
      delivery_otp_expires_at = issued_at + interval '2 hours',
      delivery_otp_attempts = 0
  where id = task.id;

  return jsonb_build_object(
    'orderId', ordered.id, 'deliveryTaskId', task.id, 'kind', 'DELIVERY_OTP',
    'secret', secret, 'issuedAt', issued_at, 'expiresAt', issued_at + interval '2 hours'
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.respond_delivery_offer(
  p_actor uuid,
  p_assignment_id uuid,
  p_action text,
  p_rejection_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  assignment public.delivery_assignments;
  task public.delivery_tasks;
  ordered public.orders;
  task_id uuid;
  order_id uuid;
  result jsonb;
  now_at timestamptz := transaction_timestamp();
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  if p_action not in ('ACCEPT', 'REJECT')
    or (
      p_action = 'REJECT'
      and p_rejection_reason not in (
        'TOO_FAR',
        'VEHICLE_ISSUE',
        'SHIFT_ENDING',
        'LOW_BATTERY',
        'OTHER'
      )
    )
    or (p_action = 'ACCEPT' and p_rejection_reason is not null)
  then
    raise exception using
      errcode = 'P0050',
      message = 'delivery offer response invalid';
  end if;

  replay := private.claim_delivery_command(
    p_actor,
    'POST',
    '/captain/delivery-offers/{assignmentId}/' || lower(p_action),
    p_assignment_id,
    p_idempotency_key,
    jsonb_build_object('action', p_action, 'reason', p_rejection_reason)
  );
  if replay is not null then
    return replay;
  end if;

  select candidate.delivery_task_id
  into task_id
  from public.delivery_assignments candidate
  where candidate.id = p_assignment_id;

  if task_id is null then
    raise exception using
      errcode = 'P0053',
      message = 'delivery offer not found';
  end if;

  select candidate.order_id
  into order_id
  from public.delivery_tasks candidate
  where candidate.id = task_id;

  if order_id is null then
    raise exception using
      errcode = 'P0053',
      message = 'delivery offer not found';
  end if;

  -- Canonical lock order: order, task, assignments, captain.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  select *
  into strict assignment
  from public.delivery_assignments candidate
  where candidate.id = p_assignment_id;

  perform 1
  from public.captain_profiles candidate
  where candidate.user_id = p_actor
  for update;

  if assignment.captain_id <> p_actor then
    raise exception using
      errcode = 'P0053',
      message = 'delivery offer not found';
  end if;

  if assignment.assignment_status <> 'OFFERED' then
    raise exception using
      errcode = 'P0054',
      message = 'delivery offer is not open';
  end if;

  if assignment.expires_at <= now_at then
    update public.delivery_assignments
    set assignment_status = 'TIMED_OUT',
        responded_at = now_at
    where id = assignment.id;

    perform private.enqueue_outbox_event(
      'delivery.offer.expired',
      'DELIVERY_TASK',
      task.id,
      jsonb_build_object(
        'deliveryTaskId', task.id,
        'assignmentId', assignment.id,
        'captainId', p_actor,
        'expiredAt', now_at
      ),
      now_at,
      now_at
    );

    if not exists (
      select 1
      from public.delivery_assignments candidate
      where candidate.delivery_task_id = task.id
        and candidate.assignment_status = 'OFFERED'
        and candidate.expires_at > now_at
    ) then
      update public.delivery_tasks
      set status = 'SEARCHING',
          next_offer_wave_at = now_at,
          updated_at = now_at
      where id = task.id
        and status = 'OFFERED';
    end if;

    if not exists (
      select 1
      from public.delivery_assignments candidate
      where candidate.captain_id = p_actor
        and candidate.assignment_status in ('OFFERED', 'ACCEPTED')
        and (
          candidate.assignment_status = 'ACCEPTED'
          or candidate.expires_at > now_at
        )
    ) then
      update public.captain_profiles
      set availability_status = 'AVAILABLE',
          updated_at = now_at
      where user_id = p_actor
        and availability_status = 'OFFERED';
    end if;

    result := jsonb_build_object('outcome', 'EXPIRED');
    return private.complete_delivery_command(
      p_actor,
      'POST',
      '/captain/delivery-offers/{assignmentId}/' || lower(p_action),
      p_assignment_id,
      p_idempotency_key,
      result
    );
  end if;

  if p_action = 'REJECT' then
    update public.delivery_assignments
    set assignment_status = 'REJECTED',
        responded_at = now_at,
        rejection_reason = p_rejection_reason
    where id = assignment.id;

    if not exists (
      select 1
      from public.delivery_assignments candidate
      where candidate.delivery_task_id = task.id
        and candidate.assignment_status = 'OFFERED'
        and candidate.expires_at > now_at
    ) then
      update public.delivery_tasks
      set status = 'SEARCHING',
          next_offer_wave_at = now_at,
          updated_at = now_at
      where id = task.id
        and status = 'OFFERED';
    end if;

    if not exists (
      select 1
      from public.delivery_assignments candidate
      where candidate.captain_id = p_actor
        and candidate.assignment_status in ('OFFERED', 'ACCEPTED')
        and (
          candidate.assignment_status = 'ACCEPTED'
          or candidate.expires_at > now_at
        )
    ) then
      update public.captain_profiles
      set availability_status = 'AVAILABLE',
          updated_at = now_at
      where user_id = p_actor
        and availability_status = 'OFFERED';
    end if;

    perform private.enqueue_outbox_event(
      'delivery.offer.rejected',
      'DELIVERY_TASK',
      task.id,
      jsonb_build_object(
        'deliveryTaskId', task.id,
        'assignmentId', assignment.id,
        'captainId', p_actor,
        'reason', p_rejection_reason,
        'respondedAt', now_at
      ),
      now_at,
      now_at
    );

    result := jsonb_build_object(
      'outcome', 'REJECTED',
      'rejection', jsonb_build_object(
        'assignmentId', assignment.id,
        'deliveryTaskId', task.id,
        'assignmentStatus', 'REJECTED',
        'reason', p_rejection_reason,
        'respondedAt', now_at,
        'replayed', false
      )
    );
  else
    if exists (
      select 1
      from public.delivery_assignments candidate
      where candidate.delivery_task_id = task.id
        and candidate.assignment_status = 'ACCEPTED'
    ) then
      raise exception using
        errcode = 'P0055',
        message = 'delivery task already assigned';
    end if;

    if exists (
      select 1
      from public.delivery_assignments candidate
      join public.delivery_tasks other_task
        on other_task.id = candidate.delivery_task_id
      where candidate.captain_id = p_actor
        and candidate.assignment_status = 'ACCEPTED'
        and other_task.status not in ('COMPLETED', 'FAILED', 'CANCELLED')
    ) then
      raise exception using
        errcode = 'P0056',
        message = 'captain already assigned';
    end if;

    -- An offered captain is no longer marked AVAILABLE, so acceptance checks the
    -- immutable readiness components instead of the aggregate dispatch_eligible flag.
    if not exists (
      select 1
      from private.captain_dispatch_readiness readiness
      where readiness.captain_id = p_actor
        and readiness.profile_active
        and readiness.captain_approved
        and readiness.location_fresh
        and readiness.location_accurate
        and readiness.device_ready
        and readiness.no_active_task
        and readiness.active_delivery_task_id is null
        and readiness.availability_status in ('AVAILABLE', 'OFFERED')
    ) then
      raise exception using
        errcode = 'P0060',
        message = 'captain not eligible';
    end if;

    update public.delivery_assignments
    set assignment_status = 'ACCEPTED',
        responded_at = now_at
    where id = assignment.id;

    update public.delivery_assignments
    set assignment_status = 'CANCELLED',
        responded_at = now_at
    where delivery_task_id = task.id
      and id <> assignment.id
      and assignment_status = 'OFFERED';

    update public.delivery_tasks
    set status = 'ASSIGNED',
        assigned_captain_id = p_actor,
        assigned_at = now_at,
        next_offer_wave_at = null,
        updated_at = now_at
    where id = task.id;

    update public.captain_profiles
    set availability_status = 'ASSIGNED',
        updated_at = now_at
    where user_id = p_actor;

    update public.captain_current_locations
    set active_delivery_task_id = task.id,
        updated_at = now_at
    where captain_id = p_actor;

    perform private.transition_order_state(
      ordered.id,
      'CAPTAIN_ASSIGNED',
      p_actor,
      'CAPTAIN',
      null,
      null
    );

    insert into public.delivery_events(
      delivery_task_id,
      event_type,
      actor_user_id,
      metadata
    )
    values (
      task.id,
      'CAPTAIN_ASSIGNED',
      p_actor,
      jsonb_build_object('assignmentId', assignment.id)
    );

    perform private.enqueue_outbox_event(
      'delivery.offer.accepted',
      'DELIVERY_TASK',
      task.id,
      jsonb_build_object(
        'deliveryTaskId', task.id,
        'assignmentId', assignment.id,
        'captainId', p_actor,
        'acceptedAt', now_at
      ),
      now_at,
      now_at
    );

    perform private.enqueue_outbox_event(
      'delivery.task.assigned',
      'DELIVERY_TASK',
      task.id,
      jsonb_build_object(
        'deliveryTaskId', task.id,
        'orderId', ordered.id,
        'captainId', p_actor,
        'assignedAt', now_at
      ),
      now_at,
      now_at
    );

    result := jsonb_build_object(
      'outcome', 'ACCEPTED',
      'delivery', private.captain_delivery_snapshot(task.id, p_actor)
    );
  end if;

  return private.complete_delivery_command(
    p_actor,
    'POST',
    '/captain/delivery-offers/{assignmentId}/' || lower(p_action),
    p_assignment_id,
    p_idempotency_key,
    result
  );
exception
  when no_data_found then
    raise exception using
      errcode = 'P0053',
      message = 'delivery offer not found';
end;
$$;

create or replace function public.admin_assign_delivery_task(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_captain_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  captain public.captain_profiles;
  order_id uuid;
  assignment_id uuid;
  now_at timestamptz := transaction_timestamp();
  result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'ADMIN');
  perform private.assert_delivery_actor(p_captain_id, 'CAPTAIN');

  replay := private.claim_delivery_command(
    p_actor,
    'POST',
    '/admin/delivery-tasks/{taskId}/assign',
    p_delivery_task_id,
    p_idempotency_key,
    jsonb_build_object('captainId', p_captain_id)
  );
  if replay is not null then
    return replay;
  end if;

  select candidate.order_id
  into order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  if order_id is null then
    raise exception using
      errcode = 'P0052',
      message = 'delivery task not found';
  end if;

  -- Canonical lock order: order, task, assignments, captain.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  select *
  into strict captain
  from public.captain_profiles candidate
  where candidate.user_id = p_captain_id
  for update;

  if task.status not in ('SEARCHING', 'OFFERED')
    or ordered.status <> 'CAPTAIN_SEARCHING'
  then
    raise exception using
      errcode = 'P0054',
      message = 'delivery state conflict';
  end if;

  if exists (
    select 1
    from public.delivery_assignments candidate
    where candidate.delivery_task_id = task.id
      and candidate.assignment_status = 'ACCEPTED'
  ) then
    raise exception using
      errcode = 'P0055',
      message = 'delivery task already assigned';
  end if;

  if exists (
    select 1
    from public.delivery_assignments candidate
    join public.delivery_tasks other_task
      on other_task.id = candidate.delivery_task_id
    where candidate.captain_id = p_captain_id
      and candidate.assignment_status = 'ACCEPTED'
      and other_task.status not in ('COMPLETED', 'FAILED', 'CANCELLED')
  ) then
    raise exception using
      errcode = 'P0056',
      message = 'captain already assigned';
  end if;

  if captain.kyc_status <> 'VERIFIED'
    or captain.approved_at is null
    or captain.availability_status not in ('AVAILABLE', 'OFFERED')
  then
    raise exception using
      errcode = 'P0060',
      message = 'captain not eligible';
  end if;

  update public.delivery_assignments
  set assignment_status = 'CANCELLED',
      responded_at = now_at
  where delivery_task_id = task.id
    and assignment_status = 'OFFERED';

  insert into public.delivery_assignments(
    delivery_task_id,
    captain_id,
    assignment_status,
    offered_earning_paise,
    offered_at,
    expires_at,
    responded_at,
    assigned_by,
    assigned_by_user_id
  )
  values (
    task.id,
    p_captain_id,
    'ACCEPTED',
    task.captain_earning_paise,
    now_at,
    now_at + interval '30 seconds',
    now_at,
    'ADMIN',
    p_actor
  )
  returning id into assignment_id;

  update public.delivery_tasks
  set status = 'ASSIGNED',
      assigned_captain_id = p_captain_id,
      assigned_at = now_at,
      next_offer_wave_at = null,
      updated_at = now_at
  where id = task.id;

  update public.captain_profiles
  set availability_status = 'ASSIGNED',
      updated_at = now_at
  where user_id = p_captain_id;

  update public.captain_current_locations
  set active_delivery_task_id = task.id,
      updated_at = now_at
  where captain_id = p_captain_id;

  perform private.transition_order_state(
    ordered.id,
    'CAPTAIN_ASSIGNED',
    p_actor,
    'ADMIN',
    null,
    'Manual assignment'
  );

  insert into public.delivery_events(
    delivery_task_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    task.id,
    'CAPTAIN_ASSIGNED',
    p_actor,
    jsonb_build_object(
      'assignmentId', assignment_id,
      'captainId', p_captain_id,
      'assignedBy', 'ADMIN'
    )
  );

  perform private.enqueue_outbox_event(
    'delivery.task.assigned',
    'DELIVERY_TASK',
    task.id,
    jsonb_build_object(
      'deliveryTaskId', task.id,
      'orderId', ordered.id,
      'assignmentId', assignment_id,
      'captainId', p_captain_id,
      'assignedBy', 'ADMIN',
      'assignedAt', now_at
    ),
    now_at,
    now_at
  );

  result := private.captain_delivery_snapshot(task.id, p_captain_id);
  return private.complete_delivery_command(
    p_actor,
    'POST',
    '/admin/delivery-tasks/{taskId}/assign',
    p_delivery_task_id,
    p_idempotency_key,
    result
  );
exception
  when no_data_found then
    raise exception using
      errcode = 'P0052',
      message = 'delivery task not found';
end;
$$;

create or replace function public.arrive_delivery_pickup(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_idempotency_key uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters numeric,
  p_recorded_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  order_id uuid;
  point extensions.geography;
  now_at timestamptz := transaction_timestamp();
  result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  replay := private.claim_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/arrive-pickup', p_delivery_task_id,
    p_idempotency_key,
    jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude,
      'accuracyMeters', p_accuracy_meters, 'recordedAt', p_recorded_at)
  );
  if replay is not null then return replay; end if;

  select candidate.order_id
  into strict order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  -- Canonical lock order: order, task, assignments.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
    and candidate.captain_id = p_actor
    and candidate.assignment_status = 'ACCEPTED';

  if not found then
    raise exception using
      errcode = 'P0051',
      message = 'delivery access denied';
  end if;

  perform 1
  from public.captain_profiles candidate
  where candidate.user_id = p_actor
  for update;
  if task.status <> 'ASSIGNED' or ordered.status <> 'CAPTAIN_ASSIGNED' then
    raise exception using errcode = 'P0054', message = 'delivery state conflict';
  end if;

  point := private.record_delivery_location(
    p_actor, task.id, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at
  );
  if extensions.st_distance(point, task.pickup_location) > 200 then
    raise exception using errcode = 'P0059', message = 'captain not at pickup';
  end if;

  update public.delivery_tasks
  set status = 'AT_PICKUP', arrived_pickup_at = now_at, updated_at = now_at
  where id = task.id;
  update public.captain_profiles
  set availability_status = 'AT_PICKUP', updated_at = now_at where user_id = p_actor;
  perform private.transition_order_state(ordered.id, 'CAPTAIN_AT_STORE', p_actor, 'CAPTAIN', null, null);
  insert into public.delivery_events(delivery_task_id, event_type, actor_user_id, location)
  values (task.id, 'ARRIVED_AT_STORE', p_actor, point);
  perform private.enqueue_outbox_event(
    'delivery.task.arrived_pickup', 'DELIVERY_TASK', task.id,
    jsonb_build_object('deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', p_actor, 'arrivedAt', now_at), now_at, now_at
  );

  result := private.captain_delivery_snapshot(task.id, p_actor);
  return private.complete_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/arrive-pickup', p_delivery_task_id,
    p_idempotency_key, result
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.verify_delivery_pickup(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_pickup_code text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  order_id uuid;
  now_at timestamptz := transaction_timestamp();
  result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  if p_pickup_code is null or p_pickup_code !~ '^\d{6}$' then
    raise exception using errcode = 'P0050', message = 'pickup code invalid';
  end if;
  replay := private.claim_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/verify-pickup', p_delivery_task_id,
    p_idempotency_key, jsonb_build_object('pickupCodeHash', encode(extensions.digest(p_pickup_code, 'sha256'), 'hex'))
  );
  if replay is not null then return replay; end if;

  select candidate.order_id
  into strict order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  -- Canonical lock order: order, task, assignments.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
    and candidate.captain_id = p_actor
    and candidate.assignment_status = 'ACCEPTED';

  if not found then
    raise exception using
      errcode = 'P0051',
      message = 'delivery access denied';
  end if;

  perform 1
  from public.captain_profiles candidate
  where candidate.user_id = p_actor
  for update;
  if task.status <> 'AT_PICKUP' or ordered.status <> 'CAPTAIN_AT_STORE' then
    raise exception using errcode = 'P0054', message = 'delivery state conflict';
  end if;
  if task.pickup_code_attempts >= 5 then
    result := jsonb_build_object('outcome', 'LOCKED');
    return private.complete_delivery_command(
      p_actor, 'POST', '/captain/deliveries/{taskId}/verify-pickup', p_delivery_task_id,
      p_idempotency_key, result
    );
  end if;
  if task.pickup_code_hash is null or task.pickup_code_expires_at is null
    or task.pickup_code_expires_at <= now_at
    or extensions.crypt(p_pickup_code, task.pickup_code_hash) <> task.pickup_code_hash
  then
    update public.delivery_tasks
    set pickup_code_attempts = pickup_code_attempts + 1, updated_at = now_at
    where id = task.id;
    result := jsonb_build_object(
      'outcome', 'INVALID',
      'attemptsRemaining', greatest(0, 5 - (task.pickup_code_attempts + 1))
    );
    return private.complete_delivery_command(
      p_actor, 'POST', '/captain/deliveries/{taskId}/verify-pickup', p_delivery_task_id,
      p_idempotency_key, result
    );
  end if;

  update public.delivery_tasks
  set status = 'PICKED_UP', picked_up_at = now_at, pickup_verified_at = now_at,
      pickup_code_hash = null, pickup_code_expires_at = null, updated_at = now_at
  where id = task.id;
  update public.captain_profiles
  set availability_status = 'DELIVERING', updated_at = now_at where user_id = p_actor;
  perform private.transition_order_state(ordered.id, 'PICKED_UP', p_actor, 'CAPTAIN', null, null);
  insert into public.delivery_events(delivery_task_id, event_type, actor_user_id)
  values (task.id, 'PICKUP_CONFIRMED', p_actor);
  perform private.enqueue_outbox_event(
    'delivery.task.picked_up', 'DELIVERY_TASK', task.id,
    jsonb_build_object('deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', p_actor, 'pickedUpAt', now_at), now_at, now_at
  );

  result := private.captain_delivery_snapshot(task.id, p_actor);
  return private.complete_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/verify-pickup', p_delivery_task_id,
    p_idempotency_key, result
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.depart_delivery_pickup(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_idempotency_key uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters numeric default null,
  p_recorded_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  order_id uuid;
  now_at timestamptz := transaction_timestamp();
  result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  replay := private.claim_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/depart-pickup', p_delivery_task_id,
    p_idempotency_key, jsonb_build_object('location', case when p_latitude is null then null else
      jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude,
        'accuracyMeters', p_accuracy_meters, 'recordedAt', p_recorded_at) end)
  );
  if replay is not null then return replay; end if;
  select candidate.order_id
  into strict order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  -- Canonical lock order: order, task, assignments.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
    and candidate.captain_id = p_actor
    and candidate.assignment_status = 'ACCEPTED';

  if not found then
    raise exception using
      errcode = 'P0051',
      message = 'delivery access denied';
  end if;
  if task.status <> 'PICKED_UP' or ordered.status <> 'PICKED_UP' then
    raise exception using errcode = 'P0054', message = 'delivery state conflict';
  end if;
  if p_latitude is not null then
    perform private.record_delivery_location(p_actor, task.id, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at);
  end if;
  update public.delivery_tasks set status = 'IN_TRANSIT', departed_pickup_at = now_at, updated_at = now_at where id = task.id;
  perform private.transition_order_state(ordered.id, 'OUT_FOR_DELIVERY', p_actor, 'CAPTAIN', null, null);
  insert into public.delivery_events(delivery_task_id, event_type, actor_user_id) values (task.id, 'LEFT_STORE', p_actor);
  perform private.enqueue_outbox_event(
    'delivery.task.in_transit', 'DELIVERY_TASK', task.id,
    jsonb_build_object('deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', p_actor, 'departedAt', now_at), now_at, now_at
  );
  result := private.captain_delivery_snapshot(task.id, p_actor);
  return private.complete_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/depart-pickup', p_delivery_task_id,
    p_idempotency_key, result
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.arrive_delivery_drop(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_idempotency_key uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters numeric default null,
  p_recorded_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  order_id uuid;
  now_at timestamptz := transaction_timestamp();
  result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  replay := private.claim_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/arrive-drop', p_delivery_task_id,
    p_idempotency_key, jsonb_build_object('location', case when p_latitude is null then null else
      jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude,
        'accuracyMeters', p_accuracy_meters, 'recordedAt', p_recorded_at) end)
  );
  if replay is not null then return replay; end if;
  select candidate.order_id
  into strict order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  -- Canonical lock order: order, task, assignments.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
    and candidate.captain_id = p_actor
    and candidate.assignment_status = 'ACCEPTED';

  if not found then
    raise exception using
      errcode = 'P0051',
      message = 'delivery access denied';
  end if;
  if task.status <> 'IN_TRANSIT' or ordered.status <> 'OUT_FOR_DELIVERY' then
    raise exception using errcode = 'P0054', message = 'delivery state conflict';
  end if;
  if p_latitude is not null then
    perform private.record_delivery_location(p_actor, task.id, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at);
  end if;
  update public.delivery_tasks set status = 'AT_DROP', arrived_drop_at = now_at, updated_at = now_at where id = task.id;
  perform private.transition_order_state(ordered.id, 'CAPTAIN_AT_CUSTOMER', p_actor, 'CAPTAIN', null, null);
  insert into public.delivery_events(delivery_task_id, event_type, actor_user_id) values (task.id, 'ARRIVED_AT_CUSTOMER', p_actor);
  perform private.enqueue_outbox_event(
    'delivery.task.arrived_drop', 'DELIVERY_TASK', task.id,
    jsonb_build_object('deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', p_actor, 'arrivedAt', now_at), now_at, now_at
  );
  result := private.captain_delivery_snapshot(task.id, p_actor);
  return private.complete_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/arrive-drop', p_delivery_task_id,
    p_idempotency_key, result
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.complete_cod_delivery(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_collected_amount_paise bigint,
  p_delivery_otp text,
  p_idempotency_key uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters numeric default null,
  p_recorded_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  assignment public.delivery_assignments;
  captain public.captain_profiles;
  order_id uuid;
  now_at timestamptz := transaction_timestamp();
  result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  if p_collected_amount_paise is null or p_collected_amount_paise < 0
    or p_delivery_otp is null or p_delivery_otp !~ '^\d{6}$'
  then
    raise exception using errcode = 'P0050', message = 'delivery completion invalid';
  end if;
  replay := private.claim_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/complete', p_delivery_task_id,
    p_idempotency_key,
    jsonb_build_object(
      'collectedAmountPaise', p_collected_amount_paise,
      'deliveryOtpHash', encode(extensions.digest(p_delivery_otp, 'sha256'), 'hex'),
      'location', case when p_latitude is null then null else jsonb_build_object(
        'latitude', p_latitude, 'longitude', p_longitude,
        'accuracyMeters', p_accuracy_meters, 'recordedAt', p_recorded_at
      ) end
    )
  );
  if replay is not null then return replay; end if;

  select candidate.order_id
  into strict order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  -- Canonical lock order: order, task, assignments, captain, COD, earnings.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  select *
  into strict assignment
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
    and candidate.captain_id = p_actor
    and candidate.assignment_status = 'ACCEPTED';

  select *
  into strict captain
  from public.captain_profiles candidate
  where candidate.user_id = p_actor
  for update;

  perform 1
  from public.cod_collections candidate
  where candidate.order_id = ordered.id
  for update;

  perform 1
  from public.captain_earnings candidate
  where candidate.delivery_task_id = task.id
  for update;

  if task.status <> 'AT_DROP' or ordered.status <> 'CAPTAIN_AT_CUSTOMER' then
    raise exception using errcode = 'P0054', message = 'delivery state conflict';
  end if;
  if p_collected_amount_paise <> ordered.total_paise then
    raise exception using errcode = 'P0064', message = 'cod amount mismatch';
  end if;
  if ordered.payment_status not in ('COD_PENDING','COD_COLLECTED') then
    raise exception using errcode = 'P0054', message = 'delivery payment state conflict';
  end if;
  if task.delivery_otp_attempts >= 5 then
    result := jsonb_build_object('outcome', 'LOCKED');
    return private.complete_delivery_command(
      p_actor, 'POST', '/captain/deliveries/{taskId}/complete', p_delivery_task_id,
      p_idempotency_key, result
    );
  end if;
  if task.delivery_otp_hash is null or task.delivery_otp_expires_at is null
    or task.delivery_otp_expires_at <= now_at
    or extensions.crypt(p_delivery_otp, task.delivery_otp_hash) <> task.delivery_otp_hash
  then
    update public.delivery_tasks
    set delivery_otp_attempts = delivery_otp_attempts + 1, updated_at = now_at
    where id = task.id;
    result := jsonb_build_object(
      'outcome', 'INVALID',
      'attemptsRemaining', greatest(0, 5 - (task.delivery_otp_attempts + 1))
    );
    return private.complete_delivery_command(
      p_actor, 'POST', '/captain/deliveries/{taskId}/complete', p_delivery_task_id,
      p_idempotency_key, result
    );
  end if;

  if p_latitude is not null then
    perform private.record_delivery_location(p_actor, task.id, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at);
  end if;

  insert into public.cod_collections(
    order_id, delivery_task_id, captain_id, amount_paise, status, collected_at
  ) values (
    ordered.id, task.id, p_actor, p_collected_amount_paise, 'COLLECTED', now_at
  ) on conflict (order_id) do update
    set delivery_task_id = excluded.delivery_task_id,
        captain_id = excluded.captain_id,
        amount_paise = excluded.amount_paise,
        status = 'COLLECTED',
        collected_at = coalesce(public.cod_collections.collected_at, excluded.collected_at);

  update public.orders set payment_status = 'COD_COLLECTED', updated_at = now_at where id = ordered.id;
  update public.delivery_tasks
  set status = 'COMPLETED', completed_at = now_at,
      delivery_otp_hash = null, delivery_otp_expires_at = null, updated_at = now_at
  where id = task.id;
  update public.delivery_assignments
  set assignment_status = 'COMPLETED', responded_at = coalesce(responded_at, now_at)
  where id = assignment.id;
  perform private.transition_order_state(ordered.id, 'DELIVERED', p_actor, 'CAPTAIN', null, null);

  insert into public.captain_earnings(
    captain_id, delivery_task_id, base_fare_paise, total_paise, status
  ) values (
    p_actor, task.id, task.captain_earning_paise, task.captain_earning_paise, 'PENDING'
  ) on conflict (delivery_task_id) do nothing;

  update public.captain_profiles
  set completed_deliveries = completed_deliveries + 1,
      cash_balance_paise = cash_balance_paise + p_collected_amount_paise,
      availability_status = 'AVAILABLE',
      updated_at = now_at
  where user_id = p_actor;
  update public.captain_current_locations
  set active_delivery_task_id = null, updated_at = now_at where captain_id = p_actor;

  insert into public.delivery_events(delivery_task_id, event_type, actor_user_id, metadata)
  values (task.id, 'DELIVERY_CONFIRMED', p_actor,
    jsonb_build_object('collectedAmountPaise', p_collected_amount_paise));
  insert into public.delivery_events(delivery_task_id, event_type, actor_user_id)
  values (task.id, 'TASK_COMPLETED', p_actor);

  perform private.enqueue_outbox_event(
    'delivery.cod.collected', 'DELIVERY_TASK', task.id,
    jsonb_build_object('deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', p_actor, 'amountPaise', p_collected_amount_paise,
      'collectedAt', now_at), now_at, now_at
  );
  perform private.enqueue_outbox_event(
    'delivery.task.completed', 'DELIVERY_TASK', task.id,
    jsonb_build_object('deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', p_actor, 'completedAt', now_at), now_at, now_at
  );

  result := jsonb_build_object(
    'taskId', task.id, 'orderId', ordered.id, 'orderNumber', ordered.order_number,
    'taskStatus', 'COMPLETED', 'orderStatus', 'DELIVERED',
    'paymentStatus', 'COD_COLLECTED', 'collectedAmountPaise', p_collected_amount_paise,
    'captainEarningPaise', task.captain_earning_paise, 'completedAt', now_at,
    'replayed', false
  );
  return private.complete_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/complete', p_delivery_task_id,
    p_idempotency_key, result
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.admin_override_cod_delivery(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_collected_amount_paise bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  assignment public.delivery_assignments;
  order_id uuid;
  now_at timestamptz := transaction_timestamp();
  result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'ADMIN');
  if p_collected_amount_paise is null or p_collected_amount_paise < 0
    or p_reason is null or length(btrim(p_reason)) not between 10 and 500
  then
    raise exception using errcode = 'P0050', message = 'delivery override invalid';
  end if;

  replay := private.claim_delivery_command(
    p_actor, 'POST', '/admin/delivery-tasks/{taskId}/delivery-override', p_delivery_task_id,
    p_idempotency_key,
    jsonb_build_object('collectedAmountPaise', p_collected_amount_paise, 'reason', btrim(p_reason))
  );
  if replay is not null then return replay; end if;

  select candidate.order_id
  into strict order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  -- Canonical lock order: order, task, assignments, captain, COD, earnings.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  select *
  into strict assignment
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
    and candidate.assignment_status = 'ACCEPTED';

  perform 1
  from public.captain_profiles candidate
  where candidate.user_id = assignment.captain_id
  for update;

  perform 1
  from public.cod_collections candidate
  where candidate.order_id = ordered.id
  for update;

  perform 1
  from public.captain_earnings candidate
  where candidate.delivery_task_id = task.id
  for update;

  if task.status <> 'AT_DROP' or ordered.status <> 'CAPTAIN_AT_CUSTOMER' then
    raise exception using errcode = 'P0054', message = 'delivery state conflict';
  end if;
  if p_collected_amount_paise <> ordered.total_paise then
    raise exception using errcode = 'P0064', message = 'cod amount mismatch';
  end if;
  if ordered.payment_status not in ('COD_PENDING','COD_COLLECTED') then
    raise exception using errcode = 'P0054', message = 'delivery payment state conflict';
  end if;

  insert into public.cod_collections(
    order_id, delivery_task_id, captain_id, amount_paise, status, collected_at
  ) values (
    ordered.id, task.id, assignment.captain_id, p_collected_amount_paise, 'COLLECTED', now_at
  ) on conflict (order_id) do update
    set delivery_task_id = excluded.delivery_task_id,
        captain_id = excluded.captain_id,
        amount_paise = excluded.amount_paise,
        status = 'COLLECTED',
        collected_at = coalesce(public.cod_collections.collected_at, excluded.collected_at);

  update public.orders set payment_status = 'COD_COLLECTED', updated_at = now_at where id = ordered.id;
  update public.delivery_tasks
  set status = 'COMPLETED', completed_at = now_at,
      delivery_otp_hash = null, delivery_otp_expires_at = null, updated_at = now_at
  where id = task.id;
  update public.delivery_assignments
  set assignment_status = 'COMPLETED', responded_at = coalesce(responded_at, now_at)
  where id = assignment.id;
  perform private.transition_order_state(
    ordered.id, 'DELIVERED', p_actor, 'ADMIN', 'DELIVERY_OTP_OVERRIDE', btrim(p_reason)
  );

  insert into public.captain_earnings(
    captain_id, delivery_task_id, base_fare_paise, total_paise, status
  ) values (
    assignment.captain_id, task.id, task.captain_earning_paise, task.captain_earning_paise, 'PENDING'
  ) on conflict (delivery_task_id) do nothing;

  update public.captain_profiles
  set completed_deliveries = completed_deliveries + 1,
      cash_balance_paise = cash_balance_paise + p_collected_amount_paise,
      availability_status = 'AVAILABLE',
      updated_at = now_at
  where user_id = assignment.captain_id;
  update public.captain_current_locations
  set active_delivery_task_id = null, updated_at = now_at
  where captain_id = assignment.captain_id;

  insert into public.delivery_events(delivery_task_id, event_type, actor_user_id, note, metadata)
  values (
    task.id, 'DELIVERY_CONFIRMED', p_actor, btrim(p_reason),
    jsonb_build_object(
      'collectedAmountPaise', p_collected_amount_paise,
      'captainId', assignment.captain_id,
      'deliveryOtpOverride', true
    )
  );
  insert into public.delivery_events(delivery_task_id, event_type, actor_user_id, metadata)
  values (
    task.id, 'TASK_COMPLETED', p_actor,
    jsonb_build_object('captainId', assignment.captain_id, 'deliveryOtpOverride', true)
  );

  perform private.enqueue_outbox_event(
    'delivery.cod.collected', 'DELIVERY_TASK', task.id,
    jsonb_build_object(
      'deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', assignment.captain_id, 'amountPaise', p_collected_amount_paise,
      'collectedAt', now_at, 'deliveryOtpOverride', true
    ), now_at, now_at
  );
  perform private.enqueue_outbox_event(
    'delivery.task.completed', 'DELIVERY_TASK', task.id,
    jsonb_build_object(
      'deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', assignment.captain_id, 'completedAt', now_at,
      'deliveryOtpOverride', true
    ), now_at, now_at
  );

  result := jsonb_build_object(
    'taskId', task.id, 'orderId', ordered.id, 'orderNumber', ordered.order_number,
    'taskStatus', 'COMPLETED', 'orderStatus', 'DELIVERED',
    'paymentStatus', 'COD_COLLECTED', 'collectedAmountPaise', p_collected_amount_paise,
    'captainEarningPaise', task.captain_earning_paise, 'completedAt', now_at,
    'replayed', false
  );
  return private.complete_delivery_command(
    p_actor, 'POST', '/admin/delivery-tasks/{taskId}/delivery-override', p_delivery_task_id,
    p_idempotency_key, result
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.report_delivery_problem(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_reason text,
  p_note text,
  p_evidence_object_key text,
  p_idempotency_key uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters numeric default null,
  p_recorded_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  order_id uuid;
  now_at timestamptz := transaction_timestamp();
  result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
  if p_reason not in (
    'CUSTOMER_UNAVAILABLE','INVALID_ADDRESS','CUSTOMER_REFUSED','PACKAGE_DAMAGED',
    'PAYMENT_NOT_AVAILABLE','SAFETY_CONCERN','VEHICLE_ISSUE','OTHER'
  ) then
    raise exception using errcode = 'P0050', message = 'delivery problem invalid';
  end if;
  replay := private.claim_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/report-problem', p_delivery_task_id,
    p_idempotency_key,
    jsonb_build_object('reason', p_reason, 'note', p_note,
      'evidenceObjectKey', p_evidence_object_key,
      'location', case when p_latitude is null then null else jsonb_build_object(
        'latitude', p_latitude, 'longitude', p_longitude,
        'accuracyMeters', p_accuracy_meters, 'recordedAt', p_recorded_at
      ) end)
  );
  if replay is not null then return replay; end if;

  select candidate.order_id
  into strict order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  -- Canonical lock order: order, task, assignments.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
    and candidate.captain_id = p_actor
    and candidate.assignment_status = 'ACCEPTED';

  if not found then
    raise exception using
      errcode = 'P0051',
      message = 'delivery access denied';
  end if;
  if task.status not in ('ASSIGNED','AT_PICKUP','PICKED_UP','IN_TRANSIT','AT_DROP') then
    raise exception using errcode = 'P0054', message = 'delivery state conflict';
  end if;
  if p_latitude is not null then
    perform private.record_delivery_location(p_actor, task.id, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at);
  end if;

  update public.delivery_tasks
  set status = 'FAILED', problem_reported_at = now_at, updated_at = now_at where id = task.id;
  perform private.transition_order_state(ordered.id, 'PROBLEM_REPORTED', p_actor, 'CAPTAIN', p_reason, p_note);
  insert into public.delivery_events(
    delivery_task_id, event_type, actor_user_id, note, evidence_object_key, metadata
  ) values (
    task.id, 'OTHER', p_actor, p_note, p_evidence_object_key,
    jsonb_build_object('reason', p_reason, 'custodyRetained', task.status in ('PICKED_UP','IN_TRANSIT','AT_DROP'))
  );
  perform private.enqueue_outbox_event(
    'delivery.task.problem_reported', 'DELIVERY_TASK', task.id,
    jsonb_build_object('deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', p_actor, 'reason', p_reason, 'reportedAt', now_at), now_at, now_at
  );

  result := jsonb_build_object(
    'taskId', task.id, 'orderId', ordered.id, 'reason', p_reason,
    'note', p_note, 'reportedAt', now_at, 'orderStatus', 'PROBLEM_REPORTED',
    'replayed', false
  );
  return private.complete_delivery_command(
    p_actor, 'POST', '/captain/deliveries/{taskId}/report-problem', p_delivery_task_id,
    p_idempotency_key, result
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function public.release_delivery_task(
  p_actor uuid,
  p_delivery_task_id uuid,
  p_reason text,
  p_note text,
  p_admin_override boolean,
  p_idempotency_key uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters numeric default null,
  p_recorded_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  replay jsonb;
  task public.delivery_tasks;
  ordered public.orders;
  assignment public.delivery_assignments;
  order_id uuid;
  released_captain_id uuid;
  now_at timestamptz := transaction_timestamp();
  route text;
  result jsonb;
begin
  if p_admin_override then
    perform private.assert_delivery_actor(p_actor, 'ADMIN');
    route := '/admin/delivery-tasks/{taskId}/release';
  else
    perform private.assert_delivery_actor(p_actor, 'CAPTAIN');
    route := '/captain/deliveries/{taskId}/release';
  end if;
  if p_reason not in (
    'VEHICLE_ISSUE','PERSONAL_EMERGENCY','CANNOT_REACH_STORE','MERCHANT_UNAVAILABLE',
    'APP_OR_NAVIGATION_FAILURE','OTHER'
  ) then
    raise exception using errcode = 'P0050', message = 'delivery release invalid';
  end if;
  replay := private.claim_delivery_command(
    p_actor, 'POST', route, p_delivery_task_id, p_idempotency_key,
    jsonb_build_object('reason', p_reason, 'note', p_note, 'adminOverride', p_admin_override)
  );
  if replay is not null then return replay; end if;

  select candidate.order_id
  into strict order_id
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id;

  -- Canonical lock order: order, task, assignments, captain.
  select *
  into strict ordered
  from public.orders candidate
  where candidate.id = order_id
  for update;

  select *
  into strict task
  from public.delivery_tasks candidate
  where candidate.id = p_delivery_task_id
  for update;

  perform 1
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
  order by candidate.id
  for update;

  select *
  into strict assignment
  from public.delivery_assignments candidate
  where candidate.delivery_task_id = task.id
    and candidate.assignment_status = 'ACCEPTED';

  released_captain_id := assignment.captain_id;

  perform 1
  from public.captain_profiles candidate
  where candidate.user_id = released_captain_id
  for update;
  if not p_admin_override and released_captain_id <> p_actor then
    raise exception using errcode = 'P0051', message = 'delivery access denied';
  end if;
  if task.status not in ('ASSIGNED','AT_PICKUP') or task.picked_up_at is not null then
    raise exception using errcode = 'P0054', message = 'delivery state conflict';
  end if;
  if p_latitude is not null and not p_admin_override then
    perform private.record_delivery_location(p_actor, task.id, p_latitude, p_longitude, p_accuracy_meters, p_recorded_at);
  end if;

  update public.delivery_assignments
  set assignment_status = 'RELEASED', responded_at = now_at where id = assignment.id;
  update public.delivery_tasks
  set status = 'SEARCHING',
      assigned_captain_id = null,
      assigned_at = null,
      arrived_pickup_at = null,
      pickup_code_hash = null,
      pickup_code_expires_at = null,
      pickup_code_attempts = 0,
      next_offer_wave_at = now_at,
      updated_at = now_at
  where id = task.id;
  update public.captain_profiles
  set availability_status = 'AVAILABLE', updated_at = now_at where user_id = released_captain_id;
  update public.captain_current_locations
  set active_delivery_task_id = null, updated_at = now_at where captain_id = released_captain_id;
  perform private.transition_order_state(
    ordered.id, 'CAPTAIN_SEARCHING', p_actor,
    case when p_admin_override then 'ADMIN'::public.order_actor_role else 'CAPTAIN'::public.order_actor_role end,
    p_reason, p_note
  );
  perform private.enqueue_outbox_event(
    'delivery.task.released', 'DELIVERY_TASK', task.id,
    jsonb_build_object('deliveryTaskId', task.id, 'orderId', ordered.id,
      'captainId', released_captain_id, 'reason', p_reason, 'releasedAt', now_at,
      'adminOverride', p_admin_override), now_at, now_at
  );

  result := jsonb_build_object(
    'taskId', task.id, 'orderId', ordered.id, 'reason', p_reason,
    'releasedAt', now_at, 'taskStatus', 'SEARCHING',
    'orderStatus', 'CAPTAIN_SEARCHING', 'replayed', false
  );
  return private.complete_delivery_command(
    p_actor, 'POST', route, p_delivery_task_id, p_idempotency_key, result
  );
exception when no_data_found then
  raise exception using errcode = 'P0052', message = 'delivery task not found';
end;
$$;

create or replace function private.delivery_tracking_snapshot(p_delivery_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'orderId', ordered.id,
    'deliveryTaskId', task.id,
    'orderNumber', ordered.order_number,
    'orderStatus', ordered.status,
    'taskStatus', task.status,
    'captain', case when task.assigned_captain_id is null then null else jsonb_build_object(
      'id', task.assigned_captain_id,
      'displayName', profile.full_name,
      'phoneLast4', case when profile.phone_number is null then null else right(profile.phone_number, 4) end,
      'vehicleType', captain.vehicle_type,
      'vehicleNumberLast4', case when captain.vehicle_number is null then null else right(captain.vehicle_number, 4) end
    ) end,
    'location', case
      when location.captain_id is null
        or task.status not in ('ASSIGNED','AT_PICKUP','PICKED_UP','IN_TRANSIT','AT_DROP')
      then null
      else jsonb_build_object(
        'latitude', extensions.st_y(location.location::extensions.geometry),
        'longitude', extensions.st_x(location.location::extensions.geometry),
        'recordedAt', location.recorded_at,
        'stale', location.recorded_at < transaction_timestamp() - interval '30 seconds'
      )
    end,
    'estimatedArrivalAt', ordered.estimated_delivery_at,
    'updatedAt', greatest(task.updated_at, ordered.updated_at, coalesce(location.updated_at, task.updated_at))
  ) into result
  from public.delivery_tasks task
  join public.orders ordered on ordered.id = task.order_id
  left join public.captain_profiles captain on captain.user_id = task.assigned_captain_id
  left join public.profiles profile on profile.id = task.assigned_captain_id
  left join public.captain_current_locations location on location.captain_id = task.assigned_captain_id
  where task.id = p_delivery_task_id;
  return result;
end;
$$;

create or replace function public.get_customer_delivery_tracking(p_actor uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare task_id uuid; result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'CUSTOMER');
  select t.id into task_id
  from public.orders o join public.delivery_tasks t on t.order_id = o.id
  where o.id = p_order_id and o.customer_id = p_actor and t.task_type = 'FORWARD_DELIVERY'
  order by t.created_at desc limit 1;
  if task_id is null then raise exception using errcode = 'P0052', message = 'delivery task not found'; end if;
  result := private.delivery_tracking_snapshot(task_id);
  return result;
end;
$$;

create or replace function public.get_merchant_order_delivery(p_actor uuid, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'MERCHANT');
  select jsonb_build_object(
    'orderId', ordered.id, 'deliveryTaskId', task.id, 'orderNumber', ordered.order_number,
    'orderStatus', ordered.status, 'taskStatus', task.status,
    'captainAssigned', task.assigned_captain_id is not null,
    'captainAtStore', task.status in ('AT_PICKUP','PICKED_UP','IN_TRANSIT','AT_DROP','COMPLETED'),
    'pickedUpAt', task.picked_up_at, 'updatedAt', greatest(task.updated_at, ordered.updated_at)
  ) into result
  from public.orders ordered
  join public.shops shop on shop.id = ordered.shop_id and shop.merchant_id = p_actor
  join public.delivery_tasks task on task.order_id = ordered.id and task.task_type = 'FORWARD_DELIVERY'
  where ordered.id = p_order_id
  order by task.created_at desc limit 1;
  if result is null then raise exception using errcode = 'P0052', message = 'delivery task not found'; end if;
  return result;
end;
$$;

create or replace function public.get_admin_delivery_task(p_actor uuid, p_delivery_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.assert_delivery_actor(p_actor, 'ADMIN');
  result := private.delivery_tracking_snapshot(p_delivery_task_id);
  if result is null then raise exception using errcode = 'P0052', message = 'delivery task not found'; end if;
  return result;
end;
$$;

alter table public.delivery_tasks
  alter column next_offer_wave_at set default transaction_timestamp();
update public.delivery_tasks
set next_offer_wave_at = coalesce(next_offer_wave_at, scheduled_at, transaction_timestamp())
where task_type = 'FORWARD_DELIVERY' and status in ('SEARCHING','OFFERED');

create or replace function public.run_delivery_dispatch_cycle(
  p_worker_id text,
  p_limit integer,
  p_initial_radius_meters integer,
  p_radius_step_meters integer,
  p_max_radius_meters integer,
  p_captains_per_wave integer,
  p_offer_lifetime_seconds integer,
  p_wave_interval_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ready_order record;
  task public.delivery_tasks;
  captain record;
  expired_offer record;
  affected_captain record;
  dispatch_result jsonb;
  dispatch_failures jsonb := '[]'::jsonb;
  task_results jsonb := '[]'::jsonb;
  now_at timestamptz := transaction_timestamp();
  next_wave_at timestamptz;
  failure_sqlstate text;
  radius integer;
  wave integer;
  created_count integer;
  expired_count integer;
  open_offer_count integer;
  dispatches_started integer := 0;
  assignment_id uuid;
begin
  if p_worker_id is null
    or length(btrim(p_worker_id)) < 3
    or p_limit not between 1 and 100
    or p_initial_radius_meters < 100
    or p_radius_step_meters < 100
    or p_max_radius_meters < p_initial_radius_meters
    or p_captains_per_wave not between 1 and 20
    or p_offer_lifetime_seconds not between 5 and 300
    or p_wave_interval_seconds not between 5 and 300
  then
    raise exception using
      errcode = 'P0050',
      message = 'dispatch cycle invalid';
  end if;

  -- S8-03: turn newly ready delivery orders into one idempotent search task.
  for ready_order in
    select candidate.id
    from public.orders candidate
    where candidate.status = 'READY_FOR_PICKUP'
      and candidate.fulfilment_type = 'DELIVERY'
    order by candidate.ready_at, candidate.id
    limit p_limit
    for update skip locked
  loop
    begin
      dispatch_result := public.start_order_dispatch(
        ready_order.id,
        md5('vastra:s8:auto-dispatch:' || ready_order.id::text)::uuid
      );

      if not coalesce((dispatch_result ->> 'replayed')::boolean, false) then
        dispatches_started := dispatches_started + 1;
      end if;
    exception
      when others then
        get stacked diagnostics failure_sqlstate = returned_sqlstate;
        dispatch_failures := dispatch_failures || jsonb_build_array(
          jsonb_build_object(
            'resourceId', ready_order.id,
            'sqlState', failure_sqlstate
          )
        );
    end;
  end loop;

  -- S8-04: claim due tasks independently so multiple workers remain safe.
  for task in
    select candidate.*
    from public.delivery_tasks candidate
    join public.orders ordered
      on ordered.id = candidate.order_id
    where candidate.task_type = 'FORWARD_DELIVERY'
      and candidate.status in ('SEARCHING', 'OFFERED')
      and ordered.status = 'CAPTAIN_SEARCHING'
      and coalesce(
        candidate.next_offer_wave_at,
        candidate.scheduled_at,
        candidate.created_at
      ) <= now_at
      and not exists (
        select 1
        from public.delivery_assignments accepted
        where accepted.delivery_task_id = candidate.id
          and accepted.assignment_status = 'ACCEPTED'
      )
    order by coalesce(
      candidate.next_offer_wave_at,
      candidate.scheduled_at,
      candidate.created_at
    ), candidate.id
    limit p_limit
    for update of candidate skip locked
  loop
    -- Lock every assignment for this task before expiring or creating offers.
    perform 1
    from public.delivery_assignments candidate
    where candidate.delivery_task_id = task.id
    order by candidate.id
    for update;

    expired_count := 0;
    for expired_offer in
      select candidate.id, candidate.captain_id
      from public.delivery_assignments candidate
      where candidate.delivery_task_id = task.id
        and candidate.assignment_status = 'OFFERED'
        and candidate.expires_at <= now_at
      order by candidate.id
    loop
      update public.delivery_assignments
      set assignment_status = 'TIMED_OUT',
          responded_at = now_at
      where id = expired_offer.id;

      expired_count := expired_count + 1;

      perform private.enqueue_outbox_event(
        'delivery.offer.expired',
        'DELIVERY_TASK',
        task.id,
        jsonb_build_object(
          'deliveryTaskId', task.id,
          'assignmentId', expired_offer.id,
          'captainId', expired_offer.captain_id,
          'expiredAt', now_at
        ),
        now_at,
        now_at
      );
    end loop;

    -- Restore captains whose final open offer expired. Captain rows are locked in
    -- deterministic ID order after assignment rows.
    for affected_captain in
      select distinct candidate.captain_id
      from public.delivery_assignments candidate
      where candidate.delivery_task_id = task.id
        and candidate.assignment_status = 'TIMED_OUT'
        and candidate.responded_at = now_at
      order by candidate.captain_id
    loop
      perform 1
      from public.captain_profiles profile
      where profile.user_id = affected_captain.captain_id
      for update;

      update public.captain_profiles profile
      set availability_status = 'AVAILABLE',
          updated_at = now_at
      where profile.user_id = affected_captain.captain_id
        and profile.availability_status = 'OFFERED'
        and not exists (
          select 1
          from public.delivery_assignments active_offer
          where active_offer.captain_id = profile.user_id
            and active_offer.assignment_status = 'OFFERED'
            and active_offer.expires_at > now_at
        )
        and not exists (
          select 1
          from public.delivery_assignments accepted
          where accepted.captain_id = profile.user_id
            and accepted.assignment_status = 'ACCEPTED'
        );
    end loop;

    select count(*)::integer, min(candidate.expires_at)
    into open_offer_count, next_wave_at
    from public.delivery_assignments candidate
    where candidate.delivery_task_id = task.id
      and candidate.assignment_status = 'OFFERED'
      and candidate.expires_at > now_at;

    if open_offer_count > 0 then
      update public.delivery_tasks
      set status = 'OFFERED',
          next_offer_wave_at = next_wave_at,
          updated_at = now_at
      where id = task.id;

      task_results := task_results || jsonb_build_array(
        jsonb_build_object(
          'deliveryTaskId', task.id,
          'taskStatus', 'OFFERED',
          'waveNumber', task.offer_wave_number,
          'radiusMeters', task.offer_radius_meters,
          'offersCreated', 0,
          'offersExpired', expired_count,
          'nextOfferWaveAt', next_wave_at,
          'replayed', false
        )
      );
      continue;
    end if;

    wave := task.offer_wave_number + 1;
    radius := least(
      p_max_radius_meters,
      p_initial_radius_meters + ((wave - 1) * p_radius_step_meters)
    );
    created_count := 0;

    -- Choose the nearest set first, then lock those captain rows by ID to avoid
    -- cross-task lock-order inversions between concurrent workers.
    for captain in
      with nearest as materialized (
        select
          readiness.captain_id,
          round(
            extensions.st_distance(readiness.location, task.pickup_location)
          )::integer as distance_meters
        from private.captain_dispatch_readiness readiness
        where readiness.dispatch_eligible
          and extensions.st_dwithin(
            readiness.location,
            task.pickup_location,
            radius
          )
          and not exists (
            select 1
            from public.delivery_assignments history
            where history.delivery_task_id = task.id
              and history.captain_id = readiness.captain_id
          )
        order by
          extensions.st_distance(readiness.location, task.pickup_location),
          readiness.captain_id
        limit p_captains_per_wave
      )
      select nearest.captain_id, nearest.distance_meters
      from nearest
      join public.captain_profiles profile
        on profile.user_id = nearest.captain_id
      order by nearest.captain_id
      for update of profile skip locked
    loop
      -- Re-check after locking because another task may have changed availability.
      if not exists (
        select 1
        from private.captain_dispatch_readiness readiness
        where readiness.captain_id = captain.captain_id
          and readiness.dispatch_eligible
      ) then
        continue;
      end if;

      insert into public.delivery_assignments(
        delivery_task_id,
        captain_id,
        assignment_status,
        offered_earning_paise,
        pickup_distance_meters,
        offered_at,
        expires_at,
        assigned_by
      )
      values (
        task.id,
        captain.captain_id,
        'OFFERED',
        task.captain_earning_paise,
        captain.distance_meters,
        now_at,
        now_at + make_interval(secs => p_offer_lifetime_seconds),
        'AUTO'
      )
      returning id into assignment_id;

      created_count := created_count + 1;

      update public.captain_profiles
      set availability_status = 'OFFERED',
          updated_at = now_at
      where user_id = captain.captain_id
        and availability_status = 'AVAILABLE';

      perform private.enqueue_outbox_event(
        'delivery.offer.created',
        'DELIVERY_TASK',
        task.id,
        jsonb_build_object(
          'deliveryTaskId', task.id,
          'assignmentId', assignment_id,
          'captainId', captain.captain_id,
          'expiresAt', now_at + make_interval(secs => p_offer_lifetime_seconds),
          'pickupDistanceMeters', captain.distance_meters
        ),
        now_at,
        now_at
      );
    end loop;

    next_wave_at := now_at + make_interval(secs => p_wave_interval_seconds);

    update public.delivery_tasks
    set status = case
          when created_count > 0 then 'OFFERED'::public.delivery_task_status
          else 'SEARCHING'::public.delivery_task_status
        end,
        offer_wave_number = wave,
        offer_radius_meters = radius,
        assignment_attempts = assignment_attempts + created_count,
        next_offer_wave_at = next_wave_at,
        updated_at = now_at
    where id = task.id;

    task_results := task_results || jsonb_build_array(
      jsonb_build_object(
        'deliveryTaskId', task.id,
        'taskStatus', case
          when created_count > 0 then 'OFFERED'
          else 'SEARCHING'
        end,
        'waveNumber', wave,
        'radiusMeters', radius,
        'offersCreated', created_count,
        'offersExpired', expired_count,
        'nextOfferWaveAt', next_wave_at,
        'replayed', false
      )
    );
  end loop;

  return jsonb_build_object(
    'workerId', p_worker_id,
    'dispatchesStarted', dispatches_started,
    'dispatchFailures', dispatch_failures,
    'taskResults', task_results
  );
end;
$$;

comment on function public.run_delivery_dispatch_cycle(text, integer, integer, integer, integer, integer, integer, integer) is
  'Claims due forward-delivery searches, expires old offers, and creates bounded nearby captain offer waves.';

revoke all on function public.list_captain_delivery_offers(uuid) from public, anon, authenticated;
revoke all on function public.get_captain_active_delivery(uuid) from public, anon, authenticated;
revoke all on function public.get_captain_delivery(uuid, uuid) from public, anon, authenticated;
revoke all on function public.respond_delivery_offer(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_assign_delivery_task(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.arrive_delivery_pickup(uuid, uuid, uuid, double precision, double precision, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.issue_merchant_pickup_code(uuid, uuid) from public, anon, authenticated;
revoke all on function public.verify_delivery_pickup(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.depart_delivery_pickup(uuid, uuid, uuid, double precision, double precision, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.get_customer_delivery_tracking(uuid, uuid) from public, anon, authenticated;
revoke all on function public.issue_customer_delivery_otp(uuid, uuid) from public, anon, authenticated;
revoke all on function public.arrive_delivery_drop(uuid, uuid, uuid, double precision, double precision, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_cod_delivery(uuid, uuid, bigint, text, uuid, double precision, double precision, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.report_delivery_problem(uuid, uuid, text, text, text, uuid, double precision, double precision, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.release_delivery_task(uuid, uuid, text, text, boolean, uuid, double precision, double precision, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.get_merchant_order_delivery(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_admin_delivery_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_override_cod_delivery(uuid, uuid, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.run_delivery_dispatch_cycle(text, integer, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;

grant execute on function public.list_captain_delivery_offers(uuid) to service_role;
grant execute on function public.get_captain_active_delivery(uuid) to service_role;
grant execute on function public.get_captain_delivery(uuid, uuid) to service_role;
grant execute on function public.respond_delivery_offer(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.admin_assign_delivery_task(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.arrive_delivery_pickup(uuid, uuid, uuid, double precision, double precision, numeric, timestamptz) to service_role;
grant execute on function public.issue_merchant_pickup_code(uuid, uuid) to service_role;
grant execute on function public.verify_delivery_pickup(uuid, uuid, text, uuid) to service_role;
grant execute on function public.depart_delivery_pickup(uuid, uuid, uuid, double precision, double precision, numeric, timestamptz) to service_role;
grant execute on function public.get_customer_delivery_tracking(uuid, uuid) to service_role;
grant execute on function public.issue_customer_delivery_otp(uuid, uuid) to service_role;
grant execute on function public.arrive_delivery_drop(uuid, uuid, uuid, double precision, double precision, numeric, timestamptz) to service_role;
grant execute on function public.complete_cod_delivery(uuid, uuid, bigint, text, uuid, double precision, double precision, numeric, timestamptz) to service_role;
grant execute on function public.report_delivery_problem(uuid, uuid, text, text, text, uuid, double precision, double precision, numeric, timestamptz) to service_role;
grant execute on function public.release_delivery_task(uuid, uuid, text, text, boolean, uuid, double precision, double precision, numeric, timestamptz) to service_role;
grant execute on function public.get_merchant_order_delivery(uuid, uuid) to service_role;
grant execute on function public.get_admin_delivery_task(uuid, uuid) to service_role;
grant execute on function public.admin_override_cod_delivery(uuid, uuid, bigint, text, uuid) to service_role;
grant execute on function public.run_delivery_dispatch_cycle(text, integer, integer, integer, integer, integer, integer, integer) to service_role;
