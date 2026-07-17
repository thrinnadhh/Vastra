const CURSOR_PATTERN = /^\d{4}-\d{2}-\d{2}T/u;

export class MerchantAlertObservabilityValidationError extends Error {}

function parseInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
    throw new MerchantAlertObservabilityValidationError();
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new MerchantAlertObservabilityValidationError();
  }
  return parsed;
}

export function parseMetricsWindow(value: unknown): number {
  return parseInteger(value, 60, 5, 10080);
}

export function parseActivityQuery(
  limitValue: unknown,
  beforeValue: unknown,
): {
  readonly limit: number;
  readonly before: string | null;
} {
  const limit = parseInteger(limitValue, 50, 1, 100);
  if (beforeValue === undefined) return { limit, before: null };
  if (
    typeof beforeValue !== 'string' ||
    !CURSOR_PATTERN.test(beforeValue) ||
    Number.isNaN(Date.parse(beforeValue))
  ) {
    throw new MerchantAlertObservabilityValidationError();
  }
  return { limit, before: new Date(beforeValue).toISOString() };
}
