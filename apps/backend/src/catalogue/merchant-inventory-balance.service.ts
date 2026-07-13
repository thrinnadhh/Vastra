import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidInventoryLookupException,
  createInvalidProductVariantIdException,
  createProductVariantNotFoundException,
} from './catalogue-http-error';
import {
  type MerchantInventoryBalanceGateway,
  MerchantInventoryBalanceDataInvalidError,
  MerchantInventoryBalanceGatewayUnavailableError,
} from './merchant-inventory-balance.gateway';
import { MERCHANT_INVENTORY_BALANCE_GATEWAY } from './merchant-inventory-balance.tokens';
import type {
  GetMerchantInventoryBalanceResponse,
  LookupMerchantInventoryResponse,
  MerchantInventoryBalanceSnapshot,
  MerchantInventoryLookupItem,
  MerchantInventoryRecord,
} from './merchant-inventory-balance.types';
import {
  MerchantInventoryLookupValidationError,
  parseMerchantInventoryLookupQuery,
} from './merchant-inventory-balance.validation';
import { MerchantShopContextService } from './merchant-shop-context.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class MerchantInventoryBalanceService {
  public constructor(
    @Inject(MerchantShopContextService)
    private readonly shopContextService: MerchantShopContextService,
    @Inject(MERCHANT_INVENTORY_BALANCE_GATEWAY)
    private readonly gateway: MerchantInventoryBalanceGateway,
  ) {}

  public async getVariantBalance(
    context: AuthenticatedRequestContext,
    shopId: string,
    variantId: string,
  ): Promise<GetMerchantInventoryBalanceResponse> {
    await this.shopContextService.requireOwnedShop(context, shopId);
    this.assertVariantId(variantId);

    try {
      const record = await this.gateway.findOwnedInventoryByVariantId(
        context.supabase,
        shopId,
        variantId,
      );

      if (record === null) {
        throw createProductVariantNotFoundException();
      }

      return {
        success: true,
        data: {
          inventory: this.toLookupItem(record),
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async lookupInventory(
    context: AuthenticatedRequestContext,
    shopId: string,
    queryValue: unknown,
    limitValue: unknown,
  ): Promise<LookupMerchantInventoryResponse> {
    await this.shopContextService.requireOwnedShop(context, shopId);

    try {
      const lookup = parseMerchantInventoryLookupQuery(queryValue, limitValue);
      const records = await this.gateway.lookupOwnedInventory(
        context.supabase,
        shopId,
        lookup.query,
        lookup.limit,
      );

      return {
        success: true,
        data: {
          query: lookup.query,
          results: records.map((record) => this.toLookupItem(record)),
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private assertVariantId(variantId: string): void {
    if (!UUID_PATTERN.test(variantId)) {
      throw createInvalidProductVariantIdException();
    }
  }

  private toLookupItem(record: MerchantInventoryRecord): MerchantInventoryLookupItem {
    return {
      product: {
        id: record.product.id,
        name: record.product.name,
        slug: record.product.slug,
        brand: record.product.brand,
        isActive: record.product.isActive,
      },
      variant: {
        id: record.variant.id,
        productId: record.variant.productId,
        sku: record.variant.sku,
        colourName: record.variant.colourName,
        sizeLabel: record.variant.sizeLabel,
        isActive: record.variant.isActive,
      },
      balance: this.toBalanceSnapshot(record),
      matchKind: record.matchKind,
    };
  }

  private toBalanceSnapshot(record: MerchantInventoryRecord): MerchantInventoryBalanceSnapshot {
    if (record.balance === null) {
      return {
        persisted: false,
        stockOnHand: 0,
        reservedQuantity: 0,
        damagedQuantity: 0,
        availableQuantity: 0,
        reorderLevel: 0,
        version: null,
        lastCountedAt: null,
        updatedAt: null,
      };
    }

    const availableQuantity =
      record.balance.stockOnHand - record.balance.reservedQuantity - record.balance.damagedQuantity;

    if (!Number.isSafeInteger(availableQuantity) || availableQuantity < 0) {
      throw createCatalogueStateInvalidException();
    }

    return {
      persisted: true,
      stockOnHand: record.balance.stockOnHand,
      reservedQuantity: record.balance.reservedQuantity,
      damagedQuantity: record.balance.damagedQuantity,
      availableQuantity,
      reorderLevel: record.balance.reorderLevel,
      version: record.balance.version,
      lastCountedAt: record.balance.lastCountedAt,
      updatedAt: record.balance.updatedAt,
    };
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantInventoryLookupValidationError) {
      throw createInvalidInventoryLookupException();
    }

    if (error instanceof MerchantInventoryBalanceGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof MerchantInventoryBalanceDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
