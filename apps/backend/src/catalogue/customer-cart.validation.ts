import type { SetCustomerCartItemInput, UpdateCustomerCartItemInput } from './customer-cart.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CART_QUANTITY = 20;

export class CustomerCartValidationError extends Error {
  public constructor() {
    super('Customer cart request invalid');
    this.name = 'CustomerCartValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireExactKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): void {
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new CustomerCartValidationError();
  }
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new CustomerCartValidationError();
  }

  return value.toLowerCase();
}

function parseQuantity(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_CART_QUANTITY
  ) {
    throw new CustomerCartValidationError();
  }

  return value;
}

export function parseCustomerCartItemId(value: unknown): string {
  return parseUuid(value);
}

export function parseSetCustomerCartItemInput(value: unknown): SetCustomerCartItemInput {
  if (!isRecord(value)) {
    throw new CustomerCartValidationError();
  }

  requireExactKeys(value, ['variantId', 'quantity', 'replaceExistingCart']);

  const replaceExistingCart = value['replaceExistingCart'];

  if (replaceExistingCart !== undefined && typeof replaceExistingCart !== 'boolean') {
    throw new CustomerCartValidationError();
  }

  return {
    variantId: parseUuid(value['variantId']),
    quantity: parseQuantity(value['quantity']),
    replaceExistingCart: replaceExistingCart ?? false,
  };
}

export function parseUpdateCustomerCartItemInput(value: unknown): UpdateCustomerCartItemInput {
  if (!isRecord(value)) {
    throw new CustomerCartValidationError();
  }

  requireExactKeys(value, ['quantity']);

  return {
    quantity: parseQuantity(value['quantity']),
  };
}
