import { render } from '@testing-library/react-native';
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

import { CustomerAppContent } from './App';

describe('CustomerAppContent', () => {
  it('exposes checkout through an empty address-selection boundary', () => {
    const { getByText } = render(<CustomerAppContent />);

    expect(getByText('Checkout awaits an address')).toBeTruthy();
  });

  it('passes a selected address into the checkout boundary', () => {
    const { getByText } = render(<CustomerAppContent addressId="selected-address-id" />);

    expect(getByText('selected-address-id')).toBeTruthy();
  });
});
