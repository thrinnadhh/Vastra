-- Phase 2E forward hardening after the first exact-head database run.
-- Preserve the complete finance audit catalogue and replace launch-critical RPCs
-- with deterministic, new-city-safe implementations.

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
