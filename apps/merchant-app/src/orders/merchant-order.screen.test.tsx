import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { MerchantOrderQueueScreen } from './merchant-order.screen';
import {
  MerchantOrderError,
  groupMerchantOrderStatus,
  type MerchantOrderDetail,
  type MerchantOrderReadPort,
  type MerchantOrderStatus,
  type MerchantOrderSummary,
} from './merchant-order.types';

const totals = {
  subtotalPaise: 10000,
  productDiscountPaise: 0,
  couponDiscountPaise: 0,
  deliveryFeePaise: 0,
  platformFeePaise: 0,
  taxPaise: 0,
  totalPaise: 10000,
};

function summary(status: MerchantOrderStatus, index = 1): MerchantOrderSummary {
  return {
    id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    orderNumber: `VAS-${String(index)}`,
    shop: { id: '20000000-0000-4000-8000-000000000001', name: 'Shop', slug: 'shop' },
    customerName: 'Asha',
    status,
    paymentStatus: 'COD_PENDING',
    fulfilmentType: 'DELIVERY',
    itemCount: 1,
    previewImageObjectKey: null,
    totals,
    alert: null,
    estimatedDeliveryAt: null,
    placedAt: '2026-07-17T01:00:00.000Z',
    createdAt: '2026-07-17T01:00:00.000Z',
  };
}

function detail(status: MerchantOrderStatus = 'WAITING_FOR_MERCHANT'): MerchantOrderDetail {
  const base = summary(status);
  return {
    id: base.id,
    orderNumber: base.orderNumber,
    shop: base.shop,
    status: base.status,
    paymentStatus: base.paymentStatus,
    fulfilmentType: base.fulfilmentType,
    itemCount: base.itemCount,
    previewImageObjectKey: base.previewImageObjectKey,
    totals: base.totals,
    alert: base.alert,
    estimatedDeliveryAt: base.estimatedDeliveryAt,
    placedAt: base.placedAt,
    createdAt: base.createdAt,
    cartId: null,
    quoteId: null,
    address: {
      id: '30000000-0000-4000-8000-000000000001',
      label: 'Home',
      recipientName: 'Asha',
      phoneNumber: '9000000000',
      line1: 'Temple Road',
      line2: null,
      landmark: null,
      area: 'Tirupati',
      city: 'Tirupati',
      state: 'AP',
      postalCode: '517501',
      countryCode: 'IN',
      latitude: 13,
      longitude: 79,
    },
    items: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        productId: '50000000-0000-4000-8000-000000000001',
        variantId: '60000000-0000-4000-8000-000000000001',
        productName: 'Kurta',
        sku: 'K-M',
        colourName: 'Blue',
        sizeLabel: 'M',
        imageObjectKey: null,
        quantity: 1,
        unitMrpPaise: 10000,
        unitSellingPricePaise: 10000,
        discountPaise: 0,
        totalPaise: 10000,
      },
    ],
    customerNote: null,
    cancellationReasonCode: null,
    cancellationNote: null,
    history: [
      {
        id: '1',
        previousStatus: null,
        newStatus: 'WAITING_FOR_MERCHANT',
        changedByRole: 'SYSTEM',
        reasonCode: null,
        note: null,
        createdAt: '2026-07-17T01:00:00.000Z',
      },
    ],
    acceptedAt: null,
    readyAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    updatedAt: '2026-07-17T01:00:00.000Z',
  };
}

function port(
  orders: readonly MerchantOrderSummary[] = [summary('WAITING_FOR_MERCHANT')],
): jest.Mocked<MerchantOrderReadPort> {
  return {
    listOrders: jest.fn().mockResolvedValue({ orders, nextCursor: null }),
    getOrder: jest.fn().mockResolvedValue(detail()),
  };
}

describe('MerchantOrderQueueScreen', () => {
  it('groups every backend status without inventing a transition', () => {
    expect(groupMerchantOrderStatus('WAITING_FOR_MERCHANT')).toBe('New');
    expect(groupMerchantOrderStatus('MERCHANT_ACCEPTED')).toBe('Accepted');
    expect(groupMerchantOrderStatus('PACKING')).toBe('Packing');
    expect(groupMerchantOrderStatus('READY_FOR_PICKUP')).toBe('Ready');
    expect(groupMerchantOrderStatus('COMPLETED')).toBe('Completed');
    expect(groupMerchantOrderStatus('CANCELLED')).toBe('Rejected');
  });

  it('shows loading then grouped orders and supports authenticated detail navigation', async () => {
    const client = port([
      summary('WAITING_FOR_MERCHANT', 1),
      summary('MERCHANT_ACCEPTED', 2),
      summary('PACKING', 3),
      summary('READY_FOR_PICKUP', 4),
      summary('COMPLETED', 5),
      summary('CANCELLED', 6),
    ]);
    const view = render(<MerchantOrderQueueScreen orderClient={client} pollIntervalMs={0} />);
    expect(view.getByLabelText('Loading merchant orders')).toBeTruthy();
    await waitFor(() => {
      expect(view.getByText('New · 1')).toBeTruthy();
    });
    expect(view.getByText('Accepted · 1')).toBeTruthy();
    expect(view.getByText('Packing · 1')).toBeTruthy();
    expect(view.getByText('Ready · 1')).toBeTruthy();
    expect(view.getByText('Completed · 1')).toBeTruthy();
    expect(view.getByText('Rejected · 1')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Open order VAS-1 for Asha'));
    await waitFor(() => {
      expect(client.getOrder.mock.calls).toContainEqual(['10000000-0000-4000-8000-000000000001']);
    });
    expect(await view.findByText('Customer and delivery')).toBeTruthy();
    expect(view.getByText('Temple Road, Tirupati, Tirupati 517501')).toBeTruthy();
  });

  it('renders an empty state and manual refresh', async () => {
    const client = port([]);
    const view = render(<MerchantOrderQueueScreen orderClient={client} pollIntervalMs={0} />);
    expect(await view.findByText('No shop orders yet')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Refresh merchant order queue'));
    await waitFor(() => {
      expect(client.listOrders.mock.calls).toHaveLength(2);
    });
  });

  it('shows an offline retry state before any data', async () => {
    const client = port();
    client.listOrders
      .mockRejectedValueOnce(new MerchantOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce({ orders: [summary('WAITING_FOR_MERCHANT')], nextCursor: null });
    const view = render(<MerchantOrderQueueScreen orderClient={client} pollIntervalMs={0} />);
    expect(await view.findByText('Orders unavailable')).toBeTruthy();
    expect(view.getByText(/appear to be offline/u)).toBeTruthy();
    fireEvent.press(view.getByLabelText('Retry merchant order queue'));
    expect(await view.findByText('New · 1')).toBeTruthy();
  });

  it('keeps stale queue data when polling or refresh fails', async () => {
    const client = port();
    client.listOrders
      .mockResolvedValueOnce({ orders: [summary('WAITING_FOR_MERCHANT')], nextCursor: null })
      .mockRejectedValueOnce(new MerchantOrderError('TEMPORARILY_UNAVAILABLE', null, true));
    const view = render(<MerchantOrderQueueScreen orderClient={client} pollIntervalMs={0} />);
    expect(await view.findByText('VAS-1')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Refresh merchant order queue'));
    expect(await view.findByText('Saved orders shown')).toBeTruthy();
    expect(view.getByText('VAS-1')).toBeTruthy();
  });

  it('polls without adding Sprint 7 ringtone behaviour', async () => {
    jest.useFakeTimers();
    const client = port();
    render(<MerchantOrderQueueScreen orderClient={client} pollIntervalMs={1000} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(client.listOrders.mock.calls).toHaveLength(1);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(client.listOrders.mock.calls).toHaveLength(2);
    jest.useRealTimers();
  });

  it('preserves the default 15-second queue polling interval', async () => {
    jest.useFakeTimers();
    const client = port();
    const view = render(<MerchantOrderQueueScreen orderClient={client} />);

    try {
      await act(async () => {
        await Promise.resolve();
      });
      expect(client.listOrders.mock.calls).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(14_999);
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(client.listOrders.mock.calls).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(client.listOrders.mock.calls).toHaveLength(2);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  it('waits for a slow queue request to settle before scheduling the next poll', async () => {
    jest.useFakeTimers();
    let resolveFirst:
      | ((page: { orders: readonly MerchantOrderSummary[]; nextCursor: string | null }) => void)
      | undefined;
    const firstRequest = new Promise<{
      orders: readonly MerchantOrderSummary[];
      nextCursor: string | null;
    }>((resolve) => {
      resolveFirst = resolve;
    });
    const client = port();
    client.listOrders
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValue({ orders: [summary('WAITING_FOR_MERCHANT')], nextCursor: null });

    try {
      render(<MerchantOrderQueueScreen orderClient={client} pollIntervalMs={1000} />);
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        jest.advanceTimersByTime(5_000);
      });
      expect(client.listOrders.mock.calls).toHaveLength(1);

      await act(async () => {
        resolveFirst?.({ orders: [summary('WAITING_FOR_MERCHANT')], nextCursor: null });
        await firstRequest;
      });
      act(() => {
        jest.advanceTimersByTime(1_000);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(client.listOrders.mock.calls).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves another-shop denial as not found in detail', async () => {
    const client = port();
    client.getOrder.mockRejectedValue(
      new MerchantOrderError('NOT_FOUND', 'MERCHANT_ORDER_NOT_FOUND', false),
    );
    const view = render(<MerchantOrderQueueScreen orderClient={client} pollIntervalMs={0} />);
    await view.findByText('VAS-1');
    fireEvent.press(view.getByLabelText('Open order VAS-1 for Asha'));
    expect(await view.findByText('Order unavailable')).toBeTruthy();
    expect(view.getByText('This order is not available for your shop.')).toBeTruthy();
  });
});
