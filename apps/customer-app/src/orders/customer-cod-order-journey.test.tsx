import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { CustomerCheckoutQuoteScreen } from '../checkout/customer-checkout-quote.screen';
import type {
  CustomerCheckoutQuote,
  CustomerCheckoutQuotePort,
} from '../checkout/customer-checkout-quote.types';
import { CustomerOrderDetailScreen } from './customer-order-detail.screen';
import { CustomerOrderConfirmationRoute } from './default-customer-order-confirmation';

jest.mock('../api/use-customer-api-client', () => ({
  useCustomerApiClient: jest.fn(),
}));
jest.mock('./api-customer-order.adapter', () => ({
  ApiCustomerOrderAdapter: jest.fn(),
}));
import {
  CustomerOrderError,
  type CustomerOrderDetail,
  type CustomerOrderDetailPort,
  type CustomerOrderPlacementPort,
  type PlacedCustomerCodOrder,
} from './customer-order.types';

const NOW = Date.parse('2026-07-16T10:00:00.000Z');
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const CART_ID = '30000000-0000-4000-8000-000000000001';
const QUOTE_ID = '40000000-0000-4000-8000-000000000001';
const SHOP_ID = '50000000-0000-4000-8000-000000000001';
const ORDER_ITEM_ID = '60000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '70000000-0000-4000-8000-000000000001';
const VARIANT_ID = '80000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '90000000-0000-4000-8000-000000000001';
const ORDER_ID = '10000000-0000-4000-8000-000000000001';

const ADDRESS = {
  id: ADDRESS_ID,
  label: 'Home',
  recipientName: 'Synthetic Journey Customer',
  phoneNumber: '9000000001',
  line1: '10 Synthetic Journey Road',
  line2: null,
  landmark: null,
  area: 'Tirupati',
  city: 'Tirupati',
  state: 'Andhra Pradesh',
  postalCode: '517501',
  countryCode: 'IN',
  latitude: 13.6288,
  longitude: 79.4192,
} as const;

const TOTALS = {
  subtotalPaise: 30_000,
  productDiscountPaise: 2_000,
  couponDiscountPaise: 0,
  deliveryFeePaise: 4_000,
  platformFeePaise: 500,
  taxPaise: 0,
  totalPaise: 32_500,
} as const;

const QUOTE: CustomerCheckoutQuote = {
  id: QUOTE_ID,
  cartId: CART_ID,
  address: ADDRESS,
  shop: {
    id: SHOP_ID,
    name: 'Synthetic Journey Shop',
    slug: 'synthetic-journey-shop',
    minimumOrderPaise: 0,
    averagePreparationMinutes: 20,
    distanceMeters: 500,
    serviceRadiusMeters: 5000,
  },
  items: [
    {
      cartItemId: '60000000-0000-4000-8000-000000000099',
      variantId: VARIANT_ID,
      productId: PRODUCT_ID,
      productName: 'Synthetic Journey Kurta',
      sku: 'SYNTH-JOURNEY-M',
      colourName: 'Indigo',
      sizeLabel: 'M',
      quantity: 1,
      previousUnitPricePaise: 30_000,
      unitPricePaise: 28_000,
      priceChanged: true,
      availableQuantity: 1,
      inventoryVersion: 7,
      lineTotalPaise: 28_000,
    },
  ],
  totals: TOTALS,
  estimatedPreparationMinutes: 20,
  estimatedTravelMinutes: 15,
  estimatedDeliveryAt: '2026-07-16T10:35:00.000Z',
  expiresAt: '2026-07-16T10:05:00.000Z',
  createdAt: '2026-07-16T10:00:00.000Z',
};

const PLACED_ORDER: PlacedCustomerCodOrder = {
  id: ORDER_ID,
  orderNumber: 'VAS-SYNTH-JOURNEY-0001',
  cartId: CART_ID,
  quoteId: QUOTE_ID,
  shop: { id: SHOP_ID, name: QUOTE.shop.name, slug: QUOTE.shop.slug },
  address: ADDRESS,
  status: 'WAITING_FOR_MERCHANT',
  paymentStatus: 'COD_PENDING',
  paymentMethod: 'COD',
  fulfilmentType: 'DELIVERY',
  items: [
    {
      id: ORDER_ITEM_ID,
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      productName: 'Synthetic Journey Kurta',
      sku: 'SYNTH-JOURNEY-M',
      colourName: 'Indigo',
      sizeLabel: 'M',
      imageObjectKey: null,
      quantity: 1,
      unitMrpPaise: 30_000,
      unitSellingPricePaise: 28_000,
      discountPaise: 2_000,
      totalPaise: 28_000,
    },
  ],
  totals: TOTALS,
  estimatedDeliveryAt: QUOTE.estimatedDeliveryAt,
  customerNote: null,
  placedAt: '2026-07-16T10:01:00.000Z',
  replayed: true,
};

const READY_ORDER: CustomerOrderDetail = {
  id: ORDER_ID,
  orderNumber: PLACED_ORDER.orderNumber,
  cartId: CART_ID,
  quoteId: QUOTE_ID,
  shop: PLACED_ORDER.shop,
  address: ADDRESS,
  status: 'READY_FOR_PICKUP',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  items: PLACED_ORDER.items,
  itemCount: 1,
  totals: TOTALS,
  estimatedDeliveryAt: null,
  customerNote: null,
  history: [
    { id: '1', status: 'PAYMENT_PENDING', createdAt: '2026-07-16T10:01:00.000Z' },
    { id: '2', status: 'WAITING_FOR_MERCHANT', createdAt: '2026-07-16T10:01:01.000Z' },
    { id: '3', status: 'MERCHANT_ACCEPTED', createdAt: '2026-07-16T10:05:00.000Z' },
    { id: '4', status: 'PACKING', createdAt: '2026-07-16T10:10:00.000Z' },
    { id: '5', status: 'READY_FOR_PICKUP', createdAt: '2026-07-16T10:20:00.000Z' },
  ],
  placedAt: '2026-07-16T10:01:00.000Z',
  acceptedAt: '2026-07-16T10:05:00.000Z',
  readyAt: '2026-07-16T10:20:00.000Z',
  pickedUpAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: '2026-07-16T10:01:00.000Z',
  updatedAt: '2026-07-16T10:20:00.000Z',
};

function CustomerCodJourney({
  quoteClient,
  placementClient,
  confirmationClient,
  detailClient,
}: {
  readonly quoteClient: CustomerCheckoutQuotePort;
  readonly placementClient: CustomerOrderPlacementPort;
  readonly confirmationClient: CustomerOrderDetailPort;
  readonly detailClient: CustomerOrderDetailPort;
}) {
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (selectedOrderId !== null) {
    return <CustomerOrderDetailScreen orderClient={detailClient} orderId={selectedOrderId} />;
  }
  if (confirmedOrderId !== null) {
    return (
      <CustomerOrderConfirmationRoute
        expectedAddressId={ADDRESS_ID}
        expectedCartId={CART_ID}
        expectedQuoteId={QUOTE_ID}
        onContinueShopping={() => {
          setConfirmedOrderId(null);
        }}
        onSecurityFailure={() => {
          setConfirmedOrderId(null);
        }}
        onViewOrder={setSelectedOrderId}
        onViewOrders={() => {
          setConfirmedOrderId(null);
        }}
        orderClient={confirmationClient}
        orderId={confirmedOrderId}
      />
    );
  }
  return (
    <CustomerCheckoutQuoteScreen
      addressId={ADDRESS_ID}
      idempotencyKey={IDEMPOTENCY_KEY}
      now={() => NOW}
      onOrderConfirmed={setConfirmedOrderId}
      orderClient={placementClient}
      quoteClient={quoteClient}
    />
  );
}

describe('customer COD order journey', () => {
  it('reconciles one attempt, confirms via GET, and opens authoritative order detail', async () => {
    const placeCodOrder = jest
      .fn<
        ReturnType<CustomerOrderPlacementPort['placeCodOrder']>,
        Parameters<CustomerOrderPlacementPort['placeCodOrder']>
      >()
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce(PLACED_ORDER);
    const confirmationGetOrder = jest.fn(() => Promise.resolve(READY_ORDER));
    const detailGetOrder = jest.fn(() => Promise.resolve(READY_ORDER));
    const view = render(
      <CustomerCodJourney
        confirmationClient={{ getOrder: confirmationGetOrder }}
        detailClient={{ getOrder: detailGetOrder }}
        placementClient={{ placeCodOrder }}
        quoteClient={{ createQuote: () => Promise.resolve(QUOTE) }}
      />,
    );

    fireEvent.press(
      await view.findByRole('button', { name: 'Review COD order for ₹325.00' }, { timeout: 5_000 }),
    );
    fireEvent.press(await view.findByRole('button', { name: 'Confirm COD order for ₹325.00' }));
    expect(await view.findByText('ORDER STATUS UNKNOWN')).toBeTruthy();
    fireEvent.press(
      await view.findByRole('button', { name: 'Reconcile uncertain COD order attempt' }),
    );

    expect(await view.findByLabelText('Order number VAS-SYNTH-JOURNEY-0001')).toBeTruthy();
    expect(view.getByText('Synthetic Journey Shop')).toBeTruthy();
    expect(view.getByText('Synthetic Journey Kurta')).toBeTruthy();
    expect(view.getByLabelText('COD total ₹325.00')).toBeTruthy();
    expect(placeCodOrder).toHaveBeenCalledTimes(2);
    expect(placeCodOrder.mock.calls[0]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(placeCodOrder.mock.calls[1]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(confirmationGetOrder).toHaveBeenCalledWith(ORDER_ID);

    fireEvent.press(await view.findByRole('button', { name: 'View order VAS-SYNTH-JOURNEY-0001' }));

    expect(
      await view.findByLabelText(
        'Current order status Ready for pickup. Your parcel is packed and ready for a delivery partner.',
      ),
    ).toBeTruthy();
    expect(
      view.getByLabelText('Order update Confirming payment at 2026-07-16T10:01:00.000Z'),
    ).toBeTruthy();
    expect(
      view.getByLabelText('Order update Waiting for shop at 2026-07-16T10:01:01.000Z'),
    ).toBeTruthy();
    expect(
      view.getByLabelText('Order update Order accepted at 2026-07-16T10:05:00.000Z'),
    ).toBeTruthy();
    expect(
      view.getByLabelText('Order update Being packed at 2026-07-16T10:10:00.000Z'),
    ).toBeTruthy();
    expect(
      view.getByLabelText('Order update Ready for pickup at 2026-07-16T10:20:00.000Z'),
    ).toBeTruthy();
    await waitFor(() => {
      expect(detailGetOrder).toHaveBeenCalledWith(ORDER_ID);
    });
  });
});
