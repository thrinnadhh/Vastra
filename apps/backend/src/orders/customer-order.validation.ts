import type { PlaceCustomerCodOrderInput } from './customer-order.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const ALLOWED_KEYS = new Set(['cartId', 'quoteId', 'addressId', 'paymentMethod', 'customerNote']);

export class CustomerOrderValidationError extends Error {
  public constructor() {
    super('Customer order request is invalid');
    this.name = 'CustomerOrderValidationError';
  }
}

export class CustomerOrderIdempotencyKeyRequiredError extends Error {
  public constructor() {
    super('Customer order idempotency key is required');
    this.name = 'CustomerOrderIdempotencyKeyRequiredError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CustomerOrderValidationError();
  }

  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new CustomerOrderValidationError();
  }

  return normalized;
}

function parseCustomerNote(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerOrderValidationError();
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > 500) {
    throw new CustomerOrderValidationError();
  }

  return normalized;
}

export function parseCustomerOrderIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new CustomerOrderIdempotencyKeyRequiredError();
  }

  return parseUuid(value);
}

export function parsePlaceCustomerCodOrderInput(
  body: unknown,
  idempotencyKeyValue: unknown,
): PlaceCustomerCodOrderInput {
  if (!isRecord(body)) {
    throw new CustomerOrderValidationError();
  }

  if (Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new CustomerOrderValidationError();
  }

  if (body['paymentMethod'] !== 'COD') {
    throw new CustomerOrderValidationError();
  }

  return {
    cartId: parseUuid(body['cartId']),
    quoteId: parseUuid(body['quoteId']),
    addressId: parseUuid(body['addressId']),
    paymentMethod: 'COD',
    customerNote: parseCustomerNote(body['customerNote']),
    idempotencyKey: parseCustomerOrderIdempotencyKey(idempotencyKeyValue),
  };
}
