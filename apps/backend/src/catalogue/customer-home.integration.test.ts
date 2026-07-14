import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import type { CategoryCatalogueGateway } from './category-catalogue.gateway';
import type { MerchantCatalogueCategorySnapshot } from './category-catalogue.types';
import type { CustomerCatalogueReadGateway } from './customer-catalogue-read.gateway';
import { CUSTOMER_CATALOGUE_READ_GATEWAY } from './customer-catalogue-read.tokens';
import type {
  CustomerCatalogueProductDetail,
  CustomerCatalogueProductPage,
  CustomerCatalogueShopSnapshot,
} from './customer-catalogue-read.types';
import { CustomerHomeController } from './customer-home.controller';
import { CustomerHomeService } from './customer-home.service';
import type { CustomerNearbyShopGateway } from './customer-nearby-shop.gateway';
import { CUSTOMER_NEARBY_SHOP_GATEWAY } from './customer-nearby-shop.tokens';
import type {
  CustomerNearbyShopQuery,
  CustomerNearbyShopSnapshot,
} from './customer-nearby-shop.types';
import { CATEGORY_CATALOGUE_GATEWAY } from './category-catalogue.tokens';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const CATEGORY_ID = '30000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
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

class IntegrationCategoryGateway implements CategoryCatalogueGateway {
  public findActiveCategories(
    _client: SupabaseClient,
  ): Promise<readonly MerchantCatalogueCategorySnapshot[]> {
    void _client;
    return Promise.resolve([
      {
        id: CATEGORY_ID,
        parentId: null,
        name: 'Kurtas',
        slug: 'kurtas',
        description: null,
        iconObjectKey: null,
        displayOrder: 1,
      },
    ]);
  }

  public findActiveCategoryById(
    _client: SupabaseClient,
    _categoryId: string,
  ): Promise<MerchantCatalogueCategorySnapshot | null> {
    void _client;
    void _categoryId;
    return Promise.resolve(null);
  }
}

class IntegrationNearbyGateway implements CustomerNearbyShopGateway {
  public listServiceableShops(
    _client: SupabaseClient,
    _query: CustomerNearbyShopQuery,
  ): Promise<readonly CustomerNearbyShopSnapshot[]> {
    void _client;
    void _query;
    return Promise.resolve([
      {
        id: SHOP_ID,
        name: 'Public Fashion Shop',
        slug: 'public-fashion-shop',
        description: null,
        operationalStatus: 'OPEN',
        acceptsOnlineOrders: true,
        distanceMeters: 100,
        serviceRadiusMeters: 5000,
        minimumOrderPaise: 0,
        averagePreparationMinutes: 15,
        ratingAverage: null,
        ratingCount: 0,
        followerCount: 0,
        isServiceable: true,
      },
    ]);
  }
}

class IntegrationCatalogueGateway implements CustomerCatalogueReadGateway {
  public findPublicShop(
    _client: SupabaseClient,
    _shopId: string,
  ): Promise<CustomerCatalogueShopSnapshot | null> {
    void _client;
    void _shopId;
    return Promise.resolve(null);
  }

  public listPublicProducts(
    _client: SupabaseClient,
    _shopId: string,
    _cursor: string | null,
    _limit: number,
  ): Promise<CustomerCatalogueProductPage> {
    void _client;
    void _shopId;
    void _cursor;
    void _limit;
    return Promise.resolve({
      products: [
        {
          id: PRODUCT_ID,
          shopId: SHOP_ID,
          categoryId: CATEGORY_ID,
          name: 'Silk Kurta',
          slug: 'silk-kurta',
          brand: null,
          genderCategory: 'WOMEN',
          primaryImage: null,
          minSellingPricePaise: 120000,
          maxSellingPricePaise: 120000,
          availableVariantCount: 1,
          totalAvailableQuantity: 3,
          isAvailable: true,
        },
      ],
      nextCursor: null,
    });
  }

  public findPublicProduct(
    _client: SupabaseClient,
    _productId: string,
  ): Promise<CustomerCatalogueProductDetail | null> {
    void _client;
    void _productId;
    return Promise.resolve(null);
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

describe('customer home integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [CustomerHomeController],
      providers: [
        CustomerHomeService,
        {
          provide: CATEGORY_CATALOGUE_GATEWAY,
          useValue: new IntegrationCategoryGateway(),
        },
        {
          provide: CUSTOMER_NEARBY_SHOP_GATEWAY,
          useValue: new IntegrationNearbyGateway(),
        },
        {
          provide: CUSTOMER_CATALOGUE_READ_GATEWAY,
          useValue: new IntegrationCatalogueGateway(),
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

  it('returns all composed home sections', async () => {
    const response = await request(httpServer).get('/customer/home').query({
      latitude: '13.6288',
      longitude: '79.4192',
    });

    expect(response.status).toBe(200);
    const data = readData(response.body as unknown);

    expect(data['categories']).toHaveLength(1);
    expect(data['nearbyShops']).toHaveLength(1);
    expect(data['nearbyProducts']).toHaveLength(1);
  });

  it('rejects a missing serviceable location', async () => {
    const response = await request(httpServer).get('/customer/home');

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body as unknown)).toBe('VALIDATION_ERROR');
  });
});
