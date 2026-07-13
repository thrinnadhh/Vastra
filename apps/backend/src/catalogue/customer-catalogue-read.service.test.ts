import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerCatalogueReadGateway,
  CustomerCatalogueReadDataInvalidError,
  CustomerCatalogueReadGatewayUnavailableError,
} from './customer-catalogue-read.gateway';
import { CustomerCatalogueReadService } from './customer-catalogue-read.service';
import type {
  CustomerCatalogueProductCard,
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
  accessToken: 'unit-token',
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

function createCard(): CustomerCatalogueProductCard {
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
    totalAvailableQuantity: 3,
    isAvailable: true,
  };
}

function createDetail(): CustomerCatalogueProductDetail {
  return {
    ...createCard(),
    shop: createShop(),
    description: 'Everyday kurta',
    material: 'Cotton',
    styleTags: ['casual'],
    occasionTags: ['daily'],
    careInstructions: 'Cold wash',
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
        availableQuantity: 3,
        isAvailable: true,
      },
    ],
  };
}

class StubGateway implements CustomerCatalogueReadGateway {
  public shop: CustomerCatalogueShopSnapshot | null = createShop();
  public page: CustomerCatalogueProductPage = {
    products: [createCard()],
    nextCursor: null,
  };
  public detail: CustomerCatalogueProductDetail | null = createDetail();
  public error: Error | null = null;
  public listArgs: {
    readonly shopId: string;
    readonly cursor: string | null;
    readonly limit: number;
  } | null = null;
  public detailProductId: string | null = null;

  public findPublicShop(
    _client: SupabaseClient,
    _shopId: string,
  ): Promise<CustomerCatalogueShopSnapshot | null> {
    void _client;
    void _shopId;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.shop);
  }

  public listPublicProducts(
    _client: SupabaseClient,
    shopId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CustomerCatalogueProductPage> {
    void _client;
    this.listArgs = { shopId, cursor, limit };

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.page);
  }

  public findPublicProduct(
    _client: SupabaseClient,
    productId: string,
  ): Promise<CustomerCatalogueProductDetail | null> {
    void _client;
    this.detailProductId = productId;

    if (this.error !== null) {
      return Promise.reject(this.error);
    }

    return Promise.resolve(this.detail);
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

describe('CustomerCatalogueReadService', () => {
  let gateway: StubGateway;
  let service: CustomerCatalogueReadService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new CustomerCatalogueReadService(gateway);
  });

  it('lists public shop products with stable defaults', async () => {
    const response = await service.listShopProducts(context, SHOP_ID, undefined, undefined);

    expect(response.data.shop.id).toBe(SHOP_ID);
    expect(response.data.products).toHaveLength(1);
    expect(gateway.listArgs).toStrictEqual({
      shopId: SHOP_ID,
      cursor: null,
      limit: 20,
    });
  });

  it('passes a UUID cursor and bounded limit', async () => {
    await service.listShopProducts(context, SHOP_ID, PRODUCT_ID, '50');

    expect(gateway.listArgs).toStrictEqual({
      shopId: SHOP_ID,
      cursor: PRODUCT_ID,
      limit: 50,
    });
  });

  it('rejects invalid list identifiers before querying', async () => {
    const error = await captureHttpException(
      service.listShopProducts(context, 'not-a-uuid', undefined, undefined),
    );

    expect(error.getStatus()).toBe(400);
    expect(readCode(error)).toBe('VALIDATION_ERROR');
    expect(gateway.listArgs).toBeNull();
  });

  it('hides a non-public shop', async () => {
    gateway.shop = null;

    const error = await captureHttpException(
      service.listShopProducts(context, SHOP_ID, undefined, undefined),
    );

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('SHOP_NOT_FOUND');
  });

  it('returns approved active product detail with availability', async () => {
    const response = await service.getProduct(context, PRODUCT_ID);

    expect(response.data.product.variants[0]?.availableQuantity).toBe(3);
    expect(gateway.detailProductId).toBe(PRODUCT_ID);
  });

  it('hides a non-public product', async () => {
    gateway.detail = null;

    const error = await captureHttpException(service.getProduct(context, PRODUCT_ID));

    expect(error.getStatus()).toBe(404);
    expect(readCode(error)).toBe('PRODUCT_NOT_FOUND');
  });

  it('maps provider failures to a retryable error', async () => {
    gateway.error = new CustomerCatalogueReadGatewayUnavailableError();

    const error = await captureHttpException(service.getProduct(context, PRODUCT_ID));

    expect(error.getStatus()).toBe(503);
    expect(readCode(error)).toBe('EXTERNAL_SERVICE_UNAVAILABLE');
  });

  it('maps inconsistent public catalogue data to an internal error', async () => {
    gateway.error = new CustomerCatalogueReadDataInvalidError();

    const error = await captureHttpException(service.getProduct(context, PRODUCT_ID));

    expect(error.getStatus()).toBe(500);
    expect(readCode(error)).toBe('CATALOGUE_STATE_INVALID');
  });
});
