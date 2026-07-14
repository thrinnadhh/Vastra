import type { CustomerShopDetailQuery } from './customer-shop-detail.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class CustomerShopDetailValidationError extends Error {
  public constructor() {
    super('Customer shop-detail query is invalid');
    this.name = 'CustomerShopDetailValidationError';
  }
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CustomerShopDetailValidationError();
  }

  const normalized = value.trim();

  if (!UUID_PATTERN.test(normalized)) {
    throw new CustomerShopDetailValidationError();
  }

  return normalized;
}

function parseCoordinate(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerShopDetailValidationError();
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new CustomerShopDetailValidationError();
  }

  return parsed;
}

export function parseCustomerShopDetailQuery(
  shopIdValue: unknown,
  latitudeValue: unknown,
  longitudeValue: unknown,
): CustomerShopDetailQuery {
  return {
    shopId: parseUuid(shopIdValue),
    latitude: parseCoordinate(latitudeValue, -90, 90),
    longitude: parseCoordinate(longitudeValue, -180, 180),
  };
}
