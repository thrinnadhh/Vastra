import { AsyncStorageMerchantOfflineSaleQueue } from './merchant-offline-sale.queue';
import {
  MerchantInventoryError,
  type MerchantInventoryPort,
  type PendingMerchantOfflineSale,
} from './merchant-inventory.types';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';

class MemoryStorage {
  private value: string | null = null;

  public getItem(): Promise<string | null> {
    return Promise.resolve(this.value);
  }

  public setItem(_key: string, value: string): Promise<void> {
    this.value = value;
    return Promise.resolve();
  }
}

function pending(idempotencyKey: string): Omit<
  PendingMerchantOfflineSale,
  'attemptCount' | 'lastAttemptAt' | 'lastErrorCode' | 'blocked'
> {
  return {
    id: idempotencyKey,
    idempotencyKey,
    barcode: '8901234567890',
    productName: 'Blue Kurta',
    createdAt: '2026-08-05T08:00:00.000Z',
    input: {
      shopId: SHOP_ID,
      customerPhone: null,
      taxPaise: 0,
      paymentMethod: 'CASH',
      items: [
        {
          variantId: VARIANT_ID,
          quantity: 1,
          unitPricePaise: 12000,
          discountPaise: 0,
          identificationMethod: 'BARCODE',
        },
      ],
    },
  };
}

function client(
  createOfflineSale: MerchantInventoryPort['createOfflineSale'],
): MerchantInventoryPort {
  return {
    listOwnedShops: () => Promise.resolve([]),
    lookupBarcode: () => Promise.reject(new Error('unused')),
    createOfflineSale,
  };
}

describe('AsyncStorageMerchantOfflineSaleQueue', () => {
  it('persists one command per idempotency key', async () => {
    const queue = new AsyncStorageMerchantOfflineSaleQueue(new MemoryStorage());

    await queue.enqueue(pending('80000000-0000-4000-8000-000000000001'));
    const result = await queue.enqueue(
      pending('80000000-0000-4000-8000-000000000001'),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.attemptCount).toBe(0);
  });

  it('allows a merchant to discard a permanently failed queued command', async () => {
    const queue = new AsyncStorageMerchantOfflineSaleQueue(new MemoryStorage());
    await queue.enqueue(pending('80000000-0000-4000-8000-000000000001'));

    const remaining = await queue.remove(
      '80000000-0000-4000-8000-000000000001',
    );

    expect(remaining).toHaveLength(0);
    await expect(queue.list()).resolves.toHaveLength(0);
  });

  it('blocks permanent failures instead of retrying them forever', async () => {
    const queue = new AsyncStorageMerchantOfflineSaleQueue(
      new MemoryStorage(),
      () => '2026-08-05T08:10:00.000Z',
    );
    await queue.enqueue(pending('80000000-0000-4000-8000-000000000001'));

    const firstClient = client(() =>
      Promise.reject(
        new MerchantInventoryError(
          'VALIDATION',
          'INVALID_OFFLINE_SALE',
          false,
        ),
      ),
    );
    const first = await queue.sync(firstClient);

    expect(first.remaining[0]).toMatchObject({
      blocked: true,
      attemptCount: 1,
      lastErrorCode: 'INVALID_OFFLINE_SALE',
    });

    const secondAttempt = jest.fn(() => Promise.reject(new Error('must not run')));
    const second = await queue.sync(client(secondAttempt));

    expect(secondAttempt).not.toHaveBeenCalled();
    expect(second.remaining[0]).toMatchObject({ blocked: true, attemptCount: 1 });
  });

  it('removes completed sales after synchronization', async () => {
    const queue = new AsyncStorageMerchantOfflineSaleQueue(new MemoryStorage());
    await queue.enqueue(pending('80000000-0000-4000-8000-000000000001'));

    const result = await queue.sync(
      client(() =>
        Promise.resolve({
          id: '70000000-0000-4000-8000-000000000001',
          saleNumber: 'OFF-1',
          totalPaise: 12000,
          replayed: false,
          createdAt: '2026-08-05T08:05:00.000Z',
          balance: {
            persisted: true,
            stockOnHand: 9,
            reservedQuantity: 0,
            damagedQuantity: 0,
            availableQuantity: 9,
            reorderLevel: 2,
            version: 2,
            updatedAt: '2026-08-05T08:05:00.000Z',
          },
        }),
      ),
    );

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.pending.idempotencyKey).toBe(
      '80000000-0000-4000-8000-000000000001',
    );
    expect(result.completed[0]?.result.saleNumber).toBe('OFF-1');
    expect(result.remaining).toHaveLength(0);
    await expect(queue.list()).resolves.toHaveLength(0);
  });

  it('keeps retryable failures and preserves later commands', async () => {
    const queue = new AsyncStorageMerchantOfflineSaleQueue(
      new MemoryStorage(),
      () => '2026-08-05T08:10:00.000Z',
    );
    await queue.enqueue(pending('80000000-0000-4000-8000-000000000001'));
    await queue.enqueue(pending('80000000-0000-4000-8000-000000000002'));

    const createOfflineSale = jest.fn(() =>
      Promise.reject(new MerchantInventoryError('TRANSPORT', null, true)),
    );
    const result = await queue.sync(client(createOfflineSale));

    expect(createOfflineSale).toHaveBeenCalledTimes(1);
    expect(result.remaining).toHaveLength(2);
    expect(result.remaining[0]).toMatchObject({
      attemptCount: 1,
      lastAttemptAt: '2026-08-05T08:10:00.000Z',
      lastErrorCode: 'TRANSPORT',
    });
    expect(result.remaining[1]).toMatchObject({ attemptCount: 0 });
  });
});
