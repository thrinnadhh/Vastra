import type { StartOrderDispatchInput } from './order-dispatch.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INPUT_KEYS = ['idempotencyKey', 'orderId'] as const;

export class OrderDispatchValidationError extends Error {
  public constructor() {
    super('Order dispatch input is invalid');
    this.name = 'OrderDispatchValidationError';
  }
}

export function parseStartOrderDispatchInput(value: unknown): StartOrderDispatchInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OrderDispatchValidationError();
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== INPUT_KEYS.length || keys.some((key, index) => key !== INPUT_KEYS[index])) {
    throw new OrderDispatchValidationError();
  }
  const orderId = record['orderId'];
  const idempotencyKey = record['idempotencyKey'];
  if (
    typeof orderId !== 'string' ||
    !UUID_PATTERN.test(orderId) ||
    typeof idempotencyKey !== 'string' ||
    !UUID_PATTERN.test(idempotencyKey)
  ) {
    throw new OrderDispatchValidationError();
  }
  return Object.freeze({ orderId, idempotencyKey });
}
