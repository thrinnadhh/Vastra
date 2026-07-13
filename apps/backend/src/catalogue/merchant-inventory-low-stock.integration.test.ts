import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { MerchantInventoryLowStockController } from './merchant-inventory-low-stock.controller';
import type { MerchantInventoryLowStockGateway } from './merchant-inventory-low-stock.gateway';
import { MerchantInventoryLowStockService } from './merchant-inventory-low-stock.service';
import { MERCHANT_INVENTORY_LOW_STOCK_GATEWAY } from './merchant-inventory-low-stock.tokens';
import type { MerchantLowStockItem } from './merchant-inventory-low-stock.types';
import { MerchantShopContextService } from './merchant-shop-context.service';

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
  accessToken: 'integration-token',
  supabase: emptyClient,
};

function createItem(): MerchantLowStockItem {
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
      stockOnHand: 1,
      reservedQuantity: 0,
      damagedQuantity: 0,
      availableQuantity: 1,
      reorderLevel: 2,
      version: 2,
      lastCountedAt: null,
      updatedAt: '2026-07-14T12:00:00.000Z',
    },
    inventoryState: 'LOW_STOCK',
  };
}

class IntegrationShopService {
  public requireOwnedShop(): Promise<{ readonly id: string }> {
    return Promise.resolve({ id: SHOP_ID });
  }
}

class IntegrationGateway implements MerchantInventoryLowStockGateway {
  public listOwnedLowStock(
    _client: SupabaseClient,
    _shopId: string,
    _limit: number,
    _includeInactive: boolean,
  ): Promise<readonly MerchantLowStockItem[]> {
    void _client;
    void _shopId;
    void _limit;
    void _includeInactive;
    return Promise.resolve([createItem()]);
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

describe('merchant low-stock inventory integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [MerchantInventoryLowStockController],
      providers: [
        MerchantInventoryLowStockService,
        {
          provide: MerchantShopContextService,
          useValue: new IntegrationShopService(),
        },
        {
          provide: MERCHANT_INVENTORY_LOW_STOCK_GATEWAY,
          useValue: new IntegrationGateway(),
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, response: unknown, next: () => void): void => {
        void response;
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

  it('lists low-stock rows', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/inventory/low-stock`)
      .query({ limit: '25', includeInactive: 'false' });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const items = readData(body)['items'];

    if (!Array.isArray(items)) {
      throw new TypeError('Expected low-stock items');
    }

    expect(items).toHaveLength(1);
    expect(requireRecord(items[0], 'low-stock item')['inventoryState']).toBe('LOW_STOCK');
  });

  it('rejects an invalid includeInactive query', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/inventory/low-stock`)
      .query({ includeInactive: 'yes' });

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });
});
