import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidNearbyShopQueryException,
} from './catalogue-http-error';
import {
  type CustomerNearbyShopGateway,
  CustomerNearbyShopDataInvalidError,
  CustomerNearbyShopGatewayUnavailableError,
} from './customer-nearby-shop.gateway';
import { CUSTOMER_NEARBY_SHOP_GATEWAY } from './customer-nearby-shop.tokens';
import type { ListCustomerNearbyShopsResponse } from './customer-nearby-shop.types';
import {
  CustomerNearbyShopValidationError,
  parseCustomerNearbyShopQuery,
} from './customer-nearby-shop.validation';

@Injectable()
export class CustomerNearbyShopService {
  public constructor(
    @Inject(CUSTOMER_NEARBY_SHOP_GATEWAY)
    private readonly gateway: CustomerNearbyShopGateway,
  ) {}

  public async listNearbyShops(
    context: AuthenticatedRequestContext,
    latitudeValue: unknown,
    longitudeValue: unknown,
    limitValue: unknown,
  ): Promise<ListCustomerNearbyShopsResponse> {
    try {
      const query = parseCustomerNearbyShopQuery(latitudeValue, longitudeValue, limitValue);
      const shops = await this.gateway.listServiceableShops(context.supabase, query);

      return {
        success: true,
        data: {
          location: {
            latitude: query.latitude,
            longitude: query.longitude,
          },
          shops,
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
    if (error instanceof CustomerNearbyShopValidationError) {
      throw createInvalidNearbyShopQueryException();
    }

    if (error instanceof CustomerNearbyShopGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CustomerNearbyShopDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
