import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantInventoryBarcodeGateway,
  MerchantInventoryBarcodeGatewayUnavailableError,
} from './merchant-inventory-barcode.gateway';
import { MerchantInventoryBarcodeService } from './merchant-inventory-barcode.service';
import type { MerchantInventoryBarcodeLookupRecord } from './merchant-inventory-barcode.types';
import type { MerchantShopContextService } from './merchant-shop-context.service';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const BARCODE_ID = '60000000-0000-4000-8000-000000000001';
const BARCODE_VALUE = '8901234567890';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createRecord(
  overrides: Partial<MerchantInventoryBarcodeLookupRecord> = {},
): MerchantInventoryBarcodeLookupRecord {
  return {
    barcode: {
      id: BARCODE_ID,
      variantId: VARIANT_ID,
      value: BARCODE_VALUE,
      type: 'EAN13',
      source: 'MANUFACTURER',
      isPrimary: true,
    },
    product: {
      id: PRODUCT_ID,
      name: 'Blue Kurta',
      slug: 'blue-kurta',
      brand: 'Vastra',
      isActive: true,
    },
    variant: {
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      shopId: SHOP_ID,
      sku: 'KURTA-BLUE-M',
      colourName: 'Blue',
      sizeLabel: 'M',
      isActive: true,
    },
    balance: {
      stockOnHand: 12,
      reservedQuantity: 3,
      damagedQuantity: 2,
      reorderLevel: 4,
      version: 7,
      lastCountedAt: null,
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    ...overrides,
  };
}

class OwnedShopService {
  public calls = 0;

  public requireOwnedShop(
    _context: AuthenticatedRequestContext,
    _shopId: string,
  ): Promise<{ readonly id: string }> {
    void _context;
    void _shopId;
    this.calls += 1;
    return Promise.resolve({ id: SHOP_ID });
  }
}

class StubGateway implements MerchantInventoryBarcodeGateway {
  public record: MerchantInventoryBarcodeLookupRecord | null = createRecord();
  public error: Error | null = null;
  public lastBarcode: string | null = null;

  public findOwnedInventoryByBarcode(
    _client: SupabaseClient,
    _shopId: string,
    barcode: string,
  ): Promise<MerchantInventoryBarcodeLookupRecord | null> {
    void _client;
    void _shopId;
    this.lastBarcode = barcode;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.record);
  }
}

function readCode(error: HttpException): string {
  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected structured error response');
  }

  const apiError = (response as Record<string, unknown>)['error'];

  if (typeof apiError !== 'object' || apiError === null || Array.isArray(apiError)) {
    throw new TypeError('Expected structured API error');
  }

  const code = (apiError as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected API error code');
  }

  return code;
}

async function captureHttpException(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof HttpException) {
      return error;
    }

    throw error;
  }

  throw new Error('Expected promise to reject');
}

describe('MerchantInventoryBarcodeService', () => {
  let shopService: OwnedShopService;
  let gateway: StubGateway;
  let service: MerchantInventoryBarcodeService;

  beforeEach(() => {
    shopService = new OwnedShopService();
    gateway = new StubGateway();
    service = new MerchantInventoryBarcodeService(
      shopService as unknown as MerchantShopContextService,
      gateway,
    );
  });

  it('returns exact barcode inventory with derived availability', async () => {
    const response = await service.lookupBarcode(context, SHOP_ID, BARCODE_VALUE);

    expect(response.data.scannedBarcode).toBe(BARCODE_VALUE);
    expect(response.data.inventory.barcode).toStrictEqual({
      id: BARCODE_ID,
      value: BARCODE_VALUE,
      type: 'EAN13',
      source: 'MANUFACTURER',
      isPrimary: true,
    });
    expect(response.data.inventory.balance.availableQuantity).toBe(7);
    expect(shopService.calls).toBe(1);
  });

  it('trims scanner whitespace without changing barcode case', async () => {
    gateway.record = createRecord({
      barcode: {
        id: BARCODE_ID,
        variantId: VARIANT_ID,
        value: 'AbC-128',
        type: 'CODE128',
        source: 'MERCHANT_ENTERED',
        isPrimary: true,
      },
    });

    const response = await service.lookupBarcode(context, SHOP_ID, '  AbC-128  ');

    expect(response.data.scannedBarcode).toBe('AbC-128');
    expect(gateway.lastBarcode).toBe('AbC-128');
  });

  it('represents a mapped variant without a balance row as zero inventory', async () => {
    gateway.record = createRecord({ balance: null });

    const response = await service.lookupBarcode(context, SHOP_ID, BARCODE_VALUE);

    expect(response.data.inventory.balance).toStrictEqual({
      persisted: false,
      stockOnHand: 0,
      reservedQuantity: 0,
      damagedQuantity: 0,
      availableQuantity: 0,
      reorderLevel: 0,
      version: null,
      lastCountedAt: null,
      updatedAt: null,
    });
  });

  it('returns BARCODE_NOT_FOUND for an unmapped or non-owned barcode', async () => {
    gateway.record = null;

    const error = await captureHttpException(
      service.lookupBarcode(context, SHOP_ID, BARCODE_VALUE),
    );

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('BARCODE_NOT_FOUND');
  });

  it('rejects repeated, blank, overlong, and control-character barcode values', async () => {
    const repeatedError = await captureHttpException(
      service.lookupBarcode(context, SHOP_ID, [BARCODE_VALUE]),
    );
    const blankError = await captureHttpException(service.lookupBarcode(context, SHOP_ID, '   '));
    const longError = await captureHttpException(
      service.lookupBarcode(context, SHOP_ID, 'x'.repeat(256)),
    );
    const controlError = await captureHttpException(
      service.lookupBarcode(context, SHOP_ID, `ABC${String.fromCharCode(10)}123`),
    );

    expect(readCode(repeatedError)).toBe('VALIDATION_ERROR');
    expect(readCode(blankError)).toBe('VALIDATION_ERROR');
    expect(readCode(longError)).toBe('VALIDATION_ERROR');
    expect(readCode(controlError)).toBe('VALIDATION_ERROR');
  });

  it('rejects internally inconsistent balance arithmetic', async () => {
    gateway.record = createRecord({
      balance: {
        stockOnHand: 4,
        reservedQuantity: 3,
        damagedQuantity: 2,
        reorderLevel: 0,
        version: 1,
        lastCountedAt: null,
        updatedAt: '2026-07-13T00:00:00.000Z',
      },
    });

    const error = await captureHttpException(
      service.lookupBarcode(context, SHOP_ID, BARCODE_VALUE),
    );

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });

  it('maps provider failures to a retryable service-unavailable error', async () => {
    gateway.error = new MerchantInventoryBarcodeGatewayUnavailableError();

    const error = await captureHttpException(
      service.lookupBarcode(context, SHOP_ID, BARCODE_VALUE),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });
});
