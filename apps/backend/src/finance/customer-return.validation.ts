import {
  CUSTOMER_RETURN_REASON_CODES,
  type CreateCustomerReturnInput,
  type CustomerReturnItemInput,
  type CustomerReturnReasonCode,
} from './customer-return.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_KEYS = new Set(['items', 'customerNote']);
const ITEM_ALLOWED_KEYS = new Set(['orderItemId', 'quantity', 'reasonCode']);

export class CustomerReturnValidationError extends Error {}
export class CustomerReturnIdempotencyKeyRequiredError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CustomerReturnValidationError();
  }
  return value as Record<string, unknown>;
}

export function requireCustomerReturnUuid(value: unknown): string {
  if (typeof value !== 'string') throw new CustomerReturnValidationError();
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new CustomerReturnValidationError();
  return normalized;
}

function parseIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new CustomerReturnIdempotencyKeyRequiredError();
  }
  return requireCustomerReturnUuid(value);
}

function parseItem(value: unknown): CustomerReturnItemInput {
  const record = requireRecord(value);
  if (Object.keys(record).some((key) => !ITEM_ALLOWED_KEYS.has(key))) {
    throw new CustomerReturnValidationError();
  }
  const quantity = record['quantity'];
  const reasonCode = record['reasonCode'];
  if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new CustomerReturnValidationError();
  }
  if (
    typeof reasonCode !== 'string' ||
    !CUSTOMER_RETURN_REASON_CODES.includes(reasonCode as CustomerReturnReasonCode)
  ) {
    throw new CustomerReturnValidationError();
  }
  return {
    orderItemId: requireCustomerReturnUuid(record['orderItemId']),
    quantity,
    reasonCode: reasonCode as CustomerReturnReasonCode,
  };
}

function parseNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new CustomerReturnValidationError();
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > 1000) throw new CustomerReturnValidationError();
  return normalized;
}

export function parseCreateCustomerReturnInput(
  body: unknown,
  idempotencyKey: unknown,
): CreateCustomerReturnInput {
  const record = requireRecord(body);
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new CustomerReturnValidationError();
  }
  const rawItems = record['items'];
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 25) {
    throw new CustomerReturnValidationError();
  }
  const items = rawItems.map(parseItem);
  if (new Set(items.map((item) => item.orderItemId)).size !== items.length) {
    throw new CustomerReturnValidationError();
  }
  return {
    items,
    customerNote: parseNote(record['customerNote']),
    idempotencyKey: parseIdempotencyKey(idempotencyKey),
  };
}
