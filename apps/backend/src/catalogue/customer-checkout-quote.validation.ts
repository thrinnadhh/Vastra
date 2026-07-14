import type { CreateCustomerCheckoutQuoteInput } from './customer-checkout-quote.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class CustomerCheckoutQuoteValidationError extends Error {
  public constructor() {
    super('Customer checkout quote request is invalid');
    this.name = 'CustomerCheckoutQuoteValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCreateCustomerCheckoutQuoteInput(
  value: unknown,
): CreateCustomerCheckoutQuoteInput {
  if (!isRecord(value)) {
    throw new CustomerCheckoutQuoteValidationError();
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'addressId') {
    throw new CustomerCheckoutQuoteValidationError();
  }

  const addressId = value['addressId'];
  if (typeof addressId !== 'string' || !UUID_PATTERN.test(addressId)) {
    throw new CustomerCheckoutQuoteValidationError();
  }

  return { addressId: addressId.toLowerCase() };
}
