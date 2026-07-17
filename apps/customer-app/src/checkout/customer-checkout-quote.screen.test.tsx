import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { CustomerCheckoutQuoteScreen } from './customer-checkout-quote.screen';
import {
  CustomerCheckoutQuoteError,
  type CustomerCheckoutQuote,
  type CustomerCheckoutQuotePort,
} from './customer-checkout-quote.types';
import {
  CustomerOrderError,
  type CustomerOrderPlacementPort,
  type PlacedCustomerCodOrder,
} from '../orders/customer-order.types';

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

const PLACED_ORDER: PlacedCustomerCodOrder = {
  id: '10000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-20260716-0001',
  cartId: QUOTE.cartId,
  quoteId: QUOTE.id,
  shop: { id: QUOTE.shop.id, name: QUOTE.shop.name, slug: QUOTE.shop.slug },
  address: QUOTE.address,
  status: 'WAITING_FOR_MERCHANT',
  paymentStatus: 'COD_PENDING',
  paymentMethod: 'COD',
  fulfilmentType: 'DELIVERY',
  items: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      productId: '80000000-0000-4000-8000-000000000001',
      variantId: '70000000-0000-4000-8000-000000000001',
      productName: 'Quote Kurta',
      sku: 'QUOTE-KURTA-M',
      colourName: 'Blue',
      sizeLabel: 'M',
      imageObjectKey: null,
      quantity: 2,
      unitMrpPaise: 26_000,
      unitSellingPricePaise: 25_000,
      discountPaise: 2_000,
      totalPaise: 50_000,
    },
  ],
  totals: QUOTE.totals,
  estimatedDeliveryAt: QUOTE.estimatedDeliveryAt,
  customerNote: null,
  placedAt: '2026-07-16T10:01:00.000Z',
  replayed: false,
};

const IDEMPOTENCY_KEY = '90000000-0000-4000-8000-000000000001';

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

  it('places an authoritative COD order and navigates only after backend confirmation', async () => {
    const placeCodOrder = jest.fn(() => Promise.resolve(PLACED_ORDER));
    const onOrderPlaced = jest.fn();
    const { findByRole } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        createIdempotencyKey={() => IDEMPOTENCY_KEY}
        now={() => NOW}
        onOrderPlaced={onOrderPlaced}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹535.00' }));

    expect(placeCodOrder).toHaveBeenCalledWith({
      cartId: QUOTE.cartId,
      quoteId: QUOTE.id,
      addressId: ADDRESS_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    await waitFor(() => {
      expect(onOrderPlaced).toHaveBeenCalledWith(PLACED_ORDER);
    });
  });

  it('blocks duplicate taps while a placement is in flight', async () => {
    let resolveOrder: ((order: PlacedCustomerCodOrder) => void) | undefined;
    const pending = new Promise<PlacedCustomerCodOrder>((resolve) => {
      resolveOrder = resolve;
    });
    const placeCodOrder = jest.fn(() => pending);
    const { findByRole } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        createIdempotencyKey={() => IDEMPOTENCY_KEY}
        now={() => NOW}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹535.00' }));
    fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹535.00' }));

    expect(placeCodOrder).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveOrder?.(PLACED_ORDER);
      await pending;
    });
  });

  it('reuses the same idempotency key when retrying a transport failure', async () => {
    const placeCodOrder = jest
      .fn<
        ReturnType<CustomerOrderPlacementPort['placeCodOrder']>,
        Parameters<CustomerOrderPlacementPort['placeCodOrder']>
      >()
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce({ ...PLACED_ORDER, replayed: true });
    const createIdempotencyKey = jest.fn(() => IDEMPOTENCY_KEY);
    const { findByRole, findByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        createIdempotencyKey={createIdempotencyKey}
        now={() => NOW}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹535.00' }));
    expect(await findByText('ORDER NOT PLACED')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹535.00' }));

    expect(placeCodOrder).toHaveBeenCalledTimes(2);
    expect(placeCodOrder.mock.calls[0]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(placeCodOrder.mock.calls[1]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it('forces a fresh quote after the backend rejects a stale placement quote', async () => {
    const createQuote = jest.fn(() => Promise.resolve(QUOTE));
    const placeCodOrder = jest.fn(() =>
      Promise.reject(new CustomerOrderError('STALE_QUOTE', 'CHECKOUT_QUOTE_EXPIRED', false)),
    );
    const { findByRole, findByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        createIdempotencyKey={() => IDEMPOTENCY_KEY}
        now={() => NOW}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(createQuote)}
      />,
    );

    fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹535.00' }));
    expect(await findByText('QUOTE MUST BE REFRESHED')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'Refresh checkout quote' }));

    await waitFor(() => {
      expect(createQuote).toHaveBeenCalledTimes(2);
    });
  });
});
