import { Inject, Injectable } from '@nestjs/common';

import {
  CAPTAIN_AVAILABILITY_STATUSES,
  type CaptainAvailabilityStatus,
} from '../auth/operational-readiness.types';
import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CaptainAvailabilitySnapshot,
  CaptainClientAvailabilityStatus,
  CaptainLocationSnapshot,
  UpdateCaptainLocationCommand,
} from './captain-presence.types';

export interface CaptainPresenceGateway {
  setAvailability(
    actorId: string,
    status: CaptainClientAvailabilityStatus,
  ): Promise<CaptainAvailabilitySnapshot>;

  updateLocation(command: UpdateCaptainLocationCommand): Promise<CaptainLocationSnapshot>;
}

export class CaptainPresenceInvalidRequestError extends Error {}
export class CaptainPresenceNotEligibleError extends Error {}
export class CaptainPresenceStateConflictError extends Error {}
export class CaptainPresenceLocationStaleError extends Error {}
export class CaptainPresenceSampleConflictError extends Error {}
export class CaptainPresenceRateLimitedError extends Error {}
export class CaptainPresenceGatewayUnavailableError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CaptainPresenceGatewayUnavailableError();
  }

  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CaptainPresenceGatewayUnavailableError();
  }

  return value;
}

function requireUuid(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (!UUID_PATTERN.test(value)) {
    throw new CaptainPresenceGatewayUnavailableError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new CaptainPresenceGatewayUnavailableError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CaptainPresenceGatewayUnavailableError();
  }

  return value;
}

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const raw = record[key];
  const value = typeof raw === 'string' && raw.trim().length > 0 ? Number(raw) : raw;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CaptainPresenceGatewayUnavailableError();
  }

  return value;
}

function readNullableUuid(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  return requireUuid(record, key);
}

function isAvailabilityStatus(value: unknown): value is CaptainAvailabilityStatus {
  return (
    typeof value === 'string' &&
    CAPTAIN_AVAILABILITY_STATUSES.some((candidate) => candidate === value)
  );
}

export function parseCaptainAvailabilitySnapshot(value: unknown): CaptainAvailabilitySnapshot {
  const record = requireRecord(value);
  const availabilityStatus = record['availabilityStatus'];
  const requestedStatus = record['requestedStatus'];
  const locationValue = record['location'];

  if (
    !isAvailabilityStatus(availabilityStatus) ||
    (requestedStatus !== 'OFFLINE' &&
      requestedStatus !== 'AVAILABLE' &&
      requestedStatus !== 'ON_BREAK')
  ) {
    throw new CaptainPresenceGatewayUnavailableError();
  }

  let location: CaptainAvailabilitySnapshot['location'] = null;

  if (locationValue !== null) {
    const locationRecord = requireRecord(locationValue);
    location = {
      recordedAt: requireTimestamp(locationRecord, 'recordedAt'),
      accuracyMeters: requireFiniteNumber(locationRecord, 'accuracyMeters'),
      fresh: requireBoolean(locationRecord, 'fresh'),
      activeDeliveryTaskId: readNullableUuid(locationRecord, 'activeDeliveryTaskId'),
    };
  }

  return {
    captainId: requireUuid(record, 'captainId'),
    requestedStatus,
    availabilityStatus,
    changed: requireBoolean(record, 'changed'),
    dispatchEligible: requireBoolean(record, 'dispatchEligible'),
    location,
    changedAt: requireTimestamp(record, 'changedAt'),
  };
}

export function parseCaptainLocationSnapshot(value: unknown): CaptainLocationSnapshot {
  const record = requireRecord(value);

  return {
    captainId: requireUuid(record, 'captainId'),
    sampleId: requireUuid(record, 'sampleId'),
    recordedAt: requireTimestamp(record, 'recordedAt'),
    acceptedAt: requireTimestamp(record, 'acceptedAt'),
    accuracyMeters: requireFiniteNumber(record, 'accuracyMeters'),
    activeDeliveryTaskId: readNullableUuid(record, 'activeDeliveryTaskId'),
    historySampled: requireBoolean(record, 'historySampled'),
    replayed: requireBoolean(record, 'replayed'),
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  switch (error.code) {
    case 'P0040':
      return new CaptainPresenceInvalidRequestError();
    case 'P0041':
      return new CaptainPresenceNotEligibleError();
    case 'P0042':
      return new CaptainPresenceStateConflictError();
    case 'P0043':
      return new CaptainPresenceLocationStaleError();
    case 'P0044':
      return new CaptainPresenceRateLimitedError();
    case 'P0045':
      return new CaptainPresenceSampleConflictError();
    case undefined:
      return new CaptainPresenceGatewayUnavailableError();
    default:
      return new CaptainPresenceGatewayUnavailableError();
  }
}

function isKnownGatewayError(error: unknown): boolean {
  return (
    error instanceof CaptainPresenceInvalidRequestError ||
    error instanceof CaptainPresenceNotEligibleError ||
    error instanceof CaptainPresenceStateConflictError ||
    error instanceof CaptainPresenceLocationStaleError ||
    error instanceof CaptainPresenceSampleConflictError ||
    error instanceof CaptainPresenceRateLimitedError ||
    error instanceof CaptainPresenceGatewayUnavailableError
  );
}

@Injectable()
export class SupabaseCaptainPresenceGateway implements CaptainPresenceGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async setAvailability(
    actorId: string,
    status: CaptainClientAvailabilityStatus,
  ): Promise<CaptainAvailabilitySnapshot> {
    try {
      const response = await this.client.rpc('set_captain_availability', {
        p_actor: actorId,
        p_requested_status: status,
      });

      if (response.error !== null) {
        throw mapRpcError(response.error);
      }

      return parseCaptainAvailabilitySnapshot(response.data);
    } catch (error: unknown) {
      if (isKnownGatewayError(error)) {
        throw error;
      }

      throw new CaptainPresenceGatewayUnavailableError();
    }
  }

  public async updateLocation(
    command: UpdateCaptainLocationCommand,
  ): Promise<CaptainLocationSnapshot> {
    try {
      const response = await this.client.rpc('update_captain_current_location', {
        p_actor: command.actorId,
        p_sample_id: command.sampleId,
        p_latitude: command.latitude,
        p_longitude: command.longitude,
        p_accuracy_meters: command.accuracyMeters,
        p_recorded_at: command.recordedAt,
        p_heading: command.heading,
        p_speed_mps: command.speedMps,
        p_battery_percent: command.batteryPercent,
        p_active_delivery_task_id: command.activeDeliveryTaskId,
      });

      if (response.error !== null) {
        throw mapRpcError(response.error);
      }

      return parseCaptainLocationSnapshot(response.data);
    } catch (error: unknown) {
      if (isKnownGatewayError(error)) {
        throw error;
      }

      throw new CaptainPresenceGatewayUnavailableError();
    }
  }
}
