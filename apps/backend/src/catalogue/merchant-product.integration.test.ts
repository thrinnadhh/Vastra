import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthModule } from '../auth/auth.module';
import type { ProfileSnapshot } from '../auth/auth.types';
import type { OperationalReadinessGateway } from '../auth/operational-readiness.gateway';
import { OPERATIONAL_READINESS_GATEWAY } from '../auth/operational-readiness.tokens';
import type {
  CaptainOperationalProfile,
  MerchantOperationalProfile,
} from '../auth/operational-readiness.types';
import type { AuthenticationGateway, TokenVerificationResult } from '../auth/supabase.gateway';
import { AUTHENTICATION_GATEWAY } from '../auth/supabase.tokens';
import { type CategoryCatalogueGateway } from './category-catalogue.gateway';
import { CATEGORY_CATALOGUE_GATEWAY } from './category-catalogue.tokens';
import type { MerchantCatalogueCategorySnapshot } from './category-catalogue.types';
import { CatalogueModule } from './catalogue.module';
import { type MerchantProductGateway } from './merchant-product.gateway';
import { MERCHANT_PRODUCT_GATEWAY } from './merchant-product.tokens';
import type {
  CreateMerchantProductInput,
  MerchantProductSnapshot,
  UpdateMerchantProductInput,
} from './merchant-product.types';
import { type MerchantShopContextGateway } from './merchant-shop-context.gateway';
import { MERCHANT_SHOP_CONTEXT_GATEWAY } from './merchant-shop-context.tokens';
import type { MerchantCatalogueShopSnapshot } from './merchant-shop-context.types';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_SHOP_ID = '20000000-0000-4000-8000-000000000002';
const CATEGORY_ID = '30000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const OTHER_PRODUCT_ID = '40000000-0000-4000-8000-000000000002';

interface IntegrationClientMarker {
  readonly accessToken: string;
}

function createIntegrationClient(accessToken: string): SupabaseClient {
  return Object.freeze({ accessToken }) as unknown as SupabaseClient;
}

function readIntegrationAccessToken(client: SupabaseClient): string {
  return (client as unknown as IntegrationClientMarker).accessToken;
}

function createShop(): MerchantCatalogueShopSnapshot {
  return {
    id: SHOP_ID,
    shopCode: 'VAS001',
    name: 'Vastra Store',
    slug: 'vastra-store',
    verificationStatus: 'VERIFIED',
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
    serviceRadiusMeters: 5000,
    minimumOrderPaise: 0,
    averagePreparationMinutes: 15,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  };
}

function createCategory(): MerchantCatalogueCategorySnapshot {
  return {
    id: CATEGORY_ID,
    parentId: null,
    name: 'Women',
    slug: 'women',
    description: 'Women fashion',
    iconObjectKey: null,
    displayOrder: 1,
  };
}

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

class IntegrationAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    switch (accessToken) {
      case 'merchant-ready-token':
      case 'merchant-pending-token':
      case 'customer-token':
        return Promise.resolve({
          valid: true,
          identity: {
            id: `${accessToken}-user-id`,
            email: `${accessToken}@example.test`,
          },
        });
      default:
        return Promise.resolve({
          valid: false,
          reason: 'INVALID',
        });
    }
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    const accessToken = userId.replace(/-user-id$/u, '');

    switch (accessToken) {
      case 'merchant-ready-token':
      case 'merchant-pending-token':
        return Promise.resolve({
          id: userId,
          accountType: 'MERCHANT',
          status: 'ACTIVE',
        });
      case 'customer-token':
        return Promise.resolve({
          id: userId,
          accountType: 'CUSTOMER',
          status: 'ACTIVE',
        });
      default:
        return Promise.resolve(null);
    }
  }

  public createUserClient(accessToken: string): SupabaseClient {
    return createIntegrationClient(accessToken);
  }
}

class IntegrationOperationalReadinessGateway implements OperationalReadinessGateway {
  public findMerchantOperationalProfile(
    client: SupabaseClient,
  ): Promise<MerchantOperationalProfile | null> {
    switch (readIntegrationAccessToken(client)) {
      case 'merchant-ready-token':
        return Promise.resolve({
          onboardingStatus: 'ACTIVE',
          kycStatus: 'VERIFIED',
          approvedAt: '2026-07-13T00:00:00.000Z',
        });
      case 'merchant-pending-token':
        return Promise.resolve({
          onboardingStatus: 'VERIFICATION_PENDING',
          kycStatus: 'IN_REVIEW',
          approvedAt: null,
        });
      default:
        return Promise.resolve(null);
    }
  }

  public findCaptainOperationalProfile(): Promise<CaptainOperationalProfile | null> {
    return Promise.resolve(null);
  }
}

class IntegrationShopContextGateway implements MerchantShopContextGateway {
  public findOwnedShops(): Promise<readonly MerchantCatalogueShopSnapshot[]> {
    return Promise.resolve([createShop()]);
  }

  public findOwnedShopById(
    client: SupabaseClient,
    _merchantId: string,
    shopId: string,
  ): Promise<MerchantCatalogueShopSnapshot | null> {
    if (readIntegrationAccessToken(client) !== 'merchant-ready-token' || shopId !== SHOP_ID) {
      return Promise.resolve(null);
    }

    return Promise.resolve(createShop());
  }
}

class IntegrationCategoryCatalogueGateway implements CategoryCatalogueGateway {
  public findActiveCategories(): Promise<readonly MerchantCatalogueCategorySnapshot[]> {
    return Promise.resolve([createCategory()]);
  }

  public findActiveCategoryById(
    client: SupabaseClient,
    categoryId: string,
  ): Promise<MerchantCatalogueCategorySnapshot | null> {
    if (
      readIntegrationAccessToken(client) !== 'merchant-ready-token' ||
      categoryId !== CATEGORY_ID
    ) {
      return Promise.resolve(null);
    }

    return Promise.resolve(createCategory());
  }
}

class IntegrationMerchantProductGateway implements MerchantProductGateway {
  public findOwnedProducts(
    client: SupabaseClient,
    shopId: string,
  ): Promise<readonly MerchantProductSnapshot[]> {
    if (readIntegrationAccessToken(client) !== 'merchant-ready-token' || shopId !== SHOP_ID) {
      return Promise.resolve([]);
    }

    return Promise.resolve([createProduct()]);
  }

  public findOwnedProductById(
    client: SupabaseClient,
    shopId: string,
    productId: string,
  ): Promise<MerchantProductSnapshot | null> {
    if (
      readIntegrationAccessToken(client) !== 'merchant-ready-token' ||
      shopId !== SHOP_ID ||
      productId !== PRODUCT_ID
    ) {
      return Promise.resolve(null);
    }

    return Promise.resolve(createProduct());
  }

  public createProduct(
    shopId: string,
    input: CreateMerchantProductInput,
  ): Promise<MerchantProductSnapshot> {
    return Promise.resolve(
      createProduct({
        shopId,
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        genderCategory: input.genderCategory,
        moderationStatus: 'PENDING',
      }),
    );
  }

  public updateProduct(
    shopId: string,
    productId: string,
    input: UpdateMerchantProductInput,
    resetModeration: boolean,
  ): Promise<MerchantProductSnapshot | null> {
    if (shopId !== SHOP_ID || productId !== PRODUCT_ID) {
      return Promise.resolve(null);
    }

    return Promise.resolve(
      createProduct({
        name: input.name ?? 'Blue Kurta',
        isActive: input.isActive ?? true,
        moderationStatus: resetModeration ? 'PENDING' : 'APPROVED',
      }),
    );
  }

  public archiveProduct(shopId: string, productId: string): Promise<boolean> {
    return Promise.resolve(shopId === SHOP_ID && productId === PRODUCT_ID);
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

function readErrorCode(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new TypeError('Expected response object');
  }

  const error = (body as Record<string, unknown>)['error'];

  if (typeof error !== 'object' || error === null || Array.isArray(error)) {
    throw new TypeError('Expected error object');
  }

  const code = (error as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} object`);
  }

  return value as Record<string, unknown>;
}

function readResponseData(body: unknown): Record<string, unknown> {
  const response = requireRecord(body, 'response');
  return requireRecord(response['data'], 'response data');
}

function readResponseProduct(body: unknown): Record<string, unknown> {
  const data = readResponseData(body);
  return requireRecord(data['product'], 'response product');
}

describe('merchant product management integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule, CatalogueModule],
    })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new IntegrationAuthenticationGateway())
      .overrideProvider(OPERATIONAL_READINESS_GATEWAY)
      .useValue(new IntegrationOperationalReadinessGateway())
      .overrideProvider(MERCHANT_SHOP_CONTEXT_GATEWAY)
      .useValue(new IntegrationShopContextGateway())
      .overrideProvider(CATEGORY_CATALOGUE_GATEWAY)
      .useValue(new IntegrationCategoryCatalogueGateway())
      .overrideProvider(MERCHANT_PRODUCT_GATEWAY)
      .useValue(new IntegrationMerchantProductGateway())
      .compile();

    app = testingModule.createNestApplication();
    await app.init();
    httpServer = requireHttpServer(app);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('lists products within an owned shop', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/products`)
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    expect(readResponseData(body)['products']).toStrictEqual([createProduct()]);
  });

  it('creates a pending product under an active category', async () => {
    const response = await request(httpServer)
      .post(`/merchant/catalogue/shops/${SHOP_ID}/products`)
      .set('Authorization', 'Bearer merchant-ready-token')
      .send({
        categoryId: CATEGORY_ID,
        name: 'Blue Kurta',
        slug: 'blue-kurta',
        genderCategory: 'WOMEN',
      });

    expect(response.status).toBe(201);
    const body: unknown = response.body;
    expect(readResponseProduct(body)['moderationStatus']).toBe('PENDING');
  });

  it('updates merchant content and resets moderation', async () => {
    const response = await request(httpServer)
      .patch(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}`)
      .set('Authorization', 'Bearer merchant-ready-token')
      .send({
        name: 'Updated Kurta',
      });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const product = readResponseProduct(body);
    expect(product['name']).toBe('Updated Kurta');
    expect(product['moderationStatus']).toBe('PENDING');
  });

  it('archives an owned product', async () => {
    const response = await request(httpServer)
      .delete(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}`)
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    expect(readResponseData(body)['archivedProductId']).toBe(PRODUCT_ID);
  });

  it('hides shops outside the merchant scope', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${OTHER_SHOP_ID}/products`)
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(404);
    expect(readErrorCode(response.body)).toBe('SHOP_NOT_FOUND');
  });

  it('hides missing products within an owned shop', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/products/${OTHER_PRODUCT_ID}`)
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(404);
    expect(readErrorCode(response.body)).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects client-controlled moderation state', async () => {
    const response = await request(httpServer)
      .post(`/merchant/catalogue/shops/${SHOP_ID}/products`)
      .set('Authorization', 'Bearer merchant-ready-token')
      .send({
        categoryId: CATEGORY_ID,
        name: 'Blue Kurta',
        slug: 'blue-kurta',
        moderationStatus: 'APPROVED',
      });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });

  it('denies customers before product lookup', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/products`)
      .set('Authorization', 'Bearer customer-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_TYPE_FORBIDDEN');
  });

  it('keeps pending merchants out of product management', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/products`)
      .set('Authorization', 'Bearer merchant-pending-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_PENDING');
  });
});
