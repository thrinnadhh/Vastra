import { DeduplicatingMerchantOrderReadPort } from './deduplicating-merchant-order-read.port';
import type {
  MerchantOrderDetail,
  MerchantOrderReadPort,
  MerchantOrderSummary,
} from './merchant-order.types';

function order(id: string): MerchantOrderSummary {
  return { id } as MerchantOrderSummary;
}

describe('DeduplicatingMerchantOrderReadPort', () => {
  it('removes cursor overlap while preserving first-seen order sequence', async () => {
    const delegate: jest.Mocked<MerchantOrderReadPort> = {
      listOrders: jest
        .fn()
        .mockResolvedValueOnce({
          orders: [order('order-1'), order('order-2')],
          nextCursor: 'cursor-2',
        })
        .mockResolvedValueOnce({
          orders: [order('order-2'), order('order-3')],
          nextCursor: null,
        }),
      getOrder: jest.fn(),
    };
    const port = new DeduplicatingMerchantOrderReadPort(delegate);

    const first = await port.listOrders({ limit: 20 });
    const second = await port.listOrders({ cursor: 'cursor-2', limit: 20 });

    expect(first.orders.map(({ id }) => id)).toEqual(['order-1', 'order-2']);
    expect(second.orders.map(({ id }) => id)).toEqual(['order-3']);
  });

  it('starts a new deduplication snapshot for a cursor-less refresh', async () => {
    const delegate: jest.Mocked<MerchantOrderReadPort> = {
      listOrders: jest
        .fn()
        .mockResolvedValueOnce({ orders: [order('order-1')], nextCursor: null })
        .mockResolvedValueOnce({ orders: [order('order-1')], nextCursor: null }),
      getOrder: jest.fn(),
    };
    const port = new DeduplicatingMerchantOrderReadPort(delegate);

    await port.listOrders({ limit: 20 });
    const refreshed = await port.listOrders({ limit: 20 });

    expect(refreshed.orders.map(({ id }) => id)).toEqual(['order-1']);
  });

  it('delegates authoritative order detail reads unchanged', async () => {
    const detail = { id: 'order-1' } as MerchantOrderDetail;
    const delegate: jest.Mocked<MerchantOrderReadPort> = {
      listOrders: jest.fn(),
      getOrder: jest.fn().mockResolvedValue(detail),
    };
    const port = new DeduplicatingMerchantOrderReadPort(delegate);

    await expect(port.getOrder('order-1')).resolves.toBe(detail);
    expect(delegate.getOrder.mock.calls).toEqual([['order-1']]);
  });
});
