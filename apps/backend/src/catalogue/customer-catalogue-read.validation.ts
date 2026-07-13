const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;

export class CustomerCatalogueReadValidationError extends Error {
  public constructor() {
    super('Customer catalogue read query is invalid');
    this.name = 'CustomerCatalogueReadValidationError';
  }
}

export interface CustomerCatalogueProductListQuery {
  readonly shopId: string;
  readonly cursor: string | null;
  readonly limit: number;
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CustomerCatalogueReadValidationError();
  }

  const normalized = value.trim();

  if (!UUID_PATTERN.test(normalized)) {
    throw new CustomerCatalogueReadValidationError();
  }

  return normalized;
}

function parseCursor(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  return parseUuid(value);
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    throw new CustomerCatalogueReadValidationError();
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > MAX_LIMIT) {
    throw new CustomerCatalogueReadValidationError();
  }

  return parsed;
}

export function parseCustomerCatalogueProductListQuery(
  shopIdValue: unknown,
  cursorValue: unknown,
  limitValue: unknown,
): CustomerCatalogueProductListQuery {
  return {
    shopId: parseUuid(shopIdValue),
    cursor: parseCursor(cursorValue),
    limit: parseLimit(limitValue),
  };
}

export function parseCustomerCatalogueProductId(value: unknown): string {
  return parseUuid(value);
}
