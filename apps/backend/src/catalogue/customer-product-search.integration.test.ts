import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerProductSearchController } from './customer-product-search.controller';
import type { CustomerProductSearchGateway } from './customer-product-search.gateway';
import { CustomerProductSearchService } from './customer-product-search.service';
import { CUSTOMER_PRODUCT_SEARCH_GATEWAY } from './customer-product-search.tokens';
import type {
  CustomerProductSearchPage,
  CustomerProductSearchQuery,
} from './customer-product-search.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '20000000-0000-4000-8000-000000000001';
const SHOP_ID = '30000000-0000-4000-8000-000000000001';
const CATEGORY_ID = '40000000-0000-4000-8000-000000000001';
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

class IntegrationGateway implements CustomerProductSearchGateway {
  public searchPublicProducts(
    _client: SupabaseClient,
    _query: CustomerProductSearchQuery,
  ): Promise<CustomerProductSearchPage> {
    void _client;
    void _query;

    return Promise.resolve({
      results: [
        {
          product: {
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
          shop: {
            id: SHOP_ID,
            name: 'Public Fashion Shop',
            slug: 'public-fashion-shop',
            operationalStatus: 'OPEN',
            acceptsOnlineOrders: true,
            distanceMeters: 125,
            isServiceable: true,
          },
        },
      ],
      nextOffset: null,
    });
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

describe('customer product-search integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [CustomerProductSearchController],
      providers: [
        CustomerProductSearchService,
        {
          provide: CUSTOMER_PRODUCT_SEARCH_GATEWAY,
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

  it('returns serviceable product-search results', async () => {
    const response = await request(httpServer).get('/customer/products/search').query({
      q: 'silk kurta',
      latitude: '13.6288',
      longitude: '79.4192',
      availableOnly: 'true',
    });

    expect(response.status).toBe(200);
    const data = readData(response.body as unknown);
    const results = data['results'];

    if (!Array.isArray(results)) {
      throw new TypeError('Expected product-search results');
    }

    expect(results).toHaveLength(1);
    const result = requireRecord(results[0], 'search result');
    expect(requireRecord(result['shop'], 'search shop')['isServiceable']).toBe(true);
  });

  it('rejects a missing search term', async () => {
    const response = await request(httpServer).get('/customer/products/search').query({
      latitude: '13.6288',
      longitude: '79.4192',
    });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body as unknown)).toBe('VALIDATION_ERROR');
  });
});
