import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { MerchantProductVariantController } from './merchant-product-variant.controller';
import type { MerchantProductVariantGateway } from './merchant-product-variant.gateway';
import { MERCHANT_PRODUCT_VARIANT_GATEWAY } from './merchant-product-variant.tokens';
import { MerchantProductVariantService } from './merchant-product-variant.service';
import type {
  CreateMerchantProductVariantInput,
  MerchantProductVariantSnapshot,
  UpdateMerchantProductVariantInput,
} from './merchant-product-variant.types';
import { MerchantProductService } from './merchant-product.service';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const VARIANT_ID = '50000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'merchant@example.test',
    accountType: 'MERCHANT',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
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
    costPricePaise: null,
    weightGrams: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    attributes: {},
    isActive: true,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
    ...overrides,
  };
}

class IntegrationProductService {
  public requireOwnedProduct(): Promise<{ readonly id: string }> {
    return Promise.resolve({ id: PRODUCT_ID });
  }
}

class IntegrationVariantGateway implements MerchantProductVariantGateway {
  public findOwnedVariants(): Promise<readonly MerchantProductVariantSnapshot[]> {
    return Promise.resolve([createVariant()]);
  }

  public findOwnedVariantById(
    _client: SupabaseClient,
    _shopId: string,
    _productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantSnapshot | null> {
    return Promise.resolve(variantId === VARIANT_ID ? createVariant() : null);
  }

  public createVariant(
    _shopId: string,
    _productId: string,
    input: CreateMerchantProductVariantInput,
  ): Promise<MerchantProductVariantSnapshot> {
    return Promise.resolve(
      createVariant({
        sku: input.sku,
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
    return Promise.resolve(variantId === VARIANT_ID ? createVariant({ isActive: false }) : null);
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

describe('merchant product variant integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [MerchantProductVariantController],
      providers: [
        MerchantProductVariantService,
        {
          provide: MerchantProductService,
          useValue: new IntegrationProductService(),
        },
        {
          provide: MERCHANT_PRODUCT_VARIANT_GATEWAY,
          useValue: new IntegrationVariantGateway(),
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, _response: unknown, next: () => void): void => {
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

  it('lists variants for an owned product', async () => {
    const response = await request(httpServer).get(
      `/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/variants`,
    );

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    expect(readData(body)['variants']).toStrictEqual([createVariant()]);
  });

  it('creates a sellable SKU', async () => {
    const response = await request(httpServer)
      .post(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/variants`)
      .send({
        sku: 'KURTA-BLUE-L',
        mrpPaise: 209_900,
        sellingPricePaise: 159_900,
      });

    expect(response.status).toBe(201);
    const body: unknown = response.body;
    const variant = requireRecord(readData(body)['variant'], 'variant');
    expect(variant['sku']).toBe('KURTA-BLUE-L');
  });

  it('updates SKU pricing while enforcing the MRP invariant', async () => {
    const response = await request(httpServer)
      .patch(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/variants/${VARIANT_ID}`)
      .send({
        sellingPricePaise: 149_000,
      });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const variant = requireRecord(readData(body)['variant'], 'variant');
    expect(variant['sellingPricePaise']).toBe(149_000);
  });

  it('rejects a selling price above the current MRP', async () => {
    const response = await request(httpServer)
      .patch(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/variants/${VARIANT_ID}`)
      .send({
        sellingPricePaise: 999_999,
      });

    expect(response.status).toBe(400);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('VALIDATION_ERROR');
  });

  it('deactivates a variant without deleting its SKU identity', async () => {
    const response = await request(httpServer).delete(
      `/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/variants/${VARIANT_ID}`,
    );

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    expect(readData(body)['deactivatedVariantId']).toBe(VARIANT_ID);
  });
});
