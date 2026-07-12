-- Vastra identity, application profiles, and role-based access structure.
--
-- Authentication identity remains exclusively in Supabase auth.users.
-- These public tables contain only application profile and authorization data.
--
-- RLS is enabled and forced immediately. Client grants and policies are added
-- later in the dedicated RLS migration.
--
-- Forward-fix strategy:
-- - Add enum values and columns through later ordered migrations.
-- - Never rewrite this migration after it has been applied outside local use.
-- - Profile deletion workflows must clean dependent private data before deleting
--   the corresponding auth.users row.

create type public.profile_status as enum (
  'ACTIVE',
  'PENDING',
  'BLOCKED',
  'SUSPENDED',
  'DELETED'
);

create type public.device_platform as enum (
  'ANDROID',
  'IOS',
  'WEB'
);

create type public.push_provider as enum (
  'FCM',
  'APNS',
  'WEB_PUSH'
);

create type public.merchant_onboarding_status as enum (
  'STARTED',
  'DOCUMENTS_PENDING',
  'VERIFICATION_PENDING',
  'CORRECTION_REQUIRED',
  'APPROVED',
  'CATALOGUE_SETUP',
  'TRAINING_PENDING',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'REJECTED'
);

create type public.kyc_status as enum (
  'PENDING',
  'IN_REVIEW',
  'VERIFIED',
  'REJECTED'
);

create type public.captain_availability_status as enum (
  'OFFLINE',
  'AVAILABLE',
  'OFFERED',
  'ASSIGNED',
  'AT_PICKUP',
  'DELIVERING',
  'ON_BREAK',
  'SUSPENDED'
);

create type public.vehicle_type as enum (
  'BIKE',
  'SCOOTER',
  'BICYCLE',
  'WALKER',
  'AUTO',
  'CAR'
);

create table public.profiles (
  id uuid primary key,
  account_type public.account_type not null default 'CUSTOMER',
  full_name text,
  phone_number text,
  avatar_url text,
  status public.profile_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_id_fkey
    foreign key (id)
    references auth.users (id)
    on update cascade
    on delete restrict,

  constraint profiles_full_name_nonempty
    check (
      full_name is null
      or length(btrim(full_name)) > 0
    ),

  constraint profiles_phone_number_nonempty
    check (
      phone_number is null
      or length(btrim(phone_number)) > 0
    )
);

comment on table public.profiles is
  'Application profile linked one-to-one with Supabase-managed auth.users.';

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_fingerprint text not null,
  platform public.device_platform not null,
  push_provider public.push_provider,
  push_token text,
  app_name public.account_type not null,
  app_version text,
  device_model text,
  os_version text,
  notification_enabled boolean not null default true,
  order_sound_enabled boolean not null default true,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_devices_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint user_devices_user_fingerprint_key
    unique (user_id, device_fingerprint),

  constraint user_devices_fingerprint_nonempty
    check (length(btrim(device_fingerprint)) > 0),

  constraint user_devices_push_registration_pair_check
    check (
      (
        push_provider is null
        and push_token is null
      )
      or (
        push_provider is not null
        and push_token is not null
        and length(btrim(push_token)) > 0
      )
    ),

  constraint user_devices_revoked_after_creation_check
    check (
      revoked_at is null
      or revoked_at >= created_at
    )
);

comment on table public.user_devices is
  'Registered application devices, push destinations, and revocation state.';

create table public.customer_profiles (
  user_id uuid primary key,
  date_of_birth date,
  gender_preference text,
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_profiles_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint customer_profiles_gender_preference_nonempty
    check (
      gender_preference is null
      or length(btrim(gender_preference)) > 0
    )
);

comment on table public.customer_profiles is
  'Customer-specific application profile data.';

create table public.merchant_profiles (
  user_id uuid primary key,
  legal_name text not null,
  business_type text,
  pan_last4 text,
  pan_encrypted text,
  gst_number text,
  onboarding_status public.merchant_onboarding_status
    not null
    default 'STARTED',
  kyc_status public.kyc_status not null default 'PENDING',
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint merchant_profiles_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint merchant_profiles_approved_by_fkey
    foreign key (approved_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint merchant_profiles_legal_name_nonempty
    check (length(btrim(legal_name)) > 0),

  constraint merchant_profiles_pan_last4_format
    check (
      pan_last4 is null
      or pan_last4 ~ '^[A-Z0-9]{4}$'
    ),

  constraint merchant_profiles_gst_number_nonempty
    check (
      gst_number is null
      or length(btrim(gst_number)) > 0
    )
);

comment on table public.merchant_profiles is
  'Merchant legal identity, KYC state, and onboarding progress.';

create table public.captain_profiles (
  user_id uuid primary key,
  captain_code text not null,
  kyc_status public.kyc_status not null default 'PENDING',
  availability_status public.captain_availability_status
    not null
    default 'OFFLINE',
  vehicle_type public.vehicle_type,
  vehicle_number text,
  driving_licence_last4 text,
  driving_licence_encrypted text,
  rating_average public.rating_value,
  rating_count public.non_negative_quantity not null default 0,
  completed_deliveries public.non_negative_quantity not null default 0,
  cash_balance_paise public.money_paise not null default 0,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint captain_profiles_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint captain_profiles_captain_code_key
    unique (captain_code),

  constraint captain_profiles_captain_code_nonempty
    check (length(btrim(captain_code)) > 0),

  constraint captain_profiles_vehicle_number_nonempty
    check (
      vehicle_number is null
      or length(btrim(vehicle_number)) > 0
    ),

  constraint captain_profiles_licence_last4_format
    check (
      driving_licence_last4 is null
      or driving_licence_last4 ~ '^[A-Z0-9]{4}$'
    ),

  constraint captain_profiles_rating_consistency
    check (
      (
        rating_count = 0
        and rating_average is null
      )
      or (
        rating_count > 0
        and rating_average is not null
      )
    )
);

comment on table public.captain_profiles is
  'Delivery partner identity, KYC, availability, vehicle, and performance data.';

create table public.admin_profiles (
  user_id uuid primary key,
  employee_code text not null,
  department text not null,
  city_scope text[] not null default '{}'::text[],
  manager_id uuid,
  two_factor_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admin_profiles_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint admin_profiles_manager_id_fkey
    foreign key (manager_id)
    references public.admin_profiles (user_id)
    on update cascade
    on delete set null,

  constraint admin_profiles_employee_code_key
    unique (employee_code),

  constraint admin_profiles_employee_code_nonempty
    check (length(btrim(employee_code)) > 0),

  constraint admin_profiles_department_nonempty
    check (length(btrim(department)) > 0),

  constraint admin_profiles_manager_not_self
    check (
      manager_id is null
      or manager_id <> user_id
    )
);

comment on table public.admin_profiles is
  'Internal employee identity, operational scope, manager, and MFA state.';

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_system_role boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint roles_code_key unique (code),

  constraint roles_code_format
    check (code ~ '^[A-Z][A-Z0-9_]*$'),

  constraint roles_name_nonempty
    check (length(btrim(name)) > 0)
);

comment on table public.roles is
  'Named application roles for granular operational and administrative access.';

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  module text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint permissions_code_key unique (code),

  constraint permissions_code_format
    check (code ~ '^[a-z][a-z0-9_.-]*$'),

  constraint permissions_module_nonempty
    check (length(btrim(module)) > 0),

  constraint permissions_name_nonempty
    check (length(btrim(name)) > 0)
);

comment on table public.permissions is
  'Fine-grained application permissions assigned through roles.';

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,

  constraint user_roles_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint user_roles_role_id_fkey
    foreign key (role_id)
    references public.roles (id)
    on update cascade
    on delete restrict,

  constraint user_roles_assigned_by_fkey
    foreign key (assigned_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint user_roles_user_role_key
    unique (user_id, role_id),

  constraint user_roles_revoked_after_assignment_check
    check (
      revoked_at is null
      or revoked_at >= assigned_at
    )
);

comment on table public.user_roles is
  'User-to-role assignment with revocation state and assigning actor.';

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null,
  permission_id uuid not null,
  created_at timestamptz not null default now(),

  constraint role_permissions_role_id_fkey
    foreign key (role_id)
    references public.roles (id)
    on update cascade
    on delete restrict,

  constraint role_permissions_permission_id_fkey
    foreign key (permission_id)
    references public.permissions (id)
    on update cascade
    on delete restrict,

  constraint role_permissions_role_permission_key
    unique (role_id, permission_id)
);

comment on table public.role_permissions is
  'Many-to-many mapping between roles and permissions.';

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_user_devices_updated_at
before update on public.user_devices
for each row
execute function public.set_updated_at();

create trigger set_customer_profiles_updated_at
before update on public.customer_profiles
for each row
execute function public.set_updated_at();

create trigger set_merchant_profiles_updated_at
before update on public.merchant_profiles
for each row
execute function public.set_updated_at();

create trigger set_captain_profiles_updated_at
before update on public.captain_profiles
for each row
execute function public.set_updated_at();

create trigger set_admin_profiles_updated_at
before update on public.admin_profiles
for each row
execute function public.set_updated_at();

create trigger set_roles_updated_at
before update on public.roles
for each row
execute function public.set_updated_at();

create trigger set_permissions_updated_at
before update on public.permissions
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.user_devices enable row level security;
alter table public.user_devices force row level security;

alter table public.customer_profiles enable row level security;
alter table public.customer_profiles force row level security;

alter table public.merchant_profiles enable row level security;
alter table public.merchant_profiles force row level security;

alter table public.captain_profiles enable row level security;
alter table public.captain_profiles force row level security;

alter table public.admin_profiles enable row level security;
alter table public.admin_profiles force row level security;

alter table public.roles enable row level security;
alter table public.roles force row level security;

alter table public.permissions enable row level security;
alter table public.permissions force row level security;

alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;

revoke all privileges
on table
  public.profiles,
  public.user_devices,
  public.customer_profiles,
  public.merchant_profiles,
  public.captain_profiles,
  public.admin_profiles,
  public.roles,
  public.permissions,
  public.user_roles,
  public.role_permissions
from anon, authenticated;
