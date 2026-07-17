import { fireEvent, render } from '@testing-library/react-native';

import { CustomerOrderConfirmationScreen } from './customer-order-confirmation.screen';
import type { PlacedCustomerCodOrder } from './customer-order.types';

const ORDER: PlacedCustomerCodOrder = {
  id: '10000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-20260716-0001',
  cartId: '30000000-0000-4000-8000-000000000001',
  quoteId: '40000000-0000-4000-8000-000000000001',
  shop: {
    id: '50000000-0000-4000-8000-000000000001',
    name: 'Snapshot Shop',
    slug: 'snapshot-shop',
  },
  address: {
    id: '20000000-0000-4000-8000-000000000001',
    label: 'Home',
    recipientName: 'Snapshot Customer',
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
  paymentMethod: 'COD',
  fulfilmentType: 'DELIVERY',
  items: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      productId: '70000000-0000-4000-8000-000000000001',
      variantId: '80000000-0000-4000-8000-000000000001',
      productName: 'Snapshot Kurta',
      sku: 'SNAP-KURTA-M',
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
  placedAt: '2026-07-16T10:01:00.000Z',
  replayed: false,
};

describe('CustomerOrderConfirmationScreen', () => {
  it('renders only authoritative order snapshots and no delivery promise', () => {
    const { getByLabelText, getByText, queryByText } = render(
      <CustomerOrderConfirmationScreen
        onContinueShopping={() => undefined}
        onViewOrder={() => undefined}
        order={ORDER}
      />,
    );

    expect(getByLabelText('Order number VAS-20260716-0001')).toBeTruthy();
    expect(getByLabelText('Current order status WAITING_FOR_MERCHANT')).toBeTruthy();
    expect(getByText('Snapshot Shop')).toBeTruthy();
    expect(getByText('Snapshot Kurta')).toBeTruthy();
    expect(getByText('Indigo · M · SNAP-KURTA-M')).toBeTruthy();
    expect(getByText('Snapshot Customer')).toBeTruthy();
    expect(getByText('10 Immutable Street')).toBeTruthy();
    expect(getByLabelText('COD total ₹535.00')).toBeTruthy();
    expect(getByText('Payment: Cash on Delivery')).toBeTruthy();
    expect(queryByText(/arrive|delivery by|guaranteed/iu)).toBeNull();
  });

  it('invokes both navigation actions with the authoritative order id', () => {
    const onViewOrder = jest.fn();
    const onContinueShopping = jest.fn();
    const { getByRole } = render(
      <CustomerOrderConfirmationScreen
        onContinueShopping={onContinueShopping}
        onViewOrder={onViewOrder}
        order={ORDER}
      />,
    );

    fireEvent.press(getByRole('button', { name: 'View order VAS-20260716-0001' }));
    fireEvent.press(getByRole('button', { name: 'Continue shopping' }));

    expect(onViewOrder).toHaveBeenCalledWith(ORDER.id);
    expect(onContinueShopping).toHaveBeenCalledTimes(1);
  });
});
