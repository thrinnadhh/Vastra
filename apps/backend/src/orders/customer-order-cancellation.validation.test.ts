import { describe, expect, it } from 'vitest';

import {
  CustomerOrderCancellationIdempotencyKeyRequiredError,
  CustomerOrderCancellationValidationError,
  parseCustomerOrderCancellationInput,
} from './customer-order-cancellation.validation';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '20000000-0000-4000-8000-000000000001';

describe('customer order cancellation validation', () => {
  it('normalizes the order id and idempotency key', () => {
    expect(
      parseCustomerOrderCancellationInput(ORDER_ID.toUpperCase(), IDEMPOTENCY_KEY.toUpperCase()),
    ).toStrictEqual({
      orderId: ORDER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });

  it.each([undefined, null, '', 'not-a-uuid'])(
    'rejects a missing or malformed idempotency key %#',
    (value) => {
      expect(() => parseCustomerOrderCancellationInput(ORDER_ID, value)).toThrow(
        CustomerOrderCancellationIdempotencyKeyRequiredError,
      );
    },
  );

  it.each([undefined, null, '', 'not-a-uuid'])('rejects an invalid order id %#', (value) => {
    expect(() => parseCustomerOrderCancellationInput(value, IDEMPOTENCY_KEY)).toThrow(
      CustomerOrderCancellationValidationError,
    );
  });
});
