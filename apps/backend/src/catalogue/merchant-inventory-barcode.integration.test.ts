import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { MerchantInventoryBarcodeController } from './merchant-inventory-barcode.controller';
import type { MerchantInventoryBarcodeGateway } from './merchant-inventory-barcode.gateway';
import { MerchantInventoryBarcodeService } from './merchant-inventory-barcode.service';
import { MERCHANT_INVENTORY_BARCODE_GATEWAY } from './merchant-inventory-barcode.tokens';
import type { MerchantInventoryBarcodeLookupRecord } from './merchant-inventory-barcode.types';
import { MerchantShopContextService } from './merchant-shop-context.service';

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
  accessToken: 'integration-token',
  supabase: emptyClient,
};

function createRecord(): MerchantInventoryBarcodeLookupRecord {
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
      stockOnHand: 9,
      reservedQuantity: 2,
      damagedQuantity: 1,
      reorderLevel: 3,
      version: 4,
      lastCountedAt: null,
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
  };
}

class IntegrationShopService {
  public requireOwnedShop(): Promise<{ readonly id: string }> {
    return Promise.resolve({ id: SHOP_ID });
  }
}

class IntegrationBarcodeGateway implements MerchantInventoryBarcodeGateway {
  public findOwnedInventoryByBarcode(
    _client: SupabaseClient,
    _shopId: string,
    barcode: string,
  ): Promise<MerchantInventoryBarcodeLookupRecord | null> {
    void _client;
    void _shopId;
    return Promise.resolve(barcode === BARCODE_VALUE ? createRecord() : null);
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

describe('merchant inventory barcode integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [MerchantInventoryBarcodeController],
      providers: [
        MerchantInventoryBarcodeService,
        {
          provide: MerchantShopContextService,
          useValue: new IntegrationShopService(),
        },
        {
          provide: MERCHANT_INVENTORY_BARCODE_GATEWAY,
          useValue: new IntegrationBarcodeGateway(),
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

  it('finds exact barcode inventory for an owned shop', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/inventory/barcode-lookup`)
      .query({ barcode: BARCODE_VALUE });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const data = readData(body);
    const inventory = requireRecord(data['inventory'], 'inventory');
    const balance = requireRecord(inventory['balance'], 'balance');
    const barcode = requireRecord(inventory['barcode'], 'barcode');

    expect(data['scannedBarcode']).toBe(BARCODE_VALUE);
    expect(barcode['type']).toBe('EAN13');
    expect(balance['availableQuantity']).toBe(6);
  });

  it('returns BARCODE_NOT_FOUND for a valid unmatched barcode', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/inventory/barcode-lookup`)
      .query({ barcode: '0000000000000' });

    expect(response.status).toBe(404);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('BARCODE_NOT_FOUND');
  });

  it('rejects a missing barcode query', async () => {
    const response = await request(httpServer).get(
      `/merchant/catalogue/shops/${SHOP_ID}/inventory/barcode-lookup`,
    );

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });

  it('rejects repeated barcode query values', async () => {
    const response = await request(httpServer).get(
      `/merchant/catalogue/shops/${SHOP_ID}/inventory/barcode-lookup?barcode=one&barcode=two`,
    );

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });
});
