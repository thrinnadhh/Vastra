import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantInventoryLowStockGateway,
  MerchantInventoryLowStockDataInvalidError,
  MerchantInventoryLowStockGatewayUnavailableError,
} from './merchant-inventory-low-stock.gateway';
import { MerchantInventoryLowStockService } from './merchant-inventory-low-stock.service';
import type { MerchantLowStockItem } from './merchant-inventory-low-stock.types';
import type { MerchantShopContextService } from './merchant-shop-context.service';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createItem(overrides: Partial<MerchantLowStockItem> = {}): MerchantLowStockItem {
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
      sku: 'BLUE-KURTA-M',
      colourName: 'Blue',
      sizeLabel: 'M',
      isActive: true,
    },
    balance: {
      persisted: true,
      stockOnHand: 4,
      reservedQuantity: 1,
      damagedQuantity: 1,
      availableQuantity: 2,
      reorderLevel: 3,
      version: 4,
      lastCountedAt: null,
      updatedAt: '2026-07-14T12:00:00.000Z',
    },
    inventoryState: 'LOW_STOCK',
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

class StubGateway implements MerchantInventoryLowStockGateway {
  public items: readonly MerchantLowStockItem[] = [createItem()];
  public error: Error | null = null;
  public args: {
    readonly shopId: string;
    readonly limit: number;
    readonly includeInactive: boolean;
  } | null = null;

  public listOwnedLowStock(
    _client: SupabaseClient,
    shopId: string,
    limit: number,
    includeInactive: boolean,
  ): Promise<readonly MerchantLowStockItem[]> {
    void _client;
    this.args = { shopId, limit, includeInactive };

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.items);
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

describe('MerchantInventoryLowStockService', () => {
  let shopService: OwnedShopService;
  let gateway: StubGateway;
  let service: MerchantInventoryLowStockService;

  beforeEach(() => {
    shopService = new OwnedShopService();
    gateway = new StubGateway();
    service = new MerchantInventoryLowStockService(
      shopService as unknown as MerchantShopContextService,
      gateway,
    );
  });

  it('lists active low-stock inventory with defaults', async () => {
    const response = await service.listLowStock(context, SHOP_ID, undefined, undefined);

    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0]?.inventoryState).toBe('LOW_STOCK');
    expect(gateway.args).toStrictEqual({
      shopId: SHOP_ID,
      limit: 50,
      includeInactive: false,
    });
    expect(shopService.calls).toBe(1);
  });

  it('allows inactive inventory to be included explicitly', async () => {
    await service.listLowStock(context, SHOP_ID, '25', 'true');

    expect(gateway.args).toStrictEqual({
      shopId: SHOP_ID,
      limit: 25,
      includeInactive: true,
    });
  });

  it('accepts an explicit false includeInactive value', async () => {
    await service.listLowStock(context, SHOP_ID, '100', 'false');

    expect(gateway.args?.includeInactive).toBe(false);
  });

  it('rejects invalid limits', async () => {
    const error = await captureHttpException(
      service.listLowStock(context, SHOP_ID, '101', undefined),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.args).toBeNull();
  });

  it('rejects ambiguous boolean values', async () => {
    const error = await captureHttpException(
      service.listLowStock(context, SHOP_ID, undefined, '1'),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
  });

  it('maps provider failures to a retryable error', async () => {
    gateway.error = new MerchantInventoryLowStockGatewayUnavailableError();

    const error = await captureHttpException(
      service.listLowStock(context, SHOP_ID, undefined, undefined),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });

  it('maps inconsistent read-model rows to an internal error', async () => {
    gateway.error = new MerchantInventoryLowStockDataInvalidError();

    const error = await captureHttpException(
      service.listLowStock(context, SHOP_ID, undefined, undefined),
    );

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });
});
