import { Buffer } from 'node:buffer';

import type { MerchantOrderListQuery } from './merchant-order-read.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 1_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const NON_NEGATIVE_INTEGER_PATTERN = /^(0|[1-9][0-9]*)$/u;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;

export class MerchantOrderReadValidationError extends Error {
  public constructor() {
    super('Merchant order read input is invalid');
    this.name = 'MerchantOrderReadValidationError';
  }
}

function parseCursor(value: unknown): number {
  if (value === undefined) {
    return 0;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new MerchantOrderReadValidationError();
  }

  let decoded: string;

  try {
    decoded = Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    throw new MerchantOrderReadValidationError();
  }

  if (Buffer.from(decoded, 'utf8').toString('base64url') !== value || !decoded.startsWith('v1:')) {
    throw new MerchantOrderReadValidationError();
  }

  const rawOffset = decoded.slice(3);

  if (!NON_NEGATIVE_INTEGER_PATTERN.test(rawOffset)) {
    throw new MerchantOrderReadValidationError();
  }

  const offset = Number(rawOffset);

  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new MerchantOrderReadValidationError();
  }

  return offset;
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    throw new MerchantOrderReadValidationError();
  }

  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit > MAX_LIMIT) {
    throw new MerchantOrderReadValidationError();
  }

  return limit;
}

export function parseMerchantOrderListQuery(
  cursorValue: unknown,
  limitValue: unknown,
): MerchantOrderListQuery {
  return {
    offset: parseCursor(cursorValue),
    limit: parseLimit(limitValue),
  };
}

export function parseMerchantOrderId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new MerchantOrderReadValidationError();
  }

  return value;
}
