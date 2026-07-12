-- Vastra customer addresses and merchant shop foundations.
--
-- The frozen MVP schema keeps addresses as reusable records and shops reference
-- them through address_id. Product catalogue and inventory tables are added in
-- later migrations.
--
-- RLS is enabled and forced immediately. Client policies and grants are added
-- later in the dedicated RLS ticket.

create type public.shop_verification_status as enum (
  'PENDING',
  'IN_REVIEW',
  'VERIFIED',
  'REJECTED'
);

create type public.shop_operational_status as enum (
  'OPEN',
  'BUSY',
  'TEMPORARILY_CLOSED',
  'CLOSED_FOR_DAY',
  'PAUSED',
  'SUSPENDED'
);

create type public.shop_schedule_type as enum (
  'WEEKLY',
  'SPECIAL_DATE'
);

create type public.shop_document_type as enum (
  'PAN',
  'GST',
  'LICENSE',
  'ADDRESS_PROOF',
  'OWNER_ID',
  'SHOP_PHOTO',
  'OTHER'
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text,
  recipient_name text not null,
  phone_number text not null,
  line1 text not null,
  line2 text,
  landmark text,
  area text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  country_code text not null default 'IN',
  location extensions.geography(point, 4326) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint addresses_user_id_fkey
    foreign key (user_id)
    references public.profiles (id)
    on update cascade
    on delete cascade,

  constraint addresses_recipient_name_nonempty
    check (length(btrim(recipient_name)) > 0),

  constraint addresses_phone_number_nonempty
    check (length(btrim(phone_number)) > 0),

  constraint addresses_line1_nonempty
    check (length(btrim(line1)) > 0),

  constraint addresses_area_nonempty
    check (length(btrim(area)) > 0),

  constraint addresses_city_nonempty
    check (length(btrim(city)) > 0),

  constraint addresses_state_nonempty
    check (length(btrim(state)) > 0),

  constraint addresses_postal_code_nonempty
    check (length(btrim(postal_code)) > 0),

  constraint addresses_country_code_format
    check (country_code ~ '^[A-Z]{2}$'),

  constraint addresses_label_nonempty
    check (
      label is null
      or length(btrim(label)) > 0
    )
);

comment on table public.addresses is
  'Reusable user-owned delivery, contact, and shop address records.';

alter table public.customer_profiles
add column default_address_id uuid;

alter table public.customer_profiles
add constraint customer_profiles_default_address_id_fkey
foreign key (default_address_id)
references public.addresses (id)
on update cascade
on delete set null;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null,
  address_id uuid not null,
  shop_code text not null,
  name text not null,
  slug text not null,
  description text,
  phone_number text not null,
  email text,
  location extensions.geography(point, 4326) not null,
  logo_object_key text,
  cover_image_object_key text,
  verification_status public.shop_verification_status
    not null
    default 'PENDING',
  operational_status public.shop_operational_status
    not null
    default 'CLOSED_FOR_DAY',
  accepts_online_orders boolean not null default false,
  service_radius_meters public.positive_quantity
    not null
    default 5000,
  minimum_order_paise public.money_paise
    not null
    default 0,
  average_preparation_minutes public.non_negative_quantity
    not null
    default 15,
  rating_average public.rating_value,
  rating_count public.non_negative_quantity
    not null
    default 0,
  follower_count public.non_negative_quantity
    not null
    default 0,
  version public.positive_quantity
    not null
    default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint shops_merchant_id_fkey
    foreign key (merchant_id)
    references public.merchant_profiles (user_id)
    on update cascade
    on delete restrict,

  constraint shops_address_id_fkey
    foreign key (address_id)
    references public.addresses (id)
    on update cascade
    on delete restrict,

  constraint shops_shop_code_key
    unique (shop_code),

  constraint shops_slug_key
    unique (slug),

  constraint shops_shop_code_format
    check (shop_code ~ '^[A-Z][A-Z0-9_-]*$'),

  constraint shops_name_nonempty
    check (length(btrim(name)) > 0),

  constraint shops_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint shops_phone_number_nonempty
    check (length(btrim(phone_number)) > 0),

  constraint shops_email_nonempty
    check (
      email is null
      or length(btrim(email)) > 0
    ),

  constraint shops_rating_consistency
    check (
      (
        rating_count = 0
        and rating_average is null
      )
      or (
        rating_count > 0
        and rating_average is not null
      )
    ),

  constraint shops_deleted_after_creation_check
    check (
      deleted_at is null
      or deleted_at >= created_at
    )
);

comment on table public.shops is
  'Canonical customer-facing shop controlled by an approved merchant.';

create table public.shop_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  schedule_type public.shop_schedule_type
    not null
    default 'WEEKLY',
  day_of_week smallint,
  special_date date,
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shop_hours_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete cascade,

  constraint shop_hours_schedule_shape_check
    check (
      (
        schedule_type = 'WEEKLY'
        and day_of_week between 0 and 6
        and special_date is null
      )
      or (
        schedule_type = 'SPECIAL_DATE'
        and day_of_week is null
        and special_date is not null
      )
    ),

  constraint shop_hours_time_shape_check
    check (
      (
        is_closed
        and open_time is null
        and close_time is null
      )
      or (
        not is_closed
        and open_time is not null
        and close_time is not null
        and open_time <> close_time
      )
    )
);

comment on table public.shop_hours is
  'Weekly and date-specific shop opening-hour records.';

create unique index shop_hours_weekly_unique_idx
on public.shop_hours (shop_id, day_of_week)
where schedule_type = 'WEEKLY';

create unique index shop_hours_special_date_unique_idx
on public.shop_hours (shop_id, special_date)
where schedule_type = 'SPECIAL_DATE';

create table public.shop_documents (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  uploaded_by uuid not null,
  document_type public.shop_document_type not null,
  document_number_last4 text,
  document_number_encrypted text,
  storage_object_key text not null,
  verification_status public.shop_verification_status
    not null
    default 'PENDING',
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shop_documents_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete cascade,

  constraint shop_documents_uploaded_by_fkey
    foreign key (uploaded_by)
    references public.profiles (id)
    on update cascade
    on delete restrict,

  constraint shop_documents_verified_by_fkey
    foreign key (verified_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint shop_documents_storage_object_key_key
    unique (storage_object_key),

  constraint shop_documents_storage_key_nonempty
    check (length(btrim(storage_object_key)) > 0),

  constraint shop_documents_last4_format
    check (
      document_number_last4 is null
      or document_number_last4 ~ '^[A-Z0-9]{4}$'
    ),

  constraint shop_documents_verification_consistency
    check (
      (
        verification_status in ('PENDING', 'IN_REVIEW')
        and verified_by is null
        and verified_at is null
        and rejection_reason is null
      )
      or (
        verification_status = 'VERIFIED'
        and verified_by is not null
        and verified_at is not null
        and rejection_reason is null
      )
      or (
        verification_status = 'REJECTED'
        and verified_by is not null
        and verified_at is not null
        and rejection_reason is not null
        and length(btrim(rejection_reason)) > 0
      )
    )
);

comment on table public.shop_documents is
  'Private merchant and shop verification document metadata.';

create table public.shop_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  account_holder_name text not null,
  account_number_last4 text not null,
  account_number_encrypted text not null,
  ifsc_code text not null,
  bank_name text,
  branch_name text,
  is_primary boolean not null default true,
  verification_status public.shop_verification_status
    not null
    default 'PENDING',
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shop_bank_accounts_shop_id_fkey
    foreign key (shop_id)
    references public.shops (id)
    on update cascade
    on delete cascade,

  constraint shop_bank_accounts_verified_by_fkey
    foreign key (verified_by)
    references public.profiles (id)
    on update cascade
    on delete set null,

  constraint shop_bank_accounts_holder_nonempty
    check (length(btrim(account_holder_name)) > 0),

  constraint shop_bank_accounts_last4_format
    check (account_number_last4 ~ '^[0-9]{4}$'),

  constraint shop_bank_accounts_encrypted_nonempty
    check (length(btrim(account_number_encrypted)) > 0),

  constraint shop_bank_accounts_ifsc_format
    check (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),

  constraint shop_bank_accounts_verification_consistency
    check (
      (
        verification_status in ('PENDING', 'IN_REVIEW')
        and verified_by is null
        and verified_at is null
        and rejection_reason is null
      )
      or (
        verification_status = 'VERIFIED'
        and verified_by is not null
        and verified_at is not null
        and rejection_reason is null
      )
      or (
        verification_status = 'REJECTED'
        and verified_by is not null
        and verified_at is not null
        and rejection_reason is not null
        and length(btrim(rejection_reason)) > 0
      )
    )
);

comment on table public.shop_bank_accounts is
  'Private merchant payout bank-account metadata for a shop.';

create unique index shop_bank_accounts_one_primary_idx
on public.shop_bank_accounts (shop_id)
where is_primary;

create trigger set_addresses_updated_at
before update on public.addresses
for each row
execute function public.set_updated_at();

create trigger set_shops_updated_at
before update on public.shops
for each row
execute function public.set_updated_at();

create trigger set_shop_hours_updated_at
before update on public.shop_hours
for each row
execute function public.set_updated_at();

create trigger set_shop_documents_updated_at
before update on public.shop_documents
for each row
execute function public.set_updated_at();

create trigger set_shop_bank_accounts_updated_at
before update on public.shop_bank_accounts
for each row
execute function public.set_updated_at();

alter table public.addresses enable row level security;
alter table public.addresses force row level security;

alter table public.shops enable row level security;
alter table public.shops force row level security;

alter table public.shop_hours enable row level security;
alter table public.shop_hours force row level security;

alter table public.shop_documents enable row level security;
alter table public.shop_documents force row level security;

alter table public.shop_bank_accounts enable row level security;
alter table public.shop_bank_accounts force row level security;

revoke all privileges
on table
  public.addresses,
  public.shops,
  public.shop_hours,
  public.shop_documents,
  public.shop_bank_accounts
from anon, authenticated;
