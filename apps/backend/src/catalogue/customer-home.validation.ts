import type { CustomerHomeQuery } from './customer-home.types';

const DEFAULT_SHOP_LIMIT = 8;
const MAX_SHOP_LIMIT = 12;
const DEFAULT_PRODUCT_LIMIT = 12;
const MAX_PRODUCT_LIMIT = 24;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;

export class CustomerHomeValidationError extends Error {
  public constructor() {
    super('Customer home query is invalid');
    this.name = 'CustomerHomeValidationError';
  }
}

function parseCoordinate(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerHomeValidationError();
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new CustomerHomeValidationError();
  }

  return parsed;
}

function parseLimit(value: unknown, defaultValue: number, maximum: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    throw new CustomerHomeValidationError();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new CustomerHomeValidationError();
  }

  return parsed;
}

export function parseCustomerHomeQuery(
  latitudeValue: unknown,
  longitudeValue: unknown,
  shopLimitValue: unknown,
  productLimitValue: unknown,
): CustomerHomeQuery {
  return {
    latitude: parseCoordinate(latitudeValue, -90, 90),
    longitude: parseCoordinate(longitudeValue, -180, 180),
    shopLimit: parseLimit(shopLimitValue, DEFAULT_SHOP_LIMIT, MAX_SHOP_LIMIT),
    productLimit: parseLimit(productLimitValue, DEFAULT_PRODUCT_LIMIT, MAX_PRODUCT_LIMIT),
  };
}
