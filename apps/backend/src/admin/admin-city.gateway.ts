import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  AdminReadModelInvalidError,
  optionalNumber,
  optionalTimestamp,
  optionalUuid,
  requireAllowedString,
  requireArray,
  requireBoolean,
  requireInteger,
  requireRecord,
  requireString,
  requireTimestamp,
  requireUuid,
} from './admin-read-model.parser';
import {
  MARKET_LIFECYCLE_STATUSES,
  type AdminCity,
  type AdminCityConfiguration,
  type AdminCityControlPlane,
  type AdminCityMutationResult,
  type AdminCityPreflightReport,
  type AdminCityPreflightResult,
  type AdminCityReadiness,
  type AdminRunCityPreflightInput,
  type AdminServiceZone,
  type AdminServiceZonePincode,
  type AdminTransitionCityInput,
  type AdminUpdateCityConfigurationInput,
  type AdminUpdateCityReadinessInput,
  type AdminUpsertServiceZoneInput,
  type AdminUpsertServiceZonePincodeInput,
} from './admin-city.types';

export interface AdminCityGateway {
  list(actorId: string): Promise<readonly AdminCityControlPlane[]>;
  get(actorId: string, cityId: string): Promise<AdminCityControlPlane>;
  updateConfiguration(input: AdminUpdateCityConfigurationInput): Promise<AdminCityMutationResult>;
  upsertZone(input: AdminUpsertServiceZoneInput): Promise<AdminCityMutationResult>;
  upsertPincode(input: AdminUpsertServiceZonePincodeInput): Promise<AdminCityMutationResult>;
  updateReadiness(input: AdminUpdateCityReadinessInput): Promise<AdminCityMutationResult>;
  runPreflight(input: AdminRunCityPreflightInput): Promise<AdminCityPreflightResult>;
  transition(input: AdminTransitionCityInput): Promise<AdminCityMutationResult>;
}

export class AdminCityGatewayUnavailableError extends Error {}
export class AdminCityNotFoundError extends Error {}
export class AdminCityAccessDeniedError extends Error {}
export class AdminCityVersionConflictError extends Error {}
export class AdminCityStateConflictError extends Error {}
export class AdminCityPreflightRequiredError extends Error {}
export class AdminCityIdempotencyConflictError extends Error {}
export class AdminCityInputRejectedError extends Error {}

function requireObject(value: unknown): Readonly<Record<string, unknown>> {
  return requireRecord(value);
}

function parseCity(value: unknown): AdminCity {
  const record = requireRecord(value);
  return {
    id: requireUuid(record, 'id'),
    code: requireString(record, 'code'),
    slug: requireString(record, 'slug'),
    name: requireString(record, 'name'),
    stateCode: requireString(record, 'state_code'),
    countryCode: requireString(record, 'country_code'),
    status: requireAllowedString(record, 'status', MARKET_LIFECYCLE_STATUSES),
    activatedAt: optionalTimestamp(record, 'activated_at'),
    pausedAt: optionalTimestamp(record, 'paused_at'),
    closedAt: optionalTimestamp(record, 'closed_at'),
    updatedAt: requireTimestamp(record, 'updated_at'),
  };
}

function parseJsonObject(record: Record<string, unknown>, key: string) {
  return requireObject(record[key]);
}

function parseConfiguration(value: unknown): AdminCityConfiguration {
  const record = requireRecord(value);
  const holidayDates = requireArray(record['holiday_dates']).map((date) => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
      throw new AdminReadModelInvalidError();
    }
    return date;
  });
  return {
    cityId: requireUuid(record, 'city_id'),
    timezone: requireString(record, 'timezone'),
    defaultCodLimitPaise: requireInteger(record, 'default_cod_limit_paise'),
    defaultDeliveryRadiusMeters: requireInteger(record, 'default_delivery_radius_meters'),
    maximumDeliveryRadiusMeters: requireInteger(record, 'maximum_delivery_radius_meters'),
    baseDeliveryFeePaise: requireInteger(record, 'base_delivery_fee_paise'),
    perKmDeliveryFeePaise: requireInteger(record, 'per_km_delivery_fee_paise'),
    merchantCommissionBps: requireInteger(record, 'merchant_commission_bps'),
    localDeliveryEnabled: requireBoolean(record, 'local_delivery_enabled'),
    postalDeliveryEnabled: requireBoolean(record, 'postal_delivery_enabled'),
    operatingHours: parseJsonObject(record, 'operating_hours'),
    holidayDates,
    cancellationPolicy: parseJsonObject(record, 'cancellation_policy'),
    refundPolicy: parseJsonObject(record, 'refund_policy'),
    version: requireInteger(record, 'version'),
    updatedAt: requireTimestamp(record, 'updated_at'),
  };
}

function parseReadiness(value: unknown): AdminCityReadiness {
  const record = requireRecord(value);
  return {
    cityId: requireUuid(record, 'city_id'),
    activeCaptainCount: requireInteger(record, 'active_captain_count'),
    standbyCaptainCount: requireInteger(record, 'standby_captain_count'),
    paymentProviderHealthy: requireBoolean(record, 'payment_provider_healthy'),
    smsOtpProviderHealthy: requireBoolean(record, 'sms_otp_provider_healthy'),
    fcmProviderHealthy: requireBoolean(record, 'fcm_provider_healthy'),
    observabilityHealthy: requireBoolean(record, 'observability_healthy'),
    validationOrderId: optionalUuid(record, 'validation_order_id'),
    unresolvedHighBlockers: requireInteger(record, 'unresolved_high_blockers'),
    version: requireInteger(record, 'version'),
    updatedAt: requireTimestamp(record, 'updated_at'),
  };
}

function parsePincode(value: unknown): AdminServiceZonePincode {
  const record = requireRecord(value);
  const pincode = requireString(record, 'pincode');
  if (!/^[1-9][0-9]{5}$/u.test(pincode)) throw new AdminReadModelInvalidError();
  return {
    id: requireUuid(record, 'id'),
    cityId: requireUuid(record, 'city_id'),
    serviceZoneId: requireUuid(record, 'service_zone_id'),
    pincode,
    priority: requireInteger(record, 'priority'),
    isPrimary: requireBoolean(record, 'is_primary'),
    isActive: requireBoolean(record, 'is_active'),
    version: requireInteger(record, 'version'),
    updatedAt: requireTimestamp(record, 'updated_at'),
  };
}

function parseZone(value: unknown): AdminServiceZone {
  const wrapper = requireRecord(value);
  const record = requireRecord(wrapper['zone']);
  return {
    id: requireUuid(record, 'id'),
    cityId: requireUuid(record, 'city_id'),
    code: requireString(record, 'code'),
    slug: requireString(record, 'slug'),
    name: requireString(record, 'name'),
    status: requireAllowedString(record, 'status', MARKET_LIFECYCLE_STATUSES),
    defaultDeliveryRadiusMeters: optionalNumber(record, 'default_delivery_radius_meters'),
    version: requireInteger(record, 'version'),
    updatedAt: requireTimestamp(record, 'updated_at'),
    pincodes: requireArray(wrapper['pincodes']).map(parsePincode),
  };
}

function parseReport(value: unknown): AdminCityPreflightReport {
  const record = requireRecord(value);
  const rawChecks = requireRecord(record['checks']);
  const checks: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [key, check] of Object.entries(rawChecks)) checks[key] = requireObject(check);
  return {
    id: requireUuid(record, 'id'),
    cityId: requireUuid(record, 'city_id'),
    cityConfigurationVersion: requireInteger(record, 'city_configuration_version'),
    readinessVersion: requireInteger(record, 'readiness_version'),
    cityStatus: requireAllowedString(record, 'city_status', MARKET_LIFECYCLE_STATUSES),
    checks,
    passed: requireBoolean(record, 'passed'),
    createdAt: requireTimestamp(record, 'created_at'),
  };
}

function parseControlPlane(value: unknown): AdminCityControlPlane {
  const record = requireRecord(value);
  const latest = record['latestPreflight'];
  return {
    city: parseCity(record['city']),
    configuration: parseConfiguration(record['configuration']),
    readiness: parseReadiness(record['readiness']),
    zones: requireArray(record['zones']).map(parseZone),
    latestPreflight: latest === null ? null : parseReport(latest),
  };
}

function parseMutationResult(value: unknown): AdminCityMutationResult {
  const record = requireRecord(value);
  return {
    replayed: requireBoolean(record, 'replayed'),
    controlPlane: parseControlPlane(record['controlPlane']),
  };
}

function parsePreflightResult(value: unknown): AdminCityPreflightResult {
  const record = requireRecord(value);
  return { replayed: requireBoolean(record, 'replayed'), report: parseReport(record['report']) };
}

function mapRpcError(message: string): never {
  if (message.includes('ADMIN_IDEMPOTENCY_CONFLICT')) {
    throw new AdminCityIdempotencyConflictError();
  }
  if (message.includes('VERSION_CONFLICT')) throw new AdminCityVersionConflictError();
  if (message.includes('PREFLIGHT_REQUIRED')) throw new AdminCityPreflightRequiredError();
  if (message.includes('NOT_FOUND')) throw new AdminCityNotFoundError();
  if (message.includes('ACCESS_DENIED') || message.includes('GLOBAL_ACCESS_REQUIRED')) {
    throw new AdminCityAccessDeniedError();
  }
  if (message.includes('INVALID') || message.includes('ACTIVATION_REQUIRES')) {
    throw new AdminCityInputRejectedError();
  }
  if (message.includes('TRANSITION') || message.includes('STATE')) {
    throw new AdminCityStateConflictError();
  }
  throw new AdminCityGatewayUnavailableError();
}

@Injectable()
export class SupabaseAdminCityGateway implements AdminCityGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private parse<T>(value: unknown, parser: (input: unknown) => T): T {
    try {
      return parser(value);
    } catch (error: unknown) {
      if (error instanceof AdminReadModelInvalidError) {
        throw new AdminCityGatewayUnavailableError();
      }
      throw error;
    }
  }

  public async list(actorId: string): Promise<readonly AdminCityControlPlane[]> {
    const { data, error } = await this.client.rpc('list_admin_cities', { p_actor_id: actorId });
    if (error !== null) mapRpcError(error.message);
    if (!Array.isArray(data)) throw new AdminCityGatewayUnavailableError();
    return data.map((item) => this.parse(item, parseControlPlane));
  }

  public async get(actorId: string, cityId: string): Promise<AdminCityControlPlane> {
    const { data, error } = await this.client.rpc('get_admin_city_control_plane', {
      p_actor_id: actorId,
      p_city_id: cityId,
    });
    if (error !== null) mapRpcError(error.message);
    return this.parse(data, parseControlPlane);
  }

  public async updateConfiguration(
    input: AdminUpdateCityConfigurationInput,
  ): Promise<AdminCityMutationResult> {
    return this.mutate('admin_update_city_configuration', {
      p_actor_id: input.actorId,
      p_city_id: input.cityId,
      p_expected_version: input.expectedVersion,
      p_patch: input.patch,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public async upsertZone(input: AdminUpsertServiceZoneInput): Promise<AdminCityMutationResult> {
    return this.mutate('admin_upsert_service_zone', {
      p_actor_id: input.actorId,
      p_city_id: input.cityId,
      p_zone_id: input.zoneId,
      p_expected_version: input.expectedVersion,
      p_patch: input.patch,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public async upsertPincode(
    input: AdminUpsertServiceZonePincodeInput,
  ): Promise<AdminCityMutationResult> {
    return this.mutate('admin_upsert_service_zone_pincode', {
      p_actor_id: input.actorId,
      p_city_id: input.cityId,
      p_zone_id: input.zoneId,
      p_mapping_id: input.mappingId,
      p_expected_version: input.expectedVersion,
      p_pincode: input.pincode,
      p_priority: input.priority,
      p_is_primary: input.isPrimary,
      p_is_active: input.isActive,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public async updateReadiness(
    input: AdminUpdateCityReadinessInput,
  ): Promise<AdminCityMutationResult> {
    return this.mutate('admin_update_city_activation_readiness', {
      p_actor_id: input.actorId,
      p_city_id: input.cityId,
      p_expected_version: input.expectedVersion,
      p_readiness: input.readiness,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public async runPreflight(input: AdminRunCityPreflightInput): Promise<AdminCityPreflightResult> {
    const { data, error } = await this.client.rpc('admin_run_city_activation_preflight', {
      p_actor_id: input.actorId,
      p_city_id: input.cityId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) mapRpcError(error.message);
    return this.parse(data, parsePreflightResult);
  }

  public async transition(input: AdminTransitionCityInput): Promise<AdminCityMutationResult> {
    return this.mutate('admin_transition_city', {
      p_actor_id: input.actorId,
      p_city_id: input.cityId,
      p_target_status: input.targetStatus,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  private async mutate(
    functionName: string,
    parameters: Record<string, unknown>,
  ): Promise<AdminCityMutationResult> {
    const { data, error } = await this.client.rpc(functionName, parameters);
    if (error !== null) mapRpcError(error.message);
    return this.parse(data, parseMutationResult);
  }
}
