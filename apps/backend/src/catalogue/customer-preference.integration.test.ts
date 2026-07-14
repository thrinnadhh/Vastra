import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerPreferenceController } from './customer-preference.controller';
import type { CustomerPreferenceGateway } from './customer-preference.gateway';
import { CustomerPreferenceService } from './customer-preference.service';
import { CUSTOMER_PREFERENCE_GATEWAY } from './customer-preference.tokens';
import type {
  CustomerFavouriteShopSnapshot,
  CustomerPreferencesSnapshot,
  ReplaceCustomerPreferencesInput,
} from './customer-preference.types';

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

class IntegrationGateway implements CustomerPreferenceGateway {
  public listFavouriteShops(
    _client: SupabaseClient,
  ): Promise<readonly CustomerFavouriteShopSnapshot[]> {
    void _client;

    return Promise.resolve([
      {
        id: SHOP_ID,
        name: 'Favourite Shop',
        slug: 'favourite-shop',
        logoObjectKey: null,
        coverImageObjectKey: null,
        operationalStatus: 'OPEN',
        acceptsOnlineOrders: true,
        ratingAverage: null,
        ratingCount: 0,
        followerCount: 1,
        favouritedAt: '2026-07-15T17:00:00.000Z',
      },
    ]);
  }

  public setFavouriteShop(
    _client: SupabaseClient,
    shopId: string,
    favourite: boolean,
  ): Promise<{ readonly shopId: string; readonly isFavourite: boolean }> {
    void _client;
    return Promise.resolve({ shopId, isFavourite: favourite });
  }

  public getPreferences(
    _client: SupabaseClient,
    _customerId: string,
  ): Promise<CustomerPreferencesSnapshot> {
    void _client;
    void _customerId;

    return Promise.resolve({
      genderCategories: [],
      styleTags: [],
      occasionTags: [],
      preferredColours: [],
      preferredSizes: [],
      minPricePaise: null,
      maxPricePaise: null,
      updatedAt: null,
    });
  }

  public replacePreferences(
    _client: SupabaseClient,
    _customerId: string,
    input: ReplaceCustomerPreferencesInput,
  ): Promise<CustomerPreferencesSnapshot> {
    void _client;
    void _customerId;
    return Promise.resolve({ ...input, updatedAt: '2026-07-15T17:00:00.000Z' });
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

describe('customer favourite shops and preferences integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [CustomerPreferenceController],
      providers: [
        CustomerPreferenceService,
        {
          provide: CUSTOMER_PREFERENCE_GATEWAY,
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

  it('lists favourite shops', async () => {
    const response = await request(httpServer).get('/customer/favourite-shops');

    expect(response.status).toBe(200);
    const shops = readData(response.body)['shops'];

    if (!Array.isArray(shops)) {
      throw new TypeError('Expected favourite shops');
    }

    expect(requireRecord(shops[0], 'favourite shop')['id']).toBe(SHOP_ID);
  });

  it('adds and removes favourite shops', async () => {
    const addResponse = await request(httpServer).put(
      `/customer/favourite-shops/${SHOP_ID}`,
    );
    const removeResponse = await request(httpServer).delete(
      `/customer/favourite-shops/${SHOP_ID}`,
    );

    expect(addResponse.status).toBe(200);
    expect(readData(addResponse.body)['isFavourite']).toBe(true);
    expect(removeResponse.status).toBe(200);
    expect(readData(removeResponse.body)['isFavourite']).toBe(false);
  });

  it('reads default preferences', async () => {
    const response = await request(httpServer).get('/customer/preferences');

    expect(response.status).toBe(200);
    const preferences = requireRecord(
      readData(response.body)['preferences'],
      'preferences',
    );
    expect(preferences['genderCategories']).toStrictEqual([]);
  });

  it('replaces and normalizes preferences', async () => {
    const response = await request(httpServer).put('/customer/preferences').send({
      genderCategories: ['WOMEN'],
      styleTags: [' Casual '],
      preferredColours: ['#aabbcc'],
      minPricePaise: 10000,
      maxPricePaise: 50000,
    });

    expect(response.status).toBe(200);
    const preferences = requireRecord(
      readData(response.body)['preferences'],
      'preferences',
    );
    expect(preferences['styleTags']).toStrictEqual(['Casual']);
    expect(preferences['preferredColours']).toStrictEqual(['#AABBCC']);
  });

  it('rejects invalid preference payloads', async () => {
    const response = await request(httpServer).put('/customer/preferences').send({
      preferredColours: ['blue'],
    });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });
});
