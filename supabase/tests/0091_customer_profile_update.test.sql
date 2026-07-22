begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(12);

select ok(
  to_regprocedure('public.update_current_customer_profile(text)') is not null,
  'customer profile update RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.update_current_customer_profile(text)',
    'EXECUTE'
  ),
  'authenticated users may execute the profile update RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.update_current_customer_profile(text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the profile update RPC'
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
    'fa100000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'profile-customer@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'fa100000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'profile-merchant@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, account_type, full_name, status)
values
  ('fa100000-0000-4000-8000-000000000001', 'CUSTOMER', null, 'ACTIVE'),
  ('fa100000-0000-4000-8000-000000000002', 'MERCHANT', 'Profile Merchant', 'ACTIVE');

insert into public.customer_profiles (user_id, profile_completed)
values ('fa100000-0000-4000-8000-000000000001', false);

insert into public.merchant_profiles (user_id, legal_name)
values ('fa100000-0000-4000-8000-000000000002', 'Profile Merchant Legal');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'fa100000-0000-4000-8000-000000000001', true);

select results_eq(
  $$
    select full_name, profile_completed
    from public.update_current_customer_profile('  Trinadh   B  ')
  $$,
  $$ values ('Trinadh B'::text, true) $$,
  'customer profile update normalizes the name and completes setup'
);

select is(
  (
    select full_name
    from public.profiles
    where id = 'fa100000-0000-4000-8000-000000000001'
  ),
  'Trinadh B',
  'common customer profile stores the normalized name'
);
select is(
  (
    select profile_completed
    from public.customer_profiles
    where user_id = 'fa100000-0000-4000-8000-000000000001'
  ),
  true,
  'customer-specific profile is marked complete'
);
select ok(
  (
    select updated_at > created_at
    from public.customer_profiles
    where user_id = 'fa100000-0000-4000-8000-000000000001'
  ),
  'customer profile update timestamp advances'
);

select throws_ok(
  $$ select * from public.update_current_customer_profile(' ') $$,
  '22023',
  'Customer profile input is invalid',
  'blank customer name is rejected'
);
select throws_ok(
  $$ select * from public.update_current_customer_profile(repeat('a', 121)) $$,
  '22023',
  'Customer profile input is invalid',
  'overlong customer name is rejected'
);
select is(
  (
    select full_name
    from public.profiles
    where id = 'fa100000-0000-4000-8000-000000000001'
  ),
  'Trinadh B',
  'invalid updates preserve the previous name'
);

select set_config('request.jwt.claim.sub', 'fa100000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$ select * from public.update_current_customer_profile('Merchant Attempt') $$,
  'P0002',
  'Customer profile is unavailable',
  'non-customer accounts cannot use the customer profile mutation'
);
select is(
  (
    select full_name
    from public.profiles
    where id = 'fa100000-0000-4000-8000-000000000002'
  ),
  'Profile Merchant',
  'rejected merchant mutation preserves merchant profile data'
);

select * from finish();
rollback;
