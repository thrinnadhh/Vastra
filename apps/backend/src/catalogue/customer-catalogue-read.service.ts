import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createCustomerCatalogueProductNotFoundException,
  createCustomerCatalogueShopNotFoundException,
  createInvalidCustomerCatalogueReadException,
} from './catalogue-http-error';
import {
  type CustomerCatalogueReadGateway,
  CustomerCatalogueReadDataInvalidError,
  CustomerCatalogueReadGatewayUnavailableError,
} from './customer-catalogue-read.gateway';
import { CUSTOMER_CATALOGUE_READ_GATEWAY } from './customer-catalogue-read.tokens';
import type {
  GetCustomerCatalogueProductResponse,
  ListCustomerCatalogueProductsResponse,
} from './customer-catalogue-read.types';
import {
  CustomerCatalogueReadValidationError,
  parseCustomerCatalogueProductId,
  parseCustomerCatalogueProductListQuery,
} from './customer-catalogue-read.validation';

@Injectable()
export class CustomerCatalogueReadService {
  public constructor(
    @Inject(CUSTOMER_CATALOGUE_READ_GATEWAY)
    private readonly gateway: CustomerCatalogueReadGateway,
  ) {}

  public async listShopProducts(
    context: AuthenticatedRequestContext,
    shopIdValue: unknown,
    cursorValue: unknown,
    limitValue: unknown,
  ): Promise<ListCustomerCatalogueProductsResponse> {
    try {
      const query = parseCustomerCatalogueProductListQuery(shopIdValue, cursorValue, limitValue);
      const shop = await this.gateway.findPublicShop(context.supabase, query.shopId);

      if (shop === null) {
        throw createCustomerCatalogueShopNotFoundException();
      }

      const page = await this.gateway.listPublicProducts(
        context.supabase,
        query.shopId,
        query.cursor,
        query.limit,
      );

      return {
        success: true,
        data: {
          shop,
          products: page.products,
          nextCursor: page.nextCursor,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async getProduct(
    context: AuthenticatedRequestContext,
    productIdValue: unknown,
  ): Promise<GetCustomerCatalogueProductResponse> {
    try {
      const productId = parseCustomerCatalogueProductId(productIdValue);
      const product = await this.gateway.findPublicProduct(context.supabase, productId);

      if (product === null) {
        throw createCustomerCatalogueProductNotFoundException();
      }

      return {
        success: true,
        data: {
          product,
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
    if (error instanceof CustomerCatalogueReadValidationError) {
      throw createInvalidCustomerCatalogueReadException();
    }

    if (error instanceof CustomerCatalogueReadGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CustomerCatalogueReadDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
