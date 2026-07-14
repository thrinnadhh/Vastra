import { Buffer } from 'node:buffer';

import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidCustomerCatalogueReadException,
} from './catalogue-http-error';
import {
  type CustomerProductSearchGateway,
  CustomerProductSearchDataInvalidError,
  CustomerProductSearchGatewayUnavailableError,
} from './customer-product-search.gateway';
import { CUSTOMER_PRODUCT_SEARCH_GATEWAY } from './customer-product-search.tokens';
import type { SearchCustomerProductsResponse } from './customer-product-search.types';
import {
  CustomerProductSearchValidationError,
  parseCustomerProductSearchQuery,
} from './customer-product-search.validation';

function encodeCursor(offset: number | null): string | null {
  if (offset === null) {
    return null;
  }

  return Buffer.from(`v1:${String(offset)}`, 'utf8').toString('base64url');
}

@Injectable()
export class CustomerProductSearchService {
  public constructor(
    @Inject(CUSTOMER_PRODUCT_SEARCH_GATEWAY)
    private readonly gateway: CustomerProductSearchGateway,
  ) {}

  public async searchProducts(
    context: AuthenticatedRequestContext,
    termValue: unknown,
    latitudeValue: unknown,
    longitudeValue: unknown,
    categoryIdValue: unknown,
    genderValue: unknown,
    shopIdValue: unknown,
    minPriceValue: unknown,
    maxPriceValue: unknown,
    availableOnlyValue: unknown,
    sortValue: unknown,
    cursorValue: unknown,
    limitValue: unknown,
  ): Promise<SearchCustomerProductsResponse> {
    try {
      const query = parseCustomerProductSearchQuery(
        termValue,
        latitudeValue,
        longitudeValue,
        categoryIdValue,
        genderValue,
        shopIdValue,
        minPriceValue,
        maxPriceValue,
        availableOnlyValue,
        sortValue,
        cursorValue,
        limitValue,
      );
      const page = await this.gateway.searchPublicProducts(context.supabase, query);

      return {
        success: true,
        data: {
          query: query.term,
          filters: {
            categoryId: query.categoryId,
            genderCategory: query.genderCategory,
            shopId: query.shopId,
            minPricePaise: query.minPricePaise,
            maxPricePaise: query.maxPricePaise,
            availableOnly: query.availableOnly,
            sort: query.sort,
          },
          location: {
            latitude: query.latitude,
            longitude: query.longitude,
          },
          results: page.results,
          nextCursor: encodeCursor(page.nextOffset),
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CustomerProductSearchValidationError) {
      throw createInvalidCustomerCatalogueReadException();
    }

    if (error instanceof CustomerProductSearchGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CustomerProductSearchDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
