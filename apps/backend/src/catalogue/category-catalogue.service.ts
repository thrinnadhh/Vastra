import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createCategoryNotFoundException,
  createInvalidCategoryIdException,
} from './catalogue-http-error';
import {
  type CategoryCatalogueGateway,
  CategoryCatalogueDataInvalidError,
  CategoryCatalogueGatewayUnavailableError,
} from './category-catalogue.gateway';
import { CATEGORY_CATALOGUE_GATEWAY } from './category-catalogue.tokens';
import type {
  GetMerchantCatalogueCategoryResponse,
  ListMerchantCatalogueCategoriesResponse,
  MerchantCatalogueCategorySnapshot,
} from './category-catalogue.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class CategoryCatalogueService {
  public constructor(
    @Inject(CATEGORY_CATALOGUE_GATEWAY)
    private readonly gateway: CategoryCatalogueGateway,
  ) {}

  public async listActiveCategories(
    context: AuthenticatedRequestContext,
  ): Promise<ListMerchantCatalogueCategoriesResponse> {
    try {
      const categories = await this.gateway.findActiveCategories(context.supabase);

      return {
        success: true,
        data: {
          categories,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async getActiveCategory(
    context: AuthenticatedRequestContext,
    categoryId: string,
  ): Promise<GetMerchantCatalogueCategoryResponse> {
    const category = await this.requireActiveCategory(context, categoryId);

    return {
      success: true,
      data: {
        category,
      },
      meta: {
        requestId: null,
      },
    };
  }

  public async requireActiveCategory(
    context: AuthenticatedRequestContext,
    categoryId: string,
  ): Promise<MerchantCatalogueCategorySnapshot> {
    if (!UUID_PATTERN.test(categoryId)) {
      throw createInvalidCategoryIdException();
    }

    try {
      const category = await this.gateway.findActiveCategoryById(context.supabase, categoryId);

      if (category === null) {
        throw createCategoryNotFoundException();
      }

      return category;
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CategoryCatalogueGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CategoryCatalogueDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
