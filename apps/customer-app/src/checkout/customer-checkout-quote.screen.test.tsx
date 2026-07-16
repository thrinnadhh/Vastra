import { fireEvent, render } from '@testing-library/react-native';

import { CustomerCheckoutQuoteScreen } from './customer-checkout-quote.screen';
import {
  CustomerCheckoutQuoteError,
  type CustomerCheckoutQuote,
  type CustomerCheckoutQuotePort,
} from './customer-checkout-quote.types';

const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-07-16T10:00:00.000Z');

const QUOTE: CustomerCheckoutQuote = {
  id: '40000000-0000-4000-8000-000000000001',
  cartId: '30000000-0000-4000-8000-000000000001',
  address: {
    id: ADDRESS_ID,
    label: 'Home',
    recipientName: 'Customer',
    phoneNumber: '9000000001',
    line1: 'Quote Street',
    line2: null,
    landmark: null,
    area: 'Tirupati',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517501',
    countryCode: 'IN',
    latitude: 13.6288,
    longitude: 79.4192,
  },
  shop: {
    id: '50000000-0000-4000-8000-000000000001',
    name: 'Quote Shop',
    slug: 'quote-shop',
    minimumOrderPaise: 0,
    averagePreparationMinutes: 20,
    distanceMeters: 500,
    serviceRadiusMeters: 5000,
  },
  items: [
    {
      cartItemId: '60000000-0000-4000-8000-000000000001',
      variantId: '70000000-0000-4000-8000-000000000001',
      productId: '80000000-0000-4000-8000-000000000001',
      productName: 'Quote Kurta',
      sku: 'QUOTE-KURTA-M',
      colourName: 'Blue',
      sizeLabel: 'M',
      quantity: 2,
      previousUnitPricePaise: 26_000,
      unitPricePaise: 25_000,
      priceChanged: true,
      availableQuantity: 3,
      inventoryVersion: 1,
      lineTotalPaise: 50_000,
    },
  ],
  totals: {
    subtotalPaise: 52_000,
    productDiscountPaise: 2_000,
    couponDiscountPaise: 1_000,
    deliveryFeePaise: 4_000,
    platformFeePaise: 500,
    taxPaise: 0,
    totalPaise: 53_500,
  },
  estimatedPreparationMinutes: 20,
  estimatedTravelMinutes: 15,
  estimatedDeliveryAt: '2026-07-16T10:35:00.000Z',
  expiresAt: '2026-07-16T10:05:00.000Z',
  createdAt: '2026-07-16T10:00:00.000Z',
};

function clientFrom(
  createQuote: CustomerCheckoutQuotePort['createQuote'],
): CustomerCheckoutQuotePort {
  return { createQuote };
}

describe('CustomerCheckoutQuoteScreen', () => {
  it('shows the initial address boundary without requesting a quote', () => {
    const createQuote = jest.fn(() => Promise.resolve(QUOTE));
    const { getByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={null}
        now={() => NOW}
        quoteClient={clientFrom(createQuote)}
      />,
    );

    expect(getByText('Select a delivery address')).toBeTruthy();
    expect(createQuote).not.toHaveBeenCalled();
  });

  it('shows loading while requesting the authoritative quote', () => {
    const neverResolves = new Promise<CustomerCheckoutQuote>(() => undefined);
    const { getByLabelText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(() => neverResolves)}
      />,
    );

    expect(getByLabelText('Loading current checkout quote')).toBeTruthy();
  });

  it('renders authoritative items, every total, price changes, and accessible COD total', async () => {
    const { findByLabelText, findByText, getByLabelText, getByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    expect(await findByText('Quote Shop')).toBeTruthy();
    expect(getByText('Quote Kurta')).toBeTruthy();
    expect(getByText('Quantity 2')).toBeTruthy();
    expect(getByLabelText('Subtotal ₹520.00')).toBeTruthy();
    expect(getByLabelText('Product discount ₹20.00')).toBeTruthy();
    expect(getByLabelText('Coupon discount ₹10.00')).toBeTruthy();
    expect(getByLabelText('Delivery fee ₹40.00')).toBeTruthy();
    expect(getByLabelText('Platform fee ₹5.00')).toBeTruthy();
    expect(getByLabelText('Tax ₹0.00')).toBeTruthy();
    expect(getByLabelText('Final COD total ₹535.00')).toBeTruthy();
    expect(getByText('PRICE UPDATED')).toBeTruthy();
    expect(
      await findByLabelText('Continue to COD order placement in the next step'),
    ).toBeDisabled();
  });

  it('retries after a transport failure with an accessible action', async () => {
    const createQuote = jest
      .fn<
        ReturnType<CustomerCheckoutQuotePort['createQuote']>,
        Parameters<CustomerCheckoutQuotePort['createQuote']>
      >()
      .mockRejectedValueOnce(new CustomerCheckoutQuoteError('TRANSPORT', null, true))
      .mockResolvedValueOnce(QUOTE);
    const { findByRole, findByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(createQuote)}
      />,
    );

    expect(await findByText('You are offline')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'Try again' }));
    expect(await findByText('Quote Shop')).toBeTruthy();
    expect(createQuote).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['VALIDATION', 'The selected delivery address or checkout request is invalid.'],
    ['CONFLICT', 'Your cart changed while checkout was loading. Refresh and review it again.'],
    [
      'UNAVAILABLE_ITEM',
      'One or more cart items are no longer available. Review your cart and try again.',
    ],
  ] as const)('renders a recoverable %s failure', async (kind, message) => {
    const { findByRole, findByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(() =>
          Promise.reject(new CustomerCheckoutQuoteError(kind, null, false)),
        )}
      />,
    );

    expect(await findByText(message)).toBeTruthy();
    expect(await findByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('renders a missing backend cart as an empty checkout state', async () => {
    const { findByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(() =>
          Promise.reject(new CustomerCheckoutQuoteError('EMPTY_CART', 'CART_NOT_FOUND', false)),
        )}
      />,
    );

    expect(await findByText('Your cart is empty')).toBeTruthy();
    expect(await findByText('Add an item from one shop before opening checkout.')).toBeTruthy();
  });

  it('marks an expired quote stale and offers a refresh without placing an order', async () => {
    const createQuote = jest.fn(() =>
      Promise.resolve({
        ...QUOTE,
        expiresAt: '2026-07-16T09:59:59.000Z',
      }),
    );
    const { findByRole, findByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(createQuote)}
      />,
    );

    expect(await findByText('QUOTE EXPIRED')).toBeTruthy();
    expect(await findByRole('button', { name: 'Refresh checkout quote' })).toBeTruthy();
    expect(createQuote).toHaveBeenCalledWith({ addressId: ADDRESS_ID });
  });
});
