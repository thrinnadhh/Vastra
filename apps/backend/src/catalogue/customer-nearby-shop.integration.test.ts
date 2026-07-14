import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerNearbyShopController } from './customer-nearby-shop.controller';
import type { CustomerNearbyShopGateway } from './customer-nearby-shop.gateway';
import { CustomerNearbyShopService } from './customer-nearby-shop.service';
import { CUSTOMER_NEARBY_SHOP_GATEWAY } from './customer-nearby-shop.tokens';
import type {
  CustomerNearbyShopQuery,
  CustomerNearbyShopSnapshot,
} from './customer-nearby-shop.types';

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

class IntegrationGateway implements CustomerNearbyShopGateway {
  public listServiceableShops(
    _client: SupabaseClient,
    _query: CustomerNearbyShopQuery,
  ): Promise<readonly CustomerNearbyShopSnapshot[]> {
    void _client;
    void _query;

    return Promise.resolve([
      {
        id: SHOP_ID,
        name: 'Nearby Fashion Shop',
        slug: 'nearby-fashion-shop',
        description: null,
        operationalStatus: 'OPEN',
        acceptsOnlineOrders: true,
        distanceMeters: 125,
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

describe('customer nearby-shop integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [CustomerNearbyShopController],
      providers: [
        CustomerNearbyShopService,
        {
          provide: CUSTOMER_NEARBY_SHOP_GATEWAY,
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

  it('returns serviceable shops ordered by distance', async () => {
    const response = await request(httpServer).get('/shops/nearby').query({
      latitude: '13.6288',
      longitude: '79.4192',
      limit: '20',
    });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const data = readData(body);
    const shops = data['shops'];

    if (!Array.isArray(shops)) {
      throw new TypeError('Expected nearby shops');
    }

    expect(shops).toHaveLength(1);
    expect(requireRecord(shops[0], 'nearby shop')['distanceMeters']).toBe(125);
    expect(requireRecord(shops[0], 'nearby shop')['isServiceable']).toBe(true);
  });

  it('rejects invalid coordinates', async () => {
    const response = await request(httpServer).get('/shops/nearby').query({
      latitude: '91',
      longitude: '79.4192',
    });

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });
});
