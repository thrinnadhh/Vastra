import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText } from 'react-native';

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
  DefaultCustomerHomeRoot: ({ openCheckout }: { readonly openCheckout: () => void }) => (
    <MockPressable accessibilityRole="button" onPress={openCheckout}>
      <MockText>Continue to checkout</MockText>
    </MockPressable>
  ),
  DefaultCustomerProfileRoot: () => <MockText>Authenticated customer profile</MockText>,
}));

import { CustomerAppContent, CustomerApplicationRoot } from './App';

describe('CustomerAppContent', () => {
  it('exposes exactly the approved five root tabs', () => {
    const { getAllByRole } = render(<CustomerAppContent />);

    expect(getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Home tab',
      'Discover tab',
      'Style tab',
      'Orders tab',
      'Profile tab',
    ]);
  });

  it('keeps checkout contextual rather than making it a sixth tab', () => {
    const { getAllByRole, getByRole, getByText } = render(<CustomerAppContent />);

    fireEvent.press(getByText('Continue to checkout'));

    expect(getByText('Checkout awaits an address')).toBeTruthy();
    expect(getAllByRole('tab')).toHaveLength(0);
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
