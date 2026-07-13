import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidLowStockQueryException,
} from './catalogue-http-error';
import {
  type MerchantInventoryLowStockGateway,
  MerchantInventoryLowStockDataInvalidError,
  MerchantInventoryLowStockGatewayUnavailableError,
} from './merchant-inventory-low-stock.gateway';
import { MERCHANT_INVENTORY_LOW_STOCK_GATEWAY } from './merchant-inventory-low-stock.tokens';
import type { ListMerchantLowStockInventoryResponse } from './merchant-inventory-low-stock.types';
import {
  MerchantLowStockQueryValidationError,
  parseMerchantLowStockQuery,
} from './merchant-inventory-low-stock.validation';
import { MerchantShopContextService } from './merchant-shop-context.service';

@Injectable()
export class MerchantInventoryLowStockService {
  public constructor(
    @Inject(MerchantShopContextService)
    private readonly shopContextService: MerchantShopContextService,
    @Inject(MERCHANT_INVENTORY_LOW_STOCK_GATEWAY)
    private readonly gateway: MerchantInventoryLowStockGateway,
  ) {}

  public async listLowStock(
    context: AuthenticatedRequestContext,
    shopId: string,
    limitValue: unknown,
    includeInactiveValue: unknown,
  ): Promise<ListMerchantLowStockInventoryResponse> {
    await this.shopContextService.requireOwnedShop(context, shopId);

    try {
      const query = parseMerchantLowStockQuery(limitValue, includeInactiveValue);
      const items = await this.gateway.listOwnedLowStock(
        context.supabase,
        shopId,
        query.limit,
        query.includeInactive,
      );

      return {
        success: true,
        data: {
          items,
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
    if (error instanceof MerchantLowStockQueryValidationError) {
      throw createInvalidLowStockQueryException();
    }

    if (error instanceof MerchantInventoryLowStockGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof MerchantInventoryLowStockDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
