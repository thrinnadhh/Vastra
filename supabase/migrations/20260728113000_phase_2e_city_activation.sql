-- Vastra Phase 2E city configuration and activation control plane.
--
-- All mutation entrypoints are service-role-only, actor-scoped, idempotent and
-- audited. No authenticated client receives direct write access to city data.

alter table private.admin_audit_log
  drop constraint if exists admin_audit_log_resource_type_check;

alter table private.admin_audit_log
  add constraint admin_audit_log_resource_type_check
  check (
    resource_type in (
      'ORDER',
      'DELIVERY_TASK',
      'MERCHANT',
      'CAPTAIN',
      'CASE',
      'CONFIGURATION',
      'PAYMENT',
      'PAYMENT_EVENT',
      'RETURN_REQUEST',
      'REFUND',
      'MERCHANT_SETTLEMENT',
      'CAPTAIN_EARNING',
      'CAPTAIN_PAYOUT',
      'COD_RECONCILIATION',
      'CITY',
      'SERVICE_ZONE',
      'CITY_ACTIVATION'
    )
  );

alter table public.service_zones
  add column if not exists version integer not null default 1;

alter table public.service_zones
  drop constraint if exists service_zones_version_positive;

alter table public.service_zones
  add constraint service_zones_version_positive check (version > 0);

alter table public.service_zone_pincodes
  add column if not exists version integer not null default 1;

alter table public.service_zone_pincodes
  drop constraint if exists service_zone_pincodes_version_positive;

alter table public.service_zone_pincodes
  add constraint service_zone_pincodes_version_positive check (version > 0);

create table private.city_configuration_versions (
  id bigint generated always as identity primary key,
  city_id uuid not null references public.cities(id) on update cascade on delete restrict,
  version integer not null,
  configuration_snapshot jsonb not null,
  changed_by uuid not null references public.profiles(id) on update cascade on delete restrict,
  reason_code text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint city_configuration_versions_unique unique (city_id, version),
  constraint city_configuration_versions_snapshot_object
    check (jsonb_typeof(configuration_snapshot) = 'object')
);

create table private.city_activation_readiness (
  city_id uuid primary key references public.cities(id) on update cascade on delete restrict,
  active_captain_count integer not null default 0,
  standby_captain_count integer not null default 0,
  payment_provider_healthy boolean not null default false,
  sms_otp_provider_healthy boolean not null default false,
  fcm_provider_healthy boolean not null default false,
  observability_healthy boolean not null default false,
  validation_order_id uuid,
  unresolved_high_blockers integer not null default 0,
  version integer not null default 1,
  updated_by uuid references public.profiles(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint city_activation_readiness_counts_nonnegative check (
    active_captain_count >= 0
    and standby_captain_count >= 0
    and unresolved_high_blockers >= 0
  ),
  constraint city_activation_readiness_version_positive check (version > 0)
);

create table private.city_activation_reports (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on update cascade on delete restrict,
  city_configuration_version integer not null,
  readiness_version integer not null,
  city_status public.market_lifecycle_status not null,
  checks jsonb not null,
  passed boolean not null,
  created_by uuid not null references public.profiles(id) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  constraint city_activation_reports_checks_object check (jsonb_typeof(checks) = 'object')
);

create index city_activation_reports_city_created_idx
  on private.city_activation_reports(city_id, created_at desc);

alter table private.city_configuration_versions enable row level security;
alter table private.city_configuration_versions force row level security;
alter table private.city_activation_readiness enable row level security;
alter table private.city_activation_readiness force row level security;
alter table private.city_activation_reports enable row level security;
alter table private.city_activation_reports force row level security;

revoke all on private.city_configuration_versions from public, anon, authenticated;
revoke all on private.city_activation_readiness from public, anon, authenticated;
revoke all on private.city_activation_reports from public, anon, authenticated;
grant select, insert on private.city_configuration_versions to service_role;
grant select, insert, update on private.city_activation_readiness to service_role;
grant select, insert on private.city_activation_reports to service_role;

drop trigger if exists prevent_city_configuration_version_mutation
  on private.city_configuration_versions;
create trigger prevent_city_configuration_version_mutation
before update or delete on private.city_configuration_versions
for each row execute function private.prevent_append_only_mutation();

drop trigger if exists prevent_city_activation_report_mutation
  on private.city_activation_reports;
create trigger prevent_city_activation_report_mutation
before update or delete on private.city_activation_reports
for each row execute function private.prevent_append_only_mutation();

drop trigger if exists city_activation_readiness_set_updated_at
  on private.city_activation_readiness;
create trigger city_activation_readiness_set_updated_at
before update on private.city_activation_readiness
for each row execute function public.set_updated_at();

create or replace function private.ensure_city_activation_readiness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into private.city_activation_readiness(city_id, updated_by)
  values (new.id, new.created_by)
  on conflict (city_id) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_city_activation_readiness()
  from public, anon, authenticated;

drop trigger if exists cities_create_activation_readiness on public.cities;
create trigger cities_create_activation_readiness
after insert on public.cities
for each row execute function private.ensure_city_activation_readiness();

insert into private.city_activation_readiness(city_id, updated_by)
select c.id, c.created_by
from public.cities c
on conflict (city_id) do nothing;

create or replace function private.assert_phase_2e_admin(
  p_actor_id uuid,
  p_city_id uuid,
  p_global_only boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_global boolean;
begin
  select ap.has_global_access
  into v_global
  from public.profiles p
  join public.admin_profiles ap on ap.user_id = p.id
  where p.id = p_actor_id
    and p.account_type::text = 'ADMIN'
    and p.status::text = 'ACTIVE'
    and ap.two_factor_enabled;

  if not found then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;

  if v_global then
    return;
  end if;

  if p_global_only then
    raise exception 'ADMIN_GLOBAL_ACCESS_REQUIRED';
  end if;

  perform 1
  from public.admin_city_assignments aca
  where aca.admin_user_id = p_actor_id
    and aca.city_id = p_city_id
    and aca.role = 'CITY_ADMIN'
    and aca.revoked_at is null;

  if not found then
    raise exception 'ADMIN_CITY_ACCESS_DENIED';
  end if;
end;
$$;

create or replace function private.claim_phase_2e_command(
  p_actor_id uuid,
  p_action text,
  p_idempotency_key uuid,
  p_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt private.admin_command_receipts%rowtype;
begin
  if p_idempotency_key is null or nullif(btrim(p_action), '') is null then
    raise exception 'ADMIN_REQUEST_INVALID';
  end if;

  insert into private.admin_command_receipts(
    actor_id,
    action,
    idempotency_key,
    request_fingerprint
  ) values (
    p_actor_id,
    p_action,
    p_idempotency_key,
    p_fingerprint
  )
  on conflict do nothing;

  select *
  into strict v_receipt
  from private.admin_command_receipts
  where actor_id = p_actor_id
    and action = p_action
    and idempotency_key = p_idempotency_key
  for update;

  if v_receipt.request_fingerprint <> p_fingerprint then
    raise exception 'ADMIN_IDEMPOTENCY_CONFLICT';
  end if;

  return v_receipt.audit_id;
end;
$$;

create or replace function private.complete_phase_2e_command(
  p_actor_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid,
  p_before_state jsonb,
  p_after_state jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit_id uuid;
begin
  insert into private.admin_audit_log(
    actor_id,
    action,
    resource_type,
    resource_id,
    reason_code,
    note,
    request_id,
    idempotency_key,
    before_state,
    after_state
  ) values (
    p_actor_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_reason_code,
    nullif(btrim(p_note), ''),
    nullif(btrim(p_request_id), ''),
    p_idempotency_key,
    p_before_state,
    p_after_state
  )
  returning id into v_audit_id;

  update private.admin_command_receipts
  set audit_id = v_audit_id
  where actor_id = p_actor_id
    and action = p_action
    and idempotency_key = p_idempotency_key;

  return v_audit_id;
end;
$$;

create or replace function private.city_preflight_snapshot(p_city_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_city public.cities%rowtype;
  v_config public.city_configurations%rowtype;
  v_readiness private.city_activation_readiness%rowtype;
  v_candidate_zones integer;
  v_zones_with_pincodes integer;
  v_active_merchants integer;
  v_zones_with_merchants integer;
  v_required_active_captains integer;
  v_required_standby_captains integer;
  v_required_owner_roles integer;
  v_present_owner_roles integer;
  v_validation_order_passed boolean;
  v_checks jsonb;
begin
  select * into strict v_city from public.cities where id = p_city_id;
  select * into strict v_config from public.city_configurations where city_id = p_city_id;
  select * into strict v_readiness from private.city_activation_readiness where city_id = p_city_id;

  select count(*)::integer
  into v_candidate_zones
  from public.service_zones z
  where z.city_id = p_city_id
    and z.status in ('READY_FOR_VALIDATION', 'ACTIVE', 'PAUSED');

  select count(*)::integer
  into v_zones_with_pincodes
  from public.service_zones z
  where z.city_id = p_city_id
    and z.status in ('READY_FOR_VALIDATION', 'ACTIVE', 'PAUSED')
    and exists (
      select 1
      from public.service_zone_pincodes szp
      where szp.city_id = p_city_id
        and szp.service_zone_id = z.id
        and szp.is_active
    );

  select count(distinct mb.merchant_id)::integer
  into v_active_merchants
  from public.merchant_branches mb
  join public.shops shop on shop.id = mb.shop_id
  join public.merchant_profiles merchant on merchant.user_id = mb.merchant_id
  join public.profiles merchant_profile on merchant_profile.id = mb.merchant_id
  where mb.city_id = p_city_id
    and mb.status in ('APPROVED', 'ACTIVE')
    and mb.verification_status = 'VERIFIED'
    and mb.geography_status = 'VERIFIED'
    and mb.local_delivery_enabled
    and shop.deleted_at is null
    and shop.verification_status = 'VERIFIED'
    and shop.operational_status not in ('PAUSED', 'SUSPENDED')
    and merchant.kyc_status = 'VERIFIED'
    and merchant.onboarding_status = 'ACTIVE'
    and merchant_profile.status = 'ACTIVE';

  select count(*)::integer
  into v_zones_with_merchants
  from public.service_zones z
  where z.city_id = p_city_id
    and z.status in ('READY_FOR_VALIDATION', 'ACTIVE', 'PAUSED')
    and exists (
      select 1
      from public.merchant_branches mb
      join public.shops shop on shop.id = mb.shop_id
      join public.merchant_profiles merchant on merchant.user_id = mb.merchant_id
      join public.profiles merchant_profile on merchant_profile.id = mb.merchant_id
      left join public.branch_service_zones bsz
        on bsz.branch_id = mb.id
       and bsz.city_id = mb.city_id
       and bsz.is_active
      where mb.city_id = p_city_id
        and mb.status in ('APPROVED', 'ACTIVE')
        and mb.verification_status = 'VERIFIED'
        and mb.geography_status = 'VERIFIED'
        and mb.local_delivery_enabled
        and shop.deleted_at is null
        and shop.verification_status = 'VERIFIED'
        and shop.operational_status not in ('PAUSED', 'SUSPENDED')
        and merchant.kyc_status = 'VERIFIED'
        and merchant.onboarding_status = 'ACTIVE'
        and merchant_profile.status = 'ACTIVE'
        and (
          mb.primary_service_zone_id = z.id
          or bsz.service_zone_id = z.id
        )
    );

  v_required_active_captains := v_candidate_zones * 5;
  v_required_standby_captains := v_candidate_zones * 2;
  v_required_owner_roles := 5;

  select count(distinct aca.role)::integer
  into v_present_owner_roles
  from public.admin_city_assignments aca
  where aca.city_id = p_city_id
    and aca.revoked_at is null
    and aca.role in (
      'CITY_OPERATIONS',
      'MERCHANT_REVIEWER',
      'CAPTAIN_OPERATIONS',
      'SUPPORT_AGENT',
      'FINANCE_AGENT'
    );

  select exists (
    select 1
    from public.orders o
    where o.id = v_readiness.validation_order_id
      and o.city_id = p_city_id
      and o.status::text in ('DELIVERED', 'COMPLETED')
  ) into v_validation_order_passed;

  v_checks := jsonb_build_object(
    'cityLifecycle', jsonb_build_object(
      'passed', v_city.status in ('READY_FOR_VALIDATION', 'PAUSED'),
      'actual', v_city.status::text,
      'expected', jsonb_build_array('READY_FOR_VALIDATION', 'PAUSED')
    ),
    'configurationComplete', jsonb_build_object(
      'passed',
        v_config.local_delivery_enabled
        and v_config.operating_hours <> '{}'::jsonb
        and v_config.cancellation_policy <> '{}'::jsonb
        and v_config.refund_policy <> '{}'::jsonb,
      'version', v_config.version
    ),
    'serviceZones', jsonb_build_object(
      'passed', v_candidate_zones > 0 and v_zones_with_pincodes = v_candidate_zones,
      'candidateZones', v_candidate_zones,
      'zonesWithPincodes', v_zones_with_pincodes
    ),
    'merchants', jsonb_build_object(
      'passed', v_active_merchants >= 5 and v_zones_with_merchants = v_candidate_zones,
      'activeMerchants', v_active_merchants,
      'minimumActiveMerchants', 5,
      'zonesWithActiveMerchantCoverage', v_zones_with_merchants,
      'candidateZones', v_candidate_zones
    ),
    'captainCapacity', jsonb_build_object(
      'passed',
        v_readiness.active_captain_count >= v_required_active_captains
        and v_readiness.standby_captain_count >= v_required_standby_captains,
      'activeCaptains', v_readiness.active_captain_count,
      'requiredActiveCaptains', v_required_active_captains,
      'standbyCaptains', v_readiness.standby_captain_count,
      'requiredStandbyCaptains', v_required_standby_captains
    ),
    'operationalOwners', jsonb_build_object(
      'passed', v_present_owner_roles = v_required_owner_roles,
      'presentRoles', v_present_owner_roles,
      'requiredRoles', v_required_owner_roles
    ),
    'providers', jsonb_build_object(
      'passed',
        v_readiness.payment_provider_healthy
        and v_readiness.sms_otp_provider_healthy
        and v_readiness.fcm_provider_healthy
        and v_readiness.observability_healthy,
      'payment', v_readiness.payment_provider_healthy,
      'smsOtp', v_readiness.sms_otp_provider_healthy,
      'fcm', v_readiness.fcm_provider_healthy,
      'observability', v_readiness.observability_healthy
    ),
    'validationOrder', jsonb_build_object(
      'passed', v_validation_order_passed,
      'orderId', v_readiness.validation_order_id
    ),
    'releaseBlockers', jsonb_build_object(
      'passed', v_readiness.unresolved_high_blockers = 0,
      'unresolvedHighOrCritical', v_readiness.unresolved_high_blockers
    )
  );

  return jsonb_build_object(
    'cityId', p_city_id,
    'cityStatus', v_city.status::text,
    'cityConfigurationVersion', v_config.version,
    'readinessVersion', v_readiness.version,
    'checks', v_checks,
    'passed', not exists (
      select 1
      from jsonb_each(v_checks) as check_entry
      where coalesce((check_entry.value ->> 'passed')::boolean, false) = false
    )
  );
end;
$$;

create or replace function private.build_admin_city_control_plane(p_city_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'city', to_jsonb(c),
    'configuration', to_jsonb(cc),
    'readiness', to_jsonb(car),
    'zones', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'zone', to_jsonb(z),
            'pincodes', coalesce(
              (
                select jsonb_agg(to_jsonb(szp) order by szp.priority, szp.pincode)
                from public.service_zone_pincodes szp
                where szp.service_zone_id = z.id
              ),
              '[]'::jsonb
            )
          )
          order by z.name
        )
        from public.service_zones z
        where z.city_id = c.id
      ),
      '[]'::jsonb
    ),
    'latestPreflight', (
      select to_jsonb(report)
      from private.city_activation_reports report
      where report.city_id = c.id
      order by report.created_at desc
      limit 1
    )
  )
  from public.cities c
  join public.city_configurations cc on cc.city_id = c.id
  join private.city_activation_readiness car on car.city_id = c.id
  where c.id = p_city_id
$$;

create or replace function public.list_admin_cities(p_actor_id uuid)
returns setof jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_global boolean;
begin
  select ap.has_global_access
  into v_global
  from public.profiles p
  join public.admin_profiles ap on ap.user_id = p.id
  where p.id = p_actor_id
    and p.account_type::text = 'ADMIN'
    and p.status::text = 'ACTIVE'
    and ap.two_factor_enabled;

  if not found then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;

  return query
  select private.build_admin_city_control_plane(c.id)
  from public.cities c
  where v_global
     or exists (
       select 1
       from public.admin_city_assignments aca
       where aca.admin_user_id = p_actor_id
         and aca.city_id = c.id
         and aca.revoked_at is null
     )
  order by c.name;
end;
$$;

create or replace function public.get_admin_city_control_plane(
  p_actor_id uuid,
  p_city_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_phase_2e_admin(p_actor_id, p_city_id, false);
  select private.build_admin_city_control_plane(p_city_id) into v_result;
  if v_result is null then
    raise exception 'ADMIN_CITY_NOT_FOUND';
  end if;
  return v_result;
end;
$$;

create or replace function public.admin_update_city_configuration(
  p_actor_id uuid,
  p_city_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := 'admin.city.configuration.update';
  v_fingerprint text;
  v_replay_audit_id uuid;
  v_before public.city_configurations%rowtype;
  v_after public.city_configurations%rowtype;
  v_unknown_key text;
begin
  perform private.assert_phase_2e_admin(p_actor_id, p_city_id, false);
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'ADMIN_CITY_CONFIGURATION_INVALID'; end if;

  select key into v_unknown_key
  from jsonb_object_keys(p_patch) as patch_key(key)
  where key not in (
    'timezone',
    'defaultCodLimitPaise',
    'defaultDeliveryRadiusMeters',
    'maximumDeliveryRadiusMeters',
    'baseDeliveryFeePaise',
    'perKmDeliveryFeePaise',
    'merchantCommissionBps',
    'localDeliveryEnabled',
    'postalDeliveryEnabled',
    'operatingHours',
    'holidayDates',
    'cancellationPolicy',
    'refundPolicy'
  )
  limit 1;
  if v_unknown_key is not null then raise exception 'ADMIN_CITY_CONFIGURATION_INVALID'; end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws('|', p_city_id::text, p_expected_version::text, p_patch::text, p_reason_code, coalesce(p_note, '')),
      'sha256'
    ),
    'hex'
  );
  v_replay_audit_id := private.claim_phase_2e_command(
    p_actor_id,
    v_action,
    p_idempotency_key,
    v_fingerprint
  );
  if v_replay_audit_id is not null then
    return jsonb_build_object('replayed', true, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
  end if;

  select * into strict v_before
  from public.city_configurations
  where city_id = p_city_id
  for update;

  if p_expected_version is null or p_expected_version <> v_before.version then
    raise exception 'ADMIN_CITY_CONFIGURATION_VERSION_CONFLICT';
  end if;

  insert into private.city_configuration_versions(
    city_id,
    version,
    configuration_snapshot,
    changed_by,
    reason_code,
    note
  ) values (
    p_city_id,
    v_before.version,
    to_jsonb(v_before),
    p_actor_id,
    p_reason_code,
    nullif(btrim(p_note), '')
  );

  update public.city_configurations
  set timezone = case when p_patch ? 'timezone' then nullif(btrim(p_patch ->> 'timezone'), '') else timezone end,
      default_cod_limit_paise = case when p_patch ? 'defaultCodLimitPaise' then (p_patch ->> 'defaultCodLimitPaise')::bigint else default_cod_limit_paise end,
      default_delivery_radius_meters = case when p_patch ? 'defaultDeliveryRadiusMeters' then (p_patch ->> 'defaultDeliveryRadiusMeters')::integer else default_delivery_radius_meters end,
      maximum_delivery_radius_meters = case when p_patch ? 'maximumDeliveryRadiusMeters' then (p_patch ->> 'maximumDeliveryRadiusMeters')::integer else maximum_delivery_radius_meters end,
      base_delivery_fee_paise = case when p_patch ? 'baseDeliveryFeePaise' then (p_patch ->> 'baseDeliveryFeePaise')::bigint else base_delivery_fee_paise end,
      per_km_delivery_fee_paise = case when p_patch ? 'perKmDeliveryFeePaise' then (p_patch ->> 'perKmDeliveryFeePaise')::bigint else per_km_delivery_fee_paise end,
      merchant_commission_bps = case when p_patch ? 'merchantCommissionBps' then (p_patch ->> 'merchantCommissionBps')::integer else merchant_commission_bps end,
      local_delivery_enabled = case when p_patch ? 'localDeliveryEnabled' then (p_patch ->> 'localDeliveryEnabled')::boolean else local_delivery_enabled end,
      postal_delivery_enabled = case when p_patch ? 'postalDeliveryEnabled' then (p_patch ->> 'postalDeliveryEnabled')::boolean else postal_delivery_enabled end,
      operating_hours = case when p_patch ? 'operatingHours' then p_patch -> 'operatingHours' else operating_hours end,
      holiday_dates = case when p_patch ? 'holidayDates' then array(select jsonb_array_elements_text(p_patch -> 'holidayDates')::date) else holiday_dates end,
      cancellation_policy = case when p_patch ? 'cancellationPolicy' then p_patch -> 'cancellationPolicy' else cancellation_policy end,
      refund_policy = case when p_patch ? 'refundPolicy' then p_patch -> 'refundPolicy' else refund_policy end,
      version = version + 1,
      updated_by = p_actor_id
  where city_id = p_city_id
  returning * into v_after;

  perform private.complete_phase_2e_command(
    p_actor_id,
    v_action,
    'CONFIGURATION',
    p_city_id,
    p_reason_code,
    p_note,
    p_request_id,
    p_idempotency_key,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return jsonb_build_object('replayed', false, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
exception
  when invalid_text_representation or numeric_value_out_of_range or not_null_violation or check_violation then
    raise exception 'ADMIN_CITY_CONFIGURATION_INVALID';
end;
$$;

create or replace function public.admin_upsert_service_zone(
  p_actor_id uuid,
  p_city_id uuid,
  p_zone_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := case when p_zone_id is null then 'admin.city.zone.create' else 'admin.city.zone.update' end;
  v_fingerprint text;
  v_replay_audit_id uuid;
  v_before public.service_zones%rowtype;
  v_after public.service_zones%rowtype;
  v_resource_id uuid;
begin
  perform private.assert_phase_2e_admin(p_actor_id, p_city_id, false);
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'ADMIN_SERVICE_ZONE_INVALID'; end if;
  if p_patch ->> 'status' = 'ACTIVE' then raise exception 'ADMIN_SERVICE_ZONE_ACTIVATION_REQUIRES_CITY_PREFLIGHT'; end if;
  v_resource_id := coalesce(p_zone_id, p_idempotency_key);
  v_fingerprint := encode(
    extensions.digest(
      concat_ws('|', p_city_id::text, v_resource_id::text, coalesce(p_expected_version::text, ''), p_patch::text, p_reason_code, coalesce(p_note, '')),
      'sha256'
    ),
    'hex'
  );
  v_replay_audit_id := private.claim_phase_2e_command(p_actor_id, v_action, p_idempotency_key, v_fingerprint);
  if v_replay_audit_id is not null then
    return jsonb_build_object('replayed', true, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
  end if;

  if p_zone_id is null then
    if p_expected_version is not null then raise exception 'ADMIN_SERVICE_ZONE_VERSION_CONFLICT'; end if;
    insert into public.service_zones(
      id,
      city_id,
      code,
      slug,
      name,
      status,
      default_delivery_radius_meters,
      created_by,
      updated_by
    ) values (
      v_resource_id,
      p_city_id,
      p_patch ->> 'code',
      p_patch ->> 'slug',
      p_patch ->> 'name',
      coalesce((p_patch ->> 'status')::public.market_lifecycle_status, 'DRAFT'),
      nullif(p_patch ->> 'defaultDeliveryRadiusMeters', '')::integer,
      p_actor_id,
      p_actor_id
    ) returning * into v_after;
  else
    select * into strict v_before
    from public.service_zones
    where id = p_zone_id and city_id = p_city_id
    for update;
    if p_expected_version is null or p_expected_version <> v_before.version then
      raise exception 'ADMIN_SERVICE_ZONE_VERSION_CONFLICT';
    end if;
    update public.service_zones
    set code = case when p_patch ? 'code' then p_patch ->> 'code' else code end,
        slug = case when p_patch ? 'slug' then p_patch ->> 'slug' else slug end,
        name = case when p_patch ? 'name' then p_patch ->> 'name' else name end,
        status = case when p_patch ? 'status' then (p_patch ->> 'status')::public.market_lifecycle_status else status end,
        default_delivery_radius_meters = case when p_patch ? 'defaultDeliveryRadiusMeters' then nullif(p_patch ->> 'defaultDeliveryRadiusMeters', '')::integer else default_delivery_radius_meters end,
        version = version + 1,
        updated_by = p_actor_id
    where id = p_zone_id
    returning * into v_after;
  end if;

  perform private.complete_phase_2e_command(
    p_actor_id,
    v_action,
    'SERVICE_ZONE',
    v_resource_id,
    p_reason_code,
    p_note,
    p_request_id,
    p_idempotency_key,
    case when p_zone_id is null then null else to_jsonb(v_before) end,
    to_jsonb(v_after)
  );
  return jsonb_build_object('replayed', false, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
exception
  when no_data_found then raise exception 'ADMIN_SERVICE_ZONE_NOT_FOUND';
  when invalid_text_representation or not_null_violation or check_violation then
    raise exception 'ADMIN_SERVICE_ZONE_INVALID';
end;
$$;

create or replace function public.admin_upsert_service_zone_pincode(
  p_actor_id uuid,
  p_city_id uuid,
  p_zone_id uuid,
  p_mapping_id uuid,
  p_expected_version integer,
  p_pincode text,
  p_priority integer,
  p_is_primary boolean,
  p_is_active boolean,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := case when p_mapping_id is null then 'admin.city.pincode.create' else 'admin.city.pincode.update' end;
  v_resource_id uuid := coalesce(p_mapping_id, p_idempotency_key);
  v_fingerprint text;
  v_replay_audit_id uuid;
  v_before public.service_zone_pincodes%rowtype;
  v_after public.service_zone_pincodes%rowtype;
begin
  perform private.assert_phase_2e_admin(p_actor_id, p_city_id, false);
  perform 1 from public.service_zones where id = p_zone_id and city_id = p_city_id;
  if not found then raise exception 'ADMIN_SERVICE_ZONE_NOT_FOUND'; end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws('|', p_city_id::text, p_zone_id::text, v_resource_id::text, coalesce(p_expected_version::text, ''), p_pincode, p_priority::text, p_is_primary::text, p_is_active::text, p_reason_code, coalesce(p_note, '')),
      'sha256'
    ),
    'hex'
  );
  v_replay_audit_id := private.claim_phase_2e_command(p_actor_id, v_action, p_idempotency_key, v_fingerprint);
  if v_replay_audit_id is not null then
    return jsonb_build_object('replayed', true, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
  end if;

  if p_mapping_id is null then
    if p_expected_version is not null then raise exception 'ADMIN_SERVICE_PINCODE_VERSION_CONFLICT'; end if;
    insert into public.service_zone_pincodes(
      id,
      city_id,
      service_zone_id,
      pincode,
      priority,
      is_primary,
      is_active,
      created_by,
      updated_by
    ) values (
      v_resource_id,
      p_city_id,
      p_zone_id,
      p_pincode,
      p_priority,
      p_is_primary,
      p_is_active,
      p_actor_id,
      p_actor_id
    ) returning * into v_after;
  else
    select * into strict v_before
    from public.service_zone_pincodes
    where id = p_mapping_id and city_id = p_city_id and service_zone_id = p_zone_id
    for update;
    if p_expected_version is null or p_expected_version <> v_before.version then
      raise exception 'ADMIN_SERVICE_PINCODE_VERSION_CONFLICT';
    end if;
    update public.service_zone_pincodes
    set pincode = p_pincode,
        priority = p_priority,
        is_primary = p_is_primary,
        is_active = p_is_active,
        version = version + 1,
        updated_by = p_actor_id
    where id = p_mapping_id
    returning * into v_after;
  end if;

  perform private.complete_phase_2e_command(
    p_actor_id,
    v_action,
    'SERVICE_ZONE',
    v_resource_id,
    p_reason_code,
    p_note,
    p_request_id,
    p_idempotency_key,
    case when p_mapping_id is null then null else to_jsonb(v_before) end,
    to_jsonb(v_after)
  );
  return jsonb_build_object('replayed', false, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
exception
  when no_data_found then raise exception 'ADMIN_SERVICE_PINCODE_NOT_FOUND';
  when unique_violation or check_violation or invalid_text_representation then
    raise exception 'ADMIN_SERVICE_PINCODE_INVALID';
end;
$$;

create or replace function public.admin_update_city_activation_readiness(
  p_actor_id uuid,
  p_city_id uuid,
  p_expected_version integer,
  p_readiness jsonb,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := 'admin.city.readiness.update';
  v_fingerprint text;
  v_replay_audit_id uuid;
  v_before private.city_activation_readiness%rowtype;
  v_after private.city_activation_readiness%rowtype;
begin
  perform private.assert_phase_2e_admin(p_actor_id, p_city_id, true);
  if jsonb_typeof(p_readiness) <> 'object' then raise exception 'ADMIN_CITY_READINESS_INVALID'; end if;
  v_fingerprint := encode(
    extensions.digest(
      concat_ws('|', p_city_id::text, p_expected_version::text, p_readiness::text, p_reason_code, coalesce(p_note, '')),
      'sha256'
    ),
    'hex'
  );
  v_replay_audit_id := private.claim_phase_2e_command(p_actor_id, v_action, p_idempotency_key, v_fingerprint);
  if v_replay_audit_id is not null then
    return jsonb_build_object('replayed', true, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
  end if;

  select * into strict v_before
  from private.city_activation_readiness
  where city_id = p_city_id
  for update;
  if p_expected_version is null or p_expected_version <> v_before.version then
    raise exception 'ADMIN_CITY_READINESS_VERSION_CONFLICT';
  end if;

  update private.city_activation_readiness
  set active_captain_count = case when p_readiness ? 'activeCaptainCount' then (p_readiness ->> 'activeCaptainCount')::integer else active_captain_count end,
      standby_captain_count = case when p_readiness ? 'standbyCaptainCount' then (p_readiness ->> 'standbyCaptainCount')::integer else standby_captain_count end,
      payment_provider_healthy = case when p_readiness ? 'paymentProviderHealthy' then (p_readiness ->> 'paymentProviderHealthy')::boolean else payment_provider_healthy end,
      sms_otp_provider_healthy = case when p_readiness ? 'smsOtpProviderHealthy' then (p_readiness ->> 'smsOtpProviderHealthy')::boolean else sms_otp_provider_healthy end,
      fcm_provider_healthy = case when p_readiness ? 'fcmProviderHealthy' then (p_readiness ->> 'fcmProviderHealthy')::boolean else fcm_provider_healthy end,
      observability_healthy = case when p_readiness ? 'observabilityHealthy' then (p_readiness ->> 'observabilityHealthy')::boolean else observability_healthy end,
      validation_order_id = case when p_readiness ? 'validationOrderId' then nullif(p_readiness ->> 'validationOrderId', '')::uuid else validation_order_id end,
      unresolved_high_blockers = case when p_readiness ? 'unresolvedHighBlockers' then (p_readiness ->> 'unresolvedHighBlockers')::integer else unresolved_high_blockers end,
      version = version + 1,
      updated_by = p_actor_id
  where city_id = p_city_id
  returning * into v_after;

  perform private.complete_phase_2e_command(
    p_actor_id,
    v_action,
    'CITY_ACTIVATION',
    p_city_id,
    p_reason_code,
    p_note,
    p_request_id,
    p_idempotency_key,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
  return jsonb_build_object('replayed', false, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
exception
  when invalid_text_representation or check_violation then raise exception 'ADMIN_CITY_READINESS_INVALID';
end;
$$;

create or replace function public.admin_run_city_activation_preflight(
  p_actor_id uuid,
  p_city_id uuid,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := 'admin.city.activation.preflight';
  v_fingerprint text;
  v_replay_audit_id uuid;
  v_snapshot jsonb;
  v_report private.city_activation_reports%rowtype;
begin
  perform private.assert_phase_2e_admin(p_actor_id, p_city_id, true);
  v_fingerprint := encode(
    extensions.digest(concat_ws('|', p_city_id::text, p_reason_code, coalesce(p_note, '')), 'sha256'),
    'hex'
  );
  v_replay_audit_id := private.claim_phase_2e_command(p_actor_id, v_action, p_idempotency_key, v_fingerprint);
  if v_replay_audit_id is not null then
    select * into strict v_report
    from private.city_activation_reports
    where id = (
      select (after_state ->> 'reportId')::uuid
      from private.admin_audit_log
      where id = v_replay_audit_id
    );
    return jsonb_build_object('replayed', true, 'report', to_jsonb(v_report));
  end if;

  v_snapshot := private.city_preflight_snapshot(p_city_id);
  insert into private.city_activation_reports(
    city_id,
    city_configuration_version,
    readiness_version,
    city_status,
    checks,
    passed,
    created_by
  ) values (
    p_city_id,
    (v_snapshot ->> 'cityConfigurationVersion')::integer,
    (v_snapshot ->> 'readinessVersion')::integer,
    (v_snapshot ->> 'cityStatus')::public.market_lifecycle_status,
    v_snapshot -> 'checks',
    (v_snapshot ->> 'passed')::boolean,
    p_actor_id
  ) returning * into v_report;

  perform private.complete_phase_2e_command(
    p_actor_id,
    v_action,
    'CITY_ACTIVATION',
    p_city_id,
    p_reason_code,
    p_note,
    p_request_id,
    p_idempotency_key,
    null,
    jsonb_build_object('reportId', v_report.id, 'passed', v_report.passed)
  );
  return jsonb_build_object('replayed', false, 'report', to_jsonb(v_report));
end;
$$;

create or replace function public.admin_transition_city(
  p_actor_id uuid,
  p_city_id uuid,
  p_target_status text,
  p_reason_code text,
  p_note text,
  p_request_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.market_lifecycle_status;
  v_action text;
  v_fingerprint text;
  v_replay_audit_id uuid;
  v_before public.cities%rowtype;
  v_after public.cities%rowtype;
  v_config_version integer;
  v_readiness_version integer;
  v_report private.city_activation_reports%rowtype;
begin
  perform private.assert_phase_2e_admin(p_actor_id, p_city_id, true);
  begin
    v_target := p_target_status::public.market_lifecycle_status;
  exception when invalid_text_representation then
    raise exception 'ADMIN_CITY_TRANSITION_INVALID';
  end;
  if v_target not in ('ACTIVE', 'PAUSED') then raise exception 'ADMIN_CITY_TRANSITION_INVALID'; end if;
  v_action := case when v_target = 'ACTIVE' then 'admin.city.activate' else 'admin.city.pause' end;
  v_fingerprint := encode(
    extensions.digest(concat_ws('|', p_city_id::text, v_target::text, p_reason_code, coalesce(p_note, '')), 'sha256'),
    'hex'
  );
  v_replay_audit_id := private.claim_phase_2e_command(p_actor_id, v_action, p_idempotency_key, v_fingerprint);
  if v_replay_audit_id is not null then
    return jsonb_build_object('replayed', true, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
  end if;

  select * into strict v_before from public.cities where id = p_city_id for update;

  if v_target = 'PAUSED' then
    if v_before.status <> 'ACTIVE' then raise exception 'ADMIN_CITY_TRANSITION_INVALID'; end if;
    update public.service_zones
    set status = 'PAUSED', version = version + 1, updated_by = p_actor_id
    where city_id = p_city_id and status = 'ACTIVE';
    update public.cities
    set status = 'PAUSED', updated_by = p_actor_id
    where id = p_city_id
    returning * into v_after;
  else
    if v_before.status not in ('READY_FOR_VALIDATION', 'PAUSED') then
      raise exception 'ADMIN_CITY_TRANSITION_INVALID';
    end if;
    select version into v_config_version from public.city_configurations where city_id = p_city_id;
    select version into v_readiness_version from private.city_activation_readiness where city_id = p_city_id;
    select * into v_report
    from private.city_activation_reports
    where city_id = p_city_id
    order by created_at desc
    limit 1;
    if v_report.id is null
      or not v_report.passed
      or v_report.city_configuration_version <> v_config_version
      or v_report.readiness_version <> v_readiness_version
      or v_report.city_status <> v_before.status
      or v_report.created_at < now() - interval '30 minutes'
    then
      raise exception 'ADMIN_CITY_PREFLIGHT_REQUIRED';
    end if;
    update public.cities
    set status = 'ACTIVE', updated_by = p_actor_id
    where id = p_city_id
    returning * into v_after;
    update public.service_zones
    set status = 'ACTIVE', version = version + 1, updated_by = p_actor_id
    where city_id = p_city_id
      and status in ('READY_FOR_VALIDATION', 'PAUSED');

    update public.merchant_branches mb
    set status = 'ACTIVE', updated_by = p_actor_id
    from public.shops shop, public.merchant_profiles merchant, public.profiles merchant_profile
    where mb.city_id = p_city_id
      and mb.status = 'APPROVED'
      and mb.verification_status = 'VERIFIED'
      and mb.geography_status = 'VERIFIED'
      and mb.local_delivery_enabled
      and shop.id = mb.shop_id
      and shop.deleted_at is null
      and shop.verification_status = 'VERIFIED'
      and shop.operational_status not in ('PAUSED', 'SUSPENDED')
      and merchant.user_id = mb.merchant_id
      and merchant.kyc_status = 'VERIFIED'
      and merchant.onboarding_status = 'ACTIVE'
      and merchant_profile.id = mb.merchant_id
      and merchant_profile.status = 'ACTIVE';
  end if;

  perform private.complete_phase_2e_command(
    p_actor_id,
    v_action,
    'CITY',
    p_city_id,
    p_reason_code,
    p_note,
    p_request_id,
    p_idempotency_key,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
  return jsonb_build_object('replayed', false, 'controlPlane', private.build_admin_city_control_plane(p_city_id));
exception
  when no_data_found then raise exception 'ADMIN_CITY_NOT_FOUND';
end;
$$;

revoke all on function private.assert_phase_2e_admin(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function private.claim_phase_2e_command(uuid, text, uuid, text)
  from public, anon, authenticated;
revoke all on function private.complete_phase_2e_command(uuid, text, text, uuid, text, text, text, uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function private.city_preflight_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function private.build_admin_city_control_plane(uuid)
  from public, anon, authenticated;

revoke all on function public.list_admin_cities(uuid)
  from public, anon, authenticated;
revoke all on function public.get_admin_city_control_plane(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_update_city_configuration(uuid, uuid, integer, jsonb, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_upsert_service_zone(uuid, uuid, uuid, integer, jsonb, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_upsert_service_zone_pincode(uuid, uuid, uuid, uuid, integer, text, integer, boolean, boolean, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_update_city_activation_readiness(uuid, uuid, integer, jsonb, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_run_city_activation_preflight(uuid, uuid, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_transition_city(uuid, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.list_admin_cities(uuid) to service_role;
grant execute on function public.get_admin_city_control_plane(uuid, uuid) to service_role;
grant execute on function public.admin_update_city_configuration(uuid, uuid, integer, jsonb, text, text, text, uuid) to service_role;
grant execute on function public.admin_upsert_service_zone(uuid, uuid, uuid, integer, jsonb, text, text, text, uuid) to service_role;
grant execute on function public.admin_upsert_service_zone_pincode(uuid, uuid, uuid, uuid, integer, text, integer, boolean, boolean, text, text, text, uuid) to service_role;
grant execute on function public.admin_update_city_activation_readiness(uuid, uuid, integer, jsonb, text, text, text, uuid) to service_role;
grant execute on function public.admin_run_city_activation_preflight(uuid, uuid, text, text, text, uuid) to service_role;
grant execute on function public.admin_transition_city(uuid, uuid, text, text, text, text, uuid) to service_role;
