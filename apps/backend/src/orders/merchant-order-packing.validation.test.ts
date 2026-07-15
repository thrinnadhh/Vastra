import { describe, expect, it } from 'vitest';

import {
  MerchantOrderPackingValidationError,
  parseMerchantOrderItemVerificationBody,
  parseMerchantOrderPackingId,
  parseStartMerchantOrderPackingBody,
} from './merchant-order-packing.validation';

const UUID = '10000000-0000-4000-8000-000000000001';

describe('merchant order packing validation', () => {
  it('accepts valid order and order-item UUIDs', () => {
    expect(parseMerchantOrderPackingId(UUID)).toBe(UUID);
  });

  it('rejects invalid UUIDs', () => {
    expect(() => parseMerchantOrderPackingId('not-a-uuid')).toThrow(
      MerchantOrderPackingValidationError,
    );
  });

  it('accepts an absent or empty start-packing body', () => {
    expect(parseStartMerchantOrderPackingBody(undefined)).toStrictEqual({});
    expect(parseStartMerchantOrderPackingBody({})).toStrictEqual({});
  });

  it('rejects unknown start-packing properties', () => {
    expect(() => parseStartMerchantOrderPackingBody({ status: 'PACKING' })).toThrow(
      MerchantOrderPackingValidationError,
    );
  });

  it('accepts and trims a valid barcode request without changing case', () => {
    expect(
      parseMerchantOrderItemVerificationBody({ method: 'BARCODE', barcode: '  AbC-123  ' }),
    ).toStrictEqual({ method: 'BARCODE', barcode: 'AbC-123' });
  });

  it.each([
    { method: 'BARCODE', barcode: '' },
    { method: 'BARCODE', barcode: ' '.repeat(3) },
    { method: 'BARCODE', barcode: 'a'.repeat(256) },
    { method: 'BARCODE', barcode: 'abc\u0000def' },
  ])('rejects empty or out-of-format barcode %#', (body) => {
    expect(() => parseMerchantOrderItemVerificationBody(body)).toThrow(
      MerchantOrderPackingValidationError,
    );
  });

  it('accepts manual confirmation without a barcode', () => {
    expect(parseMerchantOrderItemVerificationBody({ method: 'MANUAL' })).toStrictEqual({
      method: 'MANUAL',
    });
  });

  it.each([
    { method: 'MANUAL', barcode: '123' },
    { method: 'PHOTO' },
    { method: 'BARCODE', barcode: '123', result: 'MATCH' },
    { method: 'BARCODE', barcode: '123', variantId: UUID },
    { method: 'BARCODE', barcode: '123', verifiedBy: UUID },
    { method: 'BARCODE', barcode: '123', overrideReason: 'trust me' },
  ])('rejects unsupported or merchant-controlled fields %#', (body) => {
    expect(() => parseMerchantOrderItemVerificationBody(body)).toThrow(
      MerchantOrderPackingValidationError,
    );
  });
});
