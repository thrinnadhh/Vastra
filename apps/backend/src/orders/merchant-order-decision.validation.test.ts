import { describe, expect, it } from 'vitest';

import {
  MerchantOrderDecisionValidationError,
  parseMerchantAcceptOrderInput,
  parseMerchantDecisionOrderId,
  parseMerchantRejectOrderInput,
} from './merchant-order-decision.validation';

describe('merchant order decision validation', () => {
  it('accepts bounded preparation', () => {
    expect(parseMerchantAcceptOrderInput({ preparationMinutes: 30 })).toStrictEqual({
      preparationMinutes: 30,
    });
  });

  it('requires OTHER note', () => {
    expect(() => {
      parseMerchantRejectOrderInput({ reasonCode: 'OTHER' });
    }).toThrow(MerchantOrderDecisionValidationError);
  });

  it('parses rejection', () => {
    expect(parseMerchantRejectOrderInput({ reasonCode: 'OUT_OF_STOCK' })).toStrictEqual({
      reasonCode: 'OUT_OF_STOCK',
      orderItemId: null,
      note: null,
    });
  });

  it('requires UUID', () => {
    expect(() => {
      parseMerchantDecisionOrderId('bad');
    }).toThrow(MerchantOrderDecisionValidationError);
  });
});
