import { fireEvent, render } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';

const mockSelectedAddressId = '10000000-0000-4000-8000-000000000001';
const mockCartId = '20000000-0000-4000-8000-000000000001';
const mockQuoteId = '30000000-0000-4000-8000-000000000001';
const mockOrderId = '40000000-0000-4000-8000-000000000001';

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
          onSelectedAddressChange(mockSelectedAddressId);
        }}
      >
        <MockText>Select serviceable address</MockText>
      </MockPressable>
    </MockView>
  ),
}));

jest.mock('./src/checkout/default-customer-checkout-quote', () => ({
  DefaultCustomerCheckoutQuote: ({
    addressId,
    onQuoteAccepted,
    onOrderConfirmed,
  }: {
    readonly addressId: string | null;
    readonly onQuoteAccepted?: (identity: {
      readonly addressId: string;
      readonly cartId: string;
      readonly quoteId: string;
    }) => void;
    readonly onOrderConfirmed?: (orderId: string) => void;
  }) => (
    <MockView>
      <MockText>{addressId ?? 'Checkout awaits an address'}</MockText>
      <MockPressable
        accessibilityRole="button"
        onPress={() => {
          if (addressId === null) return;
          onQuoteAccepted?.({ addressId, cartId: mockCartId, quoteId: mockQuoteId });
          onOrderConfirmed?.(mockOrderId);
        }}
      >
        <MockText>Complete synthetic COD placement</MockText>
      </MockPressable>
    </MockView>
  ),
}));

jest.mock('./src/orders/default-customer-order-confirmation', () => ({
  DefaultCustomerOrderConfirmation: ({
    orderId,
    onViewOrder,
    onViewOrders,
    onContinueShopping,
  }: {
    readonly orderId: string;
    readonly onViewOrder: (orderId: string) => void;
    readonly onViewOrders: () => void;
    readonly onContinueShopping: () => void;
  }) => (
    <MockView>
      <MockText>{`Authoritative confirmation ${orderId}`}</MockText>
      <MockPressable accessibilityRole="button" onPress={() => onViewOrder(orderId)}>
        <MockText>Open confirmed order detail</MockText>
      </MockPressable>
      <MockPressable accessibilityRole="button" onPress={onViewOrders}>
        <MockText>Open confirmed My Orders</MockText>
      </MockPressable>
      <MockPressable accessibilityRole="button" onPress={onContinueShopping}>
        <MockText>Continue confirmed shopping</MockText>
      </MockPressable>
    </MockView>
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
  DefaultCustomerOrders: ({ initialOrderId }: { readonly initialOrderId?: string }) => (
    <MockText>
      {initialOrderId === undefined
        ? 'Authenticated customer orders'
        : `Authoritative order detail ${initialOrderId}`}
    </MockText>
  ),
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

function reachCheckout(view: ReturnType<typeof render>): void {
  fireEvent.press(view.getByText('Continue to checkout'));
  fireEvent.press(view.getByText('Cart continue to address'));
  fireEvent.press(view.getByText('Select serviceable address'));
}

describe('CustomerAppContent', () => {
  it('exposes exactly the approved five root tabs', () => {
    const view = render(<CustomerAppContent />);

    expect(view.getAllByRole('tab')).toHaveLength(5);
    expect(view.getByRole('tab', { name: 'Home tab' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Discover tab' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Style tab' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Orders tab' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Profile tab' })).toBeTruthy();
  });

  it('hands Home discovery actions to the canonical Discover search', () => {
    const view = render(<CustomerAppContent />);

    fireEvent.press(view.getByText('Browse Home discovery'));
    expect(view.getByText('Customer product search')).toBeTruthy();
  });

  it('preserves Discover query state across root-tab switches', () => {
    const view = render(<CustomerAppContent />);

    fireEvent.press(view.getByRole('tab', { name: 'Discover tab' }));
    fireEvent.press(view.getByText('Set preserved query'));
    fireEvent.press(view.getByRole('tab', { name: 'Home tab' }));
    fireEvent.press(view.getByRole('tab', { name: 'Discover tab' }));

    expect(view.getByText('cotton shirt')).toBeTruthy();
  });

  it('orchestrates Cart to Address to Checkout with deterministic Back behavior', () => {
    const view = render(<CustomerAppContent />);

    fireEvent.press(view.getByText('Continue to checkout'));
    expect(view.getByText('Authoritative customer cart')).toBeTruthy();
    expect(view.queryAllByRole('tab')).toHaveLength(0);

    fireEvent.press(view.getByText('Cart continue to address'));
    expect(view.getByText('No checkout address selected')).toBeTruthy();

    fireEvent.press(view.getByText('Select serviceable address'));
    expect(view.getByText(mockSelectedAddressId)).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Back from Checkout' }));
    expect(view.getByText(mockSelectedAddressId)).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Back from Delivery address' }));
    expect(view.getByText('Authoritative customer cart')).toBeTruthy();
  });

  it('seeds a selected address without bypassing address selection', () => {
    const view = render(<CustomerAppContent addressId="selected-address-id" />);

    fireEvent.press(view.getByText('Continue to checkout'));
    fireEvent.press(view.getByText('Cart continue to address'));
    expect(view.getByText('selected-address-id')).toBeTruthy();
  });

  it('replaces checkout with confirmation and opens canonical order detail', () => {
    const view = render(<CustomerAppContent />);
    reachCheckout(view);

    fireEvent.press(view.getByText('Complete synthetic COD placement'));
    expect(view.getByText(`Authoritative confirmation ${mockOrderId}`)).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Back from Order confirmed' })).toBeNull();

    fireEvent.press(view.getByText('Open confirmed order detail'));
    expect(view.getByText(`Authoritative order detail ${mockOrderId}`)).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Orders tab' })).toBeTruthy();
  });

  it('keeps the authenticated order list reachable through Orders', () => {
    const view = render(<CustomerAppContent />);

    fireEvent.press(view.getByRole('tab', { name: 'Orders tab' }));
    expect(view.getByText('Authenticated customer orders')).toBeTruthy();
  });

  it('mounts the migrated root inside the shared mobile shell', () => {
    const view = render(<CustomerApplicationRoot />);

    expect(view.getByTestId('customer-application-shell')).toBeTruthy();
    expect(view.getByText('Continue to checkout')).toBeTruthy();
  });
});
