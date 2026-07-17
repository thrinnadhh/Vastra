import {
  CAPTAIN_CLIENT_AVAILABILITY_STATUSES,
  type CaptainClientAvailabilityStatus,
  type UpdateCaptainLocationCommand,
} from './captain-presence.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class CaptainPresenceValidationError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CaptainPresenceValidationError();
  }

  return value as Record<string, unknown>;
}

function rejectUnknownKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): void {
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new CaptainPresenceValidationError();
  }
}

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new CaptainPresenceValidationError();
  }

  return value;
}

function requireFiniteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CaptainPresenceValidationError();
  }

  return value;
}

function readNullableFiniteNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  if (value === undefined || value === null) {
    return null;
  }

  return requireFiniteNumber(value);
}

function readNullableUuid(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === undefined || value === null) {
    return null;
  }

  return requireUuid(value);
}

function isCaptainClientAvailabilityStatus(
  value: unknown,
): value is CaptainClientAvailabilityStatus {
  return (
    typeof value === 'string' &&
    CAPTAIN_CLIENT_AVAILABILITY_STATUSES.some((candidate) => candidate === value)
  );
}

export function parseCaptainAvailabilityBody(value: unknown): CaptainClientAvailabilityStatus {
  const record = requireRecord(value);
  rejectUnknownKeys(record, ['status']);
  const status = record['status'];

  if (!isCaptainClientAvailabilityStatus(status)) {
    throw new CaptainPresenceValidationError();
  }

  return status;
}

export function parseCaptainLocationBody(
  actorId: string,
  value: unknown,
): UpdateCaptainLocationCommand {
  const record = requireRecord(value);
  rejectUnknownKeys(record, [
    'sampleId',
    'latitude',
    'longitude',
    'accuracyMeters',
    'recordedAt',
    'heading',
    'speedMps',
    'batteryPercent',
    'activeDeliveryTaskId',
  ]);

  const latitude = requireFiniteNumber(record['latitude']);
  const longitude = requireFiniteNumber(record['longitude']);
  const accuracyMeters = requireFiniteNumber(record['accuracyMeters']);
  const heading = readNullableFiniteNumber(record, 'heading');
  const speedMps = readNullableFiniteNumber(record, 'speedMps');
  const batteryValue = record['batteryPercent'];
  const activeDeliveryTaskId = readNullableUuid(record, 'activeDeliveryTaskId');
  const recordedAt = record['recordedAt'];
  let batteryPercent: number | null = null;

  if (batteryValue !== undefined && batteryValue !== null) {
    if (
      typeof batteryValue !== 'number' ||
      !Number.isInteger(batteryValue) ||
      batteryValue < 0 ||
      batteryValue > 100
    ) {
      throw new CaptainPresenceValidationError();
    }

    batteryPercent = batteryValue;
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    accuracyMeters < 0 ||
    (heading !== null && (heading < 0 || heading >= 360)) ||
    (speedMps !== null && speedMps < 0) ||
    typeof recordedAt !== 'string' ||
    Number.isNaN(Date.parse(recordedAt))
  ) {
    throw new CaptainPresenceValidationError();
  }

  return {
    actorId,
    sampleId: requireUuid(record['sampleId']),
    latitude,
    longitude,
    accuracyMeters,
    recordedAt,
    heading,
    speedMps,
    batteryPercent,
    activeDeliveryTaskId,
  };
}
