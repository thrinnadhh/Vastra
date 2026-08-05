import {
  HttpMerchantInventoryClient,
  parseBarcodeInventory,
  parseOfflineSale,
  parseOwnedShops,
} from './merchant-inventory.client';
import { MerchantInventoryError } from './merchant-inventory.types';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const balance = {
  persisted: true,
  stockOnHand: 10,
  reservedQuantity: 2,
  damagedQuantity: 1,
  availableQuantity: 7,
  reorderLevel: 3,
  version: 4,
  lastCountedAt: null,
  updatedAt: '2026-08-05T08:00:00.000Z',
};

const barcodeEnvelope = {
  success: true,
  data: {
    scannedBarcode: '8901234567890',
    inventory: {
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
        slug: 'blue-kurta',
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
      balance,
    },
  },
  meta: { requestId: null },
};

describe('merchant inventory client', () => {
  it('parses shops, barcode inventory, and offline sale balances', () => {
    expect(
      parseOwnedShops({
        success: true,
        data: {
          shops: [
            {
              id: SHOP_ID,
              name: 'Vastra Shop',
              shopCode: 'VAS-1',
              operationalStatus: 'OPEN',
            },
          ],
        },
      }),
    ).toHaveLength(1);
    expect(parseBarcodeInventory(barcodeEnvelope).balance.availableQuantity).toBe(7);
    expect(
      parseOfflineSale({
        success: true,
        data: {
          sale: {
            id: '70000000-0000-4000-8000-000000000001',
            saleNumber: 'OFF-1',
            totalPaise: 12000,
            replayed: false,
            createdAt: '2026-08-05T08:00:00.000Z',
            items: [{ balance }],
          },
        },
      }).balance.availableQuantity,
    ).toBe(7);
  });

  it('calls exact barcode lookup with merchant authentication', async () => {
    const fetchFunction = jest.fn(() => Promise.resolve(response(barcodeEnvelope)));
    const client = new HttpMerchantInventoryClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      fetchFunction,
    );

    const result = await client.lookupBarcode(SHOP_ID, '8901234567890');

    expect(result.variant.id).toBe(VARIANT_ID);
    expect(fetchFunction).toHaveBeenCalledWith(
      `https://api.example.test/merchant/catalogue/shops/${SHOP_ID}/inventory/barcode-lookup?barcode=8901234567890`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('sends one idempotent offline sale request', async () => {
    const fetchFunction = jest.fn(() =>
      Promise.resolve(
        response({
          success: true,
          data: {
            sale: {
              id: '70000000-0000-4000-8000-000000000001',
              saleNumber: 'OFF-1',
              totalPaise: 12000,
              replayed: false,
              createdAt: '2026-08-05T08:00:00.000Z',
              items: [{ balance }],
            },
          },
        }),
      ),
    );
    const client = new HttpMerchantInventoryClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      fetchFunction,
    );

    await client.createOfflineSale(
      {
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
      '80000000-0000-4000-8000-000000000001',
    );

    expect(fetchFunction).toHaveBeenCalledWith(
      'https://api.example.test/merchant/offline-sales',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Idempotency-Key': '80000000-0000-4000-8000-000000000001',
        }),
      }),
    );
  });

  it('maps transport and structured API failures', async () => {
    const offlineClient = new HttpMerchantInventoryClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      () => Promise.reject(new Error('offline')),
    );
    await expect(offlineClient.listOwnedShops()).rejects.toMatchObject({
      kind: 'TRANSPORT',
      retryable: true,
    });

    const notFoundClient = new HttpMerchantInventoryClient(
      'https://api.example.test',
      () => Promise.resolve('token'),
      () =>
        Promise.resolve(
          response(
            {
              success: false,
              error: { code: 'BARCODE_NOT_FOUND', retryable: false },
            },
            404,
          ),
        ),
    );
    await expect(notFoundClient.lookupBarcode(SHOP_ID, 'unknown')).rejects.toEqual(
      new MerchantInventoryError('NOT_FOUND', 'BARCODE_NOT_FOUND', false),
    );
  });
});
