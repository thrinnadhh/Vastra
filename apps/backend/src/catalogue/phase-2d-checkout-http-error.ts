import { HttpException, HttpStatus } from '@nestjs/common';

interface CheckoutErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: 'NO_FULFILMENT_BRANCH' | 'POSTAL_PRICING_REQUIRED';
    readonly message: string;
    readonly details: null;
    readonly retryable: false;
  };
  readonly requestId: null;
}

function createCheckoutError(
  code: CheckoutErrorBody['error']['code'],
  message: string,
): HttpException {
  const body: CheckoutErrorBody = {
    success: false,
    error: { code, message, details: null, retryable: false },
    requestId: null,
  };
  return new HttpException(body, HttpStatus.UNPROCESSABLE_ENTITY);
}

export function createNoFulfilmentBranchException(): HttpException {
  return createCheckoutError(
    'NO_FULFILMENT_BRANCH',
    'No single active branch can fulfil every item in this cart for the selected address.',
  );
}

export function createPostalPricingRequiredException(): HttpException {
  return createCheckoutError(
    'POSTAL_PRICING_REQUIRED',
    'Postal delivery is available, but an authoritative courier charge is required before checkout.',
  );
}
