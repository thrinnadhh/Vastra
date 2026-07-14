import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  CustomerOrderReadValidationError,
  parseCustomerOrderId,
  parseCustomerOrderListQuery,
} from './customer-order-read.validation';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';

describe('customer order read validation', () => {
  it('applies default pagination', () => {
    expect(parseCustomerOrderListQuery(undefined, undefined)).toStrictEqual({
      offset: 0,
      limit: 20,
    });
  });

  it('parses a canonical opaque cursor and bounded limit', () => {
    const cursor = Buffer.from('v1:40', 'utf8').toString('base64url');

    expect(parseCustomerOrderListQuery(cursor, '10')).toStrictEqual({
      offset: 40,
      limit: 10,
    });
  });

  it('rejects malformed pagination', () => {
    expect(() => parseCustomerOrderListQuery('not-a-cursor', '51')).toThrow(
      CustomerOrderReadValidationError,
    );
  });

  it('accepts a valid order identifier', () => {
    expect(parseCustomerOrderId(ORDER_ID)).toBe(ORDER_ID);
  });

  it('rejects an invalid order identifier', () => {
    expect(() => parseCustomerOrderId('invalid')).toThrow(CustomerOrderReadValidationError);
  });
});
