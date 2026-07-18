import type { PlaceCustomerOnlineOrderInput } from './customer-payment.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_KEYS = new Set(['cartId', 'quoteId', 'addressId', 'customerNote']);

export class CustomerPaymentValidationError extends Error {}
export class CustomerPaymentIdempotencyKeyRequiredError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CustomerPaymentValidationError();
  }
  return value as Record<string, unknown>;
}

export function requireCustomerPaymentUuid(value: unknown): string {
  if (typeof value !== 'string') throw new CustomerPaymentValidationError();
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new CustomerPaymentValidationError();
  return normalized;
}

function parseIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new CustomerPaymentIdempotencyKeyRequiredError();
  }
  return requireCustomerPaymentUuid(value);
}

function parseCustomerNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new CustomerPaymentValidationError();
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > 500) throw new CustomerPaymentValidationError();
  return normalized;
}

export function parsePlaceCustomerOnlineOrderInput(
  body: unknown,
  idempotencyKey: unknown,
): PlaceCustomerOnlineOrderInput {
  const record = requireRecord(body);
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new CustomerPaymentValidationError();
  }
  return {
    cartId: requireCustomerPaymentUuid(record['cartId']),
    quoteId: requireCustomerPaymentUuid(record['quoteId']),
    addressId: requireCustomerPaymentUuid(record['addressId']),
    customerNote: parseCustomerNote(record['customerNote']),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
  };
}
