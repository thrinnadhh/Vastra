import { HttpException, HttpStatus } from '@nestjs/common';

type OrderErrorCode =
  | 'VALIDATION_ERROR'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CART_NOT_FOUND'
  | 'CHECKOUT_QUOTE_NOT_FOUND'
  | 'CHECKOUT_QUOTE_EXPIRED'
  | 'INVENTORY_CONFLICT'
  | 'SHOP_NOT_ACCEPTING_ORDERS'
  | 'ADDRESS_NOT_SERVICEABLE'
  | 'INSUFFICIENT_STOCK'
  | 'ORDER_NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_SERVICE_UNAVAILABLE';

interface OrderApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: OrderErrorCode;
    readonly message: string;
    readonly details: null;
    readonly retryable: boolean;
  };
  readonly requestId: null;
}

function createOrderException(
  status: HttpStatus,
  code: OrderErrorCode,
  message: string,
  retryable: boolean,
): HttpException {
  const response: OrderApiErrorBody = {
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

export function createInvalidCustomerOrderRequestException(): HttpException {
  return createOrderException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The COD order request is invalid.',
    false,
  );
}

export function createCustomerOrderIdempotencyKeyRequiredException(): HttpException {
  return createOrderException(
    HttpStatus.BAD_REQUEST,
    'IDEMPOTENCY_KEY_REQUIRED',
    'An Idempotency-Key header is required to place an order.',
    false,
  );
}

export function createCustomerOrderIdempotencyConflictException(): HttpException {
  return createOrderException(
    HttpStatus.CONFLICT,
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key was already used with a different order request.',
    false,
  );
}

export function createCustomerOrderCartNotFoundException(): HttpException {
  return createOrderException(
    HttpStatus.NOT_FOUND,
    'CART_NOT_FOUND',
    'The active cart does not exist or is no longer orderable.',
    false,
  );
}

export function createCustomerOrderQuoteNotFoundException(): HttpException {
  return createOrderException(
    HttpStatus.NOT_FOUND,
    'CHECKOUT_QUOTE_NOT_FOUND',
    'The checkout quote does not exist or is not visible to this customer.',
    false,
  );
}

export function createCustomerOrderQuoteExpiredException(): HttpException {
  return createOrderException(
    HttpStatus.CONFLICT,
    'CHECKOUT_QUOTE_EXPIRED',
    'The checkout quote has expired. Request a new quote before placing the order.',
    false,
  );
}

export function createCustomerOrderQuoteStaleException(): HttpException {
  return createOrderException(
    HttpStatus.CONFLICT,
    'INVENTORY_CONFLICT',
    'Price, stock, address, or shop state changed after the quote. Refresh and retry.',
    false,
  );
}

export function createCustomerOrderShopUnavailableException(): HttpException {
  return createOrderException(
    HttpStatus.CONFLICT,
    'SHOP_NOT_ACCEPTING_ORDERS',
    'The shop is not currently accepting orders.',
    false,
  );
}

export function createCustomerOrderAddressNotServiceableException(): HttpException {
  return createOrderException(
    HttpStatus.CONFLICT,
    'ADDRESS_NOT_SERVICEABLE',
    'The selected address is outside the shop service area.',
    false,
  );
}

export function createCustomerOrderInsufficientStockException(): HttpException {
  return createOrderException(
    HttpStatus.CONFLICT,
    'INSUFFICIENT_STOCK',
    'One or more final item quantities are no longer available.',
    false,
  );
}

export function createCustomerOrderStateInvalidException(): HttpException {
  return createOrderException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
    'The created order data is internally inconsistent.',
    false,
  );
}

export function createCustomerOrderProviderUnavailableException(): HttpException {
  return createOrderException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Order placement is temporarily unavailable.',
    true,
  );
}

export function createInvalidCustomerOrderReadException(): HttpException {
  return createOrderException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The customer order query is invalid.',
    false,
  );
}

export function createCustomerOrderNotFoundException(): HttpException {
  return createOrderException(
    HttpStatus.NOT_FOUND,
    'ORDER_NOT_FOUND',
    'The order does not exist or is not visible to this customer.',
    false,
  );
}

export function createCustomerOrderReadStateInvalidException(): HttpException {
  return createOrderException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
    'Customer order history or snapshot data is internally inconsistent.',
    false,
  );
}

export function createCustomerOrderReadProviderUnavailableException(): HttpException {
  return createOrderException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Customer order history is temporarily unavailable.',
    true,
  );
}

export function createInvalidMerchantOrderReadException(): HttpException {
  return createOrderException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    'The merchant order query is invalid.',
    false,
  );
}

export function createMerchantOrderNotFoundException(): HttpException {
  return createOrderException(
    HttpStatus.NOT_FOUND,
    'ORDER_NOT_FOUND',
    'The order does not exist or is not visible to this merchant.',
    false,
  );
}

export function createMerchantOrderReadStateInvalidException(): HttpException {
  return createOrderException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
    'Merchant order, alert, or history data is internally inconsistent.',
    false,
  );
}

export function createMerchantOrderReadProviderUnavailableException(): HttpException {
  return createOrderException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'Merchant incoming orders are temporarily unavailable.',
    true,
  );
}
