begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(49);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'shop_verification_status'
  ),
  'PENDING,IN_REVIEW,VERIFIED,REJECTED',
  'shop verification statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'shop_operational_status'
  ),
  'OPEN,BUSY,TEMPORARILY_CLOSED,CLOSED_FOR_DAY,PAUSED,SUSPENDED',
  'shop operational statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'shop_schedule_type'
  ),
  'WEEKLY,SPECIAL_DATE',
  'shop schedule types are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'shop_document_type'
  ),
  'PAN,GST,LICENSE,ADDRESS_PROOF,OWNER_ID,SHOP_PHOTO,OTHER',
  'shop document types are defined'
);

select ok(
  to_regclass('public.addresses') is not null,
  'addresses table exists'
);

select ok(
  to_regclass('public.shops') is not null,
  'shops table exists'
);

select ok(
  to_regclass('public.shop_hours') is not null,
  'shop_hours table exists'
);

select ok(
  to_regclass('public.shop_documents') is not null,
  'shop_documents table exists'
);

select ok(
  to_regclass('public.shop_bank_accounts') is not null,
  'shop_bank_accounts table exists'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'addresses',
        'shops',
        'shop_hours',
        'shop_documents',
        'shop_bank_accounts'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  5,
  'all shop and address tables force row-level security'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('addresses'),
        ('shops'),
        ('shop_hours'),
        ('shop_documents'),
        ('shop_bank_accounts')
    ) as secured_tables(table_name)
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  2,
  'anon table grants match the final RLS surface'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('addresses'),
        ('shops'),
        ('shop_hours'),
        ('shop_documents'),
        ('shop_bank_accounts')
    ) as secured_tables(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  5,
  'authenticated table grants match the final RLS surface'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'addresses_user_id_fkey'
      and conrelid = 'public.addresses'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'addresses reference profiles'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.addresses'::regclass
      and attname = 'location'
      and atttypid = 'extensions.geography'::regtype
      and not attisdropped
  ),
  'addresses use PostGIS geography'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.addresses'::regclass
      and tgname = 'set_addresses_updated_at'
      and not tgisinternal
  ),
  'addresses have an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'addresses_country_code_format'
      and conrelid = 'public.addresses'::regclass
      and contype = 'c'
  ),
  'address country codes are constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'customer_profiles_default_address_id_fkey'
      and conrelid = 'public.customer_profiles'::regclass
      and confrelid = 'public.addresses'::regclass
  ),
  'customer profiles can reference a default address'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shops_merchant_id_fkey'
      and conrelid = 'public.shops'::regclass
      and confrelid = 'public.merchant_profiles'::regclass
  ),
  'shops reference merchant profiles'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shops_address_id_fkey'
      and conrelid = 'public.shops'::regclass
      and confrelid = 'public.addresses'::regclass
  ),
  'shops reference addresses'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.shops'::regclass
      and attname = 'location'
      and atttypid = 'extensions.geography'::regtype
      and not attisdropped
  ),
  'shops use PostGIS geography'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shops_shop_code_key'
      and conrelid = 'public.shops'::regclass
      and contype = 'u'
  ),
  'shop codes are unique'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shops_slug_key'
      and conrelid = 'public.shops'::regclass
      and contype = 'u'
  ),
  'shop slugs are unique'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.shops'::regclass
      and attname = 'verification_status'
      and atttypid = 'public.shop_verification_status'::regtype
      and not attisdropped
  ),
  'shops use shop verification status'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.shops'::regclass
      and attname = 'operational_status'
      and atttypid = 'public.shop_operational_status'::regtype
      and not attisdropped
  ),
  'shops use shop operational status'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shops_rating_consistency'
      and conrelid = 'public.shops'::regclass
      and contype = 'c'
  ),
  'shop ratings remain internally consistent'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.shops'::regclass
      and tgname = 'set_shops_updated_at'
      and not tgisinternal
  ),
  'shops have an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_hours_shop_id_fkey'
      and conrelid = 'public.shop_hours'::regclass
      and confrelid = 'public.shops'::regclass
  ),
  'shop hours reference shops'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.shop_hours'::regclass
      and attname = 'schedule_type'
      and atttypid = 'public.shop_schedule_type'::regtype
      and not attisdropped
  ),
  'shop hours use schedule types'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_hours_schedule_shape_check'
      and conrelid = 'public.shop_hours'::regclass
      and contype = 'c'
  ),
  'weekly and special-date schedules are structurally constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_hours_time_shape_check'
      and conrelid = 'public.shop_hours'::regclass
      and contype = 'c'
  ),
  'open and closed hour records are structurally constrained'
);

select ok(
  to_regclass('public.shop_hours_weekly_unique_idx') is not null,
  'weekly shop-hour entries are unique per weekday'
);

select ok(
  to_regclass('public.shop_hours_special_date_unique_idx') is not null,
  'special-date shop-hour entries are unique per date'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.shop_hours'::regclass
      and tgname = 'set_shop_hours_updated_at'
      and not tgisinternal
  ),
  'shop hours have an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_documents_shop_id_fkey'
      and conrelid = 'public.shop_documents'::regclass
      and confrelid = 'public.shops'::regclass
  ),
  'shop documents reference shops'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_documents_uploaded_by_fkey'
      and conrelid = 'public.shop_documents'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'shop document uploads reference profiles'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_documents_verified_by_fkey'
      and conrelid = 'public.shop_documents'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'shop document verification references profiles'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_documents_storage_object_key_key'
      and conrelid = 'public.shop_documents'::regclass
      and contype = 'u'
  ),
  'shop document storage keys are unique'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.shop_documents'::regclass
      and attname = 'document_type'
      and atttypid = 'public.shop_document_type'::regtype
      and not attisdropped
  ),
  'shop documents use document types'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.shop_documents'::regclass
      and attname = 'verification_status'
      and atttypid = 'public.shop_verification_status'::regtype
      and not attisdropped
  ),
  'shop documents use verification statuses'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_documents_verification_consistency'
      and conrelid = 'public.shop_documents'::regclass
      and contype = 'c'
  ),
  'shop document verification state is internally consistent'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.shop_documents'::regclass
      and tgname = 'set_shop_documents_updated_at'
      and not tgisinternal
  ),
  'shop documents have an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_bank_accounts_shop_id_fkey'
      and conrelid = 'public.shop_bank_accounts'::regclass
      and confrelid = 'public.shops'::regclass
  ),
  'shop bank accounts reference shops'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_bank_accounts_verified_by_fkey'
      and conrelid = 'public.shop_bank_accounts'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'bank-account verification references profiles'
);

select ok(
  to_regclass('public.shop_bank_accounts_one_primary_idx') is not null,
  'each shop has at most one primary bank account'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_bank_accounts_ifsc_format'
      and conrelid = 'public.shop_bank_accounts'::regclass
      and contype = 'c'
  ),
  'IFSC codes are constrained'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_bank_accounts_last4_format'
      and conrelid = 'public.shop_bank_accounts'::regclass
      and contype = 'c'
  ),
  'bank-account last-four digits are constrained'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.shop_bank_accounts'::regclass
      and attname = 'verification_status'
      and atttypid = 'public.shop_verification_status'::regtype
      and not attisdropped
  ),
  'shop bank accounts use verification statuses'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'shop_bank_accounts_verification_consistency'
      and conrelid = 'public.shop_bank_accounts'::regclass
      and contype = 'c'
  ),
  'bank-account verification state is internally consistent'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.shop_bank_accounts'::regclass
      and tgname = 'set_shop_bank_accounts_updated_at'
      and not tgisinternal
  ),
  'shop bank accounts have an updated_at trigger'
);

select * from finish();

rollback;
