const DEFAULT_LOOKUP_LIMIT = 20;
const MAX_LOOKUP_LIMIT = 50;
const MAX_LOOKUP_QUERY_LENGTH = 120;
function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit <= 0x1f || codeUnit === 0x7f) {
      return true;
    }
  }

  return false;
}
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;

export class MerchantInventoryLookupValidationError extends Error {
  public constructor() {
    super('Merchant inventory lookup query is invalid');
    this.name = 'MerchantInventoryLookupValidationError';
  }
}

export interface MerchantInventoryLookupQuery {
  readonly query: string;
  readonly limit: number;
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_LOOKUP_LIMIT;
  }

  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    throw new MerchantInventoryLookupValidationError();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > MAX_LOOKUP_LIMIT) {
    throw new MerchantInventoryLookupValidationError();
  }

  return parsed;
}

export function parseMerchantInventoryLookupQuery(
  queryValue: unknown,
  limitValue: unknown,
): MerchantInventoryLookupQuery {
  if (typeof queryValue !== 'string' || containsControlCharacter(queryValue)) {
    throw new MerchantInventoryLookupValidationError();
  }

  const query = queryValue.trim().replace(/\s+/gu, ' ');

  if (query.length === 0 || query.length > MAX_LOOKUP_QUERY_LENGTH) {
    throw new MerchantInventoryLookupValidationError();
  }

  return {
    query,
    limit: parseLimit(limitValue),
  };
}
