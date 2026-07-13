begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(5);

select ok(
  to_regprocedure('authz.has_aal2()') is not null,
  'AAL2 authorization predicate exists'
);

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
    '91000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'mfa-admin@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'mfa-customer@example.test',
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
    '91000000-0000-0000-0000-000000000001',
    'ADMIN',
    'MFA Administrator',
    'ACTIVE'
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    'CUSTOMER',
    'MFA Customer',
    'ACTIVE'
  );

insert into public.admin_profiles (
  user_id,
  employee_code,
  department,
  two_factor_enabled
)
values (
  '91000000-0000-0000-0000-000000000001',
  'MFA-ADMIN-ONE',
  'PLATFORM',
  true
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-0000-0000-000000000001',
  true
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '91000000-0000-0000-0000-000000000001',
    'role',
    'authenticated',
    'aal',
    'aal1'
  )::text,
  true
);

select is(
  authz.is_admin(),
  false,
  'an aal1 administrator receives no administrator privileges'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '91000000-0000-0000-0000-000000000001',
    'role',
    'authenticated'
  )::text,
  true
);

select is(
  authz.is_admin(),
  false,
  'an administrator token without aal fails closed'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '91000000-0000-0000-0000-000000000001',
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
  'an aal2 administrator receives administrator privileges'
);

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-0000-0000-000000000002',
  true
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '91000000-0000-0000-0000-000000000002',
    'role',
    'authenticated',
    'aal',
    'aal2'
  )::text,
  true
);

select is(
  authz.is_admin(),
  false,
  'aal2 does not elevate a non-administrator'
);

reset role;

select * from finish();

rollback;
