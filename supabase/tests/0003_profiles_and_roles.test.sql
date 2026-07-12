begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(48);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'profile_status'
  ),
  'ACTIVE,PENDING,BLOCKED,SUSPENDED,DELETED',
  'profile statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'device_platform'
  ),
  'ANDROID,IOS,WEB',
  'device platforms are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'push_provider'
  ),
  'FCM,APNS,WEB_PUSH',
  'push providers are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'merchant_onboarding_status'
  ),
  'STARTED,DOCUMENTS_PENDING,VERIFICATION_PENDING,CORRECTION_REQUIRED,APPROVED,CATALOGUE_SETUP,TRAINING_PENDING,ACTIVE,PAUSED,SUSPENDED,REJECTED',
  'merchant onboarding statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'kyc_status'
  ),
  'PENDING,IN_REVIEW,VERIFIED,REJECTED',
  'KYC statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'captain_availability_status'
  ),
  'OFFLINE,AVAILABLE,OFFERED,ASSIGNED,AT_PICKUP,DELIVERING,ON_BREAK,SUSPENDED',
  'captain availability statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'vehicle_type'
  ),
  'BIKE,SCOOTER,BICYCLE,WALKER,AUTO,CAR',
  'vehicle types are defined'
);

select ok(
  to_regclass('public.profiles') is not null,
  'profiles table exists'
);

select ok(
  to_regclass('public.user_devices') is not null,
  'user_devices table exists'
);

select ok(
  to_regclass('public.customer_profiles') is not null,
  'customer_profiles table exists'
);

select ok(
  to_regclass('public.merchant_profiles') is not null,
  'merchant_profiles table exists'
);

select ok(
  to_regclass('public.captain_profiles') is not null,
  'captain_profiles table exists'
);

select ok(
  to_regclass('public.admin_profiles') is not null,
  'admin_profiles table exists'
);

select ok(
  to_regclass('public.roles') is not null,
  'roles table exists'
);

select ok(
  to_regclass('public.permissions') is not null,
  'permissions table exists'
);

select ok(
  to_regclass('public.user_roles') is not null,
  'user_roles table exists'
);

select ok(
  to_regclass('public.role_permissions') is not null,
  'role_permissions table exists'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'profiles',
        'user_devices',
        'customer_profiles',
        'merchant_profiles',
        'captain_profiles',
        'admin_profiles',
        'roles',
        'permissions',
        'user_roles',
        'role_permissions'
      )
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  10,
  'all identity tables force row-level security'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('profiles'),
        ('user_devices'),
        ('customer_profiles'),
        ('merchant_profiles'),
        ('captain_profiles'),
        ('admin_profiles'),
        ('roles'),
        ('permissions'),
        ('user_roles'),
        ('role_permissions')
    ) as identity_tables(table_name)
    where has_table_privilege(
      'anon',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'anonymous clients have no identity table read grants'
);

select is(
  (
    select count(*)::integer
    from (
      values
        ('profiles'),
        ('user_devices'),
        ('customer_profiles'),
        ('merchant_profiles'),
        ('captain_profiles'),
        ('admin_profiles'),
        ('roles'),
        ('permissions'),
        ('user_roles'),
        ('role_permissions')
    ) as identity_tables(table_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', table_name),
      'SELECT'
    )
  ),
  0,
  'authenticated clients have no identity table grants before policies'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'profiles_id_fkey'
      and conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'r'
      and confupdtype = 'c'
  ),
  'profiles references auth.users with restricted deletion'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname = 'account_type'
      and atttypid = 'public.account_type'::regtype
      and not attisdropped
  ),
  'profiles uses the shared account_type enum'
);

select ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname = 'status'
      and atttypid = 'public.profile_status'::regtype
      and not attisdropped
  ),
  'profiles uses profile_status'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'set_profiles_updated_at'
      and not tgisinternal
  ),
  'profiles has an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'user_devices_user_fingerprint_key'
      and conrelid = 'public.user_devices'::regclass
      and contype = 'u'
  ),
  'user device fingerprints are unique per user'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'user_devices_user_id_fkey'
      and conrelid = 'public.user_devices'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'user devices reference profiles'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'user_devices_push_registration_pair_check'
      and conrelid = 'public.user_devices'::regclass
      and contype = 'c'
  ),
  'push provider and token consistency is constrained'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.user_devices'::regclass
      and tgname = 'set_user_devices_updated_at'
      and not tgisinternal
  ),
  'user_devices has an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'customer_profiles_user_id_fkey'
      and conrelid = 'public.customer_profiles'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'customer profiles reference profiles'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.customer_profiles'::regclass
      and tgname = 'set_customer_profiles_updated_at'
      and not tgisinternal
  ),
  'customer_profiles has an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'merchant_profiles_user_id_fkey'
      and conrelid = 'public.merchant_profiles'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'merchant profiles reference profiles'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'merchant_profiles_approved_by_fkey'
      and conrelid = 'public.merchant_profiles'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'merchant approvals reference the approving profile'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.merchant_profiles'::regclass
      and tgname = 'set_merchant_profiles_updated_at'
      and not tgisinternal
  ),
  'merchant_profiles has an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'captain_profiles_user_id_fkey'
      and conrelid = 'public.captain_profiles'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'captain profiles reference profiles'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'captain_profiles_captain_code_key'
      and conrelid = 'public.captain_profiles'::regclass
      and contype = 'u'
  ),
  'captain codes are unique'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.captain_profiles'::regclass
      and tgname = 'set_captain_profiles_updated_at'
      and not tgisinternal
  ),
  'captain_profiles has an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'admin_profiles_user_id_fkey'
      and conrelid = 'public.admin_profiles'::regclass
      and confrelid = 'public.profiles'::regclass
  ),
  'admin profiles reference profiles'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'admin_profiles_manager_id_fkey'
      and conrelid = 'public.admin_profiles'::regclass
      and confrelid = 'public.admin_profiles'::regclass
  ),
  'admin managers reference admin profiles'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.admin_profiles'::regclass
      and tgname = 'set_admin_profiles_updated_at'
      and not tgisinternal
  ),
  'admin_profiles has an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'roles_code_key'
      and conrelid = 'public.roles'::regclass
      and contype = 'u'
  ),
  'role codes are unique'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.roles'::regclass
      and tgname = 'set_roles_updated_at'
      and not tgisinternal
  ),
  'roles has an updated_at trigger'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'permissions_code_key'
      and conrelid = 'public.permissions'::regclass
      and contype = 'u'
  ),
  'permission codes are unique'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.permissions'::regclass
      and tgname = 'set_permissions_updated_at'
      and not tgisinternal
  ),
  'permissions has an updated_at trigger'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and conname in (
        'user_roles_user_id_fkey',
        'user_roles_role_id_fkey',
        'user_roles_assigned_by_fkey'
      )
      and contype = 'f'
  ),
  3,
  'user_roles has all required foreign keys'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_user_role_key'
      and conrelid = 'public.user_roles'::regclass
      and contype = 'u'
  ),
  'each user-role pair is unique'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_revoked_after_assignment_check'
      and conrelid = 'public.user_roles'::regclass
      and contype = 'c'
  ),
  'role revocation cannot predate assignment'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid = 'public.role_permissions'::regclass
      and conname in (
        'role_permissions_role_id_fkey',
        'role_permissions_permission_id_fkey'
      )
      and contype = 'f'
  ),
  2,
  'role_permissions has both required foreign keys'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'role_permissions_role_permission_key'
      and conrelid = 'public.role_permissions'::regclass
      and contype = 'u'
  ),
  'each role-permission pair is unique'
);

select * from finish();

rollback;
