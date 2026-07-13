import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { MerchantProductVariantGateway } from './merchant-product-variant.gateway';
import {
  MerchantProductVariantGatewayUnavailableError,
  MerchantProductVariantSkuConflictError,
} from './merchant-product-variant.gateway';
import { MerchantProductVariantService } from './merchant-product-variant.service';
import type {
  CreateMerchantProductVariantInput,
  MerchantProductVariantSnapshot,
  UpdateMerchantProductVariantInput,
} from './merchant-product-variant.types';
import type { MerchantProductService } from './merchant-product.service';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const MISSING_VARIANT_ID = '50000000-0000-4000-8000-000000000002';
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

function createVariant(
  overrides: Partial<MerchantProductVariantSnapshot> = {},
): MerchantProductVariantSnapshot {
  return {
    id: VARIANT_ID,
    productId: PRODUCT_ID,
    shopId: SHOP_ID,
    sku: 'KURTA-BLUE-M',
    colourName: 'Blue',
    colourHex: '#0000FF',
    sizeLabel: 'M',
    mrpPaise: 199_900,
    sellingPricePaise: 149_900,
    costPricePaise: 90_000,
    weightGrams: 400,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 4,
    attributes: {
      fit: 'REGULAR',
    },
    isActive: true,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
    ...overrides,
  };
}

class RecordingProductService {
  public productIds: string[] = [];

  public requireOwnedProduct(
    _context: AuthenticatedRequestContext,
    _shopId: string,
    productId: string,
  ): Promise<{ readonly id: string }> {
    this.productIds.push(productId);
    return Promise.resolve({ id: productId });
  }
}

class RecordingVariantGateway implements MerchantProductVariantGateway {
  public mode: 'SUCCESS' | 'MISSING' | 'CONFLICT' | 'UNAVAILABLE' = 'SUCCESS';
  public lastCreate: CreateMerchantProductVariantInput | null = null;
  public lastUpdate: UpdateMerchantProductVariantInput | null = null;
  public deactivatedVariantId: string | null = null;

  public findOwnedVariants(): Promise<readonly MerchantProductVariantSnapshot[]> {
    if (this.mode === 'UNAVAILABLE') {
      return Promise.reject(new MerchantProductVariantGatewayUnavailableError());
    }

    return Promise.resolve([createVariant()]);
  }

  public findOwnedVariantById(
    _client: SupabaseClient,
    _shopId: string,
    _productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantSnapshot | null> {
    if (this.mode === 'UNAVAILABLE') {
      return Promise.reject(new MerchantProductVariantGatewayUnavailableError());
    }

    if (this.mode === 'MISSING' || variantId === MISSING_VARIANT_ID) {
      return Promise.resolve(null);
    }

    return Promise.resolve(createVariant());
  }

  public createVariant(
    _shopId: string,
    _productId: string,
    input: CreateMerchantProductVariantInput,
  ): Promise<MerchantProductVariantSnapshot> {
    if (this.mode === 'CONFLICT') {
      return Promise.reject(new MerchantProductVariantSkuConflictError());
    }

    this.lastCreate = input;
    return Promise.resolve(
      createVariant({
        sku: input.sku,
        colourHex: input.colourHex,
        mrpPaise: input.mrpPaise,
        sellingPricePaise: input.sellingPricePaise,
      }),
    );
  }

  public updateVariant(
    _shopId: string,
    _productId: string,
    _variantId: string,
    input: UpdateMerchantProductVariantInput,
  ): Promise<MerchantProductVariantSnapshot | null> {
    if (this.mode === 'MISSING') {
      return Promise.resolve(null);
    }

    if (this.mode === 'CONFLICT') {
      return Promise.reject(new MerchantProductVariantSkuConflictError());
    }

    this.lastUpdate = input;
    return Promise.resolve(
      createVariant({
        sku: input.sku ?? 'KURTA-BLUE-M',
        mrpPaise: input.mrpPaise ?? 199_900,
        sellingPricePaise: input.sellingPricePaise ?? 149_900,
        isActive: input.isActive ?? true,
      }),
    );
  }

  public deactivateVariant(
    _shopId: string,
    _productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantSnapshot | null> {
    if (this.mode === 'MISSING') {
      return Promise.resolve(null);
    }

    this.deactivatedVariantId = variantId;
    return Promise.resolve(createVariant({ id: variantId, isActive: false }));
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

describe('MerchantProductVariantService', () => {
  let productService: RecordingProductService;
  let gateway: RecordingVariantGateway;
  let service: MerchantProductVariantService;

  beforeEach(() => {
    productService = new RecordingProductService();
    gateway = new RecordingVariantGateway();
    service = new MerchantProductVariantService(
      productService as unknown as MerchantProductService,
      gateway,
    );
  });

  it('creates a variant after product ownership validation', async () => {
    const response = await service.createVariant(context, SHOP_ID, PRODUCT_ID, {
      sku: ' KURTA-BLUE-M ',
      colourHex: '#0000ff',
      mrpPaise: 199_900,
      sellingPricePaise: 149_900,
    });

    expect(productService.productIds).toStrictEqual([PRODUCT_ID]);
    expect(gateway.lastCreate?.sku).toBe('KURTA-BLUE-M');
    expect(gateway.lastCreate?.colourHex).toBe('#0000FF');
    expect(response.data.variant.sellingPricePaise).toBe(149_900);
  });

  it('rejects a selling price above MRP', async () => {
    await expect(
      service.createVariant(context, SHOP_ID, PRODUCT_ID, {
        sku: 'KURTA-BLUE-M',
        mrpPaise: 100_000,
        sellingPricePaise: 100_001,
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'VALIDATION_ERROR');
  });

  it('validates partial price updates against the current variant', async () => {
    await expect(
      service.updateVariant(context, SHOP_ID, PRODUCT_ID, VARIANT_ID, {
        mrpPaise: 100_000,
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'VALIDATION_ERROR');
  });

  it('maps shop-wide SKU collisions to a stable conflict code', async () => {
    gateway.mode = 'CONFLICT';

    await expect(
      service.createVariant(context, SHOP_ID, PRODUCT_ID, {
        sku: 'KURTA-BLUE-M',
        mrpPaise: 199_900,
        sellingPricePaise: 149_900,
      }),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'VARIANT_SKU_CONFLICT');
  });

  it('returns not found when a nested variant is not visible', async () => {
    gateway.mode = 'MISSING';

    await expect(
      service.getVariant(context, SHOP_ID, PRODUCT_ID, MISSING_VARIANT_ID),
    ).rejects.toSatisfy((error: unknown) => readErrorCode(error) === 'VARIANT_NOT_FOUND');
  });

  it('deactivates rather than deleting the SKU record', async () => {
    const response = await service.deactivateVariant(context, SHOP_ID, PRODUCT_ID, VARIANT_ID);

    expect(gateway.deactivatedVariantId).toBe(VARIANT_ID);
    expect(response.data.deactivatedVariantId).toBe(VARIANT_ID);
  });

  it('rejects malformed variant identifiers before gateway access', async () => {
    await expect(service.getVariant(context, SHOP_ID, PRODUCT_ID, 'not-a-uuid')).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'VALIDATION_ERROR',
    );
  });
});
