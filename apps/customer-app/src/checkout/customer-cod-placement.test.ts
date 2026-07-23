import {
  isCustomerOrderSecurityFailure,
  isUncertainCustomerOrderFailure,
  matchesCustomerCheckoutTransaction,
} from './customer-cod-placement';
import { CustomerOrderError, type PlacedCustomerCodOrder } from '../orders/customer-order.types';

const ORDER = {
  id: '10000000-0000-4000-8000-000000000001',
  cartId: '20000000-0000-4000-8000-000000000001',
  quoteId: '30000000-0000-4000-8000-000000000001',
  address: { id: '40000000-0000-4000-8000-000000000001' },
} as PlacedCustomerCodOrder;

describe('customer COD placement rules', () => {
  it.each(['TRANSPORT', 'MALFORMED_RESPONSE', 'UNKNOWN'] as const)(
    'treats %s as an uncertain outcome',
    (kind) => {
      expect(isUncertainCustomerOrderFailure(new CustomerOrderError(kind, null, false))).toBe(true);
    },
  );

  it('treats a retryable temporary outage as uncertain', () => {
    expect(
      isUncertainCustomerOrderFailure(
        new CustomerOrderError('TEMPORARILY_UNAVAILABLE', null, true),
      ),
    ).toBe(true);
  });

  it.each(['VALIDATION', 'STALE_QUOTE', 'CONFLICT', 'NOT_FOUND'] as const)(
    'treats %s as a definitive failure',
    (kind) => {
      expect(isUncertainCustomerOrderFailure(new CustomerOrderError(kind, null, false))).toBe(
        false,
      );
    },
  );

  it('identifies authentication and authorization failures for state purging', () => {
    expect(isCustomerOrderSecurityFailure(new CustomerOrderError('AUTHENTICATION', null, false))).toBe(
      true,
    );
    expect(isCustomerOrderSecurityFailure(new CustomerOrderError('FORBIDDEN', null, false))).toBe(
      true,
    );
    expect(isCustomerOrderSecurityFailure(new CustomerOrderError('VALIDATION', null, false))).toBe(
      false,
    );
  });

  it('accepts only a response belonging to the active cart quote and address', () => {
    expect(
      matchesCustomerCheckoutTransaction(ORDER, {
        cartId: ORDER.cartId,
        quoteId: ORDER.quoteId,
        addressId: ORDER.address.id,
      }),
    ).toBe(true);
    expect(
      matchesCustomerCheckoutTransaction(ORDER, {
        cartId: ORDER.cartId,
        quoteId: ORDER.quoteId,
        addressId: '50000000-0000-4000-8000-000000000001',
      }),
    ).toBe(false);
  });
});
