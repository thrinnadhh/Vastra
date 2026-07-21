import {
  activeCustomerRoute,
  createInitialCustomerNavigationState,
  goBackCustomerNavigation,
  openCustomerRoute,
  selectCustomerTab,
} from './customer-navigation-state';
import type { UUID } from './customer-routes';

describe('customer navigation state', () => {
  it('starts on Home while keeping every canonical tab root available', () => {
    const state = createInitialCustomerNavigationState();

    expect(state.selectedTab).toBe('Home');
    expect(activeCustomerRoute(state)).toEqual({
      scope: 'HOME',
      name: 'Home',
      params: undefined,
    });
    expect(state.ordersStack[0]?.name).toBe('Orders');
    expect(state.profileStack[0]?.name).toBe('Profile');
  });

  it('selects the canonical owner when another tab opens a product', () => {
    const state = openCustomerRoute(createInitialCustomerNavigationState(), {
      scope: 'DISCOVERY',
      name: 'ProductDetail',
      params: { productId: '00000000-0000-4000-8000-000000000001' as UUID },
    });

    expect(state.selectedTab).toBe('Discover');
    expect(activeCustomerRoute(state).name).toBe('ProductDetail');
  });

  it('keeps transaction routes contextual rather than creating a sixth tab', () => {
    const state = openCustomerRoute(createInitialCustomerNavigationState(), {
      scope: 'TRANSACTION',
      name: 'Checkout',
      params: undefined,
    });

    expect(state.selectedTab).toBe('Home');
    expect(activeCustomerRoute(state).name).toBe('Checkout');
    expect(selectCustomerTab(state, 'Orders').transactionStack).toEqual([]);
  });

  it('pops the active transaction before the selected tab stack', () => {
    const orderId = '00000000-0000-4000-8000-000000000002' as UUID;
    const withOrder = openCustomerRoute(createInitialCustomerNavigationState(), {
      scope: 'ORDERS',
      name: 'OrderDetail',
      params: { orderId },
    });
    const withCheckout = openCustomerRoute(withOrder, {
      scope: 'TRANSACTION',
      name: 'Checkout',
      params: undefined,
    });

    const afterTransactionBack = goBackCustomerNavigation(withCheckout);
    expect(activeCustomerRoute(afterTransactionBack).name).toBe('OrderDetail');

    const afterStackBack = goBackCustomerNavigation(afterTransactionBack);
    expect(activeCustomerRoute(afterStackBack).name).toBe('Orders');
  });
});
