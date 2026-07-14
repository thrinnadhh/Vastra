import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  CategoryCatalogueDataInvalidError,
  type CategoryCatalogueGateway,
  CategoryCatalogueGatewayUnavailableError,
} from './category-catalogue.gateway';
import { CATEGORY_CATALOGUE_GATEWAY } from './category-catalogue.tokens';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidCustomerCatalogueReadException,
} from './catalogue-http-error';
import {
  type CustomerCatalogueReadGateway,
  CustomerCatalogueReadDataInvalidError,
  CustomerCatalogueReadGatewayUnavailableError,
} from './customer-catalogue-read.gateway';
import { CUSTOMER_CATALOGUE_READ_GATEWAY } from './customer-catalogue-read.tokens';
import type { CustomerCatalogueProductPage } from './customer-catalogue-read.types';
import type {
  CustomerHomeCategorySnapshot,
  CustomerHomeProductItem,
  GetCustomerHomeResponse,
} from './customer-home.types';
import { CustomerHomeValidationError, parseCustomerHomeQuery } from './customer-home.validation';
import {
  type CustomerNearbyShopGateway,
  CustomerNearbyShopDataInvalidError,
  CustomerNearbyShopGatewayUnavailableError,
} from './customer-nearby-shop.gateway';
import { CUSTOMER_NEARBY_SHOP_GATEWAY } from './customer-nearby-shop.tokens';
import type { CustomerNearbyShopSnapshot } from './customer-nearby-shop.types';

function toHomeCategory(category: {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly displayOrder: number;
}): CustomerHomeCategorySnapshot {
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    slug: category.slug,
    description: category.description,
    displayOrder: category.displayOrder,
  };
}

function composeProducts(
  shops: readonly CustomerNearbyShopSnapshot[],
  pages: readonly CustomerCatalogueProductPage[],
  limit: number,
): readonly CustomerHomeProductItem[] {
  if (shops.length !== pages.length) {
    throw new CustomerCatalogueReadDataInvalidError();
  }

  const results: CustomerHomeProductItem[] = [];
  let productIndex = 0;

  while (results.length < limit) {
    let added = false;

    for (let shopIndex = 0; shopIndex < shops.length; shopIndex += 1) {
      const shop = shops[shopIndex];
      const page = pages[shopIndex];
      const product = page?.products[productIndex];

      if (shop === undefined || page === undefined) {
        throw new CustomerCatalogueReadDataInvalidError();
      }

      if (product === undefined) {
        continue;
      }

      if (product.shopId !== shop.id) {
        throw new CustomerCatalogueReadDataInvalidError();
      }

      results.push({
        product,
        shop,
      });
      added = true;

      if (results.length === limit) {
        break;
      }
    }

    if (!added) {
      break;
    }

    productIndex += 1;
  }

  return results;
}

@Injectable()
export class CustomerHomeService {
  public constructor(
    @Inject(CATEGORY_CATALOGUE_GATEWAY)
    private readonly categoryGateway: CategoryCatalogueGateway,
    @Inject(CUSTOMER_NEARBY_SHOP_GATEWAY)
    private readonly nearbyShopGateway: CustomerNearbyShopGateway,
    @Inject(CUSTOMER_CATALOGUE_READ_GATEWAY)
    private readonly catalogueGateway: CustomerCatalogueReadGateway,
  ) {}

  public async getHome(
    context: AuthenticatedRequestContext,
    latitudeValue: unknown,
    longitudeValue: unknown,
    shopLimitValue: unknown,
    productLimitValue: unknown,
  ): Promise<GetCustomerHomeResponse> {
    try {
      const query = parseCustomerHomeQuery(
        latitudeValue,
        longitudeValue,
        shopLimitValue,
        productLimitValue,
      );
      const [categoryRows, nearbyShops] = await Promise.all([
        this.categoryGateway.findActiveCategories(context.supabase),
        this.nearbyShopGateway.listServiceableShops(context.supabase, {
          latitude: query.latitude,
          longitude: query.longitude,
          limit: query.shopLimit,
        }),
      ]);
      const pages = await Promise.all(
        nearbyShops.map((shop) =>
          this.catalogueGateway.listPublicProducts(
            context.supabase,
            shop.id,
            null,
            query.productLimit,
          ),
        ),
      );
      const nearbyProducts = composeProducts(nearbyShops, pages, query.productLimit);

      return {
        success: true,
        data: {
          location: {
            latitude: query.latitude,
            longitude: query.longitude,
          },
          categories: categoryRows.map((category) => toHomeCategory(category)),
          nearbyShops,
          nearbyProducts,
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
    if (error instanceof CustomerHomeValidationError) {
      throw createInvalidCustomerCatalogueReadException();
    }

    if (
      error instanceof CategoryCatalogueGatewayUnavailableError ||
      error instanceof CustomerNearbyShopGatewayUnavailableError ||
      error instanceof CustomerCatalogueReadGatewayUnavailableError
    ) {
      throw createCatalogueProviderUnavailableException();
    }

    if (
      error instanceof CategoryCatalogueDataInvalidError ||
      error instanceof CustomerNearbyShopDataInvalidError ||
      error instanceof CustomerCatalogueReadDataInvalidError
    ) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
