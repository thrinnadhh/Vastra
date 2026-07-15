import {
  type CreateWardrobeUploadIntentInput,
  WARDROBE_IMAGE_CONTENT_TYPES,
  WARDROBE_IMAGE_MAX_BYTES,
  type WardrobeImageContentType,
} from './wardrobe-upload.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_KEYS = new Set(['contentType', 'contentLength']);

export class WardrobeUploadValidationError extends Error {
  public constructor() {
    super('Wardrobe upload request is invalid');
    this.name = 'WardrobeUploadValidationError';
  }
}

export class WardrobeUploadIdempotencyKeyRequiredError extends Error {
  public constructor() {
    super('Wardrobe upload idempotency key is required');
    this.name = 'WardrobeUploadIdempotencyKeyRequiredError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string') {
    throw new WardrobeUploadValidationError();
  }

  const normalized = value.trim().toLowerCase();

  if (!UUID_PATTERN.test(normalized)) {
    throw new WardrobeUploadValidationError();
  }

  return normalized;
}

function parseIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new WardrobeUploadIdempotencyKeyRequiredError();
  }

  return parseUuid(value);
}

function isContentType(value: unknown): value is WardrobeImageContentType {
  return (
    typeof value === 'string' &&
    WARDROBE_IMAGE_CONTENT_TYPES.some((candidate) => candidate === value)
  );
}

export function parseWardrobeUploadIntentInput(
  body: unknown,
  idempotencyKeyValue: unknown,
): CreateWardrobeUploadIntentInput {
  if (!isRecord(body) || Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new WardrobeUploadValidationError();
  }

  const contentType = body['contentType'];
  const contentLength = body['contentLength'];

  if (
    !isContentType(contentType) ||
    typeof contentLength !== 'number' ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > WARDROBE_IMAGE_MAX_BYTES
  ) {
    throw new WardrobeUploadValidationError();
  }

  return {
    contentType,
    contentLength,
    idempotencyKey: parseIdempotencyKey(idempotencyKeyValue),
  };
}

export function extensionForWardrobeContentType(
  contentType: WardrobeImageContentType,
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
