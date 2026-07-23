import type { CustomerCheckoutQuoteIdentity } from './customer-checkout-transaction';
import type { CustomerOrderError, PlacedCustomerCodOrder } from '../orders/customer-order.types';

export function isUncertainCustomerOrderFailure(error: CustomerOrderError): boolean {
  return (
    error.kind === 'TRANSPORT' ||
    error.kind === 'MALFORMED_RESPONSE' ||
    error.kind === 'UNKNOWN' ||
    (error.kind === 'TEMPORARILY_UNAVAILABLE' && error.retryable)
  );
}

export function isCustomerOrderSecurityFailure(error: CustomerOrderError): boolean {
  return error.kind === 'AUTHENTICATION' || error.kind === 'FORBIDDEN';
}

export function matchesCustomerCheckoutTransaction(
  order: PlacedCustomerCodOrder,
  quote: CustomerCheckoutQuoteIdentity,
): boolean {
  return (
    order.id.length > 0 &&
    order.cartId === quote.cartId &&
    order.quoteId === quote.quoteId &&
    order.address.id === quote.addressId
  );
}
