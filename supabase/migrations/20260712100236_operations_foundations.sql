-- Vastra notifications, support, approvals, immutable audit records,
-- transactional outbox events, and versioned system settings.

create type public.notification_priority as enum (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

create type public.notification_channel as enum (
  'PUSH',
  'SMS',
  'WHATSAPP',
  'EMAIL',
  'IN_APP'
);

create type public.notification_delivery_status as enum (
  'PENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED'
);

create type public.support_actor_type as enum (
  'CUSTOMER',
  'MERCHANT',
  'CAPTAIN',
  'ADMIN'
);

create type public.support_priority as enum (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

create type public.support_ticket_status as enum (
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_USER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED'
);

create type public.support_message_type as enum (
  'TEXT',
  'IMAGE',
  'FILE',
  'SYSTEM'
);

create type public.approval_action_type as enum (
  'LARGE_REFUND',
  'BANK_CHANGE',
  'MERCHANT_SUSPENSION',
  'CAPTAIN_SUSPENSION',
  'SETTLEMENT_ADJUSTMENT',
  'CAMPAIGN_BUDGET',
  'OTHER'
);

create type public.approval_request_status as enum (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXECUTED'
);

create type public.outbox_event_status as enum (
  'PENDING',
  'PROCESSING',
  'PUBLISHED',
  'FAILED',
  'DEAD_LETTER'
);

create type public.system_setting_value_type as enum (
  'BOOLEAN',
  'NUMBER',
  'STRING',
  'JSON'
);

create type public.system_setting_scope_type as enum (
  'GLOBAL',
  'CITY',
  'SHOP'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  notification_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  priority public.notification_priority
    not null
    default 'NORMAL',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,

  constraint notifications_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint notifications_type_nonempty
    check (length(btrim(notification_type)) > 0),

  constraint notifications_title_nonempty
    check (length(btrim(title)) > 0),

  constraint notifications_body_nonempty
    check (length(btrim(body)) > 0),

  constraint notifications_entity_type_nonempty
    check (
      entity_type is null
      or length(btrim(entity_type)) > 0
    ),

  constraint notifications_data_object
    check (jsonb_typeof(data) = 'object'),

  constraint notifications_read_after_creation
    check (
      read_at is null
      or read_at >= created_at
    )
);

comment on table public.notifications is
  'In-app notification record for all Vastra account types.';

create table public.notification_deliveries (
  id bigint generated always as identity primary key,
  notification_id uuid not null,
  device_id uuid,
  channel public.notification_channel not null,
  provider text,
  provider_message_id text,
  status public.notification_delivery_status
    not null
    default 'PENDING',
  attempt_count public.non_negative_quantity not null default 0,
  sent_at timestamptz,
  received_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now(),

  constraint notification_deliveries_notification_id_fkey
    foreign key (notification_id)
    references public.notifications (id)
    on update cascade
    on delete restrict,

  constraint notification_deliveries_device_id_fkey
    foreign key (device_id)
    references public.user_devices (id)
    on update cascade
    on delete set null,

  constraint notification_deliveries_provider_nonempty
    check (
      provider is null
      or length(btrim(provider)) > 0
    ),

  constraint notification_deliveries_message_id_nonempty
    check (
      provider_message_id is null
      or length(btrim(provider_message_id)) > 0
    ),

  constraint notification_deliveries_lifecycle
    check (
      (
        status = 'PENDING'
        and sent_at is null
        and received_at is null
        and failed_reason is null
      )
      or (
        status = 'SENT'
        and sent_at is not null
        and received_at is null
        and failed_reason is null
      )
      or (
        status in ('DELIVERED', 'READ')
        and sent_at is not null
        and received_at is not null
        and failed_reason is null
      )
      or (
        status = 'FAILED'
        and failed_reason is not null
        and length(btrim(failed_reason)) > 0
      )
    )
);

comment on table public.notification_deliveries is
  'Channel-specific notification send and delivery history.';

create unique index notification_deliveries_provider_message_idx
on public.notification_deliveries (
  provider,
  provider_message_id
)
where provider is not null
  and provider_message_id is not null;

create table public.notification_preferences (
  user_id uuid primary key,
  order_updates boolean not null default true,
  delivery_updates boolean not null default true,
  shop_offers boolean not null default true,
  new_arrivals boolean not null default true,
  recommendations boolean not null default true,
  group_updates boolean not null default true,
  support_updates boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now(),

  constraint notification_preferences_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint notification_preferences_quiet_hours_pair
    check (
      num_nonnulls(
        quiet_hours_start,
        quiet_hours_end
      ) in (0, 2)
    )
);

comment on table public.notification_preferences is
  'User preferences for non-critical notifications.';

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null,
  raised_by_user_id uuid not null,
  raised_by_type public.support_actor_type not null,
  order_id uuid,
  shop_id uuid,
  delivery_task_id uuid,
  return_request_id uuid,
  category text not null,
  priority public.support_priority not null default 'MEDIUM',
  status public.support_ticket_status not null default 'OPEN',
  subject text not null,
  description text not null,
  assigned_team text,
  assigned_to uuid,
  resolution_code text,
  resolution_note text,
  created_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint support_tickets_raised_by_user_id_fkey
    foreign key (raised_by_user_id)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint support_tickets_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete set null,

  constraint support_tickets_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete set null,

  constraint support_tickets_delivery_task_id_fkey
    foreign key (delivery_task_id)
    references public.delivery_tasks (id)
    on update cascade
    on delete set null,

  constraint support_tickets_return_request_id_fkey
    foreign key (return_request_id)
    references public.return_requests (id)
    on update cascade
    on delete set null,

  constraint support_tickets_assigned_to_fkey
    foreign key (assigned_to)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint support_tickets_number_key
    unique (ticket_number),

  constraint support_tickets_number_format
    check (ticket_number ~ '^[A-Z0-9][A-Z0-9-]*$'),

  constraint support_tickets_category_nonempty
    check (length(btrim(category)) > 0),

  constraint support_tickets_subject_nonempty
    check (length(btrim(subject)) > 0),

  constraint support_tickets_description_nonempty
    check (length(btrim(description)) > 0),

  constraint support_tickets_assignment_consistency
    check (
      (
        status = 'OPEN'
        and assigned_to is null
      )
      or status <> 'OPEN'
    ),

  constraint support_tickets_resolution_consistency
    check (
      (
        status in ('RESOLVED', 'CLOSED')
        and resolved_at is not null
        and resolution_code is not null
        and resolution_note is not null
      )
      or status not in ('RESOLVED', 'CLOSED')
    ),

  constraint support_tickets_close_consistency
    check (
      (
        status = 'CLOSED'
        and closed_at is not null
      )
      or (
        status <> 'CLOSED'
        and closed_at is null
      )
    ),

  constraint support_tickets_timestamp_order
    check (
      (
        first_response_at is null
        or first_response_at >= created_at
      )
      and (
        resolved_at is null
        or resolved_at >= created_at
      )
      and (
        closed_at is null
        or closed_at >= created_at
      )
    )
);

comment on table public.support_tickets is
  'Unified customer, merchant, captain, and admin support ticket.';

create table public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null,
  sender_id uuid not null,
  message_type public.support_message_type
    not null
    default 'TEXT',
  message text,
  attachment_object_key text,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now(),

  constraint support_messages_ticket_id_fkey
    foreign key (ticket_id)
    references public.support_tickets (id)
    on update cascade
    on delete restrict,

  constraint support_messages_sender_id_fkey
    foreign key (sender_id)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint support_messages_content_shape
    check (
      (
        message_type in ('TEXT', 'SYSTEM')
        and message is not null
        and length(btrim(message)) > 0
      )
      or (
        message_type in ('IMAGE', 'FILE')
        and attachment_object_key is not null
        and length(btrim(attachment_object_key)) > 0
      )
    )
);

comment on table public.support_messages is
  'Append-only support conversation and attachment history.';

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  action_type public.approval_action_type not null,
  entity_type text not null,
  entity_id uuid not null,
  requested_by uuid not null,
  requested_changes jsonb not null,
  reason text not null,
  status public.approval_request_status
    not null
    default 'PENDING',
  approved_by uuid,
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz,

  constraint approval_requests_requested_by_fkey
    foreign key (requested_by)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint approval_requests_approved_by_fkey
    foreign key (approved_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint approval_requests_entity_type_nonempty
    check (length(btrim(entity_type)) > 0),

  constraint approval_requests_changes_object
    check (jsonb_typeof(requested_changes) = 'object'),

  constraint approval_requests_reason_nonempty
    check (length(btrim(reason)) > 0),

  constraint approval_requests_decision_consistency
    check (
      (
        status = 'PENDING'
        and approved_by is null
        and decided_at is null
        and decision_note is null
        and executed_at is null
      )
      or (
        status in ('APPROVED', 'REJECTED')
        and approved_by is not null
        and decided_at is not null
        and decision_note is not null
        and executed_at is null
      )
      or (
        status = 'EXECUTED'
        and approved_by is not null
        and decided_at is not null
        and executed_at is not null
      )
      or status = 'CANCELLED'
    )
);

comment on table public.approval_requests is
  'Maker-checker approval workflow for sensitive operations.';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_role public.order_actor_role
    not null
    default 'SYSTEM',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  reason text,
  ip_address inet,
  device_id uuid,
  request_id uuid,
  created_at timestamptz not null default now(),

  constraint audit_logs_actor_user_id_fkey
    foreign key (actor_user_id)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint audit_logs_device_id_fkey
    foreign key (device_id)
    references public.user_devices (id)
    on update cascade
    on delete set null,

  constraint audit_logs_action_nonempty
    check (length(btrim(action)) > 0),

  constraint audit_logs_entity_type_nonempty
    check (length(btrim(entity_type)) > 0),

  constraint audit_logs_old_values_object
    check (
      old_values is null
      or jsonb_typeof(old_values) = 'object'
    ),

  constraint audit_logs_new_values_object
    check (
      new_values is null
      or jsonb_typeof(new_values) = 'object'
    ),

  constraint audit_logs_reason_nonempty
    check (
      reason is null
      or length(btrim(reason)) > 0
    )
);

comment on table public.audit_logs is
  'Append-only sensitive action and administrative audit record.';

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_version public.positive_quantity not null default 1,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_event_status not null default 'PENDING',
  attempt_count public.non_negative_quantity not null default 0,
  max_attempts public.positive_quantity not null default 12,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  published_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outbox_events_event_type_nonempty
    check (length(btrim(event_type)) > 0),

  constraint outbox_events_aggregate_type_nonempty
    check (length(btrim(aggregate_type)) > 0),

  constraint outbox_events_payload_object
    check (jsonb_typeof(payload) = 'object'),

  constraint outbox_events_attempt_limit
    check (attempt_count <= max_attempts),

  constraint outbox_events_available_after_occurrence
    check (available_at >= occurred_at),

  constraint outbox_events_lifecycle
    check (
      (
        status = 'PENDING'
        and locked_at is null
        and locked_by is null
        and published_at is null
        and failed_at is null
        and last_error is null
      )
      or (
        status = 'PROCESSING'
        and locked_at is not null
        and locked_by is not null
        and published_at is null
      )
      or (
        status = 'PUBLISHED'
        and published_at is not null
        and failed_at is null
        and last_error is null
      )
      or (
        status in ('FAILED', 'DEAD_LETTER')
        and failed_at is not null
        and last_error is not null
        and length(btrim(last_error)) > 0
      )
    )
);

comment on table public.outbox_events is
  'Transactional event outbox supporting retry and dead-letter delivery.';

create index outbox_events_pending_idx
on public.outbox_events (
  available_at,
  created_at
)
where status in ('PENDING', 'FAILED');

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  setting_value jsonb not null,
  value_type public.system_setting_value_type not null,
  scope_type public.system_setting_scope_type
    not null
    default 'GLOBAL',
  scope_id text,
  is_secret boolean not null default false,
  version public.positive_quantity not null default 1,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),

  constraint system_settings_updated_by_fkey
    foreign key (updated_by)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint system_settings_key_nonempty
    check (length(btrim(setting_key)) > 0),

  constraint system_settings_scope_shape
    check (
      (
        scope_type = 'GLOBAL'
        and scope_id is null
      )
      or (
        scope_type in ('CITY', 'SHOP')
        and scope_id is not null
        and length(btrim(scope_id)) > 0
      )
    ),

  constraint system_settings_value_shape
    check (
      (
        value_type = 'BOOLEAN'
        and jsonb_typeof(setting_value) = 'boolean'
      )
      or (
        value_type = 'NUMBER'
        and jsonb_typeof(setting_value) = 'number'
      )
      or (
        value_type = 'STRING'
        and jsonb_typeof(setting_value) = 'string'
      )
      or value_type = 'JSON'
    )
);

comment on table public.system_settings is
  'Versioned platform configuration and feature settings.';

create unique index system_settings_scope_key_idx
on public.system_settings (
  setting_key,
  scope_type,
  coalesce(scope_id, '')
);

create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at();

create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row
execute function public.set_updated_at();

create trigger set_outbox_events_updated_at
before update on public.outbox_events
for each row
execute function public.set_updated_at();

create trigger set_system_settings_updated_at
before update on public.system_settings
for each row
execute function public.set_updated_at();

create trigger prevent_support_message_mutation
before update or delete on public.support_messages
for each row
execute function private.prevent_append_only_mutation();

create trigger prevent_audit_log_mutation
before update or delete on public.audit_logs
for each row
execute function private.prevent_append_only_mutation();

create or replace function private.enqueue_outbox_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now(),
  p_available_at timestamptz default now()
)
returns public.outbox_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.outbox_events;
begin
  if p_event_type is null
    or length(btrim(p_event_type)) = 0
  then
    raise exception
      'event type is required'
      using errcode = '22023';
  end if;

  if p_aggregate_type is null
    or length(btrim(p_aggregate_type)) = 0
  then
    raise exception
      'aggregate type is required'
      using errcode = '22023';
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception
      'event payload must be a JSON object'
      using errcode = '22023';
  end if;

  insert into public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    occurred_at,
    available_at
  )
  values (
    p_event_type,
    p_aggregate_type,
    p_aggregate_id,
    p_payload,
    p_occurred_at,
    p_available_at
  )
  returning * into event_row;

  return event_row;
end;
$$;

revoke all
on function private.enqueue_outbox_event(
  text,
  text,
  uuid,
  jsonb,
  timestamptz,
  timestamptz
)
from public, anon, authenticated;

grant execute
on function private.enqueue_outbox_event(
  text,
  text,
  uuid,
  jsonb,
  timestamptz,
  timestamptz
)
to service_role;

create or replace function private.enqueue_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_outbox_event(
    'order.status.changed',
    'ORDER',
    new.order_id,
    jsonb_build_object(
      'historyId',
      new.id,
      'previousStatus',
      new.previous_status,
      'newStatus',
      new.new_status
    ),
    new.created_at,
    new.created_at
  );

  return new;
end;
$$;

create or replace function private.enqueue_return_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_outbox_event(
    'return.status.changed',
    'RETURN_REQUEST',
    new.return_request_id,
    jsonb_build_object(
      'historyId',
      new.id,
      'previousStatus',
      new.previous_status,
      'newStatus',
      new.new_status
    ),
    new.created_at,
    new.created_at
  );

  return new;
end;
$$;

create or replace function private.enqueue_support_message_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_outbox_event(
    'support.message.created',
    'SUPPORT_TICKET',
    new.ticket_id,
    jsonb_build_object(
      'messageId',
      new.id,
      'messageType',
      new.message_type
    ),
    new.created_at,
    new.created_at
  );

  return new;
end;
$$;

revoke all
on function private.enqueue_order_status_event()
from public, anon, authenticated;

revoke all
on function private.enqueue_return_status_event()
from public, anon, authenticated;

revoke all
on function private.enqueue_support_message_event()
from public, anon, authenticated;

create trigger enqueue_order_status_event
after insert on public.order_status_history
for each row
execute function private.enqueue_order_status_event();

create trigger enqueue_return_status_event
after insert on public.return_status_history
for each row
execute function private.enqueue_return_status_event();

create trigger enqueue_support_message_event
after insert on public.support_messages
for each row
execute function private.enqueue_support_message_event();

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

alter table public.notification_deliveries enable row level security;
alter table public.notification_deliveries force row level security;

alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

alter table public.support_tickets enable row level security;
alter table public.support_tickets force row level security;

alter table public.support_messages enable row level security;
alter table public.support_messages force row level security;

alter table public.approval_requests enable row level security;
alter table public.approval_requests force row level security;

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

alter table public.outbox_events enable row level security;
alter table public.outbox_events force row level security;

alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;

revoke all privileges
on table
  public.notifications,
  public.notification_deliveries,
  public.notification_preferences,
  public.support_tickets,
  public.support_messages,
  public.approval_requests,
  public.audit_logs,
  public.outbox_events,
  public.system_settings
from anon, authenticated;

revoke all privileges
on sequence
  public.notification_deliveries_id_seq,
  public.support_messages_id_seq,
  public.audit_logs_id_seq
from anon, authenticated;
