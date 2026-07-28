begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(39);

select ok(
  to_regclass('private.city_configuration_versions') is not null,
  'versioned city configuration evidence exists'
);
select ok(
  to_regclass('private.city_activation_readiness') is not null,
  'city activation readiness evidence exists'
);
select ok(
  to_regclass('private.city_activation_reports') is not null,
  'immutable city activation reports exist'
);
select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relname in (
        'city_configuration_versions',
        'city_activation_readiness',
        'city_activation_reports'
      )
      and c.relrowsecurity
  ),
  3,
  'every Phase 2E evidence table enables RLS'
);
select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relname in (
        'city_configuration_versions',
        'city_activation_readiness',
        'city_activation_reports'
      )
      and c.relforcerowsecurity
  ),
  3,
  'every Phase 2E evidence table forces RLS'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.admin_update_city_configuration(uuid,uuid,integer,jsonb,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke city configuration commands directly'
);
select is(
  has_function_privilege(
    'service_role',
    'public.admin_update_city_configuration(uuid,uuid,integer,jsonb,text,text,text,uuid)',
    'EXECUTE'
  ),
  true,
  'the trusted backend may invoke city configuration commands'
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
    'e3000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'phase2e-global@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'e3000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'phase2e-city@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'e3000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'phase2e-user@example.test',
    crypt('local-test-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, account_type, full_name, status)
values
  ('e3000000-0000-4000-8000-000000000001', 'ADMIN', 'Phase 2E Global', 'ACTIVE'),
  ('e3000000-0000-4000-8000-000000000002', 'ADMIN', 'Phase 2E City', 'ACTIVE'),
  ('e3000000-0000-4000-8000-000000000003', 'CUSTOMER', 'Phase 2E User', 'ACTIVE');

insert into public.admin_profiles (
  user_id,
  employee_code,
  department,
  two_factor_enabled,
  has_global_access
)
values
  ('e3000000-0000-4000-8000-000000000001', 'P2E-GLOBAL', 'PLATFORM', true, true),
  ('e3000000-0000-4000-8000-000000000002', 'P2E-CITY', 'OPERATIONS', true, false);

insert into public.cities (id, code, slug, name, state_code, created_by, updated_by)
values
  (
    'e3100000-0000-4000-8000-000000000001',
    'P2E_TIRUPATI',
    'p2e-tirupati',
    'Phase 2E Tirupati',
    'AP',
    'e3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001'
  ),
  (
    'e3100000-0000-4000-8000-000000000002',
    'P2E_BENGALURU',
    'p2e-bengaluru',
    'Phase 2E Bengaluru',
    'KA',
    'e3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001'
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
  'e3200000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000002',
  'e3100000-0000-4000-8000-000000000001',
  'CITY_ADMIN',
  'e3000000-0000-4000-8000-000000000001',
  'Phase 2E test assignment'
);

select is(
  (
    public.admin_update_city_configuration(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      1,
      jsonb_build_object(
        'localDeliveryEnabled', true,
        'defaultCodLimitPaise', 250000,
        'perKmDeliveryFeePaise', 1200,
        'operatingHours', jsonb_build_object('monday', jsonb_build_array('09:00', '21:00')),
        'cancellationPolicy', jsonb_build_object('version', 1),
        'refundPolicy', jsonb_build_object('version', 1)
      ),
      'DATA_CORRECTION',
      'Initial Phase 2E configuration',
      'phase2e-request-config-1',
      'e3300000-0000-4000-8000-000000000001'
    ) -> 'controlPlane' -> 'configuration' ->> 'version'
  )::integer,
  2,
  'global admin updates configuration with optimistic versioning'
);
select is(
  (
    select per_km_delivery_fee_paise::bigint
    from public.city_configurations
    where city_id = 'e3100000-0000-4000-8000-000000000001'
  ),
  1200::bigint,
  'the authoritative commercial configuration is updated'
);
select is(
  (
    select count(*)::integer
    from private.city_configuration_versions
    where city_id = 'e3100000-0000-4000-8000-000000000001'
      and version = 1
  ),
  1,
  'the superseded configuration snapshot is immutable evidence'
);
select is(
  (
    public.admin_update_city_configuration(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      1,
      jsonb_build_object(
        'localDeliveryEnabled', true,
        'defaultCodLimitPaise', 250000,
        'perKmDeliveryFeePaise', 1200,
        'operatingHours', jsonb_build_object('monday', jsonb_build_array('09:00', '21:00')),
        'cancellationPolicy', jsonb_build_object('version', 1),
        'refundPolicy', jsonb_build_object('version', 1)
      ),
      'DATA_CORRECTION',
      'Initial Phase 2E configuration',
      'phase2e-request-config-1',
      'e3300000-0000-4000-8000-000000000001'
    ) ->> 'replayed'
  )::boolean,
  true,
  'an identical configuration command safely replays'
);
select is(
  (
    select version
    from public.city_configurations
    where city_id = 'e3100000-0000-4000-8000-000000000001'
  ),
  2,
  'idempotent replay does not increment the configuration version'
);
select throws_ok(
  $$
    select public.admin_update_city_configuration(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      2,
      '{"defaultCodLimitPaise":300000}'::jsonb,
      'DATA_CORRECTION',
      'Different payload',
      'phase2e-request-config-conflict',
      'e3300000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'ADMIN_IDEMPOTENCY_CONFLICT',
  'an idempotency key cannot be reused with a different command'
);
select throws_ok(
  $$
    select public.admin_update_city_configuration(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      1,
      '{"baseDeliveryFeePaise":500}'::jsonb,
      'DATA_CORRECTION',
      'Stale version',
      'phase2e-request-config-stale',
      'e3300000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  'ADMIN_CITY_CONFIGURATION_VERSION_CONFLICT',
  'stale configuration versions fail explicitly'
);
select is(
  (
    public.admin_update_city_configuration(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000001',
      2,
      '{"baseDeliveryFeePaise":500}'::jsonb,
      'DATA_CORRECTION',
      'Scoped city update',
      'phase2e-request-city-admin',
      'e3300000-0000-4000-8000-000000000003'
    ) -> 'controlPlane' -> 'configuration' ->> 'version'
  )::integer,
  3,
  'a scoped city admin may update the assigned city'
);
select throws_ok(
  $$
    select public.admin_update_city_configuration(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000002',
      1,
      '{"baseDeliveryFeePaise":500}'::jsonb,
      'DATA_CORRECTION',
      'Cross-city attempt',
      'phase2e-request-cross-city',
      'e3300000-0000-4000-8000-000000000004'
    )
  $$,
  'P0001',
  'ADMIN_CITY_ACCESS_DENIED',
  'a scoped administrator cannot mutate another city'
);
select throws_ok(
  $$
    select public.admin_update_city_configuration(
      'e3000000-0000-4000-8000-000000000003',
      'e3100000-0000-4000-8000-000000000001',
      3,
      '{"baseDeliveryFeePaise":600}'::jsonb,
      'DATA_CORRECTION',
      'Ordinary user attempt',
      'phase2e-request-user',
      'e3300000-0000-4000-8000-000000000005'
    )
  $$,
  'P0001',
  'ADMIN_ACCESS_DENIED',
  'ordinary users cannot execute trusted city commands'
);

update public.cities
set status = 'CONFIGURING'
where id = 'e3100000-0000-4000-8000-000000000001';
update public.cities
set status = 'READY_FOR_VALIDATION'
where id = 'e3100000-0000-4000-8000-000000000001';

select is(
  (
    public.admin_upsert_service_zone(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000001',
      null,
      null,
      '{"code":"P2E_CENTRAL","slug":"p2e-central","name":"P2E Central","status":"DRAFT","defaultDeliveryRadiusMeters":6000}'::jsonb,
      'DATA_CORRECTION',
      'Create launch zone',
      'phase2e-request-zone-create',
      'e3400000-0000-4000-8000-000000000001'
    ) -> 'controlPlane' -> 'zones' -> 0 ->> 'id'
  )::uuid,
  'e3400000-0000-4000-8000-000000000001'::uuid,
  'new zones use the idempotency key as a deterministic identity'
);
select is(
  (
    public.admin_upsert_service_zone(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000001',
      null,
      null,
      '{"code":"P2E_CENTRAL","slug":"p2e-central","name":"P2E Central","status":"DRAFT","defaultDeliveryRadiusMeters":6000}'::jsonb,
      'DATA_CORRECTION',
      'Create launch zone',
      'phase2e-request-zone-create',
      'e3400000-0000-4000-8000-000000000001'
    ) ->> 'replayed'
  )::boolean,
  true,
  'zone creation safely replays without duplicate rows'
);
select throws_ok(
  $$
    select public.admin_upsert_service_zone(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000001',
      'e3400000-0000-4000-8000-000000000001',
      1,
      '{"status":"ACTIVE"}'::jsonb,
      'OPERATIONAL_RECOVERY',
      'Unsafe direct activation',
      'phase2e-request-zone-active',
      'e3400000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  'ADMIN_SERVICE_ZONE_ACTIVATION_REQUIRES_CITY_PREFLIGHT',
  'service zones cannot bypass city activation preflight'
);
select lives_ok(
  $$
    select public.admin_upsert_service_zone(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000001',
      'e3400000-0000-4000-8000-000000000001',
      1,
      '{"status":"CONFIGURING"}'::jsonb,
      'DATA_CORRECTION',
      'Configure launch zone',
      'phase2e-request-zone-configure',
      'e3400000-0000-4000-8000-000000000003'
    )
  $$,
  'zone can enter configuration through an audited command'
);
select lives_ok(
  $$
    select public.admin_upsert_service_zone(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000001',
      'e3400000-0000-4000-8000-000000000001',
      2,
      '{"status":"READY_FOR_VALIDATION"}'::jsonb,
      'DATA_CORRECTION',
      'Validate launch zone',
      'phase2e-request-zone-ready',
      'e3400000-0000-4000-8000-000000000004'
    )
  $$,
  'zone can become validation-ready without becoming active'
);
select is(
  (
    public.admin_upsert_service_zone_pincode(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000001',
      'e3400000-0000-4000-8000-000000000001',
      null,
      null,
      '517501',
      1,
      true,
      true,
      'DATA_CORRECTION',
      'Create primary launch pincode',
      'phase2e-request-pincode',
      'e3500000-0000-4000-8000-000000000001'
    ) -> 'controlPlane' -> 'zones' -> 0 -> 'pincodes' -> 0 ->> 'id'
  )::uuid,
  'e3500000-0000-4000-8000-000000000001'::uuid,
  'new pincode mappings use deterministic idempotent identities'
);
select throws_ok(
  $$
    select public.admin_update_city_activation_readiness(
      'e3000000-0000-4000-8000-000000000002',
      'e3100000-0000-4000-8000-000000000001',
      1,
      '{"activeCaptainCount":5}'::jsonb,
      'DATA_CORRECTION',
      'Scoped readiness attempt',
      'phase2e-request-readiness-city',
      'e3600000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'ADMIN_GLOBAL_ACCESS_REQUIRED',
  'external launch-readiness evidence is global-admin only'
);
select is(
  (
    public.admin_update_city_activation_readiness(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      1,
      jsonb_build_object(
        'activeCaptainCount', 5,
        'standbyCaptainCount', 2,
        'paymentProviderHealthy', true,
        'smsOtpProviderHealthy', true,
        'fcmProviderHealthy', true,
        'observabilityHealthy', true,
        'unresolvedHighBlockers', 0
      ),
      'DATA_CORRECTION',
      'Record test readiness inputs',
      'phase2e-request-readiness-global',
      'e3600000-0000-4000-8000-000000000002'
    ) -> 'controlPlane' -> 'readiness' ->> 'version'
  )::integer,
  2,
  'global admin records versioned readiness evidence'
);
select is(
  (
    public.admin_run_city_activation_preflight(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      'OPERATIONAL_RECOVERY',
      'Evaluate launch readiness',
      'phase2e-request-preflight-fail',
      'e3700000-0000-4000-8000-000000000001'
    ) -> 'report' ->> 'passed'
  )::boolean,
  false,
  'preflight fails closed when merchant, owner and validation-order evidence is absent'
);
select is(
  (
    select count(*)::integer
    from private.city_activation_reports
    where city_id = 'e3100000-0000-4000-8000-000000000001'
      and not passed
  ),
  1,
  'the failed preflight is retained as immutable evidence'
);
select throws_ok(
  $$
    select public.admin_transition_city(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      'ACTIVE',
      'OPERATIONAL_RECOVERY',
      'Activation must fail',
      'phase2e-request-activate-fail',
      'e3800000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'ADMIN_CITY_PREFLIGHT_REQUIRED',
  'activation is rejected without a fresh passing report'
);

insert into private.city_activation_reports (
  id,
  city_id,
  city_configuration_version,
  readiness_version,
  city_status,
  checks,
  passed,
  created_by
)
select
  'e3900000-0000-4000-8000-000000000001',
  c.id,
  cc.version,
  car.version,
  c.status,
  '{"syntheticTestFixture":{"passed":true}}'::jsonb,
  true,
  'e3000000-0000-4000-8000-000000000001'
from public.cities c
join public.city_configurations cc on cc.city_id = c.id
join private.city_activation_readiness car on car.city_id = c.id
where c.id = 'e3100000-0000-4000-8000-000000000001';

select is(
  (
    public.admin_transition_city(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      'ACTIVE',
      'OPERATIONAL_RECOVERY',
      'Consume fresh passing test report',
      'phase2e-request-activate-pass',
      'e3800000-0000-4000-8000-000000000002'
    ) -> 'controlPlane' -> 'city' ->> 'status'
  ),
  'ACTIVE',
  'a fresh passing report permits atomic city activation'
);
select is(
  (
    select status::text
    from public.service_zones
    where id = 'e3400000-0000-4000-8000-000000000001'
  ),
  'ACTIVE',
  'city activation activates validation-ready service zones atomically'
);
select is(
  (
    public.admin_transition_city(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      'PAUSED',
      'SAFETY_INCIDENT',
      'Pause the test market',
      'phase2e-request-pause',
      'e3800000-0000-4000-8000-000000000003'
    ) -> 'controlPlane' -> 'city' ->> 'status'
  ),
  'PAUSED',
  'global admin can pause an active city through an audited command'
);
select is(
  (
    select status::text
    from public.service_zones
    where id = 'e3400000-0000-4000-8000-000000000001'
  ),
  'PAUSED',
  'pausing a city also pauses its active service zones'
);

insert into private.city_activation_reports (
  id,
  city_id,
  city_configuration_version,
  readiness_version,
  city_status,
  checks,
  passed,
  created_by
)
select
  'e3900000-0000-4000-8000-000000000002',
  c.id,
  cc.version,
  car.version,
  c.status,
  '{"syntheticTestFixture":{"passed":true}}'::jsonb,
  true,
  'e3000000-0000-4000-8000-000000000001'
from public.cities c
join public.city_configurations cc on cc.city_id = c.id
join private.city_activation_readiness car on car.city_id = c.id
where c.id = 'e3100000-0000-4000-8000-000000000001';

select lives_ok(
  $$
    select public.admin_update_city_configuration(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      3,
      '{"baseDeliveryFeePaise":700}'::jsonb,
      'DATA_CORRECTION',
      'Invalidate the prior report',
      'phase2e-request-config-invalidate',
      'e3300000-0000-4000-8000-000000000006'
    )
  $$,
  'configuration can change while a city is paused'
);
select throws_ok(
  $$
    select public.admin_transition_city(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      'ACTIVE',
      'OPERATIONAL_RECOVERY',
      'Stale report attempt',
      'phase2e-request-activate-stale',
      'e3800000-0000-4000-8000-000000000004'
    )
  $$,
  'P0001',
  'ADMIN_CITY_PREFLIGHT_REQUIRED',
  'a configuration change invalidates an older passing report'
);

insert into private.city_activation_reports (
  id,
  city_id,
  city_configuration_version,
  readiness_version,
  city_status,
  checks,
  passed,
  created_by
)
select
  'e3900000-0000-4000-8000-000000000003',
  c.id,
  cc.version,
  car.version,
  c.status,
  '{"syntheticTestFixture":{"passed":true}}'::jsonb,
  true,
  'e3000000-0000-4000-8000-000000000001'
from public.cities c
join public.city_configurations cc on cc.city_id = c.id
join private.city_activation_readiness car on car.city_id = c.id
where c.id = 'e3100000-0000-4000-8000-000000000001';

select is(
  (
    public.admin_transition_city(
      'e3000000-0000-4000-8000-000000000001',
      'e3100000-0000-4000-8000-000000000001',
      'ACTIVE',
      'OPERATIONAL_RECOVERY',
      'Restore with fresh test evidence',
      'phase2e-request-activate-fresh',
      'e3800000-0000-4000-8000-000000000005'
    ) -> 'controlPlane' -> 'city' ->> 'status'
  ),
  'ACTIVE',
  'a new report tied to the current versions permits restoration'
);
select throws_ok(
  $$
    update private.city_activation_reports
    set passed = false
    where id = 'e3900000-0000-4000-8000-000000000003'
  $$,
  '55000',
  'city_activation_reports is append-only; insert a compensating record instead',
  'activation reports cannot be rewritten after creation'
);
select lives_ok(
  $$
    select public.record_admin_audit(
      'e3000000-0000-4000-8000-000000000001',
      'admin.refund.phase2e_regression',
      'REFUND',
      'e3a00000-0000-4000-8000-000000000001',
      'OPERATIONAL_RECOVERY',
      'Finance resource remains accepted',
      'phase2e-request-finance',
      'e3b00000-0000-4000-8000-000000000001',
      null,
      '{"status":"QUEUED"}'::jsonb
    )
  $$,
  'Phase 2E preserves existing finance audit resource types'
);
select is(
  (
    select count(*)::integer
    from public.list_admin_cities('e3000000-0000-4000-8000-000000000002')
  ),
  1,
  'a scoped administrator lists only the assigned city'
);
select throws_ok(
  $$
    select *
    from public.list_admin_cities('e3000000-0000-4000-8000-000000000003')
  $$,
  'P0001',
  'ADMIN_ACCESS_DENIED',
  'ordinary users cannot read the trusted city control plane'
);

select * from finish();
rollback;
