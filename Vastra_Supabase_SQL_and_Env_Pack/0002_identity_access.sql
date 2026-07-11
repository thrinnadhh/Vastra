-- Vastra Supabase schema starter
-- Generated for PostgreSQL/Supabase. Review in local and staging environments before production.
-- All money values are BIGINT paise; timestamps are TIMESTAMPTZ; geospatial fields use PostGIS.


-- Identity & Access: profiles
create table if not exists public."profiles" (
  "id" uuid not null primary key,
  "account_type" text default 'CUSTOMER' not null,
  "full_name" text,
  "phone_number" text,
  "email" citext,
  "avatar_path" text,
  "status" text default 'ACTIVE' not null,
  "preferred_language" text default 'en' not null,
  "last_login_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  "deleted_at" timestamptz,
  constraint "profiles_account_type_check" check ("account_type" in ('CUSTOMER', 'MERCHANT', 'CAPTAIN', 'ADMIN')),
  constraint "profiles_status_check" check ("status" in ('ACTIVE', 'PENDING', 'BLOCKED', 'SUSPENDED', 'DELETED'))
);

comment on table public."profiles" is 'Application profile linked one-to-one with Supabase-managed auth.users. Self-sign-up always starts as CUSTOMER; trusted workflows promote merchant, captain or admin accounts.';

-- Identity & Access: user_devices
create table if not exists public."user_devices" (
  "id" uuid default gen_random_uuid() not null primary key,
  "user_id" uuid not null,
  "device_fingerprint" text not null,
  "platform" text not null,
  "push_provider" text,
  "push_token" text,
  "app_name" text not null,
  "app_version" text,
  "device_model" text,
  "os_version" text,
  "notification_enabled" boolean default true not null,
  "order_sound_enabled" boolean default true not null,
  "last_seen_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "user_devices_rule_1" unique (user_id, device_fingerprint),
  constraint "user_devices_platform_check" check ("platform" in ('ANDROID', 'IOS', 'WEB')),
  constraint "user_devices_push_provider_check" check ("push_provider" is null or "push_provider" in ('FCM', 'APNS', 'WEB_PUSH')),
  constraint "user_devices_app_name_check" check ("app_name" in ('CUSTOMER', 'MERCHANT', 'CAPTAIN', 'ADMIN'))
);

comment on table public."user_devices" is 'Registered mobile/web devices used for session visibility, push tokens, merchant ringing alerts and security controls.';

-- Identity & Access: addresses
create table if not exists public."addresses" (
  "id" uuid default gen_random_uuid() not null primary key,
  "user_id" uuid not null,
  "label" text,
  "recipient_name" text not null,
  "phone_number" text not null,
  "line1" text not null,
  "line2" text,
  "landmark" text,
  "area" text not null,
  "city" text not null,
  "state" text not null,
  "postal_code" text not null,
  "country_code" text default 'IN' not null,
  "location" geography(Point,4326),
  "is_default" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

comment on table public."addresses" is 'Reusable customer delivery addresses and contact snapshots. Shop addresses are stored directly on shops to avoid ownership ambiguity.';

-- Identity & Access: customer_profiles
create table if not exists public."customer_profiles" (
  "user_id" uuid not null primary key,
  "date_of_birth" date,
  "gender_preference" text,
  "default_address_id" uuid,
  "profile_completed" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null
);

comment on table public."customer_profiles" is 'Customer-specific data that should not be mixed into the generic profile.';

-- Identity & Access: customer_preferences
create table if not exists public."customer_preferences" (
  "customer_id" uuid not null primary key,
  "preferred_category_ids" uuid[] default '{}'::uuid[] not null,
  "preferred_colours" text[] default '{}'::text[] not null,
  "avoided_colours" text[] default '{}'::text[] not null,
  "preferred_styles" text[] default '{}'::text[] not null,
  "preferred_occasions" text[] default '{}'::text[] not null,
  "preferred_brands" text[] default '{}'::text[] not null,
  "min_budget_paise" bigint,
  "max_budget_paise" bigint,
  "fit_preference" text default 'REGULAR' not null,
  "include_footwear" boolean default true not null,
  "include_accessories" boolean default true not null,
  "updated_at" timestamptz default now() not null,
  constraint "customer_preferences_min_budget_paise_nonnegative" check ("min_budget_paise" is null or "min_budget_paise" >= 0),
  constraint "customer_preferences_max_budget_paise_nonnegative" check ("max_budget_paise" is null or "max_budget_paise" >= 0)
);

comment on table public."customer_preferences" is 'Explicit fashion, budget, fit and notification preferences used by rule-based recommendations and later ML models.';

-- Identity & Access: merchant_profiles
create table if not exists public."merchant_profiles" (
  "user_id" uuid not null primary key,
  "legal_name" text not null,
  "business_type" text,
  "pan_last4" text,
  "pan_encrypted" text,
  "GST_number" text,
  "onboarding_status" text default 'STARTED' not null,
  "kyc_status" text default 'PENDING' not null,
  "approved_at" timestamptz,
  "approved_by" uuid,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "merchant_profiles_onboarding_status_check" check ("onboarding_status" in ('STARTED', 'DOCUMENTS_PENDING', 'VERIFICATION_PENDING', 'CORRECTION_REQUIRED', 'APPROVED', 'CATALOGUE_SETUP', 'TRAINING_PENDING', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'REJECTED')),
  constraint "merchant_profiles_kyc_status_check" check ("kyc_status" in ('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED'))
);

comment on table public."merchant_profiles" is 'Merchant legal/onboarding profile. A single merchant login may own multiple shops later while MVP can enforce one active shop.';

-- Identity & Access: captain_profiles
create table if not exists public."captain_profiles" (
  "user_id" uuid not null primary key,
  "captain_code" text not null,
  "kyc_status" text default 'PENDING' not null,
  "availability_status" text default 'OFFLINE' not null,
  "vehicle_type" text,
  "vehicle_number" text,
  "driving_licence_last4" text,
  "driving_licence_encrypted" text,
  "rating_average" numeric(3,2) default 0 not null,
  "rating_count" integer default 0 not null,
  "completed_deliveries" integer default 0 not null,
  "cash_balance_paise" bigint default 0 not null,
  "approved_at" timestamptz,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "captain_profiles_captain_code_key" unique ("captain_code"),
  constraint "captain_profiles_kyc_status_check" check ("kyc_status" in ('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED')),
  constraint "captain_profiles_availability_status_check" check ("availability_status" in ('OFFLINE', 'AVAILABLE', 'OFFERED', 'ASSIGNED', 'AT_PICKUP', 'DELIVERING', 'ON_BREAK', 'SUSPENDED')),
  constraint "captain_profiles_vehicle_type_check" check ("vehicle_type" is null or "vehicle_type" in ('BIKE', 'SCOOTER', 'BICYCLE', 'WALKER', 'AUTO', 'CAR')),
  constraint "captain_profiles_rating_average_check" check (rating_average between 0 and 5),
  constraint "captain_profiles_rating_count_nonnegative" check ("rating_count" is null or "rating_count" >= 0),
  constraint "captain_profiles_completed_deliveries_nonnegative" check ("completed_deliveries" is null or "completed_deliveries" >= 0)
);

comment on table public."captain_profiles" is 'Delivery partner profile, availability, vehicle and performance data.';

-- Identity & Access: admin_profiles
create table if not exists public."admin_profiles" (
  "user_id" uuid not null primary key,
  "employee_code" text not null,
  "department" text not null,
  "city_scope" text[] default '{}'::text[] not null,
  "manager_id" uuid,
  "two_factor_enabled" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "updated_at" timestamptz default now() not null,
  constraint "admin_profiles_employee_code_key" unique ("employee_code")
);

comment on table public."admin_profiles" is 'Internal employee profile, department, city scope and second-factor status.';

-- Identity & Access: roles
create table if not exists public."roles" (
  "id" uuid default gen_random_uuid() not null primary key,
  "code" text not null,
  "name" text not null,
  "description" text,
  "is_system_role" boolean default true not null,
  "created_at" timestamptz default now() not null,
  constraint "roles_code_key" unique ("code")
);

comment on table public."roles" is 'Named application roles for granular admin and operational access.';

-- Identity & Access: permissions
create table if not exists public."permissions" (
  "id" uuid default gen_random_uuid() not null primary key,
  "code" text not null,
  "module" text not null,
  "name" text not null,
  "description" text,
  "created_at" timestamptz default now() not null,
  constraint "permissions_code_key" unique ("code")
);

comment on table public."permissions" is 'Fine-grained actions used by admin RLS helpers and backend authorization.';

-- Identity & Access: user_roles
create table if not exists public."user_roles" (
  "id" uuid default gen_random_uuid() not null primary key,
  "user_id" uuid not null,
  "role_id" uuid not null,
  "assigned_by" uuid,
  "assigned_at" timestamptz default now() not null,
  "revoked_at" timestamptz,
  constraint "user_roles_rule_1" unique (user_id, role_id)
);

comment on table public."user_roles" is 'Many-to-many mapping of users to internal roles; normally only admins receive these roles.';

-- Identity & Access: role_permissions
create table if not exists public."role_permissions" (
  "id" uuid default gen_random_uuid() not null primary key,
  "role_id" uuid not null,
  "permission_id" uuid not null,
  "created_at" timestamptz default now() not null,
  constraint "role_permissions_rule_1" unique (role_id, permission_id)
);

comment on table public."role_permissions" is 'Many-to-many mapping between roles and allowed actions.';
