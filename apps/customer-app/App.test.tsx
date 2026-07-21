import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';

jest.mock('./src/auth/default-customer-session', () => ({
  CustomerSessionApp: ({ children }: { readonly children: React.ReactNode }) => children,
}));

jest.mock('./src/checkout/default-customer-checkout-quote', () => ({
  DefaultCustomerCheckoutQuote: ({ addressId }: { readonly addressId: string | null }) => (
    <MockText>{addressId ?? 'Checkout awaits an address'}</MockText>
  ),
}));

jest.mock('./src/orders/default-customer-orders', () => ({
  DefaultCustomerOrders: () => <MockText>Authenticated customer orders</MockText>,
}));

jest.mock('./src/navigation/default-customer-root-content', () => ({
  DefaultCustomerHomeRoot: ({
    openCheckout,
    openDiscover,
  }: {
    readonly openCheckout: () => void;
    readonly openDiscover: () => void;
  }) => (
    <MockView>
      <MockPressable accessibilityRole="button" onPress={openDiscover}>
        <MockText>Browse Home discovery</MockText>
      </MockPressable>
      <MockPressable accessibilityRole="button" onPress={openCheckout}>
        <MockText>Continue to checkout</MockText>
      </MockPressable>
    </MockView>
  ),
  DefaultCustomerProfileRoot: () => <MockText>Authenticated customer profile</MockText>,
}));

import { CustomerAppContent, CustomerApplicationRoot } from './App';

describe('CustomerAppContent', () => {
  it('exposes exactly the approved five root tabs', () => {
    const { getAllByRole, getByRole } = render(<CustomerAppContent />);

    expect(getAllByRole('tab')).toHaveLength(5);
    expect(getByRole('tab', { name: 'Home tab' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Discover tab' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Style tab' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Orders tab' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Profile tab' })).toBeTruthy();
  });

  it('hands Home discovery actions to the canonical Discover tab', () => {
    const { getByText } = render(<CustomerAppContent />);

    fireEvent.press(getByText('Browse Home discovery'));

    expect(
      getByText('Search, shop, and product routes continue in the remaining Sprint 04 tickets.'),
    ).toBeTruthy();
  });

  it('keeps checkout contextual rather than making it a sixth tab', () => {
    const { getByRole, getByText, queryAllByRole } = render(<CustomerAppContent />);

    fireEvent.press(getByText('Continue to checkout'));

    expect(getByText('Checkout awaits an address')).toBeTruthy();
    expect(queryAllByRole('tab')).toHaveLength(0);
    fireEvent.press(getByRole('button', { name: 'Back from checkout' }));
    expect(getByText('Continue to checkout')).toBeTruthy();
  });

  it('passes a selected address into the preserved checkout boundary', () => {
    const { getByText } = render(<CustomerAppContent addressId="selected-address-id" />);

    fireEvent.press(getByText('Continue to checkout'));
    expect(getByText('selected-address-id')).toBeTruthy();
  });

  it('keeps the authenticated order list reachable through Orders', () => {
    const { getByRole, getByText } = render(<CustomerAppContent />);

    fireEvent.press(getByRole('tab', { name: 'Orders tab' }));

    expect(getByText('Authenticated customer orders')).toBeTruthy();
  });

  it('mounts the migrated root inside the shared mobile shell', () => {
    const { getByTestId, getByText } = render(<CustomerApplicationRoot />);

    expect(getByTestId('customer-application-shell')).toBeTruthy();
    expect(getByText('Continue to checkout')).toBeTruthy();
  });
});
