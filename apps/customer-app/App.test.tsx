import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';

jest.mock('./src/auth/default-customer-session', () => ({
  CustomerSessionApp: ({ children }: { readonly children: React.ReactNode }) => children,
}));

jest.mock('./src/cart/default-customer-cart', () => ({
  DefaultCustomerCart: ({ onCheckout }: { readonly onCheckout: () => void }) => (
    <MockView>
      <MockText>Authoritative customer cart</MockText>
      <MockPressable accessibilityRole="button" onPress={onCheckout}>
        <MockText>Cart continue to address</MockText>
      </MockPressable>
    </MockView>
  ),
}));

jest.mock('./src/addresses/default-customer-addresses', () => ({
  DefaultCustomerAddresses: ({
    selectedAddressId,
    onSelectedAddressChange,
  }: {
    readonly selectedAddressId: string | null;
    readonly onSelectedAddressChange: (addressId: string | null) => void;
  }) => (
    <MockView>
      <MockText>{selectedAddressId ?? 'No checkout address selected'}</MockText>
      <MockPressable
        accessibilityRole="button"
        onPress={() => {
          onSelectedAddressChange('10000000-0000-4000-8000-000000000001');
        }}
      >
        <MockText>Select serviceable address</MockText>
      </MockPressable>
    </MockView>
  ),
}));

jest.mock('./src/checkout/default-customer-checkout-quote', () => ({
  DefaultCustomerCheckoutQuote: ({ addressId }: { readonly addressId: string | null }) => (
    <MockText>{addressId ?? 'Checkout awaits an address'}</MockText>
  ),
}));

jest.mock('./src/discovery/default-customer-search', () => ({
  DefaultCustomerSearchRoot: ({
    sessionState,
    setSessionState,
  }: {
    readonly sessionState: { readonly draftQuery: string };
    readonly setSessionState: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  }) => (
    <MockView>
      <MockText>Customer product search</MockText>
      <MockText>{sessionState.draftQuery}</MockText>
      <MockPressable
        accessibilityRole="button"
        onPress={() => {
          setSessionState((current) => ({ ...current, draftQuery: 'cotton shirt' }));
        }}
      >
        <MockText>Set preserved query</MockText>
      </MockPressable>
    </MockView>
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

  it('hands Home discovery actions to the canonical Discover search', () => {
    const { getByText } = render(<CustomerAppContent />);

    fireEvent.press(getByText('Browse Home discovery'));

    expect(getByText('Customer product search')).toBeTruthy();
  });

  it('preserves Discover query state across root-tab switches', () => {
    const { getByRole, getByText } = render(<CustomerAppContent />);

    fireEvent.press(getByRole('tab', { name: 'Discover tab' }));
    fireEvent.press(getByText('Set preserved query'));
    fireEvent.press(getByRole('tab', { name: 'Home tab' }));
    fireEvent.press(getByRole('tab', { name: 'Discover tab' }));

    expect(getByText('cotton shirt')).toBeTruthy();
  });

  it('orchestrates Cart to Address to Checkout without creating a sixth tab', () => {
    const { getByRole, getByText, queryAllByRole } = render(<CustomerAppContent />);

    fireEvent.press(getByText('Continue to checkout'));
    expect(getByText('Authoritative customer cart')).toBeTruthy();
    expect(queryAllByRole('tab')).toHaveLength(0);

    fireEvent.press(getByText('Cart continue to address'));
    expect(getByText('No checkout address selected')).toBeTruthy();

    fireEvent.press(getByText('Select serviceable address'));
    expect(getByText('10000000-0000-4000-8000-000000000001')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: 'Back from Checkout' }));
    expect(getByText('No checkout address selected')).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Back from Delivery address' }));
    expect(getByText('Authoritative customer cart')).toBeTruthy();
  });

  it('seeds a selected address without bypassing address selection', () => {
    const { getByText } = render(<CustomerAppContent addressId="selected-address-id" />);

    fireEvent.press(getByText('Continue to checkout'));
    fireEvent.press(getByText('Cart continue to address'));
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
