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
import type { MerchantProductSnapshot } from './merchant-product.types';
import { type MerchantShopContextGateway } from './merchant-shop-context.gateway';
import { MERCHANT_SHOP_CONTEXT_GATEWAY } from './merchant-shop-context.tokens';
import type { MerchantCatalogueShopSnapshot } from './merchant-shop-context.types';
import { type ProductImageGateway } from './product-image.gateway';
import { PRODUCT_IMAGE_GATEWAY } from './product-image.tokens';
import type {
  DeletedMerchantProductImage,
  FinalizeMerchantProductImageInput,
  MerchantProductImageSnapshot,
  ReplaceMerchantProductImageInput,
} from './product-image.types';

const SHOP_ID = '20000000-0000-4000-8000-000000000001';
const CATEGORY_ID = '30000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const IMAGE_ID = '50000000-0000-4000-8000-000000000001';
const OBJECT_KEY = `catalogue/${SHOP_ID}/${PRODUCT_ID}/image.webp`;

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

function createProduct(): MerchantProductSnapshot {
  return {
    id: PRODUCT_ID,
    shopId: SHOP_ID,
    categoryId: CATEGORY_ID,
    name: 'Blue Kurta',
    slug: 'blue-kurta',
    description: null,
    brand: null,
    material: null,
    genderCategory: 'WOMEN',
    styleTags: [],
    occasionTags: [],
    careInstructions: null,
    returnEligible: true,
    returnWindowDays: 7,
    moderationStatus: 'PENDING',
    isActive: true,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
    deletedAt: null,
  };
}

function createImage(
  overrides: Partial<MerchantProductImageSnapshot> = {},
): MerchantProductImageSnapshot {
  return {
    id: IMAGE_ID,
    productId: PRODUCT_ID,
    variantId: null,
    storageObjectKey: OBJECT_KEY,
    thumbnailObjectKey: null,
    imageType: 'FRONT',
    altText: 'Blue kurta front',
    displayOrder: 0,
    isPrimary: true,
    widthPx: 1200,
    heightPx: 1600,
    createdAt: '2026-07-13T00:00:00.000Z',
    imageUrl: 'https://example.test/catalogue/image.webp',
    thumbnailUrl: null,
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

    if (accessToken === 'merchant-ready-token' || accessToken === 'merchant-pending-token') {
      return Promise.resolve({
        id: userId,
        accountType: 'MERCHANT',
        status: 'ACTIVE',
      });
    }

    if (accessToken === 'customer-token') {
      return Promise.resolve({
        id: userId,
        accountType: 'CUSTOMER',
        status: 'ACTIVE',
      });
    }

    return Promise.resolve(null);
  }

  public createUserClient(accessToken: string): SupabaseClient {
    return createIntegrationClient(accessToken);
  }
}

class IntegrationOperationalReadinessGateway implements OperationalReadinessGateway {
  public findMerchantOperationalProfile(
    client: SupabaseClient,
  ): Promise<MerchantOperationalProfile | null> {
    if (readIntegrationAccessToken(client) === 'merchant-ready-token') {
      return Promise.resolve({
        onboardingStatus: 'ACTIVE',
        kycStatus: 'VERIFIED',
        approvedAt: '2026-07-13T00:00:00.000Z',
      });
    }

    if (readIntegrationAccessToken(client) === 'merchant-pending-token') {
      return Promise.resolve({
        onboardingStatus: 'VERIFICATION_PENDING',
        kycStatus: 'IN_REVIEW',
        approvedAt: null,
      });
    }

    return Promise.resolve(null);
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

class IntegrationCategoryGateway implements CategoryCatalogueGateway {
  public findActiveCategories(): Promise<readonly MerchantCatalogueCategorySnapshot[]> {
    return Promise.resolve([createCategory()]);
  }

  public findActiveCategoryById(): Promise<MerchantCatalogueCategorySnapshot | null> {
    return Promise.resolve(createCategory());
  }
}

class IntegrationProductGateway implements MerchantProductGateway {
  public findOwnedProducts(): Promise<readonly MerchantProductSnapshot[]> {
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

  public createProduct(): Promise<MerchantProductSnapshot> {
    return Promise.resolve(createProduct());
  }

  public updateProduct(): Promise<MerchantProductSnapshot | null> {
    return Promise.resolve(createProduct());
  }

  public archiveProduct(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class IntegrationProductImageGateway implements ProductImageGateway {
  public findOwnedImages(
    client: SupabaseClient,
    productId: string,
  ): Promise<readonly MerchantProductImageSnapshot[]> {
    if (readIntegrationAccessToken(client) !== 'merchant-ready-token' || productId !== PRODUCT_ID) {
      return Promise.resolve([]);
    }

    return Promise.resolve([createImage()]);
  }

  public findOwnedImageById(
    client: SupabaseClient,
    productId: string,
    imageId: string,
  ): Promise<MerchantProductImageSnapshot | null> {
    if (
      readIntegrationAccessToken(client) !== 'merchant-ready-token' ||
      productId !== PRODUCT_ID ||
      imageId !== IMAGE_ID
    ) {
      return Promise.resolve(null);
    }

    return Promise.resolve(createImage());
  }

  public createSignedUploadUrl(): Promise<string> {
    return Promise.resolve('https://example.test/upload');
  }

  public objectExists(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public createImage(
    _shopId: string,
    _productId: string,
    input: FinalizeMerchantProductImageInput,
  ): Promise<MerchantProductImageSnapshot> {
    return Promise.resolve(
      createImage({
        storageObjectKey: input.storageObjectKey,
        imageType: input.imageType,
        isPrimary: input.isPrimary,
      }),
    );
  }

  public updateImage(
    _shopId: string,
    _productId: string,
    _imageId: string,
    input: ReplaceMerchantProductImageInput,
  ): Promise<MerchantProductImageSnapshot | null> {
    return Promise.resolve(createImage(input));
  }

  public deleteImage(): Promise<DeletedMerchantProductImage | null> {
    return Promise.resolve({
      id: IMAGE_ID,
      storageObjectKey: OBJECT_KEY,
      thumbnailObjectKey: null,
    });
  }

  public removeObjectsBestEffort(): Promise<void> {
    return Promise.resolve();
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

describe('product image management integration', () => {
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
      .useValue(new IntegrationCategoryGateway())
      .overrideProvider(MERCHANT_PRODUCT_GATEWAY)
      .useValue(new IntegrationProductGateway())
      .overrideProvider(PRODUCT_IMAGE_GATEWAY)
      .useValue(new IntegrationProductImageGateway())
      .compile();

    const application = testingModule.createNestApplication();
    app = application;
    await application.init();
    httpServer = requireHttpServer(application);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('lists images for an owned product', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/images`)
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const images = readData(body)['images'];
    expect(images).toStrictEqual([createImage()]);
  });

  it('creates a signed image upload intent', async () => {
    const response = await request(httpServer)
      .post(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/images/upload-intents`)
      .set('Authorization', 'Bearer merchant-ready-token')
      .send({
        contentType: 'image/webp',
        contentLength: 1024,
      });

    expect(response.status).toBe(201);
    const body: unknown = response.body;
    expect(readData(body)['uploadUrl']).toBe('https://example.test/upload');
  });

  it('finalizes uploaded image metadata', async () => {
    const response = await request(httpServer)
      .post(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/images`)
      .set('Authorization', 'Bearer merchant-ready-token')
      .send({
        storageObjectKey: OBJECT_KEY,
        imageType: 'FRONT',
        isPrimary: true,
      });

    expect(response.status).toBe(201);
    const body: unknown = response.body;
    const image = requireRecord(readData(body)['image'], 'response image');
    expect(image['id']).toBe(IMAGE_ID);
  });

  it('updates product image metadata', async () => {
    const response = await request(httpServer)
      .patch(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/images/${IMAGE_ID}`)
      .set('Authorization', 'Bearer merchant-ready-token')
      .send({
        displayOrder: 2,
        isPrimary: true,
      });

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    const image = requireRecord(readData(body)['image'], 'response image');
    expect(image['displayOrder']).toBe(2);
  });

  it('deletes product image metadata', async () => {
    const response = await request(httpServer)
      .delete(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/images/${IMAGE_ID}`)
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(200);
    const body: unknown = response.body;
    expect(readData(body)['deletedImageId']).toBe(IMAGE_ID);
  });

  it('hides images when the merchant does not own the product shop', async () => {
    const response = await request(httpServer)
      .get(
        `/merchant/catalogue/shops/20000000-0000-4000-8000-000000000002/products/${PRODUCT_ID}/images`,
      )
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(404);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('SHOP_NOT_FOUND');
  });

  it('blocks a merchant who is not operationally ready', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/images`)
      .set('Authorization', 'Bearer merchant-pending-token');

    expect(response.status).toBe(403);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('ACCOUNT_PENDING');
  });

  it('blocks customer accounts', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/shops/${SHOP_ID}/products/${PRODUCT_ID}/images`)
      .set('Authorization', 'Bearer customer-token');

    expect(response.status).toBe(403);
    const body: unknown = response.body;
    expect(readErrorCode(body)).toBe('ACCOUNT_TYPE_FORBIDDEN');
  });
});
