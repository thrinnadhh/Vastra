import { HttpException, HttpStatus } from '@nestjs/common';

export type CatalogueErrorCode =
  | 'VALIDATION_ERROR'
  | 'SHOP_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
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
