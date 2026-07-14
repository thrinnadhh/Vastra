import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  MerchantOrderReadValidationError,
  parseMerchantOrderId,
  parseMerchantOrderListQuery,
} from './merchant-order-read.validation';

describe('merchant order read validation', () => {
  it('uses the default first page', () => {
    expect(parseMerchantOrderListQuery(undefined, undefined)).toStrictEqual({
      offset: 0,
      limit: 20,
    });
  });

  it('parses an opaque cursor and bounded limit', () => {
    const cursor = Buffer.from('v1:40', 'utf8').toString('base64url');

    expect(parseMerchantOrderListQuery(cursor, '10')).toStrictEqual({
      offset: 40,
      limit: 10,
    });
  });

  it('rejects malformed cursors and oversized limits', () => {
    expect(() => parseMerchantOrderListQuery('not-a-cursor', undefined)).toThrow(
      MerchantOrderReadValidationError,
    );
    expect(() => parseMerchantOrderListQuery(undefined, '51')).toThrow(
      MerchantOrderReadValidationError,
    );
  });

  it('requires a UUID order identifier', () => {
    expect(parseMerchantOrderId('10000000-0000-4000-8000-000000000001')).toBe(
      '10000000-0000-4000-8000-000000000001',
    );
    expect(() => parseMerchantOrderId('invalid')).toThrow(MerchantOrderReadValidationError);
  });
});
