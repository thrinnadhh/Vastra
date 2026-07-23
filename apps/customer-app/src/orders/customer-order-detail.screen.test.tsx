import { fireEvent, render } from '@testing-library/react-native';

import { CustomerOrderDetailScreen } from './customer-order-detail.screen';
import {
  CustomerOrderError,
  type CustomerOrderDetail,
  type CustomerOrderDetailPort,
} from './customer-order.types';

const ORDER: CustomerOrderDetail = {
  id: '10000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-DETAIL',
  cartId: '30000000-0000-4000-8000-000000000001',
  quoteId: '40000000-0000-4000-8000-000000000001',
  shop: { id: '50000000-0000-4000-8000-000000000001', name: 'Detail Shop', slug: 'detail' },
  address: {
    id: '20000000-0000-4000-8000-000000000001',
    label: 'Home',
    recipientName: 'Detail Customer',
    phoneNumber: '9000000001',
    line1: '10 Snapshot Road',
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
  status: 'READY_FOR_PICKUP',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  items: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      productId: '70000000-0000-4000-8000-000000000001',
      variantId: '80000000-0000-4000-8000-000000000001',
      productName: 'Detail Kurta',
      sku: 'DETAIL-M',
      colourName: 'Green',
      sizeLabel: 'M',
      imageObjectKey: null,
      quantity: 1,
      unitMrpPaise: 30_000,
      unitSellingPricePaise: 28_000,
      discountPaise: 2_000,
      totalPaise: 28_000,
    },
  ],
  itemCount: 1,
  totals: {
    subtotalPaise: 30_000,
    productDiscountPaise: 2_000,
    couponDiscountPaise: 0,
    deliveryFeePaise: 4_000,
    platformFeePaise: 500,
    taxPaise: 0,
    totalPaise: 32_500,
  },
  estimatedDeliveryAt: null,
  customerNote: null,
  history: [
    {
      id: '1',
      status: 'WAITING_FOR_MERCHANT',
      createdAt: '2026-07-16T10:01:00.000Z',
    },
    {
      id: '4',
      status: 'READY_FOR_PICKUP',
      createdAt: '2026-07-16T10:30:00.000Z',
    },
  ],
  placedAt: '2026-07-16T10:01:00.000Z',
  acceptedAt: '2026-07-16T10:05:00.000Z',
  readyAt: '2026-07-16T10:30:00.000Z',
  pickedUpAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: '2026-07-16T10:01:00.000Z',
  updatedAt: '2026-07-16T10:30:00.000Z',
};

function clientFrom(getOrder: CustomerOrderDetailPort['getOrder']): CustomerOrderDetailPort {
  return { getOrder };
}

describe('CustomerOrderDetailScreen', () => {
  it('renders immutable snapshots and only the history returned by the backend', async () => {
    const { findByLabelText, findByText, getByLabelText, getByText, queryByText } = render(
      <CustomerOrderDetailScreen
        orderClient={clientFrom(() => Promise.resolve(ORDER))}
        orderId={ORDER.id}
      />,
    );

    expect(await findByText('VAS-DETAIL')).toBeTruthy();
    expect(getByText('Detail Shop')).toBeTruthy();
    expect(getByText('Detail Kurta')).toBeTruthy();
    expect(getByText('Green · M · DETAIL-M')).toBeTruthy();
    expect(getByText('Detail Customer')).toBeTruthy();
    expect(getByText('10 Snapshot Road')).toBeTruthy();
    expect(getByLabelText('Order total ₹325.00')).toBeTruthy();
    expect(
      getByLabelText(
        'Current order status Ready for pickup. Your parcel is packed and ready for a delivery partner.',
      ),
    ).toBeTruthy();
    expect(
      await findByLabelText('Order update Waiting for shop at 2026-07-16T10:01:00.000Z'),
    ).toBeTruthy();
    expect(
      getByLabelText('Order update Ready for pickup at 2026-07-16T10:30:00.000Z'),
    ).toBeTruthy();
    expect(queryByText('MERCHANT ACCEPTED')).toBeNull();
  });

  it('keeps stale detail visible after an offline refresh and recovers', async () => {
    const getOrder = jest
      .fn()
      .mockResolvedValueOnce(ORDER)
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce({ ...ORDER, status: 'CAPTAIN_SEARCHING' });
    const { findByLabelText, findByText } = render(
      <CustomerOrderDetailScreen orderClient={{ getOrder }} orderId={ORDER.id} />,
    );

    await findByText('VAS-DETAIL');
    fireEvent.press(await findByLabelText('Refresh order details'));
    expect(await findByText('STALE DATA')).toBeTruthy();
    expect(await findByText('Detail Shop')).toBeTruthy();
    fireEvent.press(await findByLabelText('Refresh order details'));
    expect(
      await findByLabelText(
        'Current order status Finding a delivery partner. We are matching a delivery partner to your order.',
      ),
    ).toBeTruthy();
  });

  it('removes cached address and order data after session expiry', async () => {
    const getOrder = jest
      .fn()
      .mockResolvedValueOnce(ORDER)
      .mockRejectedValueOnce(new CustomerOrderError('AUTHENTICATION', null, false));
    const view = render(
      <CustomerOrderDetailScreen orderClient={{ getOrder }} orderId={ORDER.id} />,
    );

    expect(await view.findByText('Detail Customer')).toBeTruthy();
    fireEvent.press(await view.findByLabelText('Refresh order details'));
    expect(
      await view.findByText(
        'Your session is no longer available. Sign in again to view this order.',
      ),
    ).toBeTruthy();
    expect(view.queryByText('Detail Customer')).toBeNull();
    expect(view.queryByText('10 Snapshot Road')).toBeNull();
    expect(view.queryByText('Detail Shop')).toBeNull();
    expect(view.queryByText('STALE DATA')).toBeNull();
  });

  it('lets routed detail screens return to their parent order view', async () => {
    const onBack = jest.fn();
    const { findByLabelText } = render(
      <CustomerOrderDetailScreen
        onBack={onBack}
        orderClient={clientFrom(() => Promise.resolve(ORDER))}
        orderId={ORDER.id}
      />,
    );

    fireEvent.press(await findByLabelText('Back from customer order details'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows a safe denial state for a cross-customer order id', async () => {
    const { findByRole, findByText, queryByText } = render(
      <CustomerOrderDetailScreen
        orderClient={clientFrom(() =>
          Promise.reject(new CustomerOrderError('FORBIDDEN', 'FORBIDDEN', false)),
        )}
        orderId={ORDER.id}
      />,
    );

    expect(
      await findByText('This order is unavailable or does not belong to this account.'),
    ).toBeTruthy();
    expect(await findByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(queryByText('Detail Customer')).toBeNull();
    expect(queryByText('Detail Shop')).toBeNull();
  });
});
