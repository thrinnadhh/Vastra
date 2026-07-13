import {
  MERCHANT_OFFLINE_SALE_IDENTIFICATION_METHODS,
  MERCHANT_OFFLINE_SALE_PAYMENT_METHODS,
  type CreateMerchantOfflineSaleInput,
  type CreateMerchantOfflineSaleItemInput,
  type MerchantOfflineSaleIdentificationMethod,
  type MerchantOfflineSalePaymentMethod,
} from './merchant-offline-sale.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_ITEMS = 50;
const MAX_CUSTOMER_PHONE_LENGTH = 32;

const SALE_KEYS = new Set(['shopId', 'customerPhone', 'taxPaise', 'paymentMethod', 'items']);

const ITEM_KEYS = new Set([
  'variantId',
  'quantity',
  'unitPricePaise',
  'discountPaise',
  'identificationMethod',
]);

export class MerchantOfflineSaleValidationError extends Error {
  public constructor() {
    super('Merchant offline sale request is invalid');
    this.name = 'MerchantOfflineSaleValidationError';
  }
}

export class MerchantOfflineSaleIdempotencyKeyRequiredError extends Error {
  public constructor() {
    super('Merchant offline sale requires an idempotency key');
    this.name = 'MerchantOfflineSaleIdempotencyKeyRequiredError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertKnownKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw new MerchantOfflineSaleValidationError();
  }
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

function parseUuid(value: unknown): string {
  if (typeof value !== 'string') {
    throw new MerchantOfflineSaleValidationError();
  }

  const normalized = value.trim();

  if (!UUID_PATTERN.test(normalized)) {
    throw new MerchantOfflineSaleValidationError();
  }

  return normalized;
}

function parseSafeNonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new MerchantOfflineSaleValidationError();
  }

  return value;
}

function parseSafePositiveInteger(value: unknown): number {
  const parsed = parseSafeNonNegativeInteger(value);

  if (parsed === 0) {
    throw new MerchantOfflineSaleValidationError();
  }

  return parsed;
}

function parseCustomerPhone(record: Record<string, unknown>): string | null {
  if (!Object.prototype.hasOwnProperty.call(record, 'customerPhone')) {
    return null;
  }

  const value = record['customerPhone'];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantOfflineSaleValidationError();
  }

  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_CUSTOMER_PHONE_LENGTH ||
    containsControlCharacter(normalized)
  ) {
    throw new MerchantOfflineSaleValidationError();
  }

  return normalized;
}

function parsePaymentMethod(value: unknown): MerchantOfflineSalePaymentMethod {
  if (
    typeof value !== 'string' ||
    !MERCHANT_OFFLINE_SALE_PAYMENT_METHODS.some((method) => method === value)
  ) {
    throw new MerchantOfflineSaleValidationError();
  }

  return value as MerchantOfflineSalePaymentMethod;
}

function parseIdentificationMethod(value: unknown): MerchantOfflineSaleIdentificationMethod {
  if (
    typeof value !== 'string' ||
    !MERCHANT_OFFLINE_SALE_IDENTIFICATION_METHODS.some((method) => method === value)
  ) {
    throw new MerchantOfflineSaleValidationError();
  }

  return value as MerchantOfflineSaleIdentificationMethod;
}

function parseItem(value: unknown): CreateMerchantOfflineSaleItemInput {
  if (!isRecord(value)) {
    throw new MerchantOfflineSaleValidationError();
  }

  assertKnownKeys(value, ITEM_KEYS);

  const quantity = parseSafePositiveInteger(value['quantity']);
  const unitPricePaise = parseSafeNonNegativeInteger(value['unitPricePaise']);
  const discountPaise = Object.prototype.hasOwnProperty.call(value, 'discountPaise')
    ? parseSafeNonNegativeInteger(value['discountPaise'])
    : 0;
  const grossPaise = quantity * unitPricePaise;

  if (!Number.isSafeInteger(grossPaise) || discountPaise > grossPaise) {
    throw new MerchantOfflineSaleValidationError();
  }

  return {
    variantId: parseUuid(value['variantId']),
    quantity,
    unitPricePaise,
    discountPaise,
    identificationMethod: parseIdentificationMethod(value['identificationMethod']),
  };
}

function parseItems(value: unknown): readonly CreateMerchantOfflineSaleItemInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) {
    throw new MerchantOfflineSaleValidationError();
  }

  const items = value.map((item) => parseItem(item));
  const variantIds = new Set<string>();
  let subtotalPaise = 0;
  let discountPaise = 0;

  for (const item of items) {
    if (variantIds.has(item.variantId)) {
      throw new MerchantOfflineSaleValidationError();
    }

    variantIds.add(item.variantId);
    subtotalPaise += item.quantity * item.unitPricePaise;
    discountPaise += item.discountPaise;

    if (!Number.isSafeInteger(subtotalPaise) || !Number.isSafeInteger(discountPaise)) {
      throw new MerchantOfflineSaleValidationError();
    }
  }

  return items;
}

function parseIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new MerchantOfflineSaleIdempotencyKeyRequiredError();
  }

  if (typeof value !== 'string') {
    throw new MerchantOfflineSaleValidationError();
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new MerchantOfflineSaleIdempotencyKeyRequiredError();
  }

  if (!UUID_PATTERN.test(normalized)) {
    throw new MerchantOfflineSaleValidationError();
  }

  return normalized;
}

export function parseCreateMerchantOfflineSale(
  body: unknown,
  idempotencyHeader: unknown,
): CreateMerchantOfflineSaleInput {
  if (!isRecord(body)) {
    throw new MerchantOfflineSaleValidationError();
  }

  assertKnownKeys(body, SALE_KEYS);

  const items = parseItems(body['items']);
  const taxPaise = Object.prototype.hasOwnProperty.call(body, 'taxPaise')
    ? parseSafeNonNegativeInteger(body['taxPaise'])
    : 0;
  const subtotalPaise = items.reduce((sum, item) => sum + item.quantity * item.unitPricePaise, 0);
  const discountPaise = items.reduce((sum, item) => sum + item.discountPaise, 0);
  const totalPaise = subtotalPaise - discountPaise + taxPaise;

  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0) {
    throw new MerchantOfflineSaleValidationError();
  }

  return {
    shopId: parseUuid(body['shopId']),
    customerPhone: parseCustomerPhone(body),
    taxPaise,
    paymentMethod: parsePaymentMethod(body['paymentMethod']),
    items,
    idempotencyKey: parseIdempotencyKey(idempotencyHeader),
  };
}
