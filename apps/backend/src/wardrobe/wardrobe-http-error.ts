import { HttpException, HttpStatus } from '@nestjs/common';

export type WardrobeErrorCode =
  | 'VALIDATION_ERROR'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WARDROBE_ACCESS_DENIED'
  | 'WARDROBE_ITEM_NOT_FOUND'
  | 'WARDROBE_MEDIA_INVALID'
  | 'WARDROBE_MEDIA_UNAVAILABLE'
  | 'WARDROBE_ITEM_IN_USE'
  | 'LOOK_NOT_FOUND'
  | 'LOOK_ITEM_INVALID'
  | 'LOOK_SOURCE_UNAVAILABLE'
  | 'MULTI_SHOP_CART_NOT_ALLOWED'
  | 'INSUFFICIENT_STOCK'
  | 'WARDROBE_STATE_INVALID'
  | 'EXTERNAL_SERVICE_UNAVAILABLE';

interface WardrobeApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: WardrobeErrorCode;
    readonly message: string;
    readonly details: null;
    readonly retryable: boolean;
  };
  readonly requestId: null;
}

function createWardrobeException(
  status: HttpStatus,
  code: WardrobeErrorCode,
  message: string,
  retryable = false,
): HttpException {
  const response: WardrobeApiErrorBody = {
    success: false,
    error: { code, message, details: null, retryable },
    requestId: null,
  };

  return new HttpException(response, status);
}

export function createInvalidWardrobeUploadRequestException(): HttpException {
  return createWardrobeException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The wardrobe upload request is invalid.',
  );
}

export function createWardrobeUploadIdempotencyKeyRequiredException(): HttpException {
  return createWardrobeIdempotencyKeyRequiredException();
}

export function createWardrobeUploadIdempotencyConflictException(): HttpException {
  return createWardrobeIdempotencyConflictException();
}

export function createWardrobeAccessDeniedException(): HttpException {
  return createWardrobeException(
    HttpStatus.FORBIDDEN,
    'WARDROBE_ACCESS_DENIED',
    'The account is not allowed to perform this wardrobe operation.',
  );
}

export function createWardrobeValidationException(): HttpException {
  return createWardrobeException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The wardrobe request is invalid.',
  );
}

export function createWardrobeIdempotencyKeyRequiredException(): HttpException {
  return createWardrobeException(
    HttpStatus.BAD_REQUEST,
    'IDEMPOTENCY_KEY_REQUIRED',
    'A valid Idempotency-Key header is required.',
  );
}

export function createWardrobeIdempotencyConflictException(): HttpException {
  return createWardrobeException(
    HttpStatus.CONFLICT,
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key was already used for a different request.',
  );
}

export function createWardrobeItemNotFoundException(): HttpException {
  return createWardrobeException(
    HttpStatus.NOT_FOUND,
    'WARDROBE_ITEM_NOT_FOUND',
    'The wardrobe item was not found.',
  );
}

export function createWardrobeMediaInvalidException(): HttpException {
  return createWardrobeException(
    HttpStatus.BAD_REQUEST,
    'WARDROBE_MEDIA_INVALID',
    'The uploaded wardrobe media is missing or invalid.',
  );
}

export function createWardrobeMediaUnavailableException(): HttpException {
  return createWardrobeException(
    HttpStatus.CONFLICT,
    'WARDROBE_MEDIA_UNAVAILABLE',
    'The private wardrobe media is unavailable.',
  );
}

export function createWardrobeItemInUseException(): HttpException {
  return createWardrobeException(
    HttpStatus.CONFLICT,
    'WARDROBE_ITEM_IN_USE',
    'The wardrobe item is being changed by another operation.',
  );
}

export function createLookNotFoundException(): HttpException {
  return createWardrobeException(
    HttpStatus.NOT_FOUND,
    'LOOK_NOT_FOUND',
    'The saved look was not found.',
  );
}

export function createLookItemInvalidException(): HttpException {
  return createWardrobeException(
    HttpStatus.BAD_REQUEST,
    'LOOK_ITEM_INVALID',
    'The saved look composition is invalid.',
  );
}

export function createLookSourceUnavailableException(): HttpException {
  return createWardrobeException(
    HttpStatus.CONFLICT,
    'LOOK_SOURCE_UNAVAILABLE',
    'A saved look source is unavailable.',
  );
}

export function createLookCartShopConflictException(): HttpException {
  return createWardrobeException(
    HttpStatus.CONFLICT,
    'MULTI_SHOP_CART_NOT_ALLOWED',
    'The selected products or active cart belong to another shop.',
  );
}

export function createLookCartInsufficientStockException(): HttpException {
  return createWardrobeException(
    HttpStatus.CONFLICT,
    'INSUFFICIENT_STOCK',
    'One or more selected variants do not have enough stock.',
  );
}

export function createWardrobeStateInvalidException(): HttpException {
  return createWardrobeException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'WARDROBE_STATE_INVALID',
    'Wardrobe state is internally inconsistent.',
  );
}

export function createWardrobeProviderUnavailableException(): HttpException {
  return createWardrobeException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Wardrobe storage or data is temporarily unavailable.',
    true,
  );
}
