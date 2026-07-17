import { HttpException, HttpStatus } from '@nestjs/common';

export type CaptainPresenceErrorCode =
  | 'DELIVERY_REQUEST_INVALID'
  | 'CAPTAIN_NOT_ELIGIBLE'
  | 'DELIVERY_STATE_CONFLICT'
  | 'CAPTAIN_LOCATION_STALE'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'LOCATION_UPDATE_RATE_LIMITED'
  | 'DELIVERY_SERVICE_UNAVAILABLE';

interface CaptainPresenceApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: CaptainPresenceErrorCode;
    readonly message: string;
    readonly details: null;
    readonly retryable: boolean;
  };
  readonly requestId: null;
}

function createCaptainPresenceException(
  status: HttpStatus,
  code: CaptainPresenceErrorCode,
  message: string,
  retryable: boolean,
): HttpException {
  const response: CaptainPresenceApiErrorBody = {
    success: false,
    error: { code, message, details: null, retryable },
    requestId: null,
  };

  return new HttpException(response, status);
}

export function createCaptainPresenceInvalidException(): HttpException {
  return createCaptainPresenceException(
    HttpStatus.BAD_REQUEST,
    'DELIVERY_REQUEST_INVALID',
    'The captain availability or location request is invalid.',
    false,
  );
}

export function createCaptainNotEligibleException(): HttpException {
  return createCaptainPresenceException(
    HttpStatus.FORBIDDEN,
    'CAPTAIN_NOT_ELIGIBLE',
    'The captain is not operationally eligible for this action.',
    false,
  );
}

export function createCaptainPresenceStateConflictException(): HttpException {
  return createCaptainPresenceException(
    HttpStatus.CONFLICT,
    'DELIVERY_STATE_CONFLICT',
    'The current delivery state controls captain availability or location.',
    false,
  );
}

export function createCaptainLocationStaleException(): HttpException {
  return createCaptainPresenceException(
    HttpStatus.CONFLICT,
    'CAPTAIN_LOCATION_STALE',
    'The captain location is stale, missing, or not accurate enough for dispatch.',
    false,
  );
}

export function createCaptainLocationSampleConflictException(): HttpException {
  return createCaptainPresenceException(
    HttpStatus.CONFLICT,
    'IDEMPOTENCY_KEY_REUSED',
    'The location sample identifier was already used with another payload.',
    false,
  );
}

export function createCaptainLocationRateLimitedException(): HttpException {
  return createCaptainPresenceException(
    HttpStatus.TOO_MANY_REQUESTS,
    'LOCATION_UPDATE_RATE_LIMITED',
    'Captain location updates are arriving too frequently.',
    true,
  );
}

export function createCaptainPresenceUnavailableException(): HttpException {
  return createCaptainPresenceException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'DELIVERY_SERVICE_UNAVAILABLE',
    'Captain availability and location are temporarily unavailable.',
    true,
  );
}
