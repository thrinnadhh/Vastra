import { HttpException, HttpStatus } from '@nestjs/common';

type AdminReadErrorCode = 'VALIDATION_ERROR' | 'EXTERNAL_SERVICE_UNAVAILABLE';

function createAdminReadException(
  status: HttpStatus,
  code: AdminReadErrorCode,
  message: string,
  retryable: boolean,
): HttpException {
  return new HttpException(
    {
      success: false,
      error: { code, message, details: null, retryable },
      requestId: null,
    },
    status,
  );
}

export function createInvalidAdminListQueryException(): HttpException {
  return createAdminReadException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The admin list filters, cursor, or limit are invalid.',
    false,
  );
}

export function createAdminReadProviderUnavailableException(): HttpException {
  return createAdminReadException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'The admin operational read model is temporarily unavailable.',
    true,
  );
}
