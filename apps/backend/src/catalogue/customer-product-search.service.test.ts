import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { CustomerCatalogueProductCard } from './customer-catalogue-read.types';
import {
  type CustomerProductSearchGateway,
  CustomerProductSearchDataInvalidError,
  CustomerProductSearchGatewayUnavailableError,
} from './customer-product-search.gateway';
import { CustomerProductSearchService } from './customer-product-search.service';
import type {
  CustomerProductSearchItem,
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
  accessToken: 'unit-token',
  supabase: emptyClient,
};

function createProduct(): CustomerCatalogueProductCard {
  return {
    id: PRODUCT_ID,
    shopId: SHOP_ID,
    categoryId: CATEGORY_ID,
    name: 'Silk Kurta',
    slug: 'silk-kurta',
    brand: 'Vastra Local',
    genderCategory: 'WOMEN',
    primaryImage: null,
    minSellingPricePaise: 120000,
    maxSellingPricePaise: 120000,
    availableVariantCount: 1,
    totalAvailableQuantity: 4,
    isAvailable: true,
  };
}

function createItem(): CustomerProductSearchItem {
  return {
    product: createProduct(),
    shop: {
      id: SHOP_ID,
      name: 'Public Fashion Shop',
      slug: 'public-fashion-shop',
      operationalStatus: 'OPEN',
      acceptsOnlineOrders: true,
      distanceMeters: 250,
      isServiceable: true,
    },
  };
}

class StubGateway implements CustomerProductSearchGateway {
  public page: CustomerProductSearchPage = {
    results: [createItem()],
    nextOffset: 20,
  };
  public error: Error | null = null;
  public query: CustomerProductSearchQuery | null = null;

  public searchPublicProducts(
    _client: SupabaseClient,
    query: CustomerProductSearchQuery,
  ): Promise<CustomerProductSearchPage> {
    void _client;
    this.query = query;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.page);
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

describe('CustomerProductSearchService', () => {
  let gateway: StubGateway;
  let service: CustomerProductSearchService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerProductSearchService(gateway);
  });

  it('normalizes search and returns an opaque cursor', async () => {
    const response = await service.searchProducts(
      context,
      '  silk   kurta ',
      '13.6288',
      '79.4192',
      CATEGORY_ID,
      'WOMEN',
      SHOP_ID,
      '100000',
      '150000',
      'true',
      'PRICE_ASC',
      undefined,
      '20',
    );

    expect(response.data.query).toBe('silk kurta');
    expect(response.data.nextCursor).toBe('djE6MjA');
    expect(gateway.query).toStrictEqual({
      term: 'silk kurta',
      latitude: 13.6288,
      longitude: 79.4192,
      categoryId: CATEGORY_ID,
      genderCategory: 'WOMEN',
      shopId: SHOP_ID,
      minPricePaise: 100000,
      maxPricePaise: 150000,
      availableOnly: true,
      sort: 'PRICE_ASC',
      offset: 0,
      limit: 20,
    });
  });

  it('decodes a valid continuation cursor', async () => {
    gateway.page = {
      results: [],
      nextOffset: null,
    };

    await service.searchProducts(
      context,
      'kurta',
      '13.6288',
      '79.4192',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'djE6MjA',
      undefined,
    );

    expect(gateway.query?.offset).toBe(20);
  });

  it.each([
    ['k', '13.6288', '79.4192', undefined, undefined],
    ['kurta', '91', '79.4192', undefined, undefined],
    ['kurta', '13.6288', '79.4192', '200', '100'],
  ])('rejects invalid search inputs', async (term, latitude, longitude, minPrice, maxPrice) => {
    const error = await captureHttpException(
      service.searchProducts(
        context,
        term,
        latitude,
        longitude,
        undefined,
        undefined,
        undefined,
        minPrice,
        maxPrice,
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.query).toBeNull();
  });

  it('maps provider failures to a retryable response', async () => {
    gateway.error = new CustomerProductSearchGatewayUnavailableError();

    const error = await captureHttpException(
      service.searchProducts(
        context,
        'kurta',
        '13.6288',
        '79.4192',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });

  it('maps malformed search data to an internal error', async () => {
    gateway.error = new CustomerProductSearchDataInvalidError();

    const error = await captureHttpException(
      service.searchProducts(
        context,
        'kurta',
        '13.6288',
        '79.4192',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });
});
