import {
  PRODUCT_IMAGE_CONTENT_TYPES,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_TYPES,
  type CreateProductImageUploadIntentInput,
  type FinalizeMerchantProductImageInput,
  type ProductImageContentType,
  type ProductImageType,
  type UpdateMerchantProductImageInput,
} from './product-image.types';

const MAX_ALT_TEXT_LENGTH = 500;
const MAX_OBJECT_KEY_LENGTH = 500;
const MAX_DISPLAY_ORDER = 10_000;
const MAX_DIMENSION_PX = 20_000;

export class ProductImageValidationError extends Error {
  public constructor() {
    super('Product image request is invalid');
    this.name = 'ProductImageValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertAllowedKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): void {
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new ProductImageValidationError();
  }
}

function isContentType(value: unknown): value is ProductImageContentType {
  return (
    typeof value === 'string' &&
    PRODUCT_IMAGE_CONTENT_TYPES.some((candidate) => candidate === value)
  );
}

function isImageType(value: unknown): value is ProductImageType {
  return typeof value === 'string' && PRODUCT_IMAGE_TYPES.some((candidate) => candidate === value);
}

function requireSafeIntegerInRange(value: unknown, minimum: number, maximum: number): number {
  if (
    !Number.isSafeInteger(value) ||
    typeof value !== 'number' ||
    value < minimum ||
    value > maximum
  ) {
    throw new ProductImageValidationError();
  }

  return value;
}

function requireNullableTrimmedString(value: unknown, maximumLength: number): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ProductImageValidationError();
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new ProductImageValidationError();
  }

  return normalized;
}

function requireNullableDimension(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  return requireSafeIntegerInRange(value, 1, MAX_DIMENSION_PX);
}

function assertDimensionPair(widthPx: number | null, heightPx: number | null): void {
  if ((widthPx === null) !== (heightPx === null)) {
    throw new ProductImageValidationError();
  }
}

export function parseProductImageUploadIntentBody(
  value: unknown,
): CreateProductImageUploadIntentInput {
  if (!isRecord(value)) {
    throw new ProductImageValidationError();
  }

  assertAllowedKeys(value, ['contentType', 'contentLength']);

  const contentType = value['contentType'];

  if (!isContentType(contentType)) {
    throw new ProductImageValidationError();
  }

  return {
    contentType,
    contentLength: requireSafeIntegerInRange(value['contentLength'], 1, PRODUCT_IMAGE_MAX_BYTES),
  };
}

export function parseFinalizeProductImageBody(value: unknown): FinalizeMerchantProductImageInput {
  if (!isRecord(value)) {
    throw new ProductImageValidationError();
  }

  assertAllowedKeys(value, [
    'storageObjectKey',
    'imageType',
    'altText',
    'displayOrder',
    'isPrimary',
    'widthPx',
    'heightPx',
  ]);

  const storageObjectKey = value['storageObjectKey'];

  if (
    typeof storageObjectKey !== 'string' ||
    storageObjectKey.trim().length === 0 ||
    storageObjectKey.length > MAX_OBJECT_KEY_LENGTH
  ) {
    throw new ProductImageValidationError();
  }

  const imageTypeValue = value['imageType'] ?? 'FRONT';

  if (!isImageType(imageTypeValue)) {
    throw new ProductImageValidationError();
  }

  const isPrimaryValue = value['isPrimary'] ?? false;

  if (typeof isPrimaryValue !== 'boolean') {
    throw new ProductImageValidationError();
  }

  const widthPx = requireNullableDimension(value['widthPx'] ?? null);
  const heightPx = requireNullableDimension(value['heightPx'] ?? null);
  assertDimensionPair(widthPx, heightPx);

  return {
    storageObjectKey: storageObjectKey.trim(),
    imageType: imageTypeValue,
    altText: requireNullableTrimmedString(value['altText'] ?? null, MAX_ALT_TEXT_LENGTH),
    displayOrder: requireSafeIntegerInRange(value['displayOrder'] ?? 0, 0, MAX_DISPLAY_ORDER),
    isPrimary: isPrimaryValue,
    widthPx,
    heightPx,
  };
}

export function parseUpdateProductImageBody(value: unknown): UpdateMerchantProductImageInput {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new ProductImageValidationError();
  }

  assertAllowedKeys(value, [
    'imageType',
    'altText',
    'displayOrder',
    'isPrimary',
    'widthPx',
    'heightPx',
  ]);

  const result: {
    imageType?: ProductImageType;
    altText?: string | null;
    displayOrder?: number;
    isPrimary?: true;
    widthPx?: number | null;
    heightPx?: number | null;
  } = {};

  if ('imageType' in value) {
    if (!isImageType(value['imageType'])) {
      throw new ProductImageValidationError();
    }

    result.imageType = value['imageType'];
  }

  if ('altText' in value) {
    result.altText = requireNullableTrimmedString(value['altText'], MAX_ALT_TEXT_LENGTH);
  }

  if ('displayOrder' in value) {
    result.displayOrder = requireSafeIntegerInRange(value['displayOrder'], 0, MAX_DISPLAY_ORDER);
  }

  if ('isPrimary' in value) {
    if (value['isPrimary'] !== true) {
      throw new ProductImageValidationError();
    }

    result.isPrimary = true;
  }

  if ('widthPx' in value) {
    result.widthPx = requireNullableDimension(value['widthPx']);
  }

  if ('heightPx' in value) {
    result.heightPx = requireNullableDimension(value['heightPx']);
  }

  return result;
}

export function extensionForProductImageContentType(
  contentType: ProductImageContentType,
): 'jpg' | 'png' | 'webp' {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}
