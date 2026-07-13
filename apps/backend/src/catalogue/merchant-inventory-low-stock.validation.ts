import type { MerchantLowStockQuery } from './merchant-inventory-low-stock.types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;

export class MerchantLowStockQueryValidationError extends Error {
  public constructor() {
    super('Merchant low-stock query is invalid');
    this.name = 'MerchantLowStockQueryValidationError';
  }
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    throw new MerchantLowStockQueryValidationError();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > MAX_LIMIT) {
    throw new MerchantLowStockQueryValidationError();
  }

  return parsed;
}

function parseIncludeInactive(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new MerchantLowStockQueryValidationError();
}

export function parseMerchantLowStockQuery(
  limitValue: unknown,
  includeInactiveValue: unknown,
): MerchantLowStockQuery {
  return {
    limit: parseLimit(limitValue),
    includeInactive: parseIncludeInactive(includeInactiveValue),
  };
}
