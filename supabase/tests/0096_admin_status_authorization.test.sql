begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(5);

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
    'Status Customer',
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

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '96000000-0000-0000-0000-000000000001',
  true
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '96000000-0000-0000-0000-000000000001',
    'role',
    'authenticated',
    'aal',
    'aal2'
  )::text,
  true
);

select is(
  authz.is_admin(),
  true,
  'an active AAL2 administrator receives administrator privileges'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '96000000-0000-0000-0000-000000000002'
  ),
  1,
  'an active AAL2 administrator can use administrator RLS read access'
);

reset role;

update public.profiles
set status = 'SUSPENDED'
where id = '96000000-0000-0000-0000-000000000001';

set local role authenticated;

select is(
  authz.is_admin(),
  false,
  'a suspended AAL2 administrator receives no administrator privileges'
);

select is(
  authz.has_permission('admin.audit.read'),
  false,
  'a suspended administrator receives no blanket administrator permission'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = '96000000-0000-0000-0000-000000000002'
  ),
  0,
  'a suspended administrator cannot use administrator RLS read access'
);

reset role;

select * from finish();

rollback;
