import { fireEvent, render } from '@testing-library/react-native';

import { CustomerOrderConfirmationScreen } from './customer-order-confirmation.screen';
import type { CustomerOrderDetail } from './customer-order.types';

const ORDER: CustomerOrderDetail = {
  id: '10000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-SYNTH-0001',
  cartId: '30000000-0000-4000-8000-000000000001',
  quoteId: '40000000-0000-4000-8000-000000000001',
  shop: {
    id: '50000000-0000-4000-8000-000000000001',
    name: 'Synthetic Snapshot Shop',
    slug: 'synthetic-snapshot-shop',
  },
  address: {
    id: '20000000-0000-4000-8000-000000000001',
    label: 'Home',
    recipientName: 'Synthetic Customer',
    phoneNumber: '9000000001',
    line1: '10 Immutable Street',
    line2: 'Second floor',
    landmark: null,
    area: 'Tirupati',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517501',
    countryCode: 'IN',
    latitude: 13.6288,
    longitude: 79.4192,
  },
  status: 'WAITING_FOR_MERCHANT',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  items: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      productId: '70000000-0000-4000-8000-000000000001',
      variantId: '80000000-0000-4000-8000-000000000001',
      productName: 'Synthetic Kurta',
      sku: 'SYNTH-KURTA-M',
      colourName: 'Indigo',
      sizeLabel: 'M',
      imageObjectKey: null,
      quantity: 2,
      unitMrpPaise: 26_000,
      unitSellingPricePaise: 25_000,
      discountPaise: 2_000,
      totalPaise: 50_000,
    },
  ],
  itemCount: 2,
  totals: {
    subtotalPaise: 52_000,
    productDiscountPaise: 2_000,
    couponDiscountPaise: 1_000,
    deliveryFeePaise: 4_000,
    platformFeePaise: 500,
    taxPaise: 0,
    totalPaise: 53_500,
  },
  estimatedDeliveryAt: '2026-07-16T10:35:00.000Z',
  customerNote: null,
  history: [],
  placedAt: '2026-07-16T10:01:00.000Z',
  acceptedAt: null,
  readyAt: null,
  pickedUpAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: '2026-07-16T10:01:00.000Z',
  updatedAt: '2026-07-16T10:01:00.000Z',
};

describe('CustomerOrderConfirmationScreen', () => {
  it('renders an authoritative order read and customer-safe status copy', () => {
    const view = render(
      <CustomerOrderConfirmationScreen
        onContinueShopping={() => undefined}
        onViewOrder={() => undefined}
        onViewOrders={() => undefined}
        order={ORDER}
      />,
    );

    expect(view.getByLabelText('Order number VAS-SYNTH-0001')).toBeTruthy();
    expect(
      view.getByLabelText(
        'Current order status Waiting for shop. The shop is reviewing your order.',
      ),
    ).toBeTruthy();
    expect(view.queryByText('WAITING_FOR_MERCHANT')).toBeNull();
    expect(view.getByText('Synthetic Snapshot Shop')).toBeTruthy();
    expect(view.getByText('Synthetic Kurta')).toBeTruthy();
    expect(view.getByText('Indigo · M · SYNTH-KURTA-M')).toBeTruthy();
    expect(view.getByText('Synthetic Customer')).toBeTruthy();
    expect(view.getByText('10 Immutable Street')).toBeTruthy();
    expect(view.getByLabelText('COD total ₹535.00')).toBeTruthy();
    expect(view.getByText('Payment: Cash on Delivery')).toBeTruthy();
    expect(view.queryByText(/arrive|delivery by|guaranteed/iu)).toBeNull();
  });

  it('invokes canonical detail, orders and shopping actions', () => {
    const onViewOrder = jest.fn();
    const onViewOrders = jest.fn();
    const onContinueShopping = jest.fn();
    const view = render(
      <CustomerOrderConfirmationScreen
        onContinueShopping={onContinueShopping}
        onViewOrder={onViewOrder}
        onViewOrders={onViewOrders}
        order={ORDER}
      />,
    );

    fireEvent.press(view.getByRole('button', { name: 'View order VAS-SYNTH-0001' }));
    fireEvent.press(view.getByRole('button', { name: 'Open My Orders' }));
    fireEvent.press(view.getByRole('button', { name: 'Continue shopping' }));

    expect(onViewOrder).toHaveBeenCalledWith(ORDER.id);
    expect(onViewOrders).toHaveBeenCalledTimes(1);
    expect(onContinueShopping).toHaveBeenCalledTimes(1);
  });
});
