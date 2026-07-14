import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerShopDetailController } from './customer-shop-detail.controller';
import type { CustomerShopDetailGateway } from './customer-shop-detail.gateway';
import { CustomerShopDetailService } from './customer-shop-detail.service';
import { CUSTOMER_SHOP_DETAIL_GATEWAY } from './customer-shop-detail.tokens';
import type {
  CustomerShopDetailCore,
  CustomerShopDetailQuery,
  CustomerShopHourRecord,
} from './customer-shop-detail.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ID = '20000000-0000-4000-8000-000000000001';
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

class IntegrationGateway implements CustomerShopDetailGateway {
  public findPublicShopDetail(
    _client: SupabaseClient,
    _query: CustomerShopDetailQuery,
  ): Promise<CustomerShopDetailCore | null> {
    void _client;
    void _query;

    return Promise.resolve({
      id: SHOP_ID,
      name: 'Public Fashion Shop',
      slug: 'public-fashion-shop',
      description: null,
      phoneNumber: '9000000000',
      email: null,
      latitude: 13.6288,
      longitude: 79.4192,
      operationalStatus: 'OPEN',
      acceptsOnlineOrders: true,
      distanceMeters: 100,
      serviceRadiusMeters: 5000,
      isServiceable: true,
      minimumOrderPaise: 0,
      averagePreparationMinutes: 15,
      ratingAverage: null,
      ratingCount: 0,
      followerCount: 0,
    });
  }

  public listPublicShopHours(
    _client: SupabaseClient,
    _shopId: string,
  ): Promise<readonly CustomerShopHourRecord[]> {
    void _client;
    void _shopId;

    return Promise.resolve([
      {
        scheduleType: 'WEEKLY',
        dayOfWeek: 3,
        specialDate: null,
        isClosed: false,
        opensAt: '09:00:00',
        closesAt: '21:00:00',
      },
    ]);
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

describe('customer shop-detail integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T05:00:00.000Z'));

    const testingModule = await Test.createTestingModule({
      controllers: [CustomerShopDetailController],
      providers: [
        CustomerShopDetailService,
        {
          provide: CUSTOMER_SHOP_DETAIL_GATEWAY,
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
    vi.useRealTimers();

    if (app !== undefined) {
      await app.close();
    }
  });

  it('returns public shop detail and ordering status', async () => {
    const response = await request(httpServer).get(`/shops/${SHOP_ID}`).query({
      latitude: '13.6288',
      longitude: '79.4192',
    });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const shop = requireRecord(readData(body)['shop'], 'shop');

    expect(shop['orderingStatus']).toBe('ACCEPTING_ORDERS');
    expect(shop['canPlaceOrder']).toBe(true);
    expect(requireRecord(shop['serviceability'], 'serviceability')['isServiceable']).toBe(true);
  });

  it('rejects a request without a serviceable location', async () => {
    const response = await request(httpServer).get(`/shops/${SHOP_ID}`);

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });
});
