-- Vastra delivery tasks, dispatch offers, captain tracking, delivery events,
-- COD collection, and concurrency-safe captain assignment.
--
-- Return-request foreign keys are added later when the returns tables exist.

create type public.delivery_task_type as enum (
  'FORWARD_DELIVERY',
  'RETURN_PICKUP',
  'RETURN_TO_MERCHANT',
  'EXCHANGE_DELIVERY'
);

create type public.delivery_task_status as enum (
  'CREATED',
  'SEARCHING',
  'OFFERED',
  'ASSIGNED',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DROP',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

create type public.delivery_assignment_status as enum (
  'OFFERED',
  'ACCEPTED',
  'REJECTED',
  'TIMED_OUT',
  'CANCELLED',
  'RELEASED',
  'COMPLETED'
);

create type public.delivery_assigned_by as enum (
  'AUTO',
  'ADMIN'
);

create type public.delivery_event_type as enum (
  'CAPTAIN_ASSIGNED',
  'ARRIVED_AT_STORE',
  'MERCHANT_DELAY',
  'PICKUP_CONFIRMED',
  'LEFT_STORE',
  'ARRIVED_AT_CUSTOMER',
  'DELIVERY_CONFIRMED',
  'CUSTOMER_UNAVAILABLE',
  'INVALID_ADDRESS',
  'CUSTOMER_REFUSED',
  'PACKAGE_DAMAGED',
  'RETURNING_TO_STORE',
  'TASK_COMPLETED',
  'OTHER'
);

create type public.cod_collection_status as enum (
  'PENDING_COLLECTION',
  'COLLECTED',
  'DEPOSIT_PENDING',
  'DEPOSITED',
  'RECONCILED',
  'DISPUTED'
);

create table public.delivery_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  return_request_id uuid,
  task_type public.delivery_task_type
    not null
    default 'FORWARD_DELIVERY',
  pickup_shop_id uuid not null,
  pickup_address_snapshot jsonb not null default '{}'::jsonb,
  drop_address_snapshot jsonb not null default '{}'::jsonb,
  pickup_location extensions.geography(point, 4326) not null,
  drop_location extensions.geography(point, 4326) not null,
  status public.delivery_task_status not null default 'CREATED',
  estimated_distance_meters public.non_negative_quantity,
  estimated_duration_seconds public.non_negative_quantity,
  delivery_fee_paise public.money_paise not null default 0,
  captain_earning_paise public.money_paise not null default 0,
  pickup_code_hash text,
  delivery_otp_hash text,
  assigned_captain_id uuid,
  assignment_attempts public.non_negative_quantity
    not null
    default 0,
  scheduled_at timestamptz,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint delivery_tasks_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint delivery_tasks_pickup_shop_id_fkey
    foreign key (pickup_shop_id)
    references public.shops (id)
    on update cascade
    on delete restrict,

  constraint delivery_tasks_assigned_captain_id_fkey
    foreign key (assigned_captain_id)
    references public.captain_profiles (user_id)
    on update cascade
    on delete set null,

  constraint delivery_tasks_pickup_snapshot_object
    check (jsonb_typeof(pickup_address_snapshot) = 'object'),

  constraint delivery_tasks_drop_snapshot_object
    check (jsonb_typeof(drop_address_snapshot) = 'object'),

  constraint delivery_tasks_reference_shape
    check (
      (
        task_type = 'FORWARD_DELIVERY'
        and order_id is not null
        and return_request_id is null
      )
      or (
        task_type in ('RETURN_PICKUP', 'RETURN_TO_MERCHANT')
        and return_request_id is not null
      )
      or (
        task_type = 'EXCHANGE_DELIVERY'
        and order_id is not null
        and return_request_id is not null
      )
    ),

  constraint delivery_tasks_assignment_consistency
    check (
      (
        status in ('CREATED', 'SEARCHING', 'OFFERED')
        and assigned_captain_id is null
        and assigned_at is null
      )
      or (
        status in (
          'ASSIGNED',
          'AT_PICKUP',
          'PICKED_UP',
          'IN_TRANSIT',
          'AT_DROP',
          'COMPLETED'
        )
        and assigned_captain_id is not null
        and assigned_at is not null
      )
      or status in ('FAILED', 'CANCELLED')
    ),

  constraint delivery_tasks_completion_consistency
    check (
      (
        status = 'COMPLETED'
        and completed_at is not null
      )
      or (
        status <> 'COMPLETED'
        and completed_at is null
      )
    ),

  constraint delivery_tasks_pickup_consistency
    check (
      (
        status in (
          'PICKED_UP',
          'IN_TRANSIT',
          'AT_DROP',
          'COMPLETED'
        )
        and picked_up_at is not null
      )
      or status not in (
        'PICKED_UP',
        'IN_TRANSIT',
        'AT_DROP',
        'COMPLETED'
      )
    ),

  constraint delivery_tasks_timestamp_order
    check (
      (scheduled_at is null or scheduled_at >= created_at)
      and (assigned_at is null or assigned_at >= created_at)
      and (picked_up_at is null or picked_up_at >= created_at)
      and (completed_at is null or completed_at >= created_at)
    )
);

comment on table public.delivery_tasks is
  'Reusable delivery work item for forward and reverse logistics.';

create unique index delivery_tasks_one_forward_order_idx
on public.delivery_tasks (order_id)
where task_type = 'FORWARD_DELIVERY'
  and status not in ('FAILED', 'CANCELLED');

create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  delivery_task_id uuid not null,
  captain_id uuid not null,
  assignment_status public.delivery_assignment_status
    not null
    default 'OFFERED',
  offered_earning_paise public.money_paise not null default 0,
  pickup_distance_meters public.non_negative_quantity,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  rejection_reason text,
  assigned_by public.delivery_assigned_by not null default 'AUTO',
  assigned_by_user_id uuid,
  created_at timestamptz not null default now(),

  constraint delivery_assignments_delivery_task_id_fkey
    foreign key (delivery_task_id)
    references public.delivery_tasks (id)
    on update cascade
    on delete restrict,

  constraint delivery_assignments_captain_id_fkey
    foreign key (captain_id)
    references public.captain_profiles (user_id)
    on update cascade
    on delete cascade,

  constraint delivery_assignments_assigned_by_user_id_fkey
    foreign key (assigned_by_user_id)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint delivery_assignments_expiry_check
    check (expires_at > offered_at),

  constraint delivery_assignments_admin_actor_check
    check (
      (
        assigned_by = 'AUTO'
        and assigned_by_user_id is null
      )
      or (
        assigned_by = 'ADMIN'
        and assigned_by_user_id is not null
      )
    ),

  constraint delivery_assignments_response_consistency
    check (
      (
        assignment_status = 'OFFERED'
        and responded_at is null
        and rejection_reason is null
      )
      or (
        assignment_status = 'REJECTED'
        and responded_at is not null
        and rejection_reason is not null
        and length(btrim(rejection_reason)) > 0
      )
      or (
        assignment_status in (
          'ACCEPTED',
          'TIMED_OUT',
          'CANCELLED',
          'RELEASED',
          'COMPLETED'
        )
        and responded_at is not null
        and rejection_reason is null
      )
    )
);

comment on table public.delivery_assignments is
  'Complete captain offer, response, timeout, and assignment history.';

create unique index delivery_assignments_one_accepted_idx
on public.delivery_assignments (delivery_task_id)
where assignment_status = 'ACCEPTED';

create unique index delivery_assignments_one_active_offer_idx
on public.delivery_assignments (
  delivery_task_id,
  captain_id
)
where assignment_status = 'OFFERED';

create table public.captain_current_locations (
  captain_id uuid primary key,
  location extensions.geography(point, 4326) not null,
  heading numeric(6, 2),
  speed_mps numeric(8, 2),
  accuracy_meters numeric(8, 2),
  battery_percent smallint,
  active_delivery_task_id uuid,
  updated_at timestamptz not null default now(),

  constraint captain_current_locations_captain_id_fkey
    foreign key (captain_id)
    references public.captain_profiles (user_id)
    on update cascade
    on delete cascade,

  constraint captain_current_locations_active_task_fkey
    foreign key (active_delivery_task_id)
    references public.delivery_tasks (id)
    on update cascade
    on delete set null,

  constraint captain_current_locations_heading_check
    check (
      heading is null
      or (
        heading >= 0
        and heading < 360
      )
    ),

  constraint captain_current_locations_speed_check
    check (
      speed_mps is null
      or speed_mps >= 0
    ),

  constraint captain_current_locations_accuracy_check
    check (
      accuracy_meters is null
      or accuracy_meters >= 0
    ),

  constraint captain_current_locations_battery_check
    check (
      battery_percent is null
      or battery_percent between 0 and 100
    )
);

comment on table public.captain_current_locations is
  'Latest captain position for dispatch and customer tracking.';

create table public.captain_location_history (
  id bigint generated always as identity primary key,
  captain_id uuid not null,
  delivery_task_id uuid,
  location extensions.geography(point, 4326) not null,
  heading numeric(6, 2),
  speed_mps numeric(8, 2),
  accuracy_meters numeric(8, 2),
  recorded_at timestamptz not null default now(),
  received_at timestamptz not null default now(),

  constraint captain_location_history_captain_id_fkey
    foreign key (captain_id)
    references public.captain_profiles (user_id)
    on update cascade
    on delete cascade,

  constraint captain_location_history_delivery_task_id_fkey
    foreign key (delivery_task_id)
    references public.delivery_tasks (id)
    on update cascade
    on delete set null,

  constraint captain_location_history_heading_check
    check (
      heading is null
      or (
        heading >= 0
        and heading < 360
      )
    ),

  constraint captain_location_history_speed_check
    check (
      speed_mps is null
      or speed_mps >= 0
    ),

  constraint captain_location_history_accuracy_check
    check (
      accuracy_meters is null
      or accuracy_meters >= 0
    ),

  constraint captain_location_history_received_order
    check (received_at >= recorded_at)
);

comment on table public.captain_location_history is
  'Append-only sampled location trail for active deliveries.';

create table public.delivery_events (
  id bigint generated always as identity primary key,
  delivery_task_id uuid not null,
  event_type public.delivery_event_type not null,
  actor_user_id uuid,
  location extensions.geography(point, 4326),
  note text,
  evidence_object_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint delivery_events_delivery_task_id_fkey
    foreign key (delivery_task_id)
    references public.delivery_tasks (id)
    on update cascade
    on delete restrict,

  constraint delivery_events_actor_user_id_fkey
    foreign key (actor_user_id)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint delivery_events_note_nonempty
    check (
      note is null
      or length(btrim(note)) > 0
    ),

  constraint delivery_events_evidence_nonempty
    check (
      evidence_object_key is null
      or length(btrim(evidence_object_key)) > 0
    ),

  constraint delivery_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.delivery_events is
  'Append-only operational delivery event timeline.';

create table public.cod_collections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  delivery_task_id uuid not null,
  captain_id uuid not null,
  amount_paise public.money_paise not null,
  status public.cod_collection_status
    not null
    default 'PENDING_COLLECTION',
  collected_at timestamptz,
  deposited_at timestamptz,
  reconciled_by uuid,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),

  constraint cod_collections_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint cod_collections_delivery_task_id_fkey
    foreign key (delivery_task_id)
    references public.delivery_tasks (id)
    on update cascade
    on delete restrict,

  constraint cod_collections_captain_id_fkey
    foreign key (captain_id)
    references public.captain_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint cod_collections_reconciled_by_fkey
    foreign key (reconciled_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint cod_collections_order_id_key
    unique (order_id),

  constraint cod_collections_lifecycle_check
    check (
      (
        status = 'PENDING_COLLECTION'
        and collected_at is null
        and deposited_at is null
        and reconciled_at is null
        and reconciled_by is null
      )
      or (
        status in ('COLLECTED', 'DEPOSIT_PENDING', 'DISPUTED')
        and collected_at is not null
        and deposited_at is null
        and reconciled_at is null
        and reconciled_by is null
      )
      or (
        status = 'DEPOSITED'
        and collected_at is not null
        and deposited_at is not null
        and reconciled_at is null
        and reconciled_by is null
      )
      or (
        status = 'RECONCILED'
        and collected_at is not null
        and deposited_at is not null
        and reconciled_at is not null
        and reconciled_by is not null
      )
    )
);

comment on table public.cod_collections is
  'Cash-on-delivery collection and reconciliation record.';

create trigger set_delivery_tasks_updated_at
before update on public.delivery_tasks
for each row
execute function public.set_updated_at();

create trigger set_captain_current_locations_updated_at
before update on public.captain_current_locations
for each row
execute function public.set_updated_at();

create trigger prevent_captain_location_history_mutation
before update or delete on public.captain_location_history
for each row
execute function private.prevent_append_only_mutation();

create trigger prevent_delivery_event_mutation
before update or delete on public.delivery_events
for each row
execute function private.prevent_append_only_mutation();

create or replace function private.accept_delivery_assignment(
  p_assignment_id uuid,
  p_captain_id uuid,
  p_actor_user_id uuid default null
)
returns public.delivery_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.delivery_assignments;
  task_row public.delivery_tasks;
begin
  select *
  into strict assignment_row
  from public.delivery_assignments da
  where da.id = p_assignment_id
  for update;

  if assignment_row.captain_id <> p_captain_id then
    raise exception
      'assignment % does not belong to captain %',
      p_assignment_id,
      p_captain_id
      using errcode = '42501';
  end if;

  select *
  into strict task_row
  from public.delivery_tasks dt
  where dt.id = assignment_row.delivery_task_id
  for update;

  if assignment_row.assignment_status = 'ACCEPTED'
    and task_row.assigned_captain_id = p_captain_id
  then
    return task_row;
  end if;

  if assignment_row.assignment_status <> 'OFFERED' then
    raise exception
      'assignment % is not open',
      p_assignment_id
      using errcode = '23514';
  end if;

  if assignment_row.expires_at <= now() then
    raise exception
      'assignment % has expired',
      p_assignment_id
      using errcode = '23514';
  end if;

  if task_row.status not in ('SEARCHING', 'OFFERED') then
    raise exception
      'delivery task % is not assignable',
      task_row.id
      using errcode = '23514';
  end if;

  if task_row.assigned_captain_id is not null then
    raise exception
      'delivery task % already has a captain',
      task_row.id
      using errcode = '23505';
  end if;

  update public.delivery_assignments
  set
    assignment_status = 'ACCEPTED',
    responded_at = now()
  where id = p_assignment_id;

  update public.delivery_assignments
  set
    assignment_status = 'CANCELLED',
    responded_at = now()
  where delivery_task_id = task_row.id
    and id <> p_assignment_id
    and assignment_status = 'OFFERED';

  update public.delivery_tasks
  set
    status = 'ASSIGNED',
    assigned_captain_id = p_captain_id,
    assigned_at = now(),
    assignment_attempts = assignment_attempts + 1
  where id = task_row.id
  returning * into task_row;

  update public.captain_profiles
  set availability_status = 'ASSIGNED'
  where user_id = p_captain_id;

  insert into public.delivery_events (
    delivery_task_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    task_row.id,
    'CAPTAIN_ASSIGNED',
    coalesce(p_actor_user_id, p_captain_id),
    jsonb_build_object(
      'assignment_id',
      p_assignment_id,
      'captain_id',
      p_captain_id
    )
  );

  return task_row;
end;
$$;

create or replace function private.update_captain_location(
  p_captain_id uuid,
  p_location extensions.geography,
  p_heading numeric default null,
  p_speed_mps numeric default null,
  p_accuracy_meters numeric default null,
  p_battery_percent smallint default null,
  p_active_delivery_task_id uuid default null
)
returns public.captain_current_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  location_row public.captain_current_locations;
begin
  if p_location is null then
    raise exception
      'captain location is required'
      using errcode = '22004';
  end if;

  if p_active_delivery_task_id is not null
    and not exists (
      select 1
      from public.delivery_tasks dt
      where dt.id = p_active_delivery_task_id
        and dt.assigned_captain_id = p_captain_id
        and dt.status not in (
          'COMPLETED',
          'FAILED',
          'CANCELLED'
        )
    )
  then
    raise exception
      'delivery task % is not active for captain %',
      p_active_delivery_task_id,
      p_captain_id
      using errcode = '23514';
  end if;

  insert into public.captain_current_locations (
    captain_id,
    location,
    heading,
    speed_mps,
    accuracy_meters,
    battery_percent,
    active_delivery_task_id,
    updated_at
  )
  values (
    p_captain_id,
    p_location,
    p_heading,
    p_speed_mps,
    p_accuracy_meters,
    p_battery_percent,
    p_active_delivery_task_id,
    now()
  )
  on conflict (captain_id)
  do update set
    location = excluded.location,
    heading = excluded.heading,
    speed_mps = excluded.speed_mps,
    accuracy_meters = excluded.accuracy_meters,
    battery_percent = excluded.battery_percent,
    active_delivery_task_id =
      excluded.active_delivery_task_id,
    updated_at = now()
  returning * into location_row;

  insert into public.captain_location_history (
    captain_id,
    delivery_task_id,
    location,
    heading,
    speed_mps,
    accuracy_meters
  )
  values (
    p_captain_id,
    p_active_delivery_task_id,
    p_location,
    p_heading,
    p_speed_mps,
    p_accuracy_meters
  );

  return location_row;
end;
$$;

revoke all
on function private.accept_delivery_assignment(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;

revoke all
on function private.update_captain_location(
  uuid,
  extensions.geography,
  numeric,
  numeric,
  numeric,
  smallint,
  uuid
)
from public, anon, authenticated;

grant execute
on function private.accept_delivery_assignment(
  uuid,
  uuid,
  uuid
)
to service_role;

grant execute
on function private.update_captain_location(
  uuid,
  extensions.geography,
  numeric,
  numeric,
  numeric,
  smallint,
  uuid
)
to service_role;

alter table public.delivery_tasks enable row level security;
alter table public.delivery_tasks force row level security;

alter table public.delivery_assignments enable row level security;
alter table public.delivery_assignments force row level security;

alter table public.captain_current_locations enable row level security;
alter table public.captain_current_locations force row level security;

alter table public.captain_location_history enable row level security;
alter table public.captain_location_history force row level security;

alter table public.delivery_events enable row level security;
alter table public.delivery_events force row level security;

alter table public.cod_collections enable row level security;
alter table public.cod_collections force row level security;

revoke all privileges
on table
  public.delivery_tasks,
  public.delivery_assignments,
  public.captain_current_locations,
  public.captain_location_history,
  public.delivery_events,
  public.cod_collections
from anon, authenticated;

revoke all privileges
on sequence
  public.captain_location_history_id_seq,
  public.delivery_events_id_seq
from anon, authenticated;
