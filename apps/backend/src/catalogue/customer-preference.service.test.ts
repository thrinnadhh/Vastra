import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerPreferenceGateway,
  CustomerFavouriteShopNotFoundError,
  CustomerPreferenceDataInvalidError,
  CustomerPreferenceGatewayUnavailableError,
} from './customer-preference.gateway';
import { CustomerPreferenceService } from './customer-preference.service';
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
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createPreferences(): CustomerPreferencesSnapshot {
  return {
    genderCategories: ['WOMEN'],
    styleTags: ['Casual'],
    occasionTags: ['Daily'],
    preferredColours: ['#112233'],
    preferredSizes: ['M'],
    minPricePaise: 10000,
    maxPricePaise: 50000,
    updatedAt: '2026-07-15T17:00:00.000Z',
  };
}

function createFavouriteShop(): CustomerFavouriteShopSnapshot {
  return {
    id: SHOP_ID,
    name: 'Favourite Shop',
    slug: 'favourite-shop',
    logoObjectKey: null,
    coverImageObjectKey: null,
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
    ratingAverage: 4.5,
    ratingCount: 20,
    followerCount: 11,
    favouritedAt: '2026-07-15T17:00:00.000Z',
  };
}

class StubGateway implements CustomerPreferenceGateway {
  public favouriteShops: readonly CustomerFavouriteShopSnapshot[] = [createFavouriteShop()];
  public preferences: CustomerPreferencesSnapshot = createPreferences();
  public error: Error | null = null;
  public setCall: { readonly shopId: string; readonly favourite: boolean } | null = null;
  public replaceInput: ReplaceCustomerPreferencesInput | null = null;

  public listFavouriteShops(
    _client: SupabaseClient,
  ): Promise<readonly CustomerFavouriteShopSnapshot[]> {
    void _client;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.favouriteShops);
  }

  public setFavouriteShop(
    _client: SupabaseClient,
    shopId: string,
    favourite: boolean,
  ): Promise<{ readonly shopId: string; readonly isFavourite: boolean }> {
    void _client;
    this.setCall = { shopId, favourite };

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve({ shopId, isFavourite: favourite });
  }

  public getPreferences(
    _client: SupabaseClient,
    _customerId: string,
  ): Promise<CustomerPreferencesSnapshot> {
    void _client;
    void _customerId;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.preferences);
  }

  public replacePreferences(
    _client: SupabaseClient,
    _customerId: string,
    input: ReplaceCustomerPreferencesInput,
  ): Promise<CustomerPreferencesSnapshot> {
    void _client;
    void _customerId;
    this.replaceInput = input;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    this.preferences = { ...input, updatedAt: '2026-07-15T17:00:00.000Z' };
    return Promise.resolve(this.preferences);
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

describe('CustomerPreferenceService', () => {
  let gateway: StubGateway;
  let service: CustomerPreferenceService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerPreferenceService(gateway);
  });

  it('lists favourite shops', async () => {
    const response = await service.listFavouriteShops(context);

    expect(response.data.shops).toHaveLength(1);
    expect(response.data.shops[0]?.id).toBe(SHOP_ID);
  });

  it('adds and removes a favourite shop idempotently', async () => {
    const added = await service.setFavouriteShop(context, SHOP_ID.toUpperCase(), true);

    expect(added.data).toStrictEqual({ shopId: SHOP_ID, isFavourite: true });
    expect(gateway.setCall).toStrictEqual({ shopId: SHOP_ID, favourite: true });

    const removed = await service.setFavouriteShop(context, SHOP_ID, false);
    expect(removed.data.isFavourite).toBe(false);
  });

  it('rejects an invalid favourite shop identifier', async () => {
    const error = await captureHttpException(
      service.setFavouriteShop(context, 'not-a-uuid', true),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.setCall).toBeNull();
  });

  it('reads customer preferences', async () => {
    const response = await service.getPreferences(context);

    expect(response.data.preferences).toStrictEqual(createPreferences());
  });

  it('normalizes and replaces customer preferences', async () => {
    const response = await service.replacePreferences(context, {
      genderCategories: ['WOMEN', 'UNISEX'],
      styleTags: [' Casual ', 'Minimal'],
      occasionTags: ['Daily'],
      preferredColours: ['#aabbcc'],
      preferredSizes: [' M '],
      minPricePaise: 10000,
      maxPricePaise: 60000,
    });

    expect(gateway.replaceInput).toStrictEqual({
      genderCategories: ['WOMEN', 'UNISEX'],
      styleTags: ['Casual', 'Minimal'],
      occasionTags: ['Daily'],
      preferredColours: ['#AABBCC'],
      preferredSizes: ['M'],
      minPricePaise: 10000,
      maxPricePaise: 60000,
    });
    expect(response.data.preferences.preferredColours).toStrictEqual(['#AABBCC']);
  });

  it.each([
    [{ unknown: true }],
    [{ genderCategories: ['INVALID'] }],
    [{ styleTags: ['Casual', 'casual'] }],
    [{ preferredColours: ['blue'] }],
    [{ minPricePaise: 500, maxPricePaise: 100 }],
    [{ preferredSizes: Array.from({ length: 21 }, () => 'M') }],
  ])('rejects invalid preference payloads', async (body) => {
    const error = await captureHttpException(service.replacePreferences(context, body));

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.replaceInput).toBeNull();
  });

  it('maps an unavailable favourite shop to not found', async () => {
    gateway.error = new CustomerFavouriteShopNotFoundError();

    const error = await captureHttpException(
      service.setFavouriteShop(context, SHOP_ID, true),
    );

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('SHOP_NOT_FOUND');
  });

  it('maps provider failures to a retryable response', async () => {
    gateway.error = new CustomerPreferenceGatewayUnavailableError();

    const error = await captureHttpException(service.getPreferences(context));

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });

  it('maps malformed preference data to an internal error', async () => {
    gateway.error = new CustomerPreferenceDataInvalidError();

    const error = await captureHttpException(service.listFavouriteShops(context));

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });
});
