import { HttpException, HttpStatus } from '@nestjs/common';

export type WardrobeErrorCode =
  | 'VALIDATION_ERROR'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WARDROBE_ACCESS_DENIED'
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
  retryable: boolean,
): HttpException {
  const response: WardrobeApiErrorBody = {
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

export function createInvalidWardrobeUploadRequestException(): HttpException {
  return createWardrobeException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The wardrobe upload request is invalid.',
    false,
  );
}

export function createWardrobeUploadIdempotencyKeyRequiredException(): HttpException {
  return createWardrobeException(
    HttpStatus.BAD_REQUEST,
    'IDEMPOTENCY_KEY_REQUIRED',
    'A valid Idempotency-Key header is required.',
    false,
  );
}

export function createWardrobeUploadIdempotencyConflictException(): HttpException {
  return createWardrobeException(
    HttpStatus.CONFLICT,
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key was already used for a different or expired upload intent.',
    false,
  );
}

export function createWardrobeAccessDeniedException(): HttpException {
  return createWardrobeException(
    HttpStatus.FORBIDDEN,
    'WARDROBE_ACCESS_DENIED',
    'The account is not allowed to create a wardrobe upload intent.',
    false,
  );
}

export function createWardrobeStateInvalidException(): HttpException {
  return createWardrobeException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'WARDROBE_STATE_INVALID',
    'Wardrobe upload state is internally inconsistent.',
    false,
  );
}

export function createWardrobeProviderUnavailableException(): HttpException {
  return createWardrobeException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Wardrobe media storage is temporarily unavailable.',
    true,
  );
}
