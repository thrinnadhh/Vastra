-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Logistics: captain_documents
create table if not exists public."captain_documents" (
  "id" uuid default gen_random_uuid() not null primary key,
  "captain_id" uuid not null,
  "document_type" text not null,
  "storage_path" text not null,
  "document_number_last4" text,
  "document_number_encrypted" text,
  "expiry_date" date,
  "verification_status" text default 'PENDING' not null,
  "verified_by" uuid,
  "verified_at" timestamptz,
  "rejection_reason" text,
  "created_at" timestamptz default now() not null,
  constraint "captain_documents_document_type_check" check ("document_type" in ('AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VEHICLE_RC', 'INSURANCE', 'BANK_PROOF', 'PROFILE_PHOTO', 'OTHER')),
  constraint "captain_documents_verification_status_check" check ("verification_status" in ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'))
);

comment on table public."captain_documents" is 'Private KYC, licence, vehicle and bank documents for captains.';

-- Logistics: delivery_tasks
create table if not exists public."delivery_tasks" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_id" uuid,
  "return_request_id" uuid,
  "task_type" text default 'FORWARD_DELIVERY' not null,
  "pickup_shop_id" uuid,
  "pickup_address_snapshot" jsonb default '{}'::jsonb not null,
  "drop_address_snapshot" jsonb default '{}'::jsonb not null,
  "pickup_location" geography(Point,4326) not null,
  "drop_location" geography(Point,4326) not null,
  "status" text default 'CREATED' not null,
  "estimated_distance_meters" integer,
  "estimated_duration_seconds" integer,
  "delivery_fee_paise" bigint default 0 not null,
  "captain_earning_paise" bigint default 0 not null,
  "pickup_code_hash" text,
  "delivery_otp_hash" text,
  "assigned_captain_id" uuid,
  "assignment_attempts" smallint default 0 not null,
  "scheduled_at" timestamptz,
  "assigned_at" timestamptz,
  "picked_up_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "delivery_tasks_task_type_check" check ("task_type" in ('FORWARD_DELIVERY', 'RETURN_PICKUP', 'RETURN_TO_MERCHANT', 'EXCHANGE_DELIVERY')),
  constraint "delivery_tasks_status_check" check ("status" in ('CREATED', 'SEARCHING', 'OFFERED', 'ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROP', 'COMPLETED', 'FAILED', 'CANCELLED')),
  constraint "delivery_tasks_estimated_distance_meters_nonnegative" check ("estimated_distance_meters" is null or "estimated_distance_meters" >= 0),
  constraint "delivery_tasks_estimated_duration_seconds_nonnegative" check ("estimated_duration_seconds" is null or "estimated_duration_seconds" >= 0),
  constraint "delivery_tasks_delivery_fee_paise_nonnegative" check ("delivery_fee_paise" is null or "delivery_fee_paise" >= 0),
  constraint "delivery_tasks_captain_earning_paise_nonnegative" check ("captain_earning_paise" is null or "captain_earning_paise" >= 0),
  constraint "delivery_tasks_assignment_attempts_nonnegative" check ("assignment_attempts" is null or "assignment_attempts" >= 0)
);

comment on table public."delivery_tasks" is 'Reusable delivery job for forward delivery, return pickup, return-to-merchant and later exchange flows.';

-- Logistics: delivery_assignments
create table if not exists public."delivery_assignments" (
  "id" uuid default gen_random_uuid() not null primary key,
  "delivery_task_id" uuid not null,
  "captain_id" uuid not null,
  "assignment_status" text default 'OFFERED' not null,
  "offered_earning_paise" bigint default 0 not null,
  "pickup_distance_meters" integer,
  "offered_at" timestamptz default now() not null,
  "expires_at" timestamptz not null,
  "responded_at" timestamptz,
  "rejection_reason" text,
  "assigned_by" text default 'AUTO' not null,
  "assigned_by_user_id" uuid,
  "created_at" timestamptz default now() not null,
  constraint "delivery_assignments_assignment_status_check" check ("assignment_status" in ('OFFERED', 'ACCEPTED', 'REJECTED', 'TIMED_OUT', 'CANCELLED', 'RELEASED', 'COMPLETED')),
  constraint "delivery_assignments_offered_earning_paise_nonnegative" check ("offered_earning_paise" is null or "offered_earning_paise" >= 0),
  constraint "delivery_assignments_pickup_distance_meters_nonnegative" check ("pickup_distance_meters" is null or "pickup_distance_meters" >= 0),
  constraint "delivery_assignments_assigned_by_check" check ("assigned_by" in ('AUTO', 'ADMIN'))
);

comment on table public."delivery_assignments" is 'Complete dispatch offer history including rejections, timeouts and reassignments.';

-- Logistics: captain_current_locations
create table if not exists public."captain_current_locations" (
  "captain_id" uuid not null primary key,
  "location" geography(Point,4326) not null,
  "heading" numeric(6,2),
  "speed_mps" numeric(8,2),
  "accuracy_meters" numeric(8,2),
  "battery_percent" smallint,
  "active_delivery_task_id" uuid,
  "updated_at" timestamptz default now() not null,
  constraint "captain_current_locations_speed_mps_nonnegative" check ("speed_mps" is null or "speed_mps" >= 0),
  constraint "captain_current_locations_accuracy_meters_nonnegative" check ("accuracy_meters" is null or "accuracy_meters" >= 0),
  constraint "captain_current_locations_battery_percent_check" check (battery_percent between 0 and 100)
);

comment on table public."captain_current_locations" is 'Latest captain location for dispatch and customer tracking; hot copies may also live in Redis.';

-- Logistics: captain_location_history
create table if not exists public."captain_location_history" (
  "id" bigint default generated always as identity not null primary key,
  "captain_id" uuid not null,
  "delivery_task_id" uuid,
  "location" geography(Point,4326) not null,
  "heading" numeric(6,2),
  "speed_mps" numeric(8,2),
  "accuracy_meters" numeric(8,2),
  "recorded_at" timestamptz default now() not null,
  "received_at" timestamptz default now() not null
);

comment on table public."captain_location_history" is 'Durable sampled location trail for active deliveries and dispute investigation. Partition monthly.';

-- Logistics: delivery_events
create table if not exists public."delivery_events" (
  "id" bigint default generated always as identity not null primary key,
  "delivery_task_id" uuid not null,
  "event_type" text not null,
  "actor_user_id" uuid,
  "location" geography(Point,4326),
  "note" text,
  "evidence_path" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamptz default now() not null,
  constraint "delivery_events_event_type_check" check ("event_type" in ('CAPTAIN_ASSIGNED', 'ARRIVED_AT_STORE', 'MERCHANT_DELAY', 'PICKUP_CONFIRMED', 'LEFT_STORE', 'ARRIVED_AT_CUSTOMER', 'DELIVERY_CONFIRMED', 'CUSTOMER_UNAVAILABLE', 'INVALID_ADDRESS', 'CUSTOMER_REFUSED', 'PACKAGE_DAMAGED', 'RETURNING_TO_STORE', 'TASK_COMPLETED', 'OTHER'))
);

comment on table public."delivery_events" is 'Append-only operational event log for pickup, delays, failures, arrival and completion.';

-- Logistics: cod_collections
create table if not exists public."cod_collections" (
  "id" uuid default gen_random_uuid() not null primary key,
  "order_id" uuid not null,
  "delivery_task_id" uuid not null,
  "captain_id" uuid not null,
  "amount_paise" bigint not null,
  "status" text default 'PENDING_COLLECTION' not null,
  "collected_at" timestamptz,
  "deposited_at" timestamptz,
  "reconciled_by" uuid,
  "reconciled_at" timestamptz,
  "created_at" timestamptz default now() not null,
  constraint "cod_collections_rule_1" unique (order_id),
  constraint "cod_collections_amount_paise_nonnegative" check ("amount_paise" is null or "amount_paise" >= 0),
  constraint "cod_collections_status_check" check ("status" in ('PENDING_COLLECTION', 'COLLECTED', 'DEPOSIT_PENDING', 'DEPOSITED', 'RECONCILED', 'DISPUTED'))
);

comment on table public."cod_collections" is 'Cash-on-delivery collection and reconciliation record.';

-- Logistics: captain_earnings
create table if not exists public."captain_earnings" (
  "id" uuid default gen_random_uuid() not null primary key,
  "captain_id" uuid not null,
  "delivery_task_id" uuid not null,
  "base_fare_paise" bigint default 0 not null,
  "distance_fare_paise" bigint default 0 not null,
  "waiting_fee_paise" bigint default 0 not null,
  "peak_incentive_paise" bigint default 0 not null,
  "other_incentive_paise" bigint default 0 not null,
  "tip_paise" bigint default 0 not null,
  "penalty_paise" bigint default 0 not null,
  "total_paise" bigint default 0 not null,
  "status" text default 'PENDING' not null,
  "created_at" timestamptz default now() not null,
  constraint "captain_earnings_rule_1" unique (delivery_task_id),
  constraint "captain_earnings_status_check" check ("status" in ('PENDING', 'AVAILABLE', 'INCLUDED_IN_PAYOUT', 'PAID', 'REVERSED'))
);

comment on table public."captain_earnings" is 'Per-task captain earning breakdown.';
