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

const CATEGORY_ID = '30000000-0000-4000-8000-000000000001';
const OTHER_CATEGORY_ID = '30000000-0000-4000-8000-000000000002';

interface IntegrationClientMarker {
  readonly accessToken: string;
}

function createIntegrationClient(accessToken: string): SupabaseClient {
  return Object.freeze({ accessToken }) as unknown as SupabaseClient;
}

function readIntegrationAccessToken(client: SupabaseClient): string {
  return (client as unknown as IntegrationClientMarker).accessToken;
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

class IntegrationCategoryCatalogueGateway implements CategoryCatalogueGateway {
  public findActiveCategories(
    client: SupabaseClient,
  ): Promise<readonly MerchantCatalogueCategorySnapshot[]> {
    if (readIntegrationAccessToken(client) !== 'merchant-ready-token') {
      return Promise.resolve([]);
    }

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

describe('merchant category catalogue integration', () => {
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
      .overrideProvider(CATEGORY_CATALOGUE_GATEWAY)
      .useValue(new IntegrationCategoryCatalogueGateway())
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

  it('lists active categories for a ready merchant', async () => {
    const response = await request(httpServer)
      .get('/merchant/catalogue/categories')
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      success: true,
      data: {
        categories: [createCategory()],
      },
      meta: {
        requestId: null,
      },
    });
  });

  it('returns one active category', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/categories/${CATEGORY_ID}`)
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      success: true,
      data: {
        category: createCategory(),
      },
      meta: {
        requestId: null,
      },
    });
  });

  it('hides missing or inactive categories', async () => {
    const response = await request(httpServer)
      .get(`/merchant/catalogue/categories/${OTHER_CATEGORY_ID}`)
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(404);
    expect(readErrorCode(response.body)).toBe('CATEGORY_NOT_FOUND');
  });

  it('rejects malformed category identifiers', async () => {
    const response = await request(httpServer)
      .get('/merchant/catalogue/categories/not-a-uuid')
      .set('Authorization', 'Bearer merchant-ready-token');

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });

  it('denies customers before category lookup', async () => {
    const response = await request(httpServer)
      .get('/merchant/catalogue/categories')
      .set('Authorization', 'Bearer customer-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_TYPE_FORBIDDEN');
  });

  it('keeps pending merchants out of operational category routes', async () => {
    const response = await request(httpServer)
      .get('/merchant/catalogue/categories')
      .set('Authorization', 'Bearer merchant-pending-token');

    expect(response.status).toBe(403);
    expect(readErrorCode(response.body)).toBe('ACCOUNT_PENDING');
  });

  it('requires authentication', async () => {
    const response = await request(httpServer).get('/merchant/catalogue/categories');

    expect(response.status).toBe(401);
    expect(readErrorCode(response.body)).toBe('AUTH_REQUIRED');
  });
});
