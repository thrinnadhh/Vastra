import { HttpException, HttpStatus } from '@nestjs/common';

export type AuthorizationErrorCode =
  'ACCOUNT_TYPE_FORBIDDEN' | 'PERMISSION_DENIED' | 'EXTERNAL_SERVICE_UNAVAILABLE';

interface AuthorizationErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: AuthorizationErrorCode;
    readonly message: string;
    readonly details: null;
    readonly retryable: boolean;
  };
  readonly requestId: null;
}

function createAuthorizationException(
  status: HttpStatus,
  code: AuthorizationErrorCode,
  message: string,
  retryable = false,
): HttpException {
  const response: AuthorizationErrorBody = {
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

export function createAccountTypeForbiddenException(): HttpException {
  return createAuthorizationException(
    HttpStatus.FORBIDDEN,
    'ACCOUNT_TYPE_FORBIDDEN',
    'This account type is not permitted to perform the requested action.',
  );
}

export function createPermissionDeniedException(): HttpException {
  return createAuthorizationException(
    HttpStatus.FORBIDDEN,
    'PERMISSION_DENIED',
    'The authenticated account does not have the required permission.',
  );
}

export function createAuthorizationProviderUnavailableException(): HttpException {
  return createAuthorizationException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Authorization is temporarily unavailable.',
    true,
  );
}
