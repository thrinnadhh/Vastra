import type {
  CreateMerchantProductVariantInput,
  UpdateMerchantProductVariantInput,
} from './merchant-product-variant.types';

const COLOUR_HEX_PATTERN = /^#[0-9A-F]{6}$/u;
const MAXIMUM_DIMENSION_CM = 999_999.99;
const MAXIMUM_ATTRIBUTES_BYTES = 16_384;

const MUTABLE_KEYS = new Set([
  'sku',
  'colourName',
  'colourHex',
  'sizeLabel',
  'mrpPaise',
  'sellingPricePaise',
  'costPricePaise',
  'weightGrams',
  'lengthCm',
  'widthCm',
  'heightCm',
  'attributes',
  'isActive',
]);

export class MerchantProductVariantValidationError extends Error {
  public constructor() {
    super('Merchant product variant request is invalid');
    this.name = 'MerchantProductVariantValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function assertOnlyMutableKeys(record: Record<string, unknown>): void {
  if (Object.keys(record).some((key) => !MUTABLE_KEYS.has(key))) {
    throw new MerchantProductVariantValidationError();
  }
}

function requireTrimmedString(value: unknown, maximumLength: number): string {
  if (typeof value !== 'string') {
    throw new MerchantProductVariantValidationError();
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > maximumLength) {
    throw new MerchantProductVariantValidationError();
  }

  return trimmed;
}

function requireNullableTrimmedString(value: unknown, maximumLength: number): string | null {
  if (value === null) {
    return null;
  }

  return requireTrimmedString(value, maximumLength);
}

function requireColourHex(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  const normalized = requireTrimmedString(value, 7).toUpperCase();

  if (!COLOUR_HEX_PATTERN.test(normalized)) {
    throw new MerchantProductVariantValidationError();
  }

  return normalized;
}

function requireMoneyPaise(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new MerchantProductVariantValidationError();
  }

  return value;
}

function requireNullableMoneyPaise(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  return requireMoneyPaise(value);
}

function requireNullablePositiveInteger(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > 2_147_483_647
  ) {
    throw new MerchantProductVariantValidationError();
  }

  return value;
}

function requireNullablePositiveDecimal(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAXIMUM_DIMENSION_CM
  ) {
    throw new MerchantProductVariantValidationError();
  }

  return value;
}

function requireAttributes(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new MerchantProductVariantValidationError();
  }

  try {
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAXIMUM_ATTRIBUTES_BYTES) {
      throw new MerchantProductVariantValidationError();
    }
  } catch (error: unknown) {
    if (error instanceof MerchantProductVariantValidationError) {
      throw error;
    }

    throw new MerchantProductVariantValidationError();
  }

  return { ...value };
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new MerchantProductVariantValidationError();
  }

  return value;
}

export function assertVariantPricePair(mrpPaise: number, sellingPricePaise: number): void {
  if (sellingPricePaise > mrpPaise) {
    throw new MerchantProductVariantValidationError();
  }
}

export function parseCreateMerchantProductVariantBody(
  value: unknown,
): CreateMerchantProductVariantInput {
  if (!isRecord(value)) {
    throw new MerchantProductVariantValidationError();
  }

  assertOnlyMutableKeys(value);

  if (!hasOwn(value, 'sku') || !hasOwn(value, 'mrpPaise') || !hasOwn(value, 'sellingPricePaise')) {
    throw new MerchantProductVariantValidationError();
  }

  const mrpPaise = requireMoneyPaise(value['mrpPaise']);
  const sellingPricePaise = requireMoneyPaise(value['sellingPricePaise']);
  assertVariantPricePair(mrpPaise, sellingPricePaise);

  return {
    sku: requireTrimmedString(value['sku'], 120),
    colourName: hasOwn(value, 'colourName')
      ? requireNullableTrimmedString(value['colourName'], 120)
      : null,
    colourHex: hasOwn(value, 'colourHex') ? requireColourHex(value['colourHex']) : null,
    sizeLabel: hasOwn(value, 'sizeLabel')
      ? requireNullableTrimmedString(value['sizeLabel'], 80)
      : null,
    mrpPaise,
    sellingPricePaise,
    costPricePaise: hasOwn(value, 'costPricePaise')
      ? requireNullableMoneyPaise(value['costPricePaise'])
      : null,
    weightGrams: hasOwn(value, 'weightGrams')
      ? requireNullablePositiveInteger(value['weightGrams'])
      : null,
    lengthCm: hasOwn(value, 'lengthCm') ? requireNullablePositiveDecimal(value['lengthCm']) : null,
    widthCm: hasOwn(value, 'widthCm') ? requireNullablePositiveDecimal(value['widthCm']) : null,
    heightCm: hasOwn(value, 'heightCm') ? requireNullablePositiveDecimal(value['heightCm']) : null,
    attributes: hasOwn(value, 'attributes') ? requireAttributes(value['attributes']) : {},
    isActive: hasOwn(value, 'isActive') ? requireBoolean(value['isActive']) : true,
  };
}

interface MutableVariantUpdate {
  sku?: string;
  colourName?: string | null;
  colourHex?: string | null;
  sizeLabel?: string | null;
  mrpPaise?: number;
  sellingPricePaise?: number;
  costPricePaise?: number | null;
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  attributes?: Readonly<Record<string, unknown>>;
  isActive?: boolean;
}

export function parseUpdateMerchantProductVariantBody(
  value: unknown,
): UpdateMerchantProductVariantInput {
  if (!isRecord(value)) {
    throw new MerchantProductVariantValidationError();
  }

  assertOnlyMutableKeys(value);

  if (Object.keys(value).length === 0) {
    throw new MerchantProductVariantValidationError();
  }

  const input: MutableVariantUpdate = {};

  if (hasOwn(value, 'sku')) {
    input.sku = requireTrimmedString(value['sku'], 120);
  }

  if (hasOwn(value, 'colourName')) {
    input.colourName = requireNullableTrimmedString(value['colourName'], 120);
  }

  if (hasOwn(value, 'colourHex')) {
    input.colourHex = requireColourHex(value['colourHex']);
  }

  if (hasOwn(value, 'sizeLabel')) {
    input.sizeLabel = requireNullableTrimmedString(value['sizeLabel'], 80);
  }

  if (hasOwn(value, 'mrpPaise')) {
    input.mrpPaise = requireMoneyPaise(value['mrpPaise']);
  }

  if (hasOwn(value, 'sellingPricePaise')) {
    input.sellingPricePaise = requireMoneyPaise(value['sellingPricePaise']);
  }

  if (hasOwn(value, 'costPricePaise')) {
    input.costPricePaise = requireNullableMoneyPaise(value['costPricePaise']);
  }

  if (hasOwn(value, 'weightGrams')) {
    input.weightGrams = requireNullablePositiveInteger(value['weightGrams']);
  }

  if (hasOwn(value, 'lengthCm')) {
    input.lengthCm = requireNullablePositiveDecimal(value['lengthCm']);
  }

  if (hasOwn(value, 'widthCm')) {
    input.widthCm = requireNullablePositiveDecimal(value['widthCm']);
  }

  if (hasOwn(value, 'heightCm')) {
    input.heightCm = requireNullablePositiveDecimal(value['heightCm']);
  }

  if (hasOwn(value, 'attributes')) {
    input.attributes = requireAttributes(value['attributes']);
  }

  if (hasOwn(value, 'isActive')) {
    input.isActive = requireBoolean(value['isActive']);
  }

  return input;
}
