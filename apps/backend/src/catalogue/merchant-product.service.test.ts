import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { CategoryCatalogueService } from './category-catalogue.service';
import {
  type MerchantProductGateway,
  MerchantProductGatewayUnavailableError,
  MerchantProductSlugConflictError,
} from './merchant-product.gateway';
import { MerchantProductService } from './merchant-product.service';
import type {
  CreateMerchantProductInput,
  MerchantProductSnapshot,
  UpdateMerchantProductInput,
} from './merchant-product.types';
import type { MerchantShopContextService } from './merchant-shop-context.service';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_SHOP_ID = '20000000-0000-4000-8000-000000000002';
const CATEGORY_ID = '30000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const MISSING_PRODUCT_ID = '40000000-0000-4000-8000-000000000002';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'merchant-token',
  supabase: emptyClient,
};

function createProduct(overrides: Partial<MerchantProductSnapshot> = {}): MerchantProductSnapshot {
  return {
    id: PRODUCT_ID,
    shopId: SHOP_ID,
    categoryId: CATEGORY_ID,
    name: 'Blue Kurta',
    slug: 'blue-kurta',
    description: 'Cotton kurta',
    brand: 'Vastra',
    material: 'Cotton',
    genderCategory: 'WOMEN',
    styleTags: ['ETHNIC'],
    occasionTags: ['FESTIVE'],
    careInstructions: 'Hand wash',
    returnEligible: true,
    returnWindowDays: 7,
    moderationStatus: 'PENDING',
    isActive: true,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

class RecordingShopContextService {
  public shopIds: string[] = [];

  public requireOwnedShop(
    _context: AuthenticatedRequestContext,
    shopId: string,
  ): Promise<{ readonly id: string }> {
    this.shopIds.push(shopId);

    if (shopId === OTHER_SHOP_ID) {
      return Promise.reject(
        new HttpException(
          {
            success: false,
            error: {
              code: 'SHOP_NOT_FOUND',
              message: 'Missing',
              details: null,
              retryable: false,
            },
            requestId: null,
          },
          404,
        ),
      );
    }

    return Promise.resolve({ id: shopId });
  }
}

class RecordingCategoryCatalogueService {
  public categoryIds: string[] = [];

  public requireActiveCategory(
    _context: AuthenticatedRequestContext,
    categoryId: string,
  ): Promise<{ readonly id: string }> {
    this.categoryIds.push(categoryId);
    return Promise.resolve({ id: categoryId });
  }
}

class RecordingMerchantProductGateway implements MerchantProductGateway {
  public mode: 'SUCCESS' | 'MISSING' | 'CONFLICT' | 'UNAVAILABLE' = 'SUCCESS';
  public lastCreate: CreateMerchantProductInput | null = null;
  public lastUpdate: {
    readonly input: UpdateMerchantProductInput;
    readonly resetModeration: boolean;
  } | null = null;

  public findOwnedProducts(): Promise<readonly MerchantProductSnapshot[]> {
    if (this.mode === 'UNAVAILABLE') {
      return Promise.reject(new MerchantProductGatewayUnavailableError());
    }

    return Promise.resolve([createProduct()]);
  }

  public findOwnedProductById(
    _client: SupabaseClient,
    _shopId: string,
    productId: string,
  ): Promise<MerchantProductSnapshot | null> {
    if (this.mode === 'UNAVAILABLE') {
      return Promise.reject(new MerchantProductGatewayUnavailableError());
    }

    if (this.mode === 'MISSING' || productId === MISSING_PRODUCT_ID) {
      return Promise.resolve(null);
    }

    return Promise.resolve(createProduct());
  }

  public createProduct(
    _shopId: string,
    input: CreateMerchantProductInput,
  ): Promise<MerchantProductSnapshot> {
    if (this.mode === 'CONFLICT') {
      return Promise.reject(new MerchantProductSlugConflictError());
    }

    if (this.mode === 'UNAVAILABLE') {
      return Promise.reject(new MerchantProductGatewayUnavailableError());
    }

    this.lastCreate = input;
    return Promise.resolve(
      createProduct({
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
      }),
    );
  }

  public updateProduct(
    _shopId: string,
    _productId: string,
    input: UpdateMerchantProductInput,
    resetModeration: boolean,
  ): Promise<MerchantProductSnapshot | null> {
    if (this.mode === 'MISSING') {
      return Promise.resolve(null);
    }

    if (this.mode === 'CONFLICT') {
      return Promise.reject(new MerchantProductSlugConflictError());
    }

    this.lastUpdate = {
      input,
      resetModeration,
    };

    return Promise.resolve(
      createProduct({
        name: input.name ?? 'Blue Kurta',
        isActive: input.isActive ?? true,
        moderationStatus: resetModeration ? 'PENDING' : 'APPROVED',
      }),
    );
  }

  public archiveProduct(): Promise<boolean> {
    return Promise.resolve(this.mode !== 'MISSING');
  }
}

function readErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected error response object');
  }

  const bodyError = (response as Record<string, unknown>)['error'];

  if (typeof bodyError !== 'object' || bodyError === null || Array.isArray(bodyError)) {
    throw new TypeError('Expected nested error object');
  }

  const code = (bodyError as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected string error code');
  }

  return code;
}

describe('MerchantProductService', () => {
  let shopService: RecordingShopContextService;
  let categoryService: RecordingCategoryCatalogueService;
  let gateway: RecordingMerchantProductGateway;
  let service: MerchantProductService;

  beforeEach(() => {
    shopService = new RecordingShopContextService();
    categoryService = new RecordingCategoryCatalogueService();
    gateway = new RecordingMerchantProductGateway();
    service = new MerchantProductService(
      shopService as unknown as MerchantShopContextService,
      categoryService as unknown as CategoryCatalogueService,
      gateway,
    );
  });

  it('creates a pending product only after shop and category validation', async () => {
    const response = await service.createProduct(context, SHOP_ID, {
      categoryId: CATEGORY_ID,
      name: 'Blue Kurta',
      slug: 'blue-kurta',
      genderCategory: 'WOMEN',
    });

    expect(response.data.product.moderationStatus).toBe('PENDING');
    expect(shopService.shopIds).toStrictEqual([SHOP_ID]);
    expect(categoryService.categoryIds).toStrictEqual([CATEGORY_ID]);
    expect(gateway.lastCreate?.genderCategory).toBe('WOMEN');
  });

  it('rejects client-controlled product state fields', async () => {
    await expect(
      service.createProduct(context, SHOP_ID, {
        categoryId: CATEGORY_ID,
        name: 'Blue Kurta',
        slug: 'blue-kurta',
        moderationStatus: 'APPROVED',
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'VALIDATION_ERROR');
  });

  it('resets moderation when merchant-visible content changes', async () => {
    await service.updateProduct(context, SHOP_ID, PRODUCT_ID, {
      name: 'Updated Kurta',
    });

    expect(gateway.lastUpdate).toStrictEqual({
      input: {
        name: 'Updated Kurta',
      },
      resetModeration: true,
    });
  });

  it('does not reset moderation for an active-state-only change', async () => {
    await service.updateProduct(context, SHOP_ID, PRODUCT_ID, {
      isActive: false,
    });

    expect(gateway.lastUpdate).toStrictEqual({
      input: {
        isActive: false,
      },
      resetModeration: false,
    });
  });

  it('hides products outside the owned shop scope', async () => {
    await expect(service.getProduct(context, OTHER_SHOP_ID, PRODUCT_ID)).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'SHOP_NOT_FOUND',
    );
  });

  it('returns product not found for missing owned products', async () => {
    gateway.mode = 'MISSING';

    await expect(service.getProduct(context, SHOP_ID, MISSING_PRODUCT_ID)).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'PRODUCT_NOT_FOUND',
    );
  });

  it('maps duplicate shop slugs to a canonical conflict', async () => {
    gateway.mode = 'CONFLICT';

    await expect(
      service.createProduct(context, SHOP_ID, {
        categoryId: CATEGORY_ID,
        name: 'Blue Kurta',
        slug: 'blue-kurta',
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'PRODUCT_SLUG_CONFLICT');
  });

  it('maps provider outages to a retryable service failure', async () => {
    gateway.mode = 'UNAVAILABLE';

    await expect(service.listProducts(context, SHOP_ID)).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });
});
