import { HttpException, HttpStatus } from '@nestjs/common';

type Phase2dOrderErrorCode =
  | 'CHECKOUT_QUOTE_VERSION_UNSUPPORTED'
  | 'NO_FULFILMENT_BRANCH'
  | 'POSTAL_PRICING_REQUIRED'
  | 'BRANCH_OR_CITY_UNAVAILABLE'
  | 'COD_NOT_ELIGIBLE';

function createPhase2dOrderError(
  status: HttpStatus,
  code: Phase2dOrderErrorCode,
  message: string,
): HttpException {
  return new HttpException(
    {
      success: false,
      error: { code, message, details: null, retryable: false },
      requestId: null,
    },
    status,
  );
}

export function createQuoteVersionUnsupportedException(): HttpException {
  return createPhase2dOrderError(
    HttpStatus.CONFLICT,
    'CHECKOUT_QUOTE_VERSION_UNSUPPORTED',
    'This checkout quote uses an unsupported contract version. Request a fresh quote.',
  );
}

export function createNoFulfilmentBranchOrderException(): HttpException {
  return createPhase2dOrderError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'NO_FULFILMENT_BRANCH',
    'No single active branch can fulfil every item in this cart.',
  );
}

export function createPostalPricingRequiredOrderException(): HttpException {
  return createPhase2dOrderError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'POSTAL_PRICING_REQUIRED',
    'Postal delivery requires an authoritative courier charge before order placement.',
  );
}

export function createBranchUnavailableOrderException(): HttpException {
  return createPhase2dOrderError(
    HttpStatus.CONFLICT,
    'BRANCH_OR_CITY_UNAVAILABLE',
    'The selected branch, city, or service zone is no longer active.',
  );
}

export function createCodNotEligibleOrderException(): HttpException {
  return createPhase2dOrderError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'COD_NOT_ELIGIBLE',
    'Cash on delivery is not available for the final quoted order total.',
  );
}
