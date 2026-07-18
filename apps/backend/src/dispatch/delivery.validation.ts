import {
  DELIVERY_OFFER_REJECTION_REASONS,
  DELIVERY_PROBLEM_REASONS,
  DELIVERY_RELEASE_REASONS,
  type AdminAssignInput,
  type AdminDeliveryOverrideInput,
  type AdminReleaseInput,
  type ArrivePickupInput,
  type CompleteDeliveryInput,
  type DeliveryLifecycleLocationInput,
  type DeliveryLocationInput,
  type DeliveryOfferRejectionReason,
  type ReleaseDeliveryInput,
  type ReportDeliveryProblemInput,
  type VerifyPickupInput,
} from './delivery.types';

export class DeliveryValidationError extends Error {}
export class DeliveryIdempotencyKeyRequiredError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DeliveryValidationError();
  }
  return value as Record<string, unknown>;
}

export function parseUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new DeliveryValidationError();
  }
  return value.trim();
}

export function parseIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new DeliveryIdempotencyKeyRequiredError();
  }
  return parseUuid(value);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new DeliveryValidationError();
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new DeliveryValidationError();
  }
  return normalized;
}

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DeliveryValidationError();
  }
  return value;
}

function parseLocation(value: unknown, required: boolean): DeliveryLocationInput | null {
  if ((value === undefined || value === null) && !required) return null;
  const record = requireRecord(value);
  const latitude = requireFiniteNumber(record, 'latitude');
  const longitude = requireFiniteNumber(record, 'longitude');
  const accuracyMeters = requireFiniteNumber(record, 'accuracyMeters');
  const recordedAt = record['recordedAt'];
  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    accuracyMeters < 0 ||
    typeof recordedAt !== 'string' ||
    Number.isNaN(Date.parse(recordedAt))
  ) {
    throw new DeliveryValidationError();
  }
  return { latitude, longitude, accuracyMeters, recordedAt };
}

function assertOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new DeliveryValidationError();
  }
}

export function parseRejectOfferInput(
  assignmentId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): { assignmentId: string; idempotencyKey: string; reason: DeliveryOfferRejectionReason } {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['reason']);
  const reason = record['reason'];
  if (
    typeof reason !== 'string' ||
    !DELIVERY_OFFER_REJECTION_REASONS.some((candidate) => candidate === reason)
  ) {
    throw new DeliveryValidationError();
  }
  return {
    assignmentId: parseUuid(assignmentId),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
    reason: reason as DeliveryOfferRejectionReason,
  };
}

export function parseArrivePickupInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): ArrivePickupInput {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['location']);
  const location = parseLocation(record['location'], true);
  if (location === null) throw new DeliveryValidationError();
  return {
    actorId,
    taskId: parseUuid(taskId),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
    ...location,
  };
}

export function parseVerifyPickupInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): VerifyPickupInput {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['pickupCode']);
  const pickupCode = record['pickupCode'];
  if (typeof pickupCode !== 'string' || !/^\d{6}$/u.test(pickupCode)) {
    throw new DeliveryValidationError();
  }
  return {
    actorId,
    taskId: parseUuid(taskId),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
    pickupCode,
  };
}

export function parseLifecycleLocationInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): DeliveryLifecycleLocationInput {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['location']);
  return {
    actorId,
    taskId: parseUuid(taskId),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
    location: parseLocation(record['location'], false),
  };
}

export function parseCompleteDeliveryInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): CompleteDeliveryInput {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['collectedAmountPaise', 'deliveryOtp', 'location']);
  const collectedAmountPaise = record['collectedAmountPaise'];
  const deliveryOtp = record['deliveryOtp'];
  if (
    typeof collectedAmountPaise !== 'number' ||
    !Number.isSafeInteger(collectedAmountPaise) ||
    collectedAmountPaise < 0 ||
    typeof deliveryOtp !== 'string' ||
    !/^\d{6}$/u.test(deliveryOtp)
  ) {
    throw new DeliveryValidationError();
  }
  return {
    actorId,
    taskId: parseUuid(taskId),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
    collectedAmountPaise,
    deliveryOtp,
    location: parseLocation(record['location'], false),
  };
}

export function parseProblemInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): ReportDeliveryProblemInput {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['reason', 'note', 'evidenceObjectKey', 'location']);
  const reason = record['reason'];
  if (
    typeof reason !== 'string' ||
    !DELIVERY_PROBLEM_REASONS.some((candidate) => candidate === reason)
  ) {
    throw new DeliveryValidationError();
  }
  return {
    actorId,
    taskId: parseUuid(taskId),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
    reason: reason as ReportDeliveryProblemInput['reason'],
    note: optionalString(record, 'note', 500),
    evidenceObjectKey: optionalString(record, 'evidenceObjectKey', 1024),
    location: parseLocation(record['location'], false),
  };
}

export function parseReleaseInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): ReleaseDeliveryInput {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['reason', 'note', 'location']);
  const reason = record['reason'];
  if (
    typeof reason !== 'string' ||
    !DELIVERY_RELEASE_REASONS.some((candidate) => candidate === reason)
  ) {
    throw new DeliveryValidationError();
  }
  return {
    actorId,
    taskId: parseUuid(taskId),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
    reason: reason as ReleaseDeliveryInput['reason'],
    note: optionalString(record, 'note', 500),
    location: parseLocation(record['location'], false),
  };
}

export function parseAdminAssignInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): AdminAssignInput {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['captainId']);
  return {
    actorId,
    taskId: parseUuid(taskId),
    captainId: parseUuid(record['captainId']),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
  };
}

export function parseAdminReleaseInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): AdminReleaseInput {
  const parsed = parseReleaseInput(actorId, taskId, idempotencyKey, body);
  return {
    actorId: parsed.actorId,
    taskId: parsed.taskId,
    idempotencyKey: parsed.idempotencyKey,
    reason: parsed.reason,
    note: parsed.note,
  };
}

export function parseAdminDeliveryOverrideInput(
  actorId: string,
  taskId: unknown,
  idempotencyKey: unknown,
  body: unknown,
): AdminDeliveryOverrideInput {
  const record = requireRecord(body);
  assertOnlyKeys(record, ['collectedAmountPaise', 'reason']);
  const collectedAmountPaise = record['collectedAmountPaise'];
  const reason = record['reason'];
  if (
    typeof collectedAmountPaise !== 'number' ||
    !Number.isSafeInteger(collectedAmountPaise) ||
    collectedAmountPaise < 0 ||
    typeof reason !== 'string' ||
    reason.trim().length < 10 ||
    reason.trim().length > 500
  ) {
    throw new DeliveryValidationError();
  }
  return {
    actorId,
    taskId: parseUuid(taskId),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
    collectedAmountPaise,
    reason: reason.trim(),
  };
}
