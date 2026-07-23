import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { CustomerOrderError, type CustomerOrderSummary } from './customer-order.types';
import { CustomerOrdersScreen } from './customer-orders.screen';

const ACTIVE_ORDER: CustomerOrderSummary = {
  id: '10000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-ACTIVE',
  shop: { id: '50000000-0000-4000-8000-000000000001', name: 'Active Shop', slug: 'active' },
  status: 'PACKING',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  itemCount: 2,
  previewImageObjectKey: null,
  totals: {
    subtotalPaise: 50_000,
    productDiscountPaise: 0,
    couponDiscountPaise: 0,
    deliveryFeePaise: 4_000,
    platformFeePaise: 500,
    taxPaise: 0,
    totalPaise: 54_500,
  },
  estimatedDeliveryAt: null,
  placedAt: '2026-07-16T10:01:00.000Z',
  createdAt: '2026-07-16T10:01:00.000Z',
};

const PAST_ORDER: CustomerOrderSummary = {
  ...ACTIVE_ORDER,
  id: '10000000-0000-4000-8000-000000000002',
  orderNumber: 'VAS-PAST',
  shop: { ...ACTIVE_ORDER.shop, name: 'Past Shop' },
  status: 'CANCELLED',
  itemCount: 1,
};

describe('CustomerOrdersScreen', () => {
  it('groups backend statuses into active and past, renders summaries, and opens an order', async () => {
    const onSelectOrder = jest.fn();
    const { findByLabelText, findByText, getAllByLabelText, getByLabelText, getByText } = render(
      <CustomerOrdersScreen
        onSelectOrder={onSelectOrder}
        ordersClient={{
          listOrders: () =>
            Promise.resolve({ orders: [ACTIVE_ORDER, PAST_ORDER], nextCursor: null }),
        }}
      />,
    );

    expect(await findByText('My orders')).toBeTruthy();
    expect(getByText('Active')).toBeTruthy();
    expect(getByText('Past')).toBeTruthy();
    expect(getByText('Active Shop')).toBeTruthy();
    expect(getByText('Past Shop')).toBeTruthy();
    expect(getByLabelText('Order status Being packed')).toBeTruthy();
    expect(getAllByLabelText('Order total ₹545.00')).toHaveLength(2);

    fireEvent.press(await findByLabelText('Open order VAS-ACTIVE'));
    expect(onSelectOrder).toHaveBeenCalledWith(ACTIVE_ORDER.id);
  });

  it('shows loading then the empty state', async () => {
    let resolvePage:
      ((page: { orders: readonly CustomerOrderSummary[]; nextCursor: null }) => void) | undefined;
    const pending = new Promise<{
      orders: readonly CustomerOrderSummary[];
      nextCursor: null;
    }>((resolve) => {
      resolvePage = resolve;
    });
    const { findByText, getByLabelText } = render(
      <CustomerOrdersScreen
        onSelectOrder={() => undefined}
        ordersClient={{ listOrders: () => pending }}
      />,
    );

    expect(getByLabelText('Loading your orders')).toBeTruthy();
    await act(async () => {
      resolvePage?.({ orders: [], nextCursor: null });
      await pending;
    });
    expect(await findByText('No orders yet')).toBeTruthy();
  });

  it('paginates without duplicating an overlapping order', async () => {
    const nextOrder = {
      ...ACTIVE_ORDER,
      id: '10000000-0000-4000-8000-000000000003',
      orderNumber: 'VAS-NEXT',
    };
    const listOrders = jest
      .fn()
      .mockResolvedValueOnce({ orders: [ACTIVE_ORDER], nextCursor: 'next-page' })
      .mockResolvedValueOnce({ orders: [ACTIVE_ORDER, nextOrder], nextCursor: null });
    const { findByLabelText, findByText, getAllByText } = render(
      <CustomerOrdersScreen onSelectOrder={() => undefined} ordersClient={{ listOrders }} />,
    );

    fireEvent.press(await findByLabelText('Load more orders'));
    expect(await findByText('VAS-NEXT')).toBeTruthy();
    expect(getAllByText('VAS-ACTIVE')).toHaveLength(1);
    expect(listOrders).toHaveBeenLastCalledWith({ cursor: 'next-page', limit: 20 });
  });

  it('keeps stale orders visible when refresh fails offline and can recover', async () => {
    const listOrders = jest
      .fn()
      .mockResolvedValueOnce({ orders: [ACTIVE_ORDER], nextCursor: null })
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce({ orders: [ACTIVE_ORDER], nextCursor: null });
    const { findByLabelText, findByText } = render(
      <CustomerOrdersScreen onSelectOrder={() => undefined} ordersClient={{ listOrders }} />,
    );

    await findByText('Active Shop');
    fireEvent.press(await findByLabelText('Refresh my orders'));
    expect(await findByText('STALE DATA')).toBeTruthy();
    expect(await findByText('Active Shop')).toBeTruthy();
    fireEvent.press(await findByLabelText('Refresh my orders'));

    await waitFor(() => {
      expect(listOrders).toHaveBeenCalledTimes(3);
    });
  });

  it('removes cached orders after session expiry instead of marking them stale', async () => {
    const listOrders = jest
      .fn()
      .mockResolvedValueOnce({ orders: [ACTIVE_ORDER], nextCursor: null })
      .mockRejectedValueOnce(new CustomerOrderError('AUTHENTICATION', null, false));
    const view = render(
      <CustomerOrdersScreen onSelectOrder={() => undefined} ordersClient={{ listOrders }} />,
    );

    expect(await view.findByText('Active Shop')).toBeTruthy();
    fireEvent.press(await view.findByLabelText('Refresh my orders'));
    expect(
      await view.findByText(
        'Your session is no longer available. Sign in again to view your orders.',
      ),
    ).toBeTruthy();
    expect(view.queryByText('Active Shop')).toBeNull();
    expect(view.queryByText('STALE DATA')).toBeNull();
  });

  it('shows an offline retry state when no cached orders are available', async () => {
    const listOrders = jest
      .fn()
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce({ orders: [ACTIVE_ORDER], nextCursor: null });
    const { findByRole, findByText } = render(
      <CustomerOrdersScreen onSelectOrder={() => undefined} ordersClient={{ listOrders }} />,
    );

    expect(await findByText('You are offline')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'Try again' }));
    expect(await findByText('Active Shop')).toBeTruthy();
  });
});
