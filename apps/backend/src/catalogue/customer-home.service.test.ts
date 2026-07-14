import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CategoryCatalogueGateway,
  CategoryCatalogueDataInvalidError,
} from './category-catalogue.gateway';
import type { MerchantCatalogueCategorySnapshot } from './category-catalogue.types';
import {
  type CustomerCatalogueReadGateway,
  CustomerCatalogueReadGatewayUnavailableError,
} from './customer-catalogue-read.gateway';
import type {
  CustomerCatalogueProductDetail,
  CustomerCatalogueProductPage,
  CustomerCatalogueShopSnapshot,
} from './customer-catalogue-read.types';
import { CustomerHomeService } from './customer-home.service';
import {
  type CustomerNearbyShopGateway,
  CustomerNearbyShopDataInvalidError,
} from './customer-nearby-shop.gateway';
import type {
  CustomerNearbyShopQuery,
  CustomerNearbyShopSnapshot,
} from './customer-nearby-shop.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SHOP_ONE_ID = '20000000-0000-4000-8000-000000000001';
const SHOP_TWO_ID = '20000000-0000-4000-8000-000000000002';
const CATEGORY_ID = '30000000-0000-4000-8000-000000000001';
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

function createShop(id: string, distanceMeters: number): CustomerNearbyShopSnapshot {
  return {
    id,
    name: `Shop ${id.slice(-1)}`,
    slug: `shop-${id.slice(-1)}`,
    description: null,
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
    distanceMeters,
    serviceRadiusMeters: 5000,
    minimumOrderPaise: 0,
    averagePreparationMinutes: 15,
    ratingAverage: null,
    ratingCount: 0,
    followerCount: 0,
    isServiceable: true,
  };
}

function createPage(shopId: string, suffixes: readonly string[]): CustomerCatalogueProductPage {
  return {
    products: suffixes.map((suffix) => ({
      id: `40000000-0000-4000-8000-0000000000${suffix}`,
      shopId,
      categoryId: CATEGORY_ID,
      name: `Product ${suffix}`,
      slug: `product-${suffix}`,
      brand: null,
      genderCategory: 'UNISEX',
      primaryImage: null,
      minSellingPricePaise: 10000,
      maxSellingPricePaise: 10000,
      availableVariantCount: 1,
      totalAvailableQuantity: 1,
      isAvailable: true,
    })),
    nextCursor: null,
  };
}

class StubCategoryGateway implements CategoryCatalogueGateway {
  public error: Error | null = null;

  public findActiveCategories(
    _client: SupabaseClient,
  ): Promise<readonly MerchantCatalogueCategorySnapshot[]> {
    void _client;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

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

class StubNearbyGateway implements CustomerNearbyShopGateway {
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

    return Promise.resolve([createShop(SHOP_ONE_ID, 100), createShop(SHOP_TWO_ID, 200)]);
  }
}

class StubCatalogueGateway implements CustomerCatalogueReadGateway {
  public error: Error | null = null;
  public calls: string[] = [];

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
    shopId: string,
    _cursor: string | null,
    _limit: number,
  ): Promise<CustomerCatalogueProductPage> {
    void _client;
    void _cursor;
    void _limit;
    this.calls.push(shopId);

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(
      shopId === SHOP_ONE_ID ? createPage(shopId, ['01', '03']) : createPage(shopId, ['02', '04']),
    );
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

describe('CustomerHomeService', () => {
  let categories: StubCategoryGateway;
  let nearby: StubNearbyGateway;
  let catalogue: StubCatalogueGateway;
  let service: CustomerHomeService;

  beforeEach(() => {
    categories = new StubCategoryGateway();
    nearby = new StubNearbyGateway();
    catalogue = new StubCatalogueGateway();
    service = new CustomerHomeService(categories, nearby, catalogue);
  });

  it('composes categories, shops, and round-robin products', async () => {
    const response = await service.getHome(context, '13.6288', '79.4192', undefined, '4');

    expect(response.data.categories).toHaveLength(1);
    expect(response.data.nearbyShops).toHaveLength(2);
    expect(response.data.nearbyProducts.map((item) => item.product.id)).toStrictEqual([
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000004',
    ]);
    expect(nearby.query).toStrictEqual({
      latitude: 13.6288,
      longitude: 79.4192,
      limit: 8,
    });
    expect(catalogue.calls).toStrictEqual([SHOP_ONE_ID, SHOP_TWO_ID]);
  });

  it('rejects invalid coordinates before calling gateways', async () => {
    const error = await captureHttpException(
      service.getHome(context, '91', '79.4192', undefined, undefined),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(nearby.query).toBeNull();
  });

  it('maps provider failures to a retryable response', async () => {
    catalogue.error = new CustomerCatalogueReadGatewayUnavailableError();

    const error = await captureHttpException(
      service.getHome(context, '13.6288', '79.4192', undefined, undefined),
    );

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });

  it('maps malformed composition data to an internal error', async () => {
    nearby.error = new CustomerNearbyShopDataInvalidError();

    const error = await captureHttpException(
      service.getHome(context, '13.6288', '79.4192', undefined, undefined),
    );

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });

  it('maps malformed category data to an internal error', async () => {
    categories.error = new CategoryCatalogueDataInvalidError();

    const error = await captureHttpException(
      service.getHome(context, '13.6288', '79.4192', undefined, undefined),
    );

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });
});
