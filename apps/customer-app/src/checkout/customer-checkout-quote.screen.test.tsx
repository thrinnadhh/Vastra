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
  }, 15_000);

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
    fireEvent.press(
      await findByRole('button', {
        name: 'Order placement in progress. Checkout refresh unavailable',
      }),
    );

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
    const onOrderPlaced = jest.fn();
    const { findByRole, findByText } = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        createIdempotencyKey={createIdempotencyKey}
        now={() => NOW}
        onOrderPlaced={onOrderPlaced}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹535.00' }));
    expect(await findByText('ORDER NOT PLACED')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'Retry same COD order attempt' }));

    expect(placeCodOrder).toHaveBeenCalledTimes(2);
    expect(placeCodOrder.mock.calls[0]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(placeCodOrder.mock.calls[1]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onOrderPlaced).toHaveBeenCalledWith({ ...PLACED_ORDER, replayed: true });
    });
  });

  it('preserves the placement attempt when its quote expires before the request settles', async () => {
    jest.useFakeTimers();
    let currentTime = NOW;
    let rejectFirstAttempt: ((error: CustomerOrderError) => void) | undefined;
    const firstAttempt = new Promise<PlacedCustomerCodOrder>((_resolve, reject) => {
      rejectFirstAttempt = reject;
    });
    const placeCodOrder = jest
      .fn<
        ReturnType<CustomerOrderPlacementPort['placeCodOrder']>,
        Parameters<CustomerOrderPlacementPort['placeCodOrder']>
      >()
      .mockImplementationOnce(() => firstAttempt)
      .mockResolvedValueOnce({ ...PLACED_ORDER, replayed: true });
    const createQuote = jest.fn(() =>
      Promise.resolve({ ...QUOTE, expiresAt: new Date(NOW + 1_000).toISOString() }),
    );
    const createIdempotencyKey = jest.fn(() => IDEMPOTENCY_KEY);
    const onOrderPlaced = jest.fn();

    try {
      const { getByRole } = render(
        <CustomerCheckoutQuoteScreen
          addressId={ADDRESS_ID}
          createIdempotencyKey={createIdempotencyKey}
          now={() => currentTime}
          onOrderPlaced={onOrderPlaced}
          orderClient={{ placeCodOrder }}
          quoteClient={clientFrom(createQuote)}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.press(getByRole('button', { name: 'Place COD order for ₹535.00' }));

      currentTime = NOW + 1_001;
      act(() => {
        jest.advanceTimersByTime(1_001);
      });

      expect(
        getByRole('button', {
          name: 'Order placement in progress. Checkout refresh unavailable',
        }),
      ).toBeDisabled();
      fireEvent.press(
        getByRole('button', {
          name: 'Order placement in progress. Checkout refresh unavailable',
        }),
      );
      expect(createQuote).toHaveBeenCalledTimes(1);
      expect(placeCodOrder).toHaveBeenCalledTimes(1);

      await act(async () => {
        rejectFirstAttempt?.(new CustomerOrderError('TRANSPORT', null, true));
        await expect(firstAttempt).rejects.toBeInstanceOf(CustomerOrderError);
      });
      fireEvent.press(getByRole('button', { name: 'Retry same COD order attempt' }));

      await act(async () => {
        await Promise.resolve();
      });
      expect(placeCodOrder).toHaveBeenCalledTimes(2);
      expect(placeCodOrder.mock.calls[0]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
      expect(placeCodOrder.mock.calls[1]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
      expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
      expect(onOrderPlaced).toHaveBeenCalledWith({ ...PLACED_ORDER, replayed: true });
    } finally {
      jest.useRealTimers();
    }
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

  it('renders the selected server address and explicit zero discounts', async () => {
    const quote = {
      ...QUOTE,
      totals: { ...QUOTE.totals, productDiscountPaise: 0, couponDiscountPaise: 0 },
    };
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(() => Promise.resolve(quote))}
      />,
    );

    expect(await view.findByText('DELIVER TO')).toBeTruthy();
    expect(view.getByText('Customer')).toBeTruthy();
    expect(view.getByText('Quote Street')).toBeTruthy();
    expect(view.getByText('Tirupati, Tirupati, Andhra Pradesh 517501')).toBeTruthy();
    expect(view.getByLabelText('Product discount ₹0.00')).toBeTruthy();
    expect(view.getByLabelText('Coupon discount ₹0.00')).toBeTruthy();
  });

  it('prevents duplicate quote refresh requests', async () => {
    let resolveSecond: ((quote: CustomerCheckoutQuote) => void) | undefined;
    const expiredQuote = { ...QUOTE, expiresAt: '2026-07-16T09:59:00.000Z' };
    const createQuote = jest
      .fn()
      .mockResolvedValueOnce(expiredQuote)
      .mockImplementationOnce(
        () =>
          new Promise<CustomerCheckoutQuote>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(createQuote)}
      />,
    );

    expect(await view.findByText('Quote Shop')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Refresh checkout quote' }));
    fireEvent.press(view.getByRole('button', { name: 'Refresh checkout quote' }));
    expect(createQuote).toHaveBeenCalledTimes(2);
    act(() => {
      resolveSecond?.(QUOTE);
    });
  });

  it('announces an authoritative stock shortfall', async () => {
    const firstItem = QUOTE.items[0];
    if (firstItem === undefined) throw new Error('Expected quote item fixture');
    const quote: CustomerCheckoutQuote = {
      ...QUOTE,
      items: [{ ...firstItem, quantity: 4, availableQuantity: 3 }],
    };
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(() => Promise.resolve(quote))}
      />,
    );
    expect(await view.findByText('STOCK CHANGED')).toBeTruthy();
  });
});
