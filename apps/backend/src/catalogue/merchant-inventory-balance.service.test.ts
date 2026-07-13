import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantInventoryBalanceGateway,
  MerchantInventoryBalanceGatewayUnavailableError,
} from './merchant-inventory-balance.gateway';
import { MerchantInventoryBalanceService } from './merchant-inventory-balance.service';
import type { MerchantInventoryRecord } from './merchant-inventory-balance.types';
import type { MerchantShopContextService } from './merchant-shop-context.service';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
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

function createRecord(overrides: Partial<MerchantInventoryRecord> = {}): MerchantInventoryRecord {
  return {
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
    matchKind: 'SKU_EXACT',
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

class StubGateway implements MerchantInventoryBalanceGateway {
  public directRecord: MerchantInventoryRecord | null = createRecord({
    matchKind: 'VARIANT_ID',
  });
  public lookupRecords: readonly MerchantInventoryRecord[] = [createRecord()];
  public directError: Error | null = null;
  public lookupError: Error | null = null;
  public lastQuery: string | null = null;
  public lastLimit: number | null = null;

  public findOwnedInventoryByVariantId(
    _client: SupabaseClient,
    _shopId: string,
    _variantId: string,
  ): Promise<MerchantInventoryRecord | null> {
    void _client;
    void _shopId;
    void _variantId;

    if (this.directError !== null) {
      return Promise.reject(this.directError);
    }

    return Promise.resolve(this.directRecord);
  }

  public lookupOwnedInventory(
    _client: SupabaseClient,
    _shopId: string,
    query: string,
    limit: number,
  ): Promise<readonly MerchantInventoryRecord[]> {
    this.lastQuery = query;
    this.lastLimit = limit;

    if (this.lookupError !== null) {
      return Promise.reject(this.lookupError);
    }

    return Promise.resolve(this.lookupRecords);
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

describe('MerchantInventoryBalanceService', () => {
  let shopService: OwnedShopService;
  let gateway: StubGateway;
  let service: MerchantInventoryBalanceService;

  beforeEach(() => {
    shopService = new OwnedShopService();
    gateway = new StubGateway();
    service = new MerchantInventoryBalanceService(
      shopService as unknown as MerchantShopContextService,
      gateway,
    );
  });

  it('returns a variant balance with available quantity derived once', async () => {
    const response = await service.getVariantBalance(context, SHOP_ID, VARIANT_ID);

    expect(response.data.inventory.balance).toStrictEqual({
      persisted: true,
      stockOnHand: 12,
      reservedQuantity: 3,
      damagedQuantity: 2,
      availableQuantity: 7,
      reorderLevel: 4,
      version: 7,
      lastCountedAt: null,
      updatedAt: '2026-07-13T00:00:00.000Z',
    });
    expect(shopService.calls).toBe(1);
  });

  it('represents a missing balance row as an explicit zero balance', async () => {
    gateway.directRecord = createRecord({
      balance: null,
      matchKind: 'VARIANT_ID',
    });

    const response = await service.getVariantBalance(context, SHOP_ID, VARIANT_ID);

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

  it('returns VARIANT_NOT_FOUND when the owned shop has no matching variant', async () => {
    gateway.directRecord = null;

    const error = await captureHttpException(
      service.getVariantBalance(context, SHOP_ID, VARIANT_ID),
    );

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('VARIANT_NOT_FOUND');
  });

  it('normalizes lookup text and applies the default result limit', async () => {
    const response = await service.lookupInventory(context, SHOP_ID, '  Blue   Kurta  ', undefined);

    expect(response.data.query).toBe('Blue Kurta');
    expect(gateway.lastQuery).toBe('Blue Kurta');
    expect(gateway.lastLimit).toBe(20);
    expect(response.data.results[0]?.matchKind).toBe('SKU_EXACT');
  });

  it('rejects repeated or out-of-range lookup parameters', async () => {
    const queryError = await captureHttpException(
      service.lookupInventory(context, SHOP_ID, ['KURTA'], undefined),
    );
    const limitError = await captureHttpException(
      service.lookupInventory(context, SHOP_ID, 'KURTA', '51'),
    );

    expect(queryError.getStatus()).toBe(400);
    expect(readCode(queryError)).toBe('VALIDATION_ERROR');
    expect(limitError.getStatus()).toBe(400);
    expect(readCode(limitError)).toBe('VALIDATION_ERROR');
  });

  it('rejects internally inconsistent balance arithmetic', async () => {
    gateway.directRecord = createRecord({
      balance: {
        stockOnHand: 4,
        reservedQuantity: 3,
        damagedQuantity: 2,
        reorderLevel: 0,
        version: 1,
        lastCountedAt: null,
        updatedAt: '2026-07-13T00:00:00.000Z',
      },
      matchKind: 'VARIANT_ID',
    });

    const error = await captureHttpException(
      service.getVariantBalance(context, SHOP_ID, VARIANT_ID),
    );

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });

  it('maps provider failures to a retryable service-unavailable error', async () => {
    gateway.lookupError = new MerchantInventoryBalanceGatewayUnavailableError();

    const error = await captureHttpException(
      service.lookupInventory(context, SHOP_ID, 'KURTA', '10'),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });
});
