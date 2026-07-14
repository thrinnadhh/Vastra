import type { CustomerNearbyShopQuery } from './customer-nearby-shop.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;

export class CustomerNearbyShopValidationError extends Error {
  public constructor() {
    super('Nearby-shop query is invalid');
    this.name = 'CustomerNearbyShopValidationError';
  }
}

function parseCoordinate(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerNearbyShopValidationError();
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new CustomerNearbyShopValidationError();
  }

  return parsed;
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    throw new CustomerNearbyShopValidationError();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > MAX_LIMIT) {
    throw new CustomerNearbyShopValidationError();
  }

  return parsed;
}

export function parseCustomerNearbyShopQuery(
  latitudeValue: unknown,
  longitudeValue: unknown,
  limitValue: unknown,
): CustomerNearbyShopQuery {
  return {
    latitude: parseCoordinate(latitudeValue, -90, 90),
    longitude: parseCoordinate(longitudeValue, -180, 180),
    limit: parseLimit(limitValue),
  };
}
