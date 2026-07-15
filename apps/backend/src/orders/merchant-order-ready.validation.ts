const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class MerchantOrderReadyValidationError extends Error {
  public constructor() {
    super('Merchant ready-for-pickup input is invalid');
    this.name = 'MerchantOrderReadyValidationError';
  }
}

export class MerchantOrderReadyIdempotencyKeyError extends Error {
  public constructor() {
    super('A valid Idempotency-Key is required');
    this.name = 'MerchantOrderReadyIdempotencyKeyError';
  }
}

export function parseMerchantOrderReadyOrderId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new MerchantOrderReadyValidationError();
  }
  return value;
}

export function parseMerchantOrderReadyIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new MerchantOrderReadyIdempotencyKeyError();
  }
  return value;
}

export function parseMerchantOrderReadyBody(value: unknown): Record<string, never> {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MerchantOrderReadyValidationError();
  }
  if (Object.keys(value).length !== 0) {
    throw new MerchantOrderReadyValidationError();
  }
  return {};
}
