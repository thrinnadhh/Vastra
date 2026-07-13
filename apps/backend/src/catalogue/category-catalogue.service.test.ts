import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CategoryCatalogueGateway,
  CategoryCatalogueDataInvalidError,
  CategoryCatalogueGatewayUnavailableError,
} from './category-catalogue.gateway';
import { CategoryCatalogueService } from './category-catalogue.service';
import type { MerchantCatalogueCategorySnapshot } from './category-catalogue.types';

const CATEGORY_ID = '30000000-0000-4000-8000-000000000001';
const MISSING_CATEGORY_ID = '30000000-0000-4000-8000-000000000002';
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

class RecordingCategoryCatalogueGateway implements CategoryCatalogueGateway {
  public mode: 'SUCCESS' | 'MISSING' | 'UNAVAILABLE' | 'INVALID' = 'SUCCESS';

  public findActiveCategories(): Promise<readonly MerchantCatalogueCategorySnapshot[]> {
    if (this.mode === 'UNAVAILABLE') {
      return Promise.reject(new CategoryCatalogueGatewayUnavailableError());
    }

    if (this.mode === 'INVALID') {
      return Promise.reject(new CategoryCatalogueDataInvalidError());
    }

    return Promise.resolve([createCategory()]);
  }

  public findActiveCategoryById(
    _client: SupabaseClient,
    categoryId: string,
  ): Promise<MerchantCatalogueCategorySnapshot | null> {
    if (this.mode === 'UNAVAILABLE') {
      return Promise.reject(new CategoryCatalogueGatewayUnavailableError());
    }

    if (this.mode === 'INVALID') {
      return Promise.reject(new CategoryCatalogueDataInvalidError());
    }

    if (this.mode === 'MISSING' || categoryId === MISSING_CATEGORY_ID) {
      return Promise.resolve(null);
    }

    return Promise.resolve(createCategory());
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

describe('CategoryCatalogueService', () => {
  let gateway: RecordingCategoryCatalogueGateway;
  let service: CategoryCatalogueService;

  beforeEach(() => {
    gateway = new RecordingCategoryCatalogueGateway();
    service = new CategoryCatalogueService(gateway);
  });

  it('lists active categories in canonical response form', async () => {
    await expect(service.listActiveCategories(context)).resolves.toStrictEqual({
      success: true,
      data: {
        categories: [createCategory()],
      },
      meta: {
        requestId: null,
      },
    });
  });

  it('returns an active category for later product validation', async () => {
    await expect(service.requireActiveCategory(context, CATEGORY_ID)).resolves.toStrictEqual(
      createCategory(),
    );
  });

  it('rejects malformed category identifiers before provider access', async () => {
    await expect(service.requireActiveCategory(context, 'not-a-uuid')).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'VALIDATION_ERROR',
    );
  });

  it('hides missing or inactive categories', async () => {
    gateway.mode = 'MISSING';

    await expect(service.requireActiveCategory(context, CATEGORY_ID)).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'CATEGORY_NOT_FOUND',
    );
  });

  it('maps invalid provider data to catalogue state failure', async () => {
    gateway.mode = 'INVALID';

    await expect(service.listActiveCategories(context)).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'CATALOGUE_STATE_INVALID',
    );
  });

  it('maps provider outages to a retryable service failure', async () => {
    gateway.mode = 'UNAVAILABLE';

    await expect(service.listActiveCategories(context)).rejects.toSatisfy(
      (error: unknown) => readErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });
});
