import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MerchantInventoryWorkflow } from './merchant-inventory.screen';
import {
  MerchantInventoryError,
  type MerchantBarcodeInventory,
  type MerchantInventoryCachePort,
  type MerchantInventoryPort,
  type MerchantOfflineSaleQueuePort,
} from './merchant-inventory.types';

jest.mock('../barcode/merchant-barcode-scanner', () => ({
  MerchantBarcodeScanner: () => null,
}));

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '80000000-0000-4000-8000-000000000001';

function firstCall<T extends readonly unknown[]>(calls: readonly T[]): T {
  const call = calls[0];
  if (call === undefined) {
    throw new TypeError('Expected one mock call');
  }
  return call;
}

const inventory: MerchantBarcodeInventory = {
  scannedBarcode: '8901234567890',
  barcode: {
    id: '60000000-0000-4000-8000-000000000001',
    value: '8901234567890',
    type: 'EAN13',
    source: 'MANUFACTURER',
    isPrimary: true,
  },
  product: {
    id: '40000000-0000-4000-8000-000000000001',
    name: 'Blue Kurta',
    brand: 'Vastra',
    isActive: true,
  },
  variant: {
    id: VARIANT_ID,
    productId: '40000000-0000-4000-8000-000000000001',
    sku: 'KURTA-BLUE-M',
    colourName: 'Blue',
    sizeLabel: 'M',
    isActive: true,
  },
  balance: {
    persisted: true,
    stockOnHand: 10,
    reservedQuantity: 2,
    damagedQuantity: 1,
    availableQuantity: 7,
    reorderLevel: 3,
    version: 4,
    updatedAt: '2026-08-05T08:00:00.000Z',
  },
};

function port(): jest.Mocked<MerchantInventoryPort> {
  return {
    listOwnedShops: jest.fn(() =>
      Promise.resolve([
        {
          id: SHOP_ID,
          name: 'Vastra Shop',
          shopCode: 'VAS-1',
          operationalStatus: 'OPEN',
        },
      ]),
    ),
    lookupBarcode: jest.fn<
      ReturnType<MerchantInventoryPort['lookupBarcode']>,
      Parameters<MerchantInventoryPort['lookupBarcode']>
    >(() => Promise.resolve(inventory)),
    createOfflineSale: jest.fn<
      ReturnType<MerchantInventoryPort['createOfflineSale']>,
      Parameters<MerchantInventoryPort['createOfflineSale']>
    >(() =>
      Promise.resolve({
        id: '70000000-0000-4000-8000-000000000001',
        saleNumber: 'OFF-1',
        totalPaise: 12000,
        replayed: false,
        createdAt: '2026-08-05T08:05:00.000Z',
        balance: {
          ...inventory.balance,
          stockOnHand: 9,
          availableQuantity: 6,
          version: 5,
          updatedAt: '2026-08-05T08:05:00.000Z',
        },
      }),
    ),
  };
}

function queue(): jest.Mocked<MerchantOfflineSaleQueuePort> {
  return {
    list: jest.fn(() => Promise.resolve([])),
    remove: jest.fn<
      ReturnType<MerchantOfflineSaleQueuePort['remove']>,
      Parameters<MerchantOfflineSaleQueuePort['remove']>
    >(() => Promise.resolve([])),
    enqueue: jest.fn((entry) =>
      Promise.resolve([
        {
          ...entry,
          attemptCount: 0,
          lastAttemptAt: null,
          lastErrorCode: null,
          blocked: false,
        },
      ]),
    ),
    sync: jest.fn<
      ReturnType<MerchantOfflineSaleQueuePort['sync']>,
      Parameters<MerchantOfflineSaleQueuePort['sync']>
    >(() => Promise.resolve({ remaining: [], completed: [] })),
  };
}

function cache(
  cached: MerchantBarcodeInventory | null = null,
): jest.Mocked<MerchantInventoryCachePort> {
  return {
    get: jest.fn<
      ReturnType<MerchantInventoryCachePort['get']>,
      Parameters<MerchantInventoryCachePort['get']>
    >(() => Promise.resolve(cached)),
    put: jest.fn<
      ReturnType<MerchantInventoryCachePort['put']>,
      Parameters<MerchantInventoryCachePort['put']>
    >(() => Promise.resolve()),
  };
}

describe('MerchantInventoryWorkflow', () => {
  it('looks up a barcode and records a server-authoritative sale', async () => {
    const client = port();
    const view = render(
      <MerchantInventoryWorkflow
        cache={cache()}
        client={client}
        createIdempotencyKey={() => IDEMPOTENCY_KEY}
        queue={queue()}
        syncIntervalMs={60_000}
      />,
    );

    await view.findByText('Inventory scanner');
    fireEvent.changeText(view.getByLabelText('Enter product barcode manually'), '8901234567890');
    fireEvent.press(view.getByLabelText('Look up entered product barcode'));
    expect(await view.findByText('Blue Kurta')).toBeTruthy();

    fireEvent.changeText(view.getByLabelText('Offline sale unit price in rupees'), '120');
    fireEvent.press(view.getByLabelText('Record offline barcode sale'));

    expect(await view.findByText(/Sale OFF-1 recorded/u)).toBeTruthy();
    const [saleInput, idempotencyKey] = firstCall(client.createOfflineSale.mock.calls);
    expect(saleInput.shopId).toBe(SHOP_ID);
    expect(saleInput.items[0]).toMatchObject({
      variantId: VARIANT_ID,
      identificationMethod: 'BARCODE',
    });
    expect(idempotencyKey).toBe(IDEMPOTENCY_KEY);
  });

  it('uses cached barcode data offline and queues the sale durably', async () => {
    const client = port();
    client.lookupBarcode.mockRejectedValue(new MerchantInventoryError('TRANSPORT', null, true));
    client.createOfflineSale.mockRejectedValue(new MerchantInventoryError('TRANSPORT', null, true));
    const offlineQueue = queue();
    const view = render(
      <MerchantInventoryWorkflow
        cache={cache(inventory)}
        client={client}
        createIdempotencyKey={() => IDEMPOTENCY_KEY}
        queue={offlineQueue}
        syncIntervalMs={60_000}
      />,
    );

    await view.findByText('Inventory scanner');
    fireEvent.changeText(view.getByLabelText('Enter product barcode manually'), '8901234567890');
    fireEvent.press(view.getByLabelText('Look up entered product barcode'));
    expect(await view.findByText('CACHED')).toBeTruthy();

    fireEvent.changeText(view.getByLabelText('Offline sale unit price in rupees'), '120');
    fireEvent.press(view.getByLabelText('Record offline barcode sale'));

    expect(await view.findByText(/saved on this device/u)).toBeTruthy();
    await waitFor(() => {
      expect(offlineQueue.enqueue.mock.calls).toHaveLength(1);
    });
    const [queued] = firstCall(offlineQueue.enqueue.mock.calls);
    expect(queued.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(queued.input.items[0].variantId).toBe(VARIANT_ID);
  });
});
