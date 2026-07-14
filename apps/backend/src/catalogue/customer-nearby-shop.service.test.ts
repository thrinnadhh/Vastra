import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerNearbyShopGateway,
  CustomerNearbyShopDataInvalidError,
  CustomerNearbyShopGatewayUnavailableError,
} from './customer-nearby-shop.gateway';
import { CustomerNearbyShopService } from './customer-nearby-shop.service';
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
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createShop(): CustomerNearbyShopSnapshot {
  return {
    id: SHOP_ID,
    name: 'Nearby Fashion Shop',
    slug: 'nearby-fashion-shop',
    description: 'Fashion close to home',
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
    distanceMeters: 250,
    serviceRadiusMeters: 5000,
    minimumOrderPaise: 0,
    averagePreparationMinutes: 15,
    ratingAverage: 4.5,
    ratingCount: 10,
    followerCount: 25,
    isServiceable: true,
  };
}

class StubGateway implements CustomerNearbyShopGateway {
  public shops: readonly CustomerNearbyShopSnapshot[] = [createShop()];
  public error: Error | null = null;
  public query: CustomerNearbyShopQuery | null = null;

  public listServiceableShops(
    _client: SupabaseClient,
    query: CustomerNearbyShopQuery,
  ): Promise<readonly CustomerNearbyShopSnapshot[]> {
    void _client;
    this.query = query;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.shops);
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

describe('CustomerNearbyShopService', () => {
  let gateway: StubGateway;
  let service: CustomerNearbyShopService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerNearbyShopService(gateway);
  });

  it('lists serviceable shops with the default limit', async () => {
    const response = await service.listNearbyShops(context, '13.6288', '79.4192', undefined);

    expect(response.data.location).toStrictEqual({
      latitude: 13.6288,
      longitude: 79.4192,
    });
    expect(response.data.shops).toHaveLength(1);
    expect(gateway.query).toStrictEqual({
      latitude: 13.6288,
      longitude: 79.4192,
      limit: 20,
    });
  });

  it('accepts coordinate boundaries and the maximum limit', async () => {
    await service.listNearbyShops(context, '-90', '180', '50');

    expect(gateway.query).toStrictEqual({
      latitude: -90,
      longitude: 180,
      limit: 50,
    });
  });

  it('allows an empty serviceable result', async () => {
    gateway.shops = [];

    const response = await service.listNearbyShops(context, '13.6288', '79.4192', undefined);

    expect(response.data.shops).toStrictEqual([]);
  });

  it.each([
    ['91', '79.4192', undefined],
    ['13.6288', '-181', undefined],
    ['NaN', '79.4192', undefined],
    ['13.6288', '79.4192', '0'],
    ['13.6288', '79.4192', '51'],
  ])('rejects invalid nearby-shop query values', async (latitude, longitude, limit) => {
    const error = await captureHttpException(
      service.listNearbyShops(context, latitude, longitude, limit),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.query).toBeNull();
  });

  it('maps provider failures to a retryable response', async () => {
    gateway.error = new CustomerNearbyShopGatewayUnavailableError();

    const error = await captureHttpException(
      service.listNearbyShops(context, '13.6288', '79.4192', undefined),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });

  it('maps malformed geospatial rows to an internal error', async () => {
    gateway.error = new CustomerNearbyShopDataInvalidError();

    const error = await captureHttpException(
      service.listNearbyShops(context, '13.6288', '79.4192', undefined),
    );

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });
});
