import { HttpException, HttpStatus } from '@nestjs/common';

export type AuthenticationErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_TOKEN_EXPIRED'
  | 'ACCOUNT_BLOCKED'
  | 'ACCOUNT_PENDING'
  | 'EXTERNAL_SERVICE_UNAVAILABLE';

interface ApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: AuthenticationErrorCode;
    readonly message: string;
    readonly details: null;
    readonly retryable: boolean;
  };
  readonly requestId: null;
}

function createAuthenticationException(
  status: HttpStatus,
  code: AuthenticationErrorCode,
  message: string,
  retryable = false,
): HttpException {
  const response: ApiErrorBody = {
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

export function createAuthRequiredException(): HttpException {
  return createAuthenticationException(
    HttpStatus.UNAUTHORIZED,
    'AUTH_REQUIRED',
    'A valid access token is required.',
  );
}

export function createExpiredTokenException(): HttpException {
  return createAuthenticationException(
    HttpStatus.UNAUTHORIZED,
    'AUTH_TOKEN_EXPIRED',
    'The access token has expired.',
  );
}

export function createAccountPendingException(): HttpException {
  return createAuthenticationException(
    HttpStatus.FORBIDDEN,
    'ACCOUNT_PENDING',
    'The account is not yet ready for access.',
  );
}

export function createAccountBlockedException(): HttpException {
  return createAuthenticationException(
    HttpStatus.FORBIDDEN,
    'ACCOUNT_BLOCKED',
    'The account is not permitted to access Vastra.',
  );
}

export function createAuthenticationProviderUnavailableException(): HttpException {
  return createAuthenticationException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Authentication is temporarily unavailable.',
    true,
  );
}
