import { fireEvent, render } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

jest.mock('./src/auth/default-customer-session', () => ({
  CustomerSessionApp: ({ children }: { readonly children: React.ReactNode }) => children,
}));

jest.mock('./src/checkout/default-customer-checkout-quote', () => {
  return {
    DefaultCustomerCheckoutQuote: ({ addressId }: { readonly addressId: string | null }) => (
      <MockText>{addressId ?? 'Checkout awaits an address'}</MockText>
    ),
  };
});

jest.mock('./src/orders/default-customer-orders', () => ({
  DefaultCustomerOrders: () => <MockText>Authenticated customer orders</MockText>,
}));

import App, { CustomerAppContent } from './App';

describe('CustomerAppContent', () => {
  it('exposes checkout through an empty address-selection boundary', () => {
    const { getByText } = render(<CustomerAppContent />);

    expect(getByText('Checkout awaits an address')).toBeTruthy();
  });

  it('passes a selected address into the checkout boundary', () => {
    const { getByText } = render(<CustomerAppContent addressId="selected-address-id" />);

    expect(getByText('selected-address-id')).toBeTruthy();
  });

  it('makes the authenticated order list reachable from the app shell', () => {
    const { getByRole, getByText } = render(<CustomerAppContent />);

    fireEvent.press(getByRole('tab', { name: 'My orders' }));

    expect(getByText('Authenticated customer orders')).toBeTruthy();
  });

  it('mounts the preserved customer routes inside the shared mobile shell', () => {
    const { getByTestId, getByText } = render(<App />);

    expect(getByTestId('customer-application-shell')).toBeTruthy();
    expect(getByText('Checkout awaits an address')).toBeTruthy();
  });
});
