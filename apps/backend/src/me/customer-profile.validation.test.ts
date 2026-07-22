import { describe, expect, it } from 'vitest';

import {
  CustomerProfileValidationError,
  parseUpdateCustomerProfileInput,
} from './customer-profile.validation';

describe('parseUpdateCustomerProfileInput', () => {
  it('normalizes surrounding and repeated whitespace', () => {
    expect(parseUpdateCustomerProfileInput({ fullName: '  Trinadh   B  ' })).toStrictEqual({
      fullName: 'Trinadh B',
    });
  });

  it.each([
    null,
    [],
    {},
    { fullName: ' ' },
    { fullName: 'A' },
    { fullName: 'Valid Name', unexpected: true },
    { fullName: `Valid\u0000Name` },
    { fullName: 'a'.repeat(121) },
  ])('rejects invalid profile input %#', (value) => {
    expect(() => parseUpdateCustomerProfileInput(value)).toThrow(CustomerProfileValidationError);
  });
});
