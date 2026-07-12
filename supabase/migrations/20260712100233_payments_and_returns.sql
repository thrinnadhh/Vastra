-- Vastra payment attempts, payment gateway events, returns, evidence,
-- return history, and refunds.
--
-- Direct client privileges remain disabled. Server-side payment and return
-- workflows run through trusted backend services.

create type public.payment_method as enum (
  'UPI',
  'CARD',
  'NETBANKING',
  'WALLET',
  'COD',
  'OTHER'
);

create type public.payment_attempt_status as enum (
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED'
);

create type public.payment_event_processing_status as enum (
  'RECEIVED',
  'PROCESSED',
  'IGNORED',
  'FAILED'
);

create type public.return_reason_code as enum (
  'WRONG_SIZE',
  'WRONG_COLOUR',
  'WRONG_PRODUCT',
  'DAMAGED',
  'QUALITY',
  'DIFFERENT_FROM_IMAGE',
  'MISSING_ITEM',
  'CHANGED_MIND',
  'OTHER'
);

create type public.return_request_status as enum (
  'REQUESTED',
  'REVIEW',
  'APPROVED',
  'REJECTED',
  'PICKUP_ASSIGNED',
  'PICKED_UP',
  'RECEIVED',
  'VERIFIED',
  'REFUND_PENDING',
  'REFUNDED',
  'CLOSED'
);

create type public.return_refund_method as enum (
  'ORIGINAL',
  'WALLET',
  'MANUAL'
);

create type public.return_inspection_status as enum (
  'PENDING',
  'SELLABLE',
  'DAMAGED',
  'USED',
  'WRONG_ITEM',
  'DISPUTED'
);

create type public.return_merchant_decision as enum (
  'ACCEPTED',
  'DISPUTED',
  'PARTIAL'
);

create type public.return_evidence_type as enum (
  'CUSTOMER_PHOTO',
  'MERCHANT_PHOTO',
  'CAPTAIN_PHOTO',
  'VIDEO',
  'DOCUMENT',
  'NOTE'
);

create type public.refund_status as enum (
  'PENDING',
  'APPROVAL_REQUIRED',
  'INITIATED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

alter table public.orders
add constraint orders_id_customer_id_key
unique (id, customer_id);

alter table public.orders
add constraint orders_id_customer_shop_key
unique (id, customer_id, shop_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  customer_id uuid not null,
  idempotency_key text not null,
  provider text not null,
  provider_order_id text,
  provider_payment_id text,
  method public.payment_method not null,
  amount_paise public.money_paise not null,
  currency text not null default 'INR',
  status public.payment_attempt_status not null default 'CREATED',
  signature_verified boolean not null default false,
  failure_code text,
  failure_message text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_order_customer_fkey
    foreign key (order_id, customer_id)
    references public.orders (id, customer_id)
    on update cascade
    on delete restrict,

  constraint payments_id_order_id_key
    unique (id, order_id),

  constraint payments_order_idempotency_key
    unique (order_id, idempotency_key),

  constraint payments_idempotency_key_nonempty
    check (length(btrim(idempotency_key)) > 0),

  constraint payments_provider_nonempty
    check (length(btrim(provider)) > 0),

  constraint payments_currency_format
    check (currency ~ '^[A-Z]{3}$'),

  constraint payments_provider_order_nonempty
    check (
      provider_order_id is null
      or length(btrim(provider_order_id)) > 0
    ),

  constraint payments_provider_payment_nonempty
    check (
      provider_payment_id is null
      or length(btrim(provider_payment_id)) > 0
    ),

  constraint payments_paid_state_check
    check (
      (
        status in (
          'CAPTURED',
          'PARTIALLY_REFUNDED',
          'REFUNDED'
        )
        and paid_at is not null
      )
      or (
        status not in (
          'CAPTURED',
          'PARTIALLY_REFUNDED',
          'REFUNDED'
        )
      )
    ),

  constraint payments_failure_state_check
    check (
      (
        status = 'FAILED'
        and (
          failure_code is not null
          or failure_message is not null
        )
      )
      or status <> 'FAILED'
    )
);

comment on table public.payments is
  'Idempotent online or COD payment attempt linked to an order.';

create unique index payments_provider_order_id_idx
on public.payments (provider, provider_order_id)
where provider_order_id is not null;

create unique index payments_provider_payment_id_idx
on public.payments (provider, provider_payment_id)
where provider_payment_id is not null;

create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_valid boolean not null default false,
  processing_status public.payment_event_processing_status
    not null
    default 'RECEIVED',
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,

  constraint payment_events_payment_id_fkey
    foreign key (payment_id)
    references public.payments (id)
    on update cascade
    on delete set null,

  constraint payment_events_provider_event_key
    unique (provider, provider_event_id),

  constraint payment_events_provider_nonempty
    check (length(btrim(provider)) > 0),

  constraint payment_events_provider_event_nonempty
    check (length(btrim(provider_event_id)) > 0),

  constraint payment_events_event_type_nonempty
    check (length(btrim(event_type)) > 0),

  constraint payment_events_payload_object
    check (jsonb_typeof(payload) = 'object'),

  constraint payment_events_processing_lifecycle
    check (
      (
        processing_status = 'RECEIVED'
        and processed_at is null
        and processing_error is null
      )
      or (
        processing_status in ('PROCESSED', 'IGNORED')
        and processed_at is not null
        and processing_error is null
      )
      or (
        processing_status = 'FAILED'
        and processed_at is not null
        and processing_error is not null
        and length(btrim(processing_error)) > 0
      )
    )
);

comment on table public.payment_events is
  'Idempotent payment-provider webhook and event processing log.';

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  return_number text not null,
  idempotency_key text not null,
  order_id uuid not null,
  customer_id uuid not null,
  shop_id uuid not null,
  reason_code public.return_reason_code not null,
  customer_note text,
  status public.return_request_status
    not null
    default 'REQUESTED',
  refund_method public.return_refund_method
    not null
    default 'ORIGINAL',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint return_requests_order_customer_shop_fkey
    foreign key (order_id, customer_id, shop_id)
    references public.orders (id, customer_id, shop_id)
    on update cascade
    on delete restrict,

  constraint return_requests_return_number_key
    unique (return_number),

  constraint return_requests_id_order_id_key
    unique (id, order_id),

  constraint return_requests_order_idempotency_key
    unique (order_id, idempotency_key),

  constraint return_requests_number_format
    check (return_number ~ '^[A-Z0-9][A-Z0-9-]*$'),

  constraint return_requests_idempotency_nonempty
    check (length(btrim(idempotency_key)) > 0),

  constraint return_requests_note_nonempty
    check (
      customer_note is null
      or length(btrim(customer_note)) > 0
    ),

  constraint return_requests_approval_lifecycle
    check (
      (
        status in (
          'APPROVED',
          'PICKUP_ASSIGNED',
          'PICKED_UP',
          'RECEIVED',
          'VERIFIED',
          'REFUND_PENDING',
          'REFUNDED',
          'CLOSED'
        )
        and approved_at is not null
      )
      or status not in (
        'APPROVED',
        'PICKUP_ASSIGNED',
        'PICKED_UP',
        'RECEIVED',
        'VERIFIED',
        'REFUND_PENDING',
        'REFUNDED',
        'CLOSED'
      )
    ),

  constraint return_requests_completion_lifecycle
    check (
      (
        status in ('REFUNDED', 'CLOSED')
        and completed_at is not null
      )
      or status not in ('REFUNDED', 'CLOSED')
    ),

  constraint return_requests_timestamp_order
    check (
      requested_at >= created_at
      and (
        approved_at is null
        or approved_at >= requested_at
      )
      and (
        completed_at is null
        or completed_at >= requested_at
      )
    )
);

comment on table public.return_requests is
  'Customer return request and current return workflow state.';

create table public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null,
  order_item_id uuid not null,
  quantity public.positive_quantity not null default 1,
  reason_code public.return_reason_code not null,
  requested_refund_paise public.money_paise not null,
  inspection_status public.return_inspection_status
    not null
    default 'PENDING',
  merchant_decision public.return_merchant_decision,
  merchant_note text,
  inspected_by uuid,
  inspected_at timestamptz,

  constraint return_items_return_request_id_fkey
    foreign key (return_request_id)
    references public.return_requests (id)
    on update cascade
    on delete restrict,

  constraint return_items_order_item_id_fkey
    foreign key (order_item_id)
    references public.order_items (id)
    on update cascade
    on delete restrict,

  constraint return_items_inspected_by_fkey
    foreign key (inspected_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint return_items_request_item_key
    unique (return_request_id, order_item_id),

  constraint return_items_inspection_consistency
    check (
      (
        inspection_status = 'PENDING'
        and inspected_by is null
        and inspected_at is null
        and merchant_decision is null
      )
      or (
        inspection_status <> 'PENDING'
        and inspected_by is not null
        and inspected_at is not null
      )
    ),

  constraint return_items_merchant_note_nonempty
    check (
      merchant_note is null
      or length(btrim(merchant_note)) > 0
    )
);

comment on table public.return_items is
  'Per-order-item return quantity, requested refund, and inspection.';

create table public.return_evidence (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null,
  uploaded_by uuid not null,
  evidence_type public.return_evidence_type not null,
  storage_object_key text,
  description text,
  created_at timestamptz not null default now(),

  constraint return_evidence_return_request_id_fkey
    foreign key (return_request_id)
    references public.return_requests (id)
    on update cascade
    on delete restrict,

  constraint return_evidence_uploaded_by_fkey
    foreign key (uploaded_by)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint return_evidence_content_check
    check (
      storage_object_key is not null
      or description is not null
    ),

  constraint return_evidence_storage_key_nonempty
    check (
      storage_object_key is null
      or length(btrim(storage_object_key)) > 0
    ),

  constraint return_evidence_description_nonempty
    check (
      description is null
      or length(btrim(description)) > 0
    )
);

comment on table public.return_evidence is
  'Customer, merchant, captain, or admin return evidence.';

create table public.return_status_history (
  id bigint generated always as identity primary key,
  return_request_id uuid not null,
  previous_status public.return_request_status,
  new_status public.return_request_status not null,
  changed_by uuid,
  reason_code text,
  note text,
  created_at timestamptz not null default now(),

  constraint return_status_history_return_request_id_fkey
    foreign key (return_request_id)
    references public.return_requests (id)
    on update cascade
    on delete restrict,

  constraint return_status_history_changed_by_fkey
    foreign key (changed_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint return_status_history_changed_check
    check (
      previous_status is null
      or previous_status <> new_status
    ),

  constraint return_status_history_reason_nonempty
    check (
      reason_code is null
      or length(btrim(reason_code)) > 0
    ),

  constraint return_status_history_note_nonempty
    check (
      note is null
      or length(btrim(note)) > 0
    )
);

comment on table public.return_status_history is
  'Append-only return-state history.';

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  refund_number text not null,
  idempotency_key text not null,
  order_id uuid not null,
  payment_id uuid,
  return_request_id uuid,
  amount_paise public.money_paise not null,
  reason_code text not null,
  provider_refund_id text,
  status public.refund_status not null default 'PENDING',
  initiated_by uuid not null,
  approved_by uuid,
  initiated_at timestamptz,
  completed_at timestamptz,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint refunds_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete restrict,

  constraint refunds_payment_id_fkey
    foreign key (payment_id)
    references public.payments (id)
    on update cascade
    on delete set null,

  constraint refunds_return_request_id_fkey
    foreign key (return_request_id)
    references public.return_requests (id)
    on update cascade
    on delete set null,

  constraint refunds_initiated_by_fkey
    foreign key (initiated_by)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint refunds_approved_by_fkey
    foreign key (approved_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint refunds_refund_number_key
    unique (refund_number),

  constraint refunds_order_idempotency_key
    unique (order_id, idempotency_key),

  constraint refunds_number_format
    check (refund_number ~ '^[A-Z0-9][A-Z0-9-]*$'),

  constraint refunds_idempotency_nonempty
    check (length(btrim(idempotency_key)) > 0),

  constraint refunds_reason_nonempty
    check (length(btrim(reason_code)) > 0),

  constraint refunds_provider_id_nonempty
    check (
      provider_refund_id is null
      or length(btrim(provider_refund_id)) > 0
    ),

  constraint refunds_initiation_lifecycle
    check (
      (
        status in (
          'INITIATED',
          'PROCESSING',
          'COMPLETED',
          'FAILED'
        )
        and initiated_at is not null
      )
      or status not in (
        'INITIATED',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
      )
    ),

  constraint refunds_completion_lifecycle
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

  constraint refunds_failure_lifecycle
    check (
      (
        status = 'FAILED'
        and failure_message is not null
        and length(btrim(failure_message)) > 0
      )
      or status <> 'FAILED'
    )
);

comment on table public.refunds is
  'Idempotent payment-provider or manual refund record.';

create unique index refunds_provider_refund_id_idx
on public.refunds (provider_refund_id)
where provider_refund_id is not null;

alter table public.delivery_tasks
add constraint delivery_tasks_return_request_id_fkey
foreign key (return_request_id)
references public.return_requests (id)
on update cascade
on delete restrict;

create trigger set_payments_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

create trigger set_return_requests_updated_at
before update on public.return_requests
for each row
execute function public.set_updated_at();

create trigger set_refunds_updated_at
before update on public.refunds
for each row
execute function public.set_updated_at();

create or replace function private.record_return_status_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.return_status_history (
      return_request_id,
      previous_status,
      new_status
    )
    values (
      new.id,
      null,
      new.status
    );

    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.return_status_history (
      return_request_id,
      previous_status,
      new_status
    )
    values (
      new.id,
      old.status,
      new.status
    );
  end if;

  return new;
end;
$$;

revoke all
on function private.record_return_status_history()
from public, anon, authenticated;

create trigger record_initial_return_status
after insert on public.return_requests
for each row
execute function private.record_return_status_history();

create trigger record_return_status_change
after update of status on public.return_requests
for each row
execute function private.record_return_status_history();

create trigger prevent_return_status_history_mutation
before update or delete on public.return_status_history
for each row
execute function private.prevent_append_only_mutation();

alter table public.payments enable row level security;
alter table public.payments force row level security;

alter table public.payment_events enable row level security;
alter table public.payment_events force row level security;

alter table public.return_requests enable row level security;
alter table public.return_requests force row level security;

alter table public.return_items enable row level security;
alter table public.return_items force row level security;

alter table public.return_evidence enable row level security;
alter table public.return_evidence force row level security;

alter table public.return_status_history enable row level security;
alter table public.return_status_history force row level security;

alter table public.refunds enable row level security;
alter table public.refunds force row level security;

revoke all privileges
on table
  public.payments,
  public.payment_events,
  public.return_requests,
  public.return_items,
  public.return_evidence,
  public.return_status_history,
  public.refunds
from anon, authenticated;

revoke all privileges
on sequence
  public.payment_events_id_seq,
  public.return_status_history_id_seq
from anon, authenticated;
