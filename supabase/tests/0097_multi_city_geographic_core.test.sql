begin;

create extension if not exists pgtap
with schema extensions;

set local search_path = extensions, public;

select plan(53);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'market_lifecycle_status'
  ),
  'DRAFT,CONFIGURING,READY_FOR_VALIDATION,ACTIVE,PAUSED,CLOSED',
  'market lifecycle statuses are defined'
);

select is(
  (
    select string_agg(e.enumlabel, ',' order by e.enumsortorder)
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'city_admin_role'
  ),
  'CITY_ADMIN,CITY_OPERATIONS,MERCHANT_REVIEWER,CAPTAIN_OPERATIONS,SUPPORT_AGENT,FINANCE_AGENT',
  'city-scoped administrator roles are defined'
);

select ok(to_regclass('public.cities') is not null, 'cities table exists');
select ok(
  to_regclass('public.city_configurations') is not null,
  'city_configurations table exists'
);
select ok(
  to_regclass('public.service_zones') is not null,
  'service_zones table exists'
);
select ok(
  to_regclass('public.service_zone_pincodes') is not null,
  'service_zone_pincodes table exists'
);
select ok(
  to_regclass('public.admin_city_assignments') is not null,
  'admin_city_assignments table exists'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'cities',
        'city_configurations',
        'service_zones',
        'service_zone_pincodes',
        'admin_city_assignments'
      )
      and c.relrowsecurity
  ),
  5,
  'RLS is enabled on every geographic-core table'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'cities',
        'city_configurations',
        'service_zones',
        'service_zone_pincodes',
        'admin_city_assignments'
      )
      and c.relforcerowsecurity
  ),
  5,
  'RLS is forced on every geographic-core table'
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
    '97000000-0000-0000-0000-000000000901',
    'authenticated',
    'authenticated',
    'global-admin@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '97000000-0000-0000-0000-000000000902',
    'authenticated',
    'authenticated',
    'city-admin@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '97000000-0000-0000-0000-000000000903',
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
    '97000000-0000-0000-0000-000000000901',
    'ADMIN',
    'Global Administrator',
    'ACTIVE'
  ),
  (
    '97000000-0000-0000-0000-000000000902',
    'ADMIN',
    'Tirupati Administrator',
    'ACTIVE'
  ),
  (
    '97000000-0000-0000-0000-000000000903',
    'CUSTOMER',
    'Ordinary User',
    'ACTIVE'
  );

insert into public.admin_profiles (
  user_id,
  employee_code,
  department,
  two_factor_enabled,
  has_global_access
)
values
  (
    '97000000-0000-0000-0000-000000000901',
    'GLOBAL-ADMIN-970',
    'PLATFORM',
    true,
    true
  ),
  (
    '97000000-0000-0000-0000-000000000902',
    'CITY-ADMIN-970',
    'OPERATIONS',
    true,
    false
  );

insert into public.cities (
  id,
  code,
  slug,
  name,
  state_code
)
values
  (
    '97000000-0000-0000-0000-000000000001',
    'TIRUPATI',
    'tirupati',
    'Tirupati',
    'AP'
  ),
  (
    '97000000-0000-0000-0000-000000000002',
    'BENGALURU',
    'bengaluru',
    'Bengaluru',
    'KA'
  );

select is(
  (
    select count(*)::integer
    from public.city_configurations
    where city_id in (
      '97000000-0000-0000-0000-000000000001',
      '97000000-0000-0000-0000-000000000002'
    )
  ),
  2,
  'every city receives a default configuration atomically'
);

select is(
  (
    select default_cod_limit_paise::bigint
    from public.city_configurations
    where city_id = '97000000-0000-0000-0000-000000000001'
  ),
  200000::bigint,
  'default city COD limit is ₹2,000 in integer paise'
);

select throws_ok(
  $$
    insert into public.cities (code, slug, name, state_code)
    values ('TIRUPATI', 'tirupati-copy', 'Tirupati Copy', 'AP')
  $$,
  '23505',
  'duplicate key value violates unique constraint "cities_code_key"',
  'duplicate city codes are rejected'
);

select throws_ok(
  $$
    insert into public.cities (code, slug, name, state_code, status)
    values ('CHITTOOR', 'chittoor', 'Chittoor', 'AP', 'ACTIVE')
  $$,
  '23514',
  'MARKET_INITIAL_STATUS_INVALID',
  'cities cannot bypass the DRAFT initial state'
);

insert into public.service_zones (
  id,
  city_id,
  code,
  slug,
  name
)
values
  (
    '97000000-0000-0000-0000-000000000101',
    '97000000-0000-0000-0000-000000000001',
    'TIRUPATI_CENTRAL',
    'tirupati-central',
    'Tirupati Central'
  ),
  (
    '97000000-0000-0000-0000-000000000102',
    '97000000-0000-0000-0000-000000000001',
    'TIRUPATI_EAST',
    'tirupati-east',
    'Tirupati East'
  ),
  (
    '97000000-0000-0000-0000-000000000201',
    '97000000-0000-0000-0000-000000000002',
    'BENGALURU_CENTRAL',
    'bengaluru-central',
    'Bengaluru Central'
  );

select throws_ok(
  $$
    insert into public.service_zone_pincodes (
      city_id,
      service_zone_id,
      pincode
    )
    values (
      '97000000-0000-0000-0000-000000000001',
      '97000000-0000-0000-0000-000000000101',
      '012345'
    )
  $$,
  '23514',
  'new row for relation "service_zone_pincodes" violates check constraint "service_zone_pincodes_india_format"',
  'invalid Indian pincodes are rejected'
);

select lives_ok(
  $$
    insert into public.service_zone_pincodes (
      id,
      city_id,
      service_zone_id,
      pincode,
      priority,
      is_primary
    )
    values (
      '97000000-0000-0000-0000-000000000301',
      '97000000-0000-0000-0000-000000000001',
      '97000000-0000-0000-0000-000000000101',
      '517501',
      10,
      true
    )
  $$,
  'a valid pincode can be mapped to a service zone'
);

select lives_ok(
  $$
    insert into public.service_zone_pincodes (
      id,
      city_id,
      service_zone_id,
      pincode,
      priority,
      is_primary
    )
    values (
      '97000000-0000-0000-0000-000000000302',
      '97000000-0000-0000-0000-000000000001',
      '97000000-0000-0000-0000-000000000102',
      '517501',
      20,
      false
    )
  $$,
  'overlapping pincode coverage is allowed with explicit precedence'
);

select throws_ok(
  $$
    update public.service_zone_pincodes
    set priority = 10
    where id = '97000000-0000-0000-0000-000000000302'
  $$,
  '23505',
  'duplicate key value violates unique constraint "service_zone_pincodes_active_priority_key"',
  'overlapping active zones cannot use an ambiguous priority'
);

select throws_ok(
  $$
    update public.service_zone_pincodes
    set is_primary = true
    where id = '97000000-0000-0000-0000-000000000302'
  $$,
  '23505',
  'duplicate key value violates unique constraint "service_zone_pincodes_active_primary_key"',
  'one city and pincode can have only one active primary zone'
);

select lives_ok(
  $$
    update public.cities
    set status = 'CONFIGURING'
    where id = '97000000-0000-0000-0000-000000000001'
  $$,
  'DRAFT can transition to CONFIGURING'
);

select throws_ok(
  $$
    update public.cities
    set status = 'ACTIVE'
    where id = '97000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  'MARKET_LIFECYCLE_TRANSITION_INVALID',
  'CONFIGURING cannot bypass READY_FOR_VALIDATION'
);

select lives_ok(
  $$
    update public.cities
    set status = 'READY_FOR_VALIDATION'
    where id = '97000000-0000-0000-0000-000000000001'
  $$,
  'CONFIGURING can transition to READY_FOR_VALIDATION'
);

select lives_ok(
  $$
    update public.cities
    set status = 'ACTIVE'
    where id = '97000000-0000-0000-0000-000000000001'
  $$,
  'READY_FOR_VALIDATION can transition to ACTIVE'
);

select ok(
  (
    select activated_at is not null
    from public.cities
    where id = '97000000-0000-0000-0000-000000000001'
  ),
  'activation records its first activation timestamp'
);

select lives_ok(
  $$
    update public.service_zones
    set status = 'CONFIGURING'
    where id = '97000000-0000-0000-0000-000000000101'
  $$,
  'zone DRAFT can transition to CONFIGURING'
);

select lives_ok(
  $$
    update public.service_zones
    set status = 'READY_FOR_VALIDATION'
    where id = '97000000-0000-0000-0000-000000000101'
  $$,
  'zone CONFIGURING can transition to READY_FOR_VALIDATION'
);

select lives_ok(
  $$
    update public.service_zones
    set status = 'ACTIVE'
    where id = '97000000-0000-0000-0000-000000000101'
  $$,
  'a zone can activate under an active parent city'
);

select lives_ok(
  $$
    update public.service_zones
    set status = 'CONFIGURING'
    where id = '97000000-0000-0000-0000-000000000201'
  $$,
  'second-city zone can enter configuration'
);

select lives_ok(
  $$
    update public.service_zones
    set status = 'READY_FOR_VALIDATION'
    where id = '97000000-0000-0000-0000-000000000201'
  $$,
  'second-city zone can become ready for validation'
);

select throws_ok(
  $$
    update public.service_zones
    set status = 'ACTIVE'
    where id = '97000000-0000-0000-0000-000000000201'
  $$,
  '23514',
  'SERVICE_ZONE_PARENT_CITY_NOT_ACTIVE',
  'a zone cannot activate while its parent city is not active'
);

select lives_ok(
  $$
    update public.cities
    set status = 'PAUSED'
    where id = '97000000-0000-0000-0000-000000000001'
  $$,
  'an active city can be paused'
);

set local role anon;

select is(
  (
    select count(*)::integer
    from public.cities
    where id = '97000000-0000-0000-0000-000000000001'
  ),
  0,
  'a paused city disappears from public discovery'
);

select is(
  (
    select count(*)::integer
    from public.service_zones
    where id = '97000000-0000-0000-0000-000000000101'
  ),
  0,
  'zones disappear publicly when the parent city is paused'
);

select is(
  (
    select count(*)::integer
    from public.service_zone_pincodes
    where id = '97000000-0000-0000-0000-000000000301'
  ),
  0,
  'pincode routing disappears publicly when the city is paused'
);

reset role;

select lives_ok(
  $$
    update public.cities
    set status = 'ACTIVE'
    where id = '97000000-0000-0000-0000-000000000001'
  $$,
  'a paused city can be reactivated'
);

insert into public.admin_city_assignments (
  id,
  admin_user_id,
  city_id,
  role,
  assigned_by,
  reason
)
values (
  '97000000-0000-0000-0000-000000000401',
  '97000000-0000-0000-0000-000000000902',
  '97000000-0000-0000-0000-000000000001',
  'CITY_ADMIN',
  '97000000-0000-0000-0000-000000000901',
  'Tirupati launch ownership'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '97000000-0000-0000-0000-000000000901',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '97000000-0000-0000-0000-000000000901',
    'role',
    'authenticated',
    'aal',
    'aal2'
  )::text,
  true
);

select is(
  authz.is_global_admin(),
  true,
  'an active AAL2 administrator with global access is global'
);

select is(
  (
    select count(*)::integer
    from public.city_configurations
    where city_id in (
      '97000000-0000-0000-0000-000000000001',
      '97000000-0000-0000-0000-000000000002'
    )
  ),
  2,
  'a global administrator can read every city configuration'
);

select is(
  (
    select count(*)::integer
    from public.admin_city_assignments
  ),
  1,
  'a global administrator can read all city assignments'
);

select set_config(
  'request.jwt.claim.sub',
  '97000000-0000-0000-0000-000000000902',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '97000000-0000-0000-0000-000000000902',
    'role',
    'authenticated',
    'aal',
    'aal2'
  )::text,
  true
);

select is(
  authz.is_global_admin(),
  false,
  'a scoped administrator is not a global administrator'
);

select is(
  authz.has_city_access(
    '97000000-0000-0000-0000-000000000001'
  ),
  true,
  'a scoped administrator can access the assigned city'
);

select is(
  authz.has_city_access(
    '97000000-0000-0000-0000-000000000002'
  ),
  false,
  'a scoped administrator cannot access another city'
);

select is(
  authz.can_manage_city(
    '97000000-0000-0000-0000-000000000001'
  ),
  true,
  'CITY_ADMIN can manage the assigned city'
);

select is(
  (
    select count(*)::integer
    from public.city_configurations
  ),
  1,
  'a city administrator reads only the assigned city configuration'
);

select is(
  (
    select count(*)::integer
    from public.cities
    where id = '97000000-0000-0000-0000-000000000002'
  ),
  0,
  'a city administrator cannot read another non-public city'
);

select is(
  (
    select count(*)::integer
    from public.admin_city_assignments
  ),
  1,
  'a city administrator can read assignments in the managed city'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '97000000-0000-0000-0000-000000000902',
    'role',
    'authenticated',
    'aal',
    'aal1'
  )::text,
  true
);

select is(
  authz.has_city_access(
    '97000000-0000-0000-0000-000000000001'
  ),
  false,
  'AAL1 sessions cannot use city-scoped administrator privileges'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '97000000-0000-0000-0000-000000000902',
    'role',
    'authenticated',
    'aal',
    'aal2'
  )::text,
  true
);

select set_config(
  'request.jwt.claim.sub',
  '97000000-0000-0000-0000-000000000903',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '97000000-0000-0000-0000-000000000903',
    'role',
    'authenticated',
    'aal',
    'aal2'
  )::text,
  true
);

select is(
  authz.has_city_access(
    '97000000-0000-0000-0000-000000000001'
  ),
  false,
  'an ordinary authenticated user has no administrative city access'
);

select is(
  (
    select count(*)::integer
    from public.cities
  ),
  1,
  'ordinary users can discover only active cities'
);

select is(
  (
    select count(*)::integer
    from public.service_zones
  ),
  1,
  'ordinary users can discover active zones in active cities'
);

select is(
  (
    select count(*)::integer
    from public.city_configurations
  ),
  0,
  'ordinary users cannot read city commercial configuration'
);

select throws_ok(
  $$
    insert into public.cities (code, slug, name, state_code)
    values ('UNAUTHORISED', 'unauthorised', 'Unauthorised', 'AP')
  $$,
  '42501',
  'permission denied for table cities',
  'authenticated clients cannot mutate cities directly'
);

reset role;

update public.admin_city_assignments
set
  revoked_at = now(),
  revoked_by = '97000000-0000-0000-0000-000000000901'
where id = '97000000-0000-0000-0000-000000000401';

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '97000000-0000-0000-0000-000000000902',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    '97000000-0000-0000-0000-000000000902',
    'role',
    'authenticated',
    'aal',
    'aal2'
  )::text,
  true
);

select is(
  (
    select count(*)::integer
    from public.city_configurations
  ),
  0,
  'revoking a city assignment removes privileged city access'
);

reset role;

select lives_ok(
  $$
    update public.cities
    set status = 'CLOSED'
    where id = '97000000-0000-0000-0000-000000000002'
  $$,
  'a draft city may be closed'
);

select throws_ok(
  $$
    update public.cities
    set status = 'CONFIGURING'
    where id = '97000000-0000-0000-0000-000000000002'
  $$,
  '23514',
  'MARKET_LIFECYCLE_TRANSITION_INVALID',
  'a closed city cannot be reopened'
);

select * from finish();
rollback;
