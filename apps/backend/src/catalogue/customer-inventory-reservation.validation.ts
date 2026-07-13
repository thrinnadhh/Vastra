import type {
  CreateCustomerInventoryReservationInput,
  ReleaseCustomerInventoryReservationInput,
} from './customer-inventory-reservation.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DEFAULT_TTL_SECONDS = 900;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 1800;
const MAX_RELEASE_REASON_LENGTH = 500;

const CREATE_KEYS = new Set(['cartId', 'variantId', 'quantity', 'ttlSeconds']);
const RELEASE_KEYS = new Set(['reason']);

export class CustomerInventoryReservationValidationError extends Error {
  public constructor() {
    super('Customer inventory reservation request is invalid');
    this.name = 'CustomerInventoryReservationValidationError';
  }
}

export class CustomerInventoryReservationIdempotencyKeyRequiredError extends Error {
  public constructor() {
    super('Customer inventory reservation requires an idempotency key');
    this.name = 'CustomerInventoryReservationIdempotencyKeyRequiredError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertKnownKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw new CustomerInventoryReservationValidationError();
  }
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined || codePoint <= 31 || codePoint === 127) {
      return true;
    }
  }

  return false;
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CustomerInventoryReservationValidationError();
  }

  const normalized = value.trim();

  if (!UUID_PATTERN.test(normalized)) {
    throw new CustomerInventoryReservationValidationError();
  }

  return normalized;
}

function parsePositiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new CustomerInventoryReservationValidationError();
  }

  return value;
}

function parseTtlSeconds(record: Record<string, unknown>): number {
  if (!Object.prototype.hasOwnProperty.call(record, 'ttlSeconds')) {
    return DEFAULT_TTL_SECONDS;
  }

  const value = record['ttlSeconds'];

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < MIN_TTL_SECONDS ||
    value > MAX_TTL_SECONDS
  ) {
    throw new CustomerInventoryReservationValidationError();
  }

  return value;
}

function parseIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new CustomerInventoryReservationIdempotencyKeyRequiredError();
  }

  if (typeof value !== 'string') {
    throw new CustomerInventoryReservationValidationError();
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new CustomerInventoryReservationIdempotencyKeyRequiredError();
  }

  if (!UUID_PATTERN.test(normalized)) {
    throw new CustomerInventoryReservationValidationError();
  }

  return normalized;
}

function parseReleaseReason(body: unknown): string {
  if (body === undefined || body === null) {
    return 'Customer released cart reservation';
  }

  if (!isRecord(body)) {
    throw new CustomerInventoryReservationValidationError();
  }

  assertKnownKeys(body, RELEASE_KEYS);

  if (!Object.prototype.hasOwnProperty.call(body, 'reason')) {
    return 'Customer released cart reservation';
  }

  const value = body['reason'];

  if (typeof value !== 'string') {
    throw new CustomerInventoryReservationValidationError();
  }

  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_RELEASE_REASON_LENGTH ||
    containsControlCharacter(normalized)
  ) {
    throw new CustomerInventoryReservationValidationError();
  }

  return normalized;
}

export function parseCreateCustomerInventoryReservation(
  body: unknown,
  idempotencyHeader: unknown,
): CreateCustomerInventoryReservationInput {
  if (!isRecord(body)) {
    throw new CustomerInventoryReservationValidationError();
  }

  assertKnownKeys(body, CREATE_KEYS);

  return {
    cartId: parseUuid(body['cartId']),
    variantId: parseUuid(body['variantId']),
    quantity: parsePositiveInteger(body['quantity']),
    ttlSeconds: parseTtlSeconds(body),
    idempotencyKey: parseIdempotencyKey(idempotencyHeader),
  };
}

export function parseReleaseCustomerInventoryReservation(
  reservationIdValue: unknown,
  body: unknown,
): ReleaseCustomerInventoryReservationInput {
  return {
    reservationId: parseUuid(reservationIdValue),
    reason: parseReleaseReason(body),
  };
}
