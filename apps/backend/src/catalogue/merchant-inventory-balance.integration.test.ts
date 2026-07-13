import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { MerchantInventoryBalanceController } from './merchant-inventory-balance.controller';
import type { MerchantInventoryBalanceGateway } from './merchant-inventory-balance.gateway';
import { MerchantInventoryBalanceService } from './merchant-inventory-balance.service';
import { MERCHANT_INVENTORY_BALANCE_GATEWAY } from './merchant-inventory-balance.tokens';
import type { MerchantInventoryRecord } from './merchant-inventory-balance.types';
import { MerchantShopContextService } from './merchant-shop-context.service';

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
  accessToken: 'integration-token',
  supabase: emptyClient,
};

function createRecord(matchKind: MerchantInventoryRecord['matchKind']): MerchantInventoryRecord {
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
      stockOnHand: 9,
      reservedQuantity: 2,
      damagedQuantity: 1,
      reorderLevel: 3,
      version: 4,
      lastCountedAt: null,
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    matchKind,
  };
}

class IntegrationShopService {
  public requireOwnedShop(): Promise<{ readonly id: string }> {
    return Promise.resolve({ id: SHOP_ID });
  }
}

class IntegrationInventoryGateway implements MerchantInventoryBalanceGateway {
  public findOwnedInventoryByVariantId(
    _client: SupabaseClient,
    _shopId: string,
    variantId: string,
  ): Promise<MerchantInventoryRecord | null> {
    return Promise.resolve(variantId === VARIANT_ID ? createRecord('VARIANT_ID') : null);
  }

  public lookupOwnedInventory(
    _client: SupabaseClient,
    _shopId: string,
    query: string,
    _limit: number,
  ): Promise<readonly MerchantInventoryRecord[]> {
    void _limit;

    return Promise.resolve(
      query.toLocaleLowerCase('en-US').includes('kurta') ? [createRecord('PRODUCT')] : [],
    );
  }
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();

  if (!isHttpServer(server)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }

  return server;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} object`);
  }

  return value as Record<string, unknown>;
}

function readData(body: unknown): Record<string, unknown> {
  return requireRecord(requireRecord(body, 'response')['data'], 'response data');
}

function readErrorCode(body: unknown): string {
  const error = requireRecord(requireRecord(body, 'response')['error'], 'response error');
  const code = error['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('merchant inventory balance integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [MerchantInventoryBalanceController],
      providers: [
        MerchantInventoryBalanceService,
        {
          provide: MerchantShopContextService,
          useValue: new IntegrationShopService(),
        },
        {
          provide: MERCHANT_INVENTORY_BALANCE_GATEWAY,
          useValue: new IntegrationInventoryGateway(),
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, _response: unknown, next: () => void): void => {
        incomingRequest.authContext = context;
        next();
      },
    );
    app = application;
    await application.init();
    httpServer = requireHttpServer(application);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('reads the balance of an owned variant', async () => {
    const response = await request(httpServer).get(
      `/merchant/catalogue/shops/${SHOP_ID}/inventory/balances/${VARIANT_ID}`,
    );

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const inventory = requireRecord(readData(body)['inventory'], 'inventory');
    const balance = requireRecord(inventory['balance'], 'balance');
    expect(balance['availableQuantity']).toBe(6);
  });

  it('manually finds inventory by a product search term', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/inventory/lookup`)
      .query({
        query: 'Blue Kurta',
        limit: '10',
      });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const results = readData(body)['results'];

    if (!Array.isArray(results)) {
      throw new TypeError('Expected lookup result array');
    }

    expect(results).toHaveLength(1);
    const inventory = requireRecord(results[0], 'lookup result');
    expect(inventory['matchKind']).toBe('PRODUCT');
  });

  it('returns an empty result set for a valid unmatched query', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/inventory/lookup`)
      .query({
        query: 'No Match',
      });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    expect(readData(body)['results']).toStrictEqual([]);
  });

  it('rejects blank lookup text', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/inventory/lookup`)
      .query({
        query: '   ',
      });

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });

  it('returns VARIANT_NOT_FOUND for an unknown owned-shop variant', async () => {
    const response = await request(httpServer).get(
      `/merchant/catalogue/shops/${SHOP_ID}/inventory/balances/50000000-0000-4000-8000-000000000099`,
    );

    expect(response.status).toBe(404);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VARIANT_NOT_FOUND');
  });
});
