import type { MerchantOrderItemVerificationInput } from './merchant-order-packing.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_BARCODE_LENGTH = 255;

export class MerchantOrderPackingValidationError extends Error {
  public constructor() {
    super('Merchant order packing input is invalid');
    this.name = 'MerchantOrderPackingValidationError';
  }
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MerchantOrderPackingValidationError();
  }
  return value as Record<string, unknown>;
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || codePoint <= 31 || codePoint === 127) {
      return true;
    }
  }
  return false;
}

export function parseMerchantOrderPackingId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new MerchantOrderPackingValidationError();
  }
  return value;
}

export function parseStartMerchantOrderPackingBody(value: unknown): Record<string, never> {
  if (value === undefined) {
    return {};
  }
  const record = requireRecord(value);
  if (Object.keys(record).length !== 0) {
    throw new MerchantOrderPackingValidationError();
  }
  return {};
}

export function parseMerchantOrderItemVerificationBody(
  value: unknown,
): MerchantOrderItemVerificationInput {
  const record = requireRecord(value);
  const method = record['method'];

  if (method === 'MANUAL') {
    if (Object.keys(record).some((key) => key !== 'method')) {
      throw new MerchantOrderPackingValidationError();
    }
    return { method: 'MANUAL' };
  }

  if (method === 'BARCODE') {
    if (Object.keys(record).some((key) => key !== 'method' && key !== 'barcode')) {
      throw new MerchantOrderPackingValidationError();
    }
    const rawBarcode = record['barcode'];
    if (typeof rawBarcode !== 'string') {
      throw new MerchantOrderPackingValidationError();
    }
    const barcode = rawBarcode.trim();
    if (
      barcode.length === 0 ||
      barcode.length > MAX_BARCODE_LENGTH ||
      containsControlCharacter(barcode)
    ) {
      throw new MerchantOrderPackingValidationError();
    }
    return { method: 'BARCODE', barcode };
  }

  throw new MerchantOrderPackingValidationError();
}
