import { HttpException, HttpStatus } from '@nestjs/common';

export type CatalogueErrorCode =
  | 'VALIDATION_ERROR'
  | 'SHOP_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_SLUG_CONFLICT'
  | 'VARIANT_NOT_FOUND'
  | 'VARIANT_SKU_CONFLICT'
  | 'PRODUCT_IMAGE_NOT_FOUND'
  | 'PRODUCT_IMAGE_UPLOAD_INVALID'
  | 'PRODUCT_IMAGE_CONFLICT'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVENTORY_CONFLICT'
  | 'NEGATIVE_INVENTORY_REJECTED'
  | 'CATALOGUE_STATE_INVALID'
  | 'EXTERNAL_SERVICE_UNAVAILABLE';

interface CatalogueApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: CatalogueErrorCode;
    readonly message: string;
    readonly details: null;
    readonly retryable: boolean;
  };
  readonly requestId: null;
}

function createCatalogueException(
  status: HttpStatus,
  code: CatalogueErrorCode,
  message: string,
  retryable: boolean,
): HttpException {
  const response: CatalogueApiErrorBody = {
    success: false,
    error: {
      code,
      message,
      details: null,
      retryable,
    },
    requestId: null,
  };

  return new HttpException(response, status);
}

export function createInvalidShopIdException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The shop identifier is invalid.',
    false,
  );
}

export function createShopNotFoundException(): HttpException {
  return createCatalogueException(
    HttpStatus.NOT_FOUND,
    'SHOP_NOT_FOUND',
    'The shop does not exist or is not visible to this merchant.',
    false,
  );
}

export function createInvalidCategoryIdException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The category identifier is invalid.',
    false,
  );
}

export function createCategoryNotFoundException(): HttpException {
  return createCatalogueException(
    HttpStatus.NOT_FOUND,
    'CATEGORY_NOT_FOUND',
    'The category does not exist or is not active.',
    false,
  );
}

export function createInvalidProductIdException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The product identifier is invalid.',
    false,
  );
}

export function createInvalidProductInputException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The product request is invalid.',
    false,
  );
}

export function createProductNotFoundException(): HttpException {
  return createCatalogueException(
    HttpStatus.NOT_FOUND,
    'PRODUCT_NOT_FOUND',
    'The product does not exist or is not visible to this merchant.',
    false,
  );
}

export function createProductSlugConflictException(): HttpException {
  return createCatalogueException(
    HttpStatus.CONFLICT,
    'PRODUCT_SLUG_CONFLICT',
    'The product slug is already used by this shop.',
    false,
  );
}

export function createInvalidProductVariantIdException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The product variant identifier is invalid.',
    false,
  );
}

export function createInvalidProductVariantInputException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The product variant request is invalid.',
    false,
  );
}

export function createProductVariantNotFoundException(): HttpException {
  return createCatalogueException(
    HttpStatus.NOT_FOUND,
    'VARIANT_NOT_FOUND',
    'The product variant does not exist or is not visible to this merchant.',
    false,
  );
}

export function createProductVariantSkuConflictException(): HttpException {
  return createCatalogueException(
    HttpStatus.CONFLICT,
    'VARIANT_SKU_CONFLICT',
    'The SKU is already used by another variant in this shop.',
    false,
  );
}

export function createInvalidInventoryLookupException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The inventory lookup query or limit is invalid.',
    false,
  );
}

export function createInvalidInventoryAdjustmentException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The inventory adjustment request is invalid.',
    false,
  );
}

export function createInvalidInventoryMovementQueryException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The inventory movement query is invalid.',
    false,
  );
}

export function createIdempotencyKeyRequiredException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'IDEMPOTENCY_KEY_REQUIRED',
    'An Idempotency-Key header is required for this inventory adjustment.',
    false,
  );
}

export function createIdempotencyConflictException(): HttpException {
  return createCatalogueException(
    HttpStatus.CONFLICT,
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key was already used with a different request.',
    false,
  );
}

export function createInventoryConflictException(): HttpException {
  return createCatalogueException(
    HttpStatus.CONFLICT,
    'INVENTORY_CONFLICT',
    'Inventory changed after it was loaded. Refresh and retry.',
    false,
  );
}

export function createNegativeInventoryRejectedException(): HttpException {
  return createCatalogueException(
    HttpStatus.CONFLICT,
    'NEGATIVE_INVENTORY_REJECTED',
    'The adjustment would make available inventory invalid.',
    false,
  );
}

export function createInvalidProductImageInputException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The product image request is invalid.',
    false,
  );
}

export function createProductImageUploadInvalidException(): HttpException {
  return createCatalogueException(
    HttpStatus.BAD_REQUEST,
    'PRODUCT_IMAGE_UPLOAD_INVALID',
    'The uploaded product image is missing or invalid.',
    false,
  );
}

export function createProductImageNotFoundException(): HttpException {
  return createCatalogueException(
    HttpStatus.NOT_FOUND,
    'PRODUCT_IMAGE_NOT_FOUND',
    'The product image does not exist or is not visible to this merchant.',
    false,
  );
}

export function createProductImageConflictException(): HttpException {
  return createCatalogueException(
    HttpStatus.CONFLICT,
    'PRODUCT_IMAGE_CONFLICT',
    'The product image conflicts with existing media.',
    false,
  );
}

export function createCatalogueStateInvalidException(): HttpException {
  return createCatalogueException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'CATALOGUE_STATE_INVALID',
    'Catalogue data is not in a valid state.',
    false,
  );
}

export function createCatalogueProviderUnavailableException(): HttpException {
  return createCatalogueException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Catalogue information is temporarily unavailable.',
    true,
  );
}
