import { HttpException, HttpStatus } from '@nestjs/common';

function create(
  status: HttpStatus,
  code: string,
  message: string,
  retryable = false,
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

export const createDeliveryRequestInvalidException = (): HttpException =>
  create(HttpStatus.BAD_REQUEST, 'DELIVERY_REQUEST_INVALID', 'The delivery request is invalid.');
export const createDeliveryIdempotencyRequiredException = (): HttpException =>
  create(
    HttpStatus.BAD_REQUEST,
    'IDEMPOTENCY_KEY_REQUIRED',
    'A valid Idempotency-Key is required.',
  );
export const createDeliveryAccessDeniedException = (): HttpException =>
  create(HttpStatus.FORBIDDEN, 'DELIVERY_ACCESS_DENIED', 'Delivery access is denied.');
export const createCaptainNotEligibleException = (): HttpException =>
  create(
    HttpStatus.FORBIDDEN,
    'CAPTAIN_NOT_ELIGIBLE',
    'The captain is not operationally eligible.',
  );
export const createDeliveryTaskNotFoundException = (): HttpException =>
  create(HttpStatus.NOT_FOUND, 'DELIVERY_TASK_NOT_FOUND', 'The delivery task was not found.');
export const createDeliveryOfferNotFoundException = (): HttpException =>
  create(HttpStatus.NOT_FOUND, 'DELIVERY_OFFER_NOT_FOUND', 'The delivery offer was not found.');
export const createDeliveryStateConflictException = (): HttpException =>
  create(
    HttpStatus.CONFLICT,
    'DELIVERY_STATE_CONFLICT',
    'The current delivery state rejects this action.',
  );
export const createDeliveryAlreadyAssignedException = (): HttpException =>
  create(
    HttpStatus.CONFLICT,
    'DELIVERY_TASK_ALREADY_ASSIGNED',
    'Another captain already owns the delivery.',
  );
export const createCaptainAlreadyAssignedException = (): HttpException =>
  create(
    HttpStatus.CONFLICT,
    'CAPTAIN_ALREADY_ASSIGNED',
    'The captain already owns another active delivery.',
  );
export const createDeliveryIdempotencyConflictException = (): HttpException =>
  create(
    HttpStatus.CONFLICT,
    'IDEMPOTENCY_KEY_REUSED',
    'The idempotency key was reused with another request.',
  );
export const createDeliveryOfferExpiredException = (): HttpException =>
  create(HttpStatus.GONE, 'DELIVERY_OFFER_EXPIRED', 'The delivery offer has expired.');
export const createCaptainNotAtPickupException = (): HttpException =>
  create(
    HttpStatus.CONFLICT,
    'CAPTAIN_NOT_AT_PICKUP',
    'The captain is not close enough to the pickup location.',
  );
export const createPickupCodeInvalidException = (): HttpException =>
  create(HttpStatus.UNPROCESSABLE_ENTITY, 'PICKUP_CODE_INVALID', 'The pickup code is invalid.');
export const createDeliveryOtpInvalidException = (): HttpException =>
  create(HttpStatus.UNPROCESSABLE_ENTITY, 'DELIVERY_OTP_INVALID', 'The delivery OTP is invalid.');
export const createDeliverySecretLockedException = (): HttpException =>
  create(
    HttpStatus.LOCKED,
    'DELIVERY_SECRET_LOCKED',
    'Verification is locked and requires operations review.',
  );
export const createCodAmountMismatchException = (): HttpException =>
  create(
    HttpStatus.CONFLICT,
    'COD_AMOUNT_MISMATCH',
    'The collected amount does not match the order total.',
  );
export const createDeliveryUnavailableException = (): HttpException =>
  create(
    HttpStatus.SERVICE_UNAVAILABLE,
    'DELIVERY_SERVICE_UNAVAILABLE',
    'Delivery services are temporarily unavailable.',
    true,
  );
