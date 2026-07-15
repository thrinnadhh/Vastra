import { describe, expect, it } from 'vitest';

import {
  OrderDispatchValidationError,
  parseStartOrderDispatchInput,
} from './order-dispatch.validation';

const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';

describe('order dispatch validation', () => {
  it('normalizes a valid input into an immutable copy', () => {
    const input = { orderId: ORDER_ID, idempotencyKey: KEY };
    const result = parseStartOrderDispatchInput(input);
    expect(result).toStrictEqual(input);
    expect(result).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    undefined,
    null,
    {},
    { orderId: null, idempotencyKey: KEY },
    { orderId: 'invalid', idempotencyKey: KEY },
    { orderId: ORDER_ID, idempotencyKey: 'invalid' },
    { orderId: ORDER_ID, idempotencyKey: null },
    { orderId: ORDER_ID, idempotencyKey: KEY, unknown: true },
  ])('rejects invalid input %#', (value) => {
    expect(() => parseStartOrderDispatchInput(value)).toThrow(OrderDispatchValidationError);
  });
});
