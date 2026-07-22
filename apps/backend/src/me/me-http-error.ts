import { HttpException, HttpStatus } from '@nestjs/common';

export type MeErrorCode =
  | 'VALIDATION_ERROR'
  | 'PROFILE_STATE_INVALID'
  | 'EXTERNAL_SERVICE_UNAVAILABLE';

interface MeApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: MeErrorCode;
    readonly message: string;
    readonly details: null;
    readonly retryable: boolean;
  };
  readonly requestId: null;
}

function createMeException(
  status: HttpStatus,
  code: MeErrorCode,
  message: string,
  retryable: boolean,
): HttpException {
  const response: MeApiErrorBody = {
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

export function createCustomerProfileValidationException(): HttpException {
  return createMeException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'Customer profile input is invalid.',
    false,
  );
}

export function createProfileStateInvalidException(): HttpException {
  return createMeException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'PROFILE_STATE_INVALID',
    'The account profile is not in a valid state.',
    false,
  );
}

export function createMeProviderUnavailableException(): HttpException {
  return createMeException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Account information is temporarily unavailable.',
    true,
  );
}
