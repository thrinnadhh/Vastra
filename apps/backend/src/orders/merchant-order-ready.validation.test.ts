import { describe, expect, it } from 'vitest';

import {
  MerchantOrderReadyIdempotencyKeyError,
  MerchantOrderReadyValidationError,
  parseMerchantOrderReadyBody,
  parseMerchantOrderReadyIdempotencyKey,
  parseMerchantOrderReadyOrderId,
} from './merchant-order-ready.validation';

const UUID = '10000000-0000-4000-8000-000000000001';

describe('merchant ready-for-pickup validation', () => {
  it('accepts valid order and idempotency UUIDs', () => {
    expect(parseMerchantOrderReadyOrderId(UUID)).toBe(UUID);
    expect(parseMerchantOrderReadyIdempotencyKey(UUID)).toBe(UUID);
  });

  it('rejects an invalid order UUID', () => {
    expect(() => parseMerchantOrderReadyOrderId('invalid')).toThrow(
      MerchantOrderReadyValidationError,
    );
  });

  it.each([undefined, '', 'invalid', ['10000000-0000-4000-8000-000000000001']])(
    'rejects a missing or malformed idempotency key %#',
    (value) => {
      expect(() => parseMerchantOrderReadyIdempotencyKey(value)).toThrow(
        MerchantOrderReadyIdempotencyKeyError,
      );
    },
  );

  it('accepts an absent or empty command body', () => {
    expect(parseMerchantOrderReadyBody(undefined)).toStrictEqual({});
    expect(parseMerchantOrderReadyBody({})).toStrictEqual({});
  });

  it.each([
    null,
    [],
    { status: 'READY_FOR_PICKUP' },
    { orderItemId: UUID },
    { verificationResult: 'MATCH' },
  ])('rejects invalid or merchant-controlled body fields %#', (body) => {
    expect(() => parseMerchantOrderReadyBody(body)).toThrow(MerchantOrderReadyValidationError);
  });
});
