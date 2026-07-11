-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Operations: support_tickets
create table if not exists public."support_tickets" (
  "id" uuid default gen_random_uuid() not null primary key,
  "ticket_number" text not null,
  "raised_by_user_id" uuid not null,
  "raised_by_type" text not null,
  "order_id" uuid,
  "shop_id" uuid,
  "delivery_task_id" uuid,
  "return_request_id" uuid,
  "category" text not null,
  "priority" text default 'MEDIUM' not null,
  "status" text default 'OPEN' not null,
  "subject" text not null,
  "description" text not null,
  "assigned_team" text,
  "assigned_to" uuid,
  "resolution_code" text,
  "resolution_note" text,
  "created_at" timestamptz default now() not null,
  "first_response_at" timestamptz,
  "resolved_at" timestamptz,
  "closed_at" timestamptz,
  "updated_at" timestamptz default now() not null,
  constraint "support_tickets_ticket_number_key" unique ("ticket_number"),
  constraint "support_tickets_raised_by_type_check" check ("raised_by_type" in ('CUSTOMER', 'MERCHANT', 'CAPTAIN', 'ADMIN')),
  constraint "support_tickets_priority_check" check ("priority" in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  constraint "support_tickets_status_check" check ("status" in ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'ESCALATED', 'RESOLVED', 'CLOSED'))
);

comment on table public."support_tickets" is 'Unified support ticket for customer, merchant, captain and internal issues.';

-- Operations: support_messages
create table if not exists public."support_messages" (
  "id" bigint default generated always as identity not null primary key,
  "ticket_id" uuid not null,
  "sender_id" uuid not null,
  "message_type" text default 'TEXT' not null,
  "message" text,
  "attachment_path" text,
  "is_internal_note" boolean default false not null,
  "created_at" timestamptz default now() not null,
  constraint "support_messages_message_type_check" check ("message_type" in ('TEXT', 'IMAGE', 'FILE', 'SYSTEM'))
);

comment on table public."support_messages" is 'Ticket conversation, attachments and internal notes.';

-- Campaigns: campaigns
create table if not exists public."campaigns" (
  "id" uuid default gen_random_uuid() not null primary key,
  "name" text not null,
  "campaign_type" text not null,
  "objective" text,
  "audience_rules" jsonb default '{}'::jsonb not null,
  "budget_paise" bigint,
  "status" text default 'DRAFT' not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "created_by" uuid not null,
  "approved_by" uuid,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "campaigns_campaign_type_check" check ("campaign_type" in ('BANNER', 'COUPON', 'FREE_DELIVERY', 'FESTIVAL', 'GROUP_STYLE', 'MERCHANT_SPONSORED')),
  constraint "campaigns_budget_paise_nonnegative" check ("budget_paise" is null or "budget_paise" >= 0),
  constraint "campaigns_status_check" check ("status" in ('DRAFT', 'APPROVAL_REQUIRED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'))
);

comment on table public."campaigns" is 'Admin-created banners, coupons, city promotions and Group Style campaigns.';

-- Campaigns: banners
create table if not exists public."banners" (
  "id" uuid default gen_random_uuid() not null primary key,
  "campaign_id" uuid not null,
  "mobile_image_path" text not null,
  "desktop_image_path" text,
  "title" text not null,
  "subtitle" text,
  "cta_text" text,
  "destination_type" text not null,
  "destination_id" uuid,
  "external_url" text,
  "priority" integer default 0 not null,
  "placement" text default 'HOME_TOP' not null,
  "impression_count" bigint default 0 not null,
  "click_count" bigint default 0 not null,
  "created_at" timestamptz default now() not null,
  constraint "banners_destination_type_check" check ("destination_type" in ('CATEGORY', 'PRODUCT', 'SHOP', 'COLLECTION', 'GROUP_STYLE', 'OFFER', 'URL'))
);

comment on table public."banners" is 'Responsive banner creative and destination shown on customer home/discovery surfaces.';

-- Field Operations: merchant_leads
create table if not exists public."merchant_leads" (
  "id" uuid default gen_random_uuid() not null primary key,
  "shop_name" text not null,
  "owner_name" text,
  "phone_number" text not null,
  "category_summary" text,
  "address_text" text,
  "location" geography(Point,4326),
  "lead_source" text default 'FIELD' not null,
  "lead_status" text default 'NEW' not null,
  "assigned_executive_id" uuid,
  "next_followup_at" timestamptz,
  "notes" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "merchant_leads_lead_status_check" check ("lead_status" in ('NEW', 'CONTACTED', 'INTERESTED', 'VISIT_SCHEDULED', 'ONBOARDING_STARTED', 'ACTIVE', 'NOT_INTERESTED', 'FOLLOW_UP'))
);

comment on table public."merchant_leads" is 'Prospective shop pipeline for field acquisition and onboarding.';

-- Field Operations: field_visits
create table if not exists public."field_visits" (
  "id" uuid default gen_random_uuid() not null primary key,
  "merchant_lead_id" uuid,
  "shop_id" uuid,
  "executive_id" uuid not null,
  "visit_type" text not null,
  "scheduled_at" timestamptz not null,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "start_location" geography(Point,4326),
  "completion_location" geography(Point,4326),
  "merchant_confirmation_method" text,
  "merchant_confirmation_at" timestamptz,
  "status" text default 'SCHEDULED' not null,
  "notes" text,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "field_visits_visit_type_check" check ("visit_type" in ('SALES', 'ONBOARDING', 'TRAINING', 'SUPPORT', 'INVENTORY_AUDIT', 'RETENTION')),
  constraint "field_visits_merchant_confirmation_method_check" check ("merchant_confirmation_method" is null or "merchant_confirmation_method" in ('OTP', 'SIGNATURE', 'APP_CONFIRMATION')),
  constraint "field_visits_status_check" check ("status" in ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'))
);

comment on table public."field_visits" is 'GPS and merchant-confirmed merchant onboarding/support visit.';

-- Field Operations: field_visit_checklist_items
create table if not exists public."field_visit_checklist_items" (
  "id" uuid default gen_random_uuid() not null primary key,
  "field_visit_id" uuid not null,
  "item_code" text not null,
  "label" text not null,
  "is_required" boolean default true not null,
  "is_completed" boolean default false not null,
  "evidence_path" text,
  "completed_by" uuid,
  "completed_at" timestamptz,
  "notes" text,
  constraint "field_visit_checklist_items_rule_1" unique (field_visit_id, item_code)
);

comment on table public."field_visit_checklist_items" is 'Structured onboarding/training/support checklist evidence.';

-- Moderation: product_moderation_cases
create table if not exists public."product_moderation_cases" (
  "id" uuid default gen_random_uuid() not null primary key,
  "product_id" uuid not null,
  "case_type" text not null,
  "status" text default 'OPEN' not null,
  "moderator_id" uuid,
  "merchant_response" text,
  "resolution_note" text,
  "created_at" timestamptz default now() not null,
  "resolved_at" timestamptz,
  constraint "product_moderation_cases_case_type_check" check ("case_type" in ('NEW_LISTING', 'IMAGE_QUALITY', 'WRONG_CATEGORY', 'DUPLICATE', 'MISLEADING_PRICE', 'PROHIBITED', 'CUSTOMER_REPORT')),
  constraint "product_moderation_cases_status_check" check ("status" in ('OPEN', 'ASSIGNED', 'MERCHANT_ACTION_REQUIRED', 'APPROVED', 'REJECTED', 'CLOSED'))
);

comment on table public."product_moderation_cases" is 'Product quality, duplicate, category, pricing and prohibited-content moderation case.';

-- Governance: approval_requests
create table if not exists public."approval_requests" (
  "id" uuid default gen_random_uuid() not null primary key,
  "action_type" text not null,
  "entity_type" text not null,
  "entity_id" uuid not null,
  "requested_by" uuid not null,
  "requested_changes" jsonb not null,
  "reason" text not null,
  "status" text default 'PENDING' not null,
  "approved_by" uuid,
  "decision_note" text,
  "created_at" timestamptz default now() not null,
  "decided_at" timestamptz,
  "executed_at" timestamptz,
  constraint "approval_requests_action_type_check" check ("action_type" in ('LARGE_REFUND', 'BANK_CHANGE', 'MERCHANT_SUSPENSION', 'CAPTAIN_SUSPENSION', 'SETTLEMENT_ADJUSTMENT', 'CAMPAIGN_BUDGET', 'OTHER')),
  constraint "approval_requests_status_check" check ("status" in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXECUTED'))
);

comment on table public."approval_requests" is 'Maker-checker workflow for large refunds, bank changes, suspensions, settlement adjustments and campaigns.';

-- Risk: fraud_cases
create table if not exists public."fraud_cases" (
  "id" uuid default gen_random_uuid() not null primary key,
  "case_number" text not null,
  "case_type" text not null,
  "subject_user_id" uuid,
  "shop_id" uuid,
  "order_id" uuid,
  "risk_score" numeric(6,3),
  "signals" jsonb default '{}'::jsonb not null,
  "status" text default 'OPEN' not null,
  "assigned_to" uuid,
  "action_taken" text,
  "notes" text,
  "created_at" timestamptz default now() not null,
  "resolved_at" timestamptz,
  constraint "fraud_cases_case_number_key" unique ("case_number"),
  constraint "fraud_cases_case_type_check" check ("case_type" in ('FAKE_ORDER', 'DUPLICATE_ACCOUNT', 'REFUND_ABUSE', 'COD_ABUSE', 'MERCHANT_MANIPULATION', 'CAPTAIN_FRAUD', 'ACCOUNT_TAKEOVER', 'OTHER')),
  constraint "fraud_cases_risk_score_check" check (risk_score between 0 and 100),
  constraint "fraud_cases_status_check" check ("status" in ('OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'CLEARED', 'CONFIRMED', 'CLOSED'))
);

comment on table public."fraud_cases" is 'Investigation record for suspicious orders, referrals, refunds, COD, merchants or captains.';

-- Governance: audit_logs
create table if not exists public."audit_logs" (
  "id" bigint default generated always as identity not null primary key,
  "actor_user_id" uuid,
  "actor_role" text default 'SYSTEM' not null,
  "action" text not null,
  "entity_type" text not null,
  "entity_id" uuid,
  "old_values" jsonb,
  "new_values" jsonb,
  "reason" text,
  "ip_address" inet,
  "device_id" uuid,
  "request_id" uuid,
  "created_at" timestamptz default now() not null
);

comment on table public."audit_logs" is 'Append-only record of sensitive mutations and admin/backend actions. Partition monthly and never expose to clients.';

-- Configuration: system_settings
create table if not exists public."system_settings" (
  "id" uuid default gen_random_uuid() not null primary key,
  "setting_key" text not null,
  "setting_value" jsonb not null,
  "value_type" text not null,
  "scope_type" text default 'GLOBAL' not null,
  "scope_id" text,
  "is_secret" boolean default false not null,
  "version" integer default 1 not null,
  "updated_by" uuid not null,
  "updated_at" timestamptz default now() not null,
  constraint "system_settings_setting_key_key" unique ("setting_key"),
  constraint "system_settings_rule_1" unique (setting_key, scope_type, scope_id),
  constraint "system_settings_value_type_check" check ("value_type" in ('BOOLEAN', 'NUMBER', 'STRING', 'JSON')),
  constraint "system_settings_scope_type_check" check ("scope_type" in ('GLOBAL', 'CITY', 'SHOP')),
  constraint "system_settings_version_nonnegative" check ("version" is null or "version" >= 0)
);

comment on table public."system_settings" is 'Versioned platform configuration such as timeouts, limits and feature flags.';

-- Configuration: service_zones
create table if not exists public."service_zones" (
  "id" uuid default gen_random_uuid() not null primary key,
  "name" text not null,
  "city" text not null,
  "zone_type" text default 'DELIVERY' not null,
  "boundary" geography(Polygon,4326) not null,
  "is_active" boolean default true not null,
  "base_delivery_fee_paise" bigint default 0 not null,
  "per_km_fee_paise" bigint default 0 not null,
  "minimum_order_paise" bigint default 0 not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "service_zones_zone_type_check" check ("zone_type" in ('DELIVERY', 'MERCHANT_ONBOARDING', 'CAPTAIN_OPERATIONS')),
  constraint "service_zones_base_delivery_fee_paise_nonnegative" check ("base_delivery_fee_paise" is null or "base_delivery_fee_paise" >= 0),
  constraint "service_zones_per_km_fee_paise_nonnegative" check ("per_km_fee_paise" is null or "per_km_fee_paise" >= 0),
  constraint "service_zones_minimum_order_paise_nonnegative" check ("minimum_order_paise" is null or "minimum_order_paise" >= 0)
);

comment on table public."service_zones" is 'Polygonal city/service areas used for customer serviceability and operational routing.';
