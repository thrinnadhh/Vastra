import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  CustomerOrderError,
  type CustomerOrderPlacementPort,
  type PlacedCustomerCodOrder,
} from '../orders/customer-order.types';
import { CustomerCheckoutQuoteScreen } from './customer-checkout-quote.screen';
import {
  CustomerCheckoutQuoteError,
  type CustomerCheckoutQuote,
  type CustomerCheckoutQuotePort,
} from './customer-checkout-quote.types';

const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const CART_ID = '30000000-0000-4000-8000-000000000001';
const QUOTE_ID = '40000000-0000-4000-8000-000000000001';
const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '90000000-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-07-16T10:00:00.000Z');

const QUOTE: CustomerCheckoutQuote = {
  id: QUOTE_ID,
  cartId: CART_ID,
  address: {
    id: ADDRESS_ID,
    label: 'Home',
    recipientName: 'Synthetic Customer',
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
    name: 'Synthetic Quote Shop',
    slug: 'synthetic-quote-shop',
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
      productName: 'Synthetic Kurta',
      sku: 'SYNTH-KURTA-M',
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
  id: ORDER_ID,
  orderNumber: 'VAS-SYNTH-0001',
  cartId: CART_ID,
  quoteId: QUOTE_ID,
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
      productName: 'Synthetic Kurta',
      sku: 'SYNTH-KURTA-M',
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

function clientFrom(
  createQuote: CustomerCheckoutQuotePort['createQuote'],
): CustomerCheckoutQuotePort {
  return { createQuote };
}

async function beginAndConfirm(view: ReturnType<typeof render>): Promise<void> {
  fireEvent.press(await view.findByRole('button', { name: 'Review COD order for ₹535.00' }));
  expect(await view.findByText('CONFIRM CASH ON DELIVERY')).toBeTruthy();
  fireEvent.press(await view.findByRole('button', { name: 'Confirm COD order for ₹535.00' }));
}

describe('CustomerCheckoutQuoteScreen', () => {
  it('requires an address before requesting a quote', () => {
    const createQuote = jest.fn(() => Promise.resolve(QUOTE));
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={null}
        now={() => NOW}
        quoteClient={clientFrom(createQuote)}
      />,
    );

    expect(view.getByText('Select a delivery address')).toBeTruthy();
    expect(createQuote).not.toHaveBeenCalled();
  });

  it('shows loading while requesting the authoritative quote', () => {
    const neverResolves = new Promise<CustomerCheckoutQuote>(() => undefined);
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(() => neverResolves)}
      />,
    );

    expect(view.getByLabelText('Loading current checkout quote')).toBeTruthy();
  });

  it('renders server-owned items, fees, address and accessible COD total', async () => {
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    expect(await view.findByText('Synthetic Quote Shop')).toBeTruthy();
    expect(view.getByText('Synthetic Kurta')).toBeTruthy();
    expect(view.getByText('Quantity 2')).toBeTruthy();
    expect(view.getByLabelText('Subtotal ₹520.00')).toBeTruthy();
    expect(view.getByLabelText('Product discount ₹20.00')).toBeTruthy();
    expect(view.getByLabelText('Coupon discount ₹10.00')).toBeTruthy();
    expect(view.getByLabelText('Delivery fee ₹40.00')).toBeTruthy();
    expect(view.getByLabelText('Platform fee ₹5.00')).toBeTruthy();
    expect(view.getByLabelText('Tax ₹0.00')).toBeTruthy();
    expect(view.getByLabelText('Final COD total ₹535.00')).toBeTruthy();
    expect(view.getByText('PRICE UPDATED')).toBeTruthy();
    expect(
      view.getByLabelText('Continue to COD order placement in the next step'),
    ).toBeDisabled();
  });

  it('retries an offline quote request without retaining fabricated data', async () => {
    const createQuote = jest
      .fn<
        ReturnType<CustomerCheckoutQuotePort['createQuote']>,
        Parameters<CustomerCheckoutQuotePort['createQuote']>
      >()
      .mockRejectedValueOnce(new CustomerCheckoutQuoteError('TRANSPORT', null, true))
      .mockResolvedValueOnce(QUOTE);
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        quoteClient={clientFrom(createQuote)}
      />,
    );

    expect(await view.findByText('You are offline')).toBeTruthy();
    fireEvent.press(await view.findByRole('button', { name: 'Try again' }));
    expect(await view.findByText('Synthetic Quote Shop')).toBeTruthy();
    expect(createQuote).toHaveBeenCalledTimes(2);
  });

  it('reports the accepted cart quote and address identifiers', async () => {
    const onQuoteAccepted = jest.fn();
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        onQuoteAccepted={onQuoteAccepted}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    expect(await view.findByText('Synthetic Quote Shop')).toBeTruthy();
    expect(onQuoteAccepted).toHaveBeenCalledWith({
      addressId: ADDRESS_ID,
      cartId: CART_ID,
      quoteId: QUOTE_ID,
    });
  });

  it('purges checkout when the quote address does not match the active route', async () => {
    const onSecurityFailure = jest.fn();
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        now={() => NOW}
        onSecurityFailure={onSecurityFailure}
        quoteClient={clientFrom(() =>
          Promise.resolve({
            ...QUOTE,
            address: {
              ...QUOTE.address,
              id: '21000000-0000-4000-8000-000000000001',
            },
          }),
        )}
      />,
    );

    expect(await view.findByText('We could not verify checkout totals. Please try again.')).toBeTruthy();
    expect(onSecurityFailure).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit COD confirmation before placement', async () => {
    const placeCodOrder = jest.fn(() => Promise.resolve(PLACED_ORDER));
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        idempotencyKey={IDEMPOTENCY_KEY}
        now={() => NOW}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    fireEvent.press(await view.findByRole('button', { name: 'Review COD order for ₹535.00' }));
    expect(await view.findByText('CONFIRM CASH ON DELIVERY')).toBeTruthy();
    expect(placeCodOrder).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('button', { name: 'Return to checkout review' }));
    expect(await view.findByRole('button', { name: 'Review COD order for ₹535.00' })).toBeTruthy();
  });

  it('places with server identifiers and navigates only after a confirmed order ID', async () => {
    const placeCodOrder = jest.fn(() => Promise.resolve(PLACED_ORDER));
    const onOrderConfirmed = jest.fn();
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        idempotencyKey={IDEMPOTENCY_KEY}
        now={() => NOW}
        onOrderConfirmed={onOrderConfirmed}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    await beginAndConfirm(view);

    expect(placeCodOrder).toHaveBeenCalledWith({
      cartId: CART_ID,
      quoteId: QUOTE_ID,
      addressId: ADDRESS_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    await waitFor(() => {
      expect(onOrderConfirmed).toHaveBeenCalledWith(ORDER_ID);
    });
  });

  it('ignores repeated confirmation taps while placement is in flight', async () => {
    let resolveOrder: ((order: PlacedCustomerCodOrder) => void) | undefined;
    const pending = new Promise<PlacedCustomerCodOrder>((resolve) => {
      resolveOrder = resolve;
    });
    const placeCodOrder = jest.fn(() => pending);
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        idempotencyKey={IDEMPOTENCY_KEY}
        now={() => NOW}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    fireEvent.press(await view.findByRole('button', { name: 'Review COD order for ₹535.00' }));
    const confirm = await view.findByRole('button', { name: 'Confirm COD order for ₹535.00' });
    fireEvent.press(confirm);
    fireEvent.press(confirm);

    expect(placeCodOrder).toHaveBeenCalledTimes(1);
    expect(
      await view.findByRole('button', {
        name: 'Order placement in progress. Checkout refresh unavailable',
      }),
    ).toBeDisabled();

    await act(async () => {
      resolveOrder?.(PLACED_ORDER);
      await pending;
    });
  });

  it('reconciles an uncertain result with the same idempotency key', async () => {
    const placeCodOrder = jest
      .fn<
        ReturnType<CustomerOrderPlacementPort['placeCodOrder']>,
        Parameters<CustomerOrderPlacementPort['placeCodOrder']>
      >()
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce({ ...PLACED_ORDER, replayed: true });
    const createIdempotencyKey = jest.fn(() => 'should-not-be-created');
    const onOrderConfirmed = jest.fn();
    const phases: string[] = [];
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        createIdempotencyKey={createIdempotencyKey}
        idempotencyKey={IDEMPOTENCY_KEY}
        now={() => NOW}
        onOrderConfirmed={onOrderConfirmed}
        onPlacementPhaseChange={(phase) => phases.push(phase)}
        orderClient={{ placeCodOrder }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    await beginAndConfirm(view);
    expect(await view.findByText('ORDER STATUS UNKNOWN')).toBeTruthy();
    fireEvent.press(
      await view.findByRole('button', { name: 'Reconcile uncertain COD order attempt' }),
    );

    await waitFor(() => {
      expect(onOrderConfirmed).toHaveBeenCalledWith(ORDER_ID);
    });
    expect(placeCodOrder).toHaveBeenCalledTimes(2);
    expect(placeCodOrder.mock.calls[0]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(placeCodOrder.mock.calls[1]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(createIdempotencyKey).not.toHaveBeenCalled();
    expect(phases).toEqual(
      expect.arrayContaining(['CONFIRMING', 'SUBMITTING', 'UNCERTAIN', 'RECONCILING', 'SUCCEEDED']),
    );
  });

  it('does not trust a success response belonging to another transaction', async () => {
    const onOrderConfirmed = jest.fn();
    const onSecurityFailure = jest.fn();
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        idempotencyKey={IDEMPOTENCY_KEY}
        now={() => NOW}
        onOrderConfirmed={onOrderConfirmed}
        onSecurityFailure={onSecurityFailure}
        orderClient={{
          placeCodOrder: () =>
            Promise.resolve({
              ...PLACED_ORDER,
              quoteId: '41000000-0000-4000-8000-000000000001',
            }),
        }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    await beginAndConfirm(view);

    expect(await view.findByText('ORDER NOT PLACED')).toBeTruthy();
    expect(onOrderConfirmed).not.toHaveBeenCalled();
    expect(onSecurityFailure).toHaveBeenCalledTimes(1);
  });

  it('purges sensitive checkout state after authorization denial', async () => {
    const onSecurityFailure = jest.fn();
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        idempotencyKey={IDEMPOTENCY_KEY}
        now={() => NOW}
        onSecurityFailure={onSecurityFailure}
        orderClient={{
          placeCodOrder: () => Promise.reject(new CustomerOrderError('FORBIDDEN', null, false)),
        }}
        quoteClient={clientFrom(() => Promise.resolve(QUOTE))}
      />,
    );

    await beginAndConfirm(view);

    expect(onSecurityFailure).toHaveBeenCalledTimes(1);
    expect(await view.findByText('This order is unavailable for the current account.')).toBeTruthy();
  });

  it('forces a fresh quote after a definitive stale-quote failure', async () => {
    const createQuote = jest.fn(() => Promise.resolve(QUOTE));
    const view = render(
      <CustomerCheckoutQuoteScreen
        addressId={ADDRESS_ID}
        idempotencyKey={IDEMPOTENCY_KEY}
        now={() => NOW}
        orderClient={{
          placeCodOrder: () =>
            Promise.reject(
              new CustomerOrderError('STALE_QUOTE', 'CHECKOUT_QUOTE_EXPIRED', false),
            ),
        }}
        quoteClient={clientFrom(createQuote)}
      />,
    );

    await beginAndConfirm(view);
    expect(await view.findByText('QUOTE MUST BE REFRESHED')).toBeTruthy();
    fireEvent.press(await view.findByRole('button', { name: 'Refresh checkout quote' }));

    await waitFor(() => {
      expect(createQuote).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps uncertain reconciliation available after the original quote expires', async () => {
    jest.useFakeTimers();
    let currentTime = NOW;
    const placeCodOrder = jest
      .fn<
        ReturnType<CustomerOrderPlacementPort['placeCodOrder']>,
        Parameters<CustomerOrderPlacementPort['placeCodOrder']>
      >()
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce({ ...PLACED_ORDER, replayed: true });

    try {
      const view = render(
        <CustomerCheckoutQuoteScreen
          addressId={ADDRESS_ID}
          idempotencyKey={IDEMPOTENCY_KEY}
          now={() => currentTime}
          orderClient={{ placeCodOrder }}
          quoteClient={clientFrom(() =>
            Promise.resolve({ ...QUOTE, expiresAt: new Date(NOW + 1_000).toISOString() }),
          )}
        />,
      );

      await beginAndConfirm(view);
      expect(await view.findByText('ORDER STATUS UNKNOWN')).toBeTruthy();
      currentTime = NOW + 1_001;
      act(() => {
        jest.advanceTimersByTime(1_001);
      });
      fireEvent.press(
        view.getByRole('button', { name: 'Reconcile uncertain COD order attempt' }),
      );

      await waitFor(() => {
        expect(placeCodOrder).toHaveBeenCalledTimes(2);
      });
      expect(placeCodOrder.mock.calls[0]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
      expect(placeCodOrder.mock.calls[1]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders explicit zero discounts from the selected server quote', async () => {
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
    expect(view.getByText('Synthetic Customer')).toBeTruthy();
    expect(view.getByText('Quote Street')).toBeTruthy();
    expect(view.getByText('Tirupati, Tirupati, Andhra Pradesh 517501')).toBeTruthy();
    expect(view.getByLabelText('Product discount ₹0.00')).toBeTruthy();
    expect(view.getByLabelText('Coupon discount ₹0.00')).toBeTruthy();
  });
});
