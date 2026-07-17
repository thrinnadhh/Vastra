import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { CustomerCheckoutQuoteScreen } from '../checkout/customer-checkout-quote.screen';
import type {
  CustomerCheckoutQuote,
  CustomerCheckoutQuotePort,
} from '../checkout/customer-checkout-quote.types';
import { CustomerOrderConfirmationScreen } from './customer-order-confirmation.screen';
import { CustomerOrderDetailScreen } from './customer-order-detail.screen';
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
  recipientName: 'Journey Customer',
  phoneNumber: '9000000001',
  line1: '10 Journey Road',
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
    name: 'Journey Shop',
    slug: 'journey-shop',
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
      productName: 'Journey Kurta',
      sku: 'JOURNEY-M',
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
  orderNumber: 'VAS-JOURNEY-0001',
  cartId: CART_ID,
  quoteId: QUOTE_ID,
  shop: { id: SHOP_ID, name: 'Journey Shop', slug: 'journey-shop' },
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
      productName: 'Journey Kurta',
      sku: 'JOURNEY-M',
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
  estimatedDeliveryAt: '2026-07-16T10:35:00.000Z',
  customerNote: null,
  placedAt: '2026-07-16T10:01:00.000Z',
  replayed: true,
};

const READY_ORDER: CustomerOrderDetail = {
  id: ORDER_ID,
  orderNumber: 'VAS-JOURNEY-0001',
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
  cancellationReasonCode: null,
  cancellationNote: null,
  history: [
    {
      id: '1',
      previousStatus: null,
      newStatus: 'PAYMENT_PENDING',
      changedByRole: 'SYSTEM',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-16T10:01:00.000Z',
    },
    {
      id: '2',
      previousStatus: 'PAYMENT_PENDING',
      newStatus: 'WAITING_FOR_MERCHANT',
      changedByRole: 'SYSTEM',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-16T10:01:01.000Z',
    },
    {
      id: '3',
      previousStatus: 'WAITING_FOR_MERCHANT',
      newStatus: 'MERCHANT_ACCEPTED',
      changedByRole: 'MERCHANT',
      reasonCode: null,
      note: 'Preparation time: 20 minutes',
      createdAt: '2026-07-16T10:05:00.000Z',
    },
    {
      id: '4',
      previousStatus: 'MERCHANT_ACCEPTED',
      newStatus: 'PACKING',
      changedByRole: 'MERCHANT',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-16T10:10:00.000Z',
    },
    {
      id: '5',
      previousStatus: 'PACKING',
      newStatus: 'READY_FOR_PICKUP',
      changedByRole: 'MERCHANT',
      reasonCode: null,
      note: 'Every ordered item was verified',
      createdAt: '2026-07-16T10:20:00.000Z',
    },
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
  detailClient,
}: {
  readonly quoteClient: CustomerCheckoutQuotePort;
  readonly placementClient: CustomerOrderPlacementPort;
  readonly detailClient: CustomerOrderDetailPort;
}) {
  const [placedOrder, setPlacedOrder] = useState<PlacedCustomerCodOrder | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (selectedOrderId !== null) {
    return <CustomerOrderDetailScreen orderClient={detailClient} orderId={selectedOrderId} />;
  }
  if (placedOrder !== null) {
    return (
      <CustomerOrderConfirmationScreen
        onContinueShopping={() => {
          setPlacedOrder(null);
        }}
        onViewOrder={setSelectedOrderId}
        order={placedOrder}
      />
    );
  }
  return (
    <CustomerCheckoutQuoteScreen
      addressId={ADDRESS_ID}
      createIdempotencyKey={() => IDEMPOTENCY_KEY}
      now={() => NOW}
      onOrderPlaced={setPlacedOrder}
      orderClient={placementClient}
      quoteClient={quoteClient}
    />
  );
}

describe('customer COD order journey', () => {
  it('retries an unknown result with the same key, confirms the backend order, and renders its complete history', async () => {
    const placeCodOrder = jest
      .fn<
        ReturnType<CustomerOrderPlacementPort['placeCodOrder']>,
        Parameters<CustomerOrderPlacementPort['placeCodOrder']>
      >()
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce(PLACED_ORDER);
    const getOrder = jest.fn(() => Promise.resolve(READY_ORDER));
    const { findByLabelText, findByRole, findByText, getByLabelText, getByText } = render(
      <CustomerCodJourney
        detailClient={{ getOrder }}
        placementClient={{ placeCodOrder }}
        quoteClient={{ createQuote: () => Promise.resolve(QUOTE) }}
      />,
    );

    fireEvent.press(await findByRole('button', { name: 'Place COD order for ₹325.00' }));
    expect(await findByText('ORDER NOT PLACED')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'Retry same COD order attempt' }));

    expect(await findByLabelText('Order number VAS-JOURNEY-0001')).toBeTruthy();
    expect(getByText('Journey Shop')).toBeTruthy();
    expect(getByText('Journey Kurta')).toBeTruthy();
    expect(getByLabelText('COD total ₹325.00')).toBeTruthy();
    expect(placeCodOrder).toHaveBeenCalledTimes(2);
    expect(placeCodOrder.mock.calls[0]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(placeCodOrder.mock.calls[1]?.[0].idempotencyKey).toBe(IDEMPOTENCY_KEY);

    fireEvent.press(await findByRole('button', { name: 'View order VAS-JOURNEY-0001' }));

    expect(await findByLabelText('Current order status READY_FOR_PICKUP')).toBeTruthy();
    expect(getByLabelText('History PAYMENT_PENDING at 2026-07-16T10:01:00.000Z')).toBeTruthy();
    expect(getByLabelText('History WAITING_FOR_MERCHANT at 2026-07-16T10:01:01.000Z')).toBeTruthy();
    expect(getByLabelText('History MERCHANT_ACCEPTED at 2026-07-16T10:05:00.000Z')).toBeTruthy();
    expect(getByLabelText('History PACKING at 2026-07-16T10:10:00.000Z')).toBeTruthy();
    expect(getByLabelText('History READY_FOR_PICKUP at 2026-07-16T10:20:00.000Z')).toBeTruthy();
    expect(getOrder).toHaveBeenCalledWith(ORDER_ID);
    await waitFor(() => {
      expect(getOrder).toHaveBeenCalledTimes(1);
    });
  });
});
