import { describe, expect, it } from 'vitest';

import {
  MerchantOrderAlertValidationError,
  parseMerchantOrderAlertId,
} from './merchant-order-alert.validation';

describe('merchant order alert validation', () => {
  it('accepts a UUID alert identifier', () => {
    expect(parseMerchantOrderAlertId('10000000-0000-4000-8000-000000000001')).toBe(
      '10000000-0000-4000-8000-000000000001',
    );
  });

  it('rejects a malformed alert identifier', () => {
    expect(() => parseMerchantOrderAlertId('invalid')).toThrow(MerchantOrderAlertValidationError);
  });
});
