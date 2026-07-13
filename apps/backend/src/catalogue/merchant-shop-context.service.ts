import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidShopIdException,
  createShopNotFoundException,
} from './catalogue-http-error';
import {
  type MerchantShopContextGateway,
  MerchantShopContextDataInvalidError,
  MerchantShopContextGatewayUnavailableError,
} from './merchant-shop-context.gateway';
import { MERCHANT_SHOP_CONTEXT_GATEWAY } from './merchant-shop-context.tokens';
import type {
  GetMerchantCatalogueShopResponse,
  ListMerchantCatalogueShopsResponse,
  MerchantCatalogueShopSnapshot,
} from './merchant-shop-context.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class MerchantShopContextService {
  public constructor(
    @Inject(MERCHANT_SHOP_CONTEXT_GATEWAY)
    private readonly gateway: MerchantShopContextGateway,
  ) {}

  public async listOwnedShops(
    context: AuthenticatedRequestContext,
  ): Promise<ListMerchantCatalogueShopsResponse> {
    try {
      const shops = await this.gateway.findOwnedShops(context.supabase, context.actor.id);

      return {
        success: true,
        data: {
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

  public async getOwnedShop(
    context: AuthenticatedRequestContext,
    shopId: string,
  ): Promise<GetMerchantCatalogueShopResponse> {
    const shop = await this.requireOwnedShop(context, shopId);

    return {
      success: true,
      data: {
        shop,
      },
      meta: {
        requestId: null,
      },
    };
  }

  public async requireOwnedShop(
    context: AuthenticatedRequestContext,
    shopId: string,
  ): Promise<MerchantCatalogueShopSnapshot> {
    if (!UUID_PATTERN.test(shopId)) {
      throw createInvalidShopIdException();
    }

    try {
      const shop = await this.gateway.findOwnedShopById(context.supabase, context.actor.id, shopId);

      if (shop === null) {
        throw createShopNotFoundException();
      }

      return shop;
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantShopContextGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof MerchantShopContextDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
