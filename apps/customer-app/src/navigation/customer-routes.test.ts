import {
  CUSTOMER_TABS,
  isCustomerTabKey,
  isUuid,
  ownerTabForRoute,
  type DiscoveryRoute,
  type OrdersRoute,
  type TransactionRoute,
  type UUID,
} from './customer-routes';

describe('customer route contract', () => {
  it('freezes exactly five labelled root tabs', () => {
    expect(CUSTOMER_TABS).toEqual(['Home', 'Discover', 'Style', 'Orders', 'Profile']);
    expect(isCustomerTabKey('Orders')).toBe(true);
    expect(isCustomerTabKey('Checkout')).toBe(false);
  });

  it('keeps canonical route ownership stable', () => {
    const productRoute = {
      scope: 'DISCOVERY',
      name: 'ProductDetail',
      params: { productId: '00000000-0000-4000-8000-000000000001' as UUID },
    } satisfies DiscoveryRoute;
    const orderRoute = {
      scope: 'ORDERS',
      name: 'OrderDetail',
      params: { orderId: '00000000-0000-4000-8000-000000000002' as UUID },
    } satisfies OrdersRoute;
    const checkoutRoute = {
      scope: 'TRANSACTION',
      name: 'Checkout',
      params: undefined,
    } satisfies TransactionRoute;

    expect(ownerTabForRoute(productRoute)).toBe('Discover');
    expect(ownerTabForRoute(orderRoute)).toBe('Orders');
    expect(ownerTabForRoute(checkoutRoute)).toBeNull();
  });

  it('accepts UUID-shaped identifiers and rejects arbitrary ingress data', () => {
    expect(isUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('not-a-route-id')).toBe(false);
  });
});
