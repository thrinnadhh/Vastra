const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class MerchantOrderAlertValidationError extends Error {
  public constructor() {
    super('Merchant order alert input is invalid');
    this.name = 'MerchantOrderAlertValidationError';
  }
}

export function parseMerchantOrderAlertId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new MerchantOrderAlertValidationError();
  }

  return value;
}
