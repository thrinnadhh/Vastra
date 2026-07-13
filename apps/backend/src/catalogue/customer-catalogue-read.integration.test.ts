import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerCatalogueReadController } from './customer-catalogue-read.controller';
import type { CustomerCatalogueReadGateway } from './customer-catalogue-read.gateway';
import { CustomerCatalogueReadService } from './customer-catalogue-read.service';
import { CUSTOMER_CATALOGUE_READ_GATEWAY } from './customer-catalogue-read.tokens';
import type {
  CustomerCatalogueProductDetail,
  CustomerCatalogueProductPage,
  CustomerCatalogueShopSnapshot,
} from './customer-catalogue-read.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
  supabase: emptyClient,
};

function createShop(): CustomerCatalogueShopSnapshot {
  return {
    id: SHOP_ID,
    name: 'Public Fashion Shop',
    slug: 'public-fashion-shop',
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
  };
}

function createDetail(): CustomerCatalogueProductDetail {
  return {
    id: PRODUCT_ID,
    shopId: SHOP_ID,
    categoryId: '30000000-0000-4000-8000-000000000001',
    name: 'Blue Kurta',
    slug: 'blue-kurta',
    brand: 'Vastra',
    genderCategory: 'UNISEX',
    primaryImage: null,
    minSellingPricePaise: 90000,
    maxSellingPricePaise: 90000,
    availableVariantCount: 1,
    totalAvailableQuantity: 2,
    isAvailable: true,
    shop: createShop(),
    description: 'Everyday kurta',
    material: 'Cotton',
    styleTags: [],
    occasionTags: [],
    careInstructions: null,
    returnEligible: true,
    returnWindowDays: 7,
    images: [],
    variants: [
      {
        id: VARIANT_ID,
        sku: 'BLUE-KURTA-M',
        colourName: 'Blue',
        colourHex: '#0000FF',
        sizeLabel: 'M',
        mrpPaise: 100000,
        sellingPricePaise: 90000,
        attributes: {},
        availableQuantity: 2,
        isAvailable: true,
      },
    ],
  };
}

class IntegrationGateway implements CustomerCatalogueReadGateway {
  public findPublicShop(): Promise<CustomerCatalogueShopSnapshot | null> {
    return Promise.resolve(createShop());
  }

  public listPublicProducts(): Promise<CustomerCatalogueProductPage> {
    const detail = createDetail();

    return Promise.resolve({
      products: [
        {
          id: detail.id,
          shopId: detail.shopId,
          categoryId: detail.categoryId,
          name: detail.name,
          slug: detail.slug,
          brand: detail.brand,
          genderCategory: detail.genderCategory,
          primaryImage: detail.primaryImage,
          minSellingPricePaise: detail.minSellingPricePaise,
          maxSellingPricePaise: detail.maxSellingPricePaise,
          availableVariantCount: detail.availableVariantCount,
          totalAvailableQuantity: detail.totalAvailableQuantity,
          isAvailable: detail.isAvailable,
        },
      ],
      nextCursor: null,
    });
  }

  public findPublicProduct(): Promise<CustomerCatalogueProductDetail | null> {
    return Promise.resolve(createDetail());
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

describe('customer catalogue read integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [CustomerCatalogueReadController],
      providers: [
        CustomerCatalogueReadService,
        {
          provide: CUSTOMER_CATALOGUE_READ_GATEWAY,
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

  it('lists one public shop product page', async () => {
    const response = await request(httpServer)
      .get(`/shops/${SHOP_ID}/products`)
      .query({ limit: '20' });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const products = readData(body)['products'];

    if (!Array.isArray(products)) {
      throw new TypeError('Expected product list');
    }

    expect(products).toHaveLength(1);
    expect(requireRecord(products[0], 'product')['isAvailable']).toBe(true);
  });

  it('returns product detail with live variant availability', async () => {
    const response = await request(httpServer).get(`/products/${PRODUCT_ID}`);

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const product = requireRecord(readData(body)['product'], 'product');
    const variants = product['variants'];

    if (!Array.isArray(variants)) {
      throw new TypeError('Expected variants');
    }

    expect(requireRecord(variants[0], 'variant')['availableQuantity']).toBe(2);
  });

  it('rejects an invalid product identifier', async () => {
    const response = await request(httpServer).get('/products/not-a-uuid');

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });
});
