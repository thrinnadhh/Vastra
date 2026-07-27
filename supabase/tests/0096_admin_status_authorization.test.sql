begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(24);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '96000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'status-admin@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'status-customer@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '96000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'ordinary-user@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (
  id,
  account_type,
  full_name,
  status
)
values
  (
    '96000000-0000-0000-0000-000000000001',
    'ADMIN',
    'Status Administrator',
    'ACTIVE'
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    'CUSTOMER',
    'Target Customer',
    'ACTIVE'
  ),
  (
    '96000000-0000-0000-0000-000000000003',
    'CUSTOMER',
    'Ordinary Customer',
    'ACTIVE'
  );

insert into public.admin_profiles (
  user_id,
  employee_code,
  department,
  two_factor_enabled
)
values (
  '96000000-0000-0000-0000-000000000001',
  'STATUS-ADMIN-ONE',
  'PLATFORM',
  true
);

-- ============================================================================
-- 1. Active AAL2 Admin
-- ============================================================================

set local role authenticated;

select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '96000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);

select is(
  authz.is_admin(),
  true,
  'Active AAL2 admin: is_admin() = true'
);

select is(
  authz.has_permission('admin.audit.read'),
  true,
  'Active AAL2 admin: has_permission(admin.audit.read) = true'
);

select is(
  (select count(*)::integer from public.profiles where id = '96000000-0000-0000-0000-000000000002'),
  1,
  'Active AAL2 admin: RLS cross-user read granted'
);

-- ============================================================================
-- 2. Active AAL1 Admin
-- ============================================================================

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '96000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aal', 'aal1')::text,
  true
);

select is(
  authz.is_admin(),
  false,
  'Active AAL1 admin: is_admin() = false'
);

select is(
  authz.has_permission('admin.audit.read'),
  false,
  'Active AAL1 admin: has_permission(admin.audit.read) = false'
);

select is(
  (select count(*)::integer from public.profiles where id = '96000000-0000-0000-0000-000000000002'),
  0,
  'Active AAL1 admin: RLS cross-user access denied'
);

-- Reset back to AAL2 session context for status tests
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '96000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);

-- ============================================================================
-- 3. Suspended Admin
-- ============================================================================

reset role;
update public.profiles set status = 'SUSPENDED' where id = '96000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  authz.is_admin(),
  false,
  'Suspended admin: is_admin() = false'
);

select is(
  authz.has_permission('admin.audit.read'),
  false,
  'Suspended admin: has_permission(admin.audit.read) = false'
);

select is(
  (select count(*)::integer from public.profiles where id = '96000000-0000-0000-0000-000000000002'),
  0,
  'Suspended admin: RLS cross-user access denied'
);

-- ============================================================================
-- 4. Blocked Admin
-- ============================================================================

reset role;
update public.profiles set status = 'BLOCKED' where id = '96000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  authz.is_admin(),
  false,
  'Blocked admin: is_admin() = false'
);

select is(
  authz.has_permission('admin.audit.read'),
  false,
  'Blocked admin: has_permission(admin.audit.read) = false'
);

select is(
  (select count(*)::integer from public.profiles where id = '96000000-0000-0000-0000-000000000002'),
  0,
  'Blocked admin: RLS cross-user access denied'
);

-- ============================================================================
-- 5. Deleted Admin
-- ============================================================================

reset role;
update public.profiles set status = 'DELETED' where id = '96000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  authz.is_admin(),
  false,
  'Deleted admin: is_admin() = false'
);

select is(
  authz.has_permission('admin.audit.read'),
  false,
  'Deleted admin: has_permission(admin.audit.read) = false'
);

select is(
  (select count(*)::integer from public.profiles where id = '96000000-0000-0000-0000-000000000002'),
  0,
  'Deleted admin: RLS cross-user access denied'
);

-- ============================================================================
-- 6. Pending (Non-Active) Admin
-- ============================================================================

reset role;
update public.profiles set status = 'PENDING' where id = '96000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  authz.is_admin(),
  false,
  'Pending admin: is_admin() = false'
);

select is(
  authz.has_permission('admin.audit.read'),
  false,
  'Pending admin: has_permission(admin.audit.read) = false'
);

select is(
  (select count(*)::integer from public.profiles where id = '96000000-0000-0000-0000-000000000002'),
  0,
  'Pending admin: RLS cross-user access denied'
);

-- ============================================================================
-- 7. Ordinary User with No Admin Profile
-- ============================================================================

select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '96000000-0000-0000-0000-000000000003', 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);

select is(
  authz.is_admin(),
  false,
  'Ordinary user: is_admin() = false'
);

select is(
  authz.has_permission('admin.audit.read'),
  false,
  'Ordinary user: has_permission(admin.audit.read) = false'
);

select is(
  (select count(*)::integer from public.profiles where id = '96000000-0000-0000-0000-000000000002'),
  0,
  'Ordinary user: RLS cross-user access denied'
);

-- ============================================================================
-- 8. Admin-Profile Row with Non-Active Profile (account_type = CUSTOMER + admin_profiles row)
-- ============================================================================

reset role;
update public.profiles set account_type = 'CUSTOMER', status = 'SUSPENDED' where id = '96000000-0000-0000-0000-000000000003';
insert into public.admin_profiles (user_id, employee_code, department, two_factor_enabled)
values ('96000000-0000-0000-0000-000000000003', 'STATUS-ADMIN-THREE', 'PLATFORM', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-0000-0000-000000000003', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '96000000-0000-0000-0000-000000000003', 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);

select is(
  authz.is_admin(),
  false,
  'Admin-profile row with non-active profile: is_admin() = false'
);

select is(
  authz.has_permission('admin.audit.read'),
  false,
  'Admin-profile row with non-active profile: has_permission(admin.audit.read) = false'
);

select is(
  (select count(*)::integer from public.profiles where id = '96000000-0000-0000-0000-000000000002'),
  0,
  'Admin-profile row with non-active profile: RLS cross-user access denied'
);

reset role;

select * from finish();

rollback;
