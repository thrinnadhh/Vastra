import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidInventoryBarcodeException,
  createInventoryBarcodeNotFoundException,
} from './catalogue-http-error';
import {
  type MerchantInventoryBarcodeGateway,
  MerchantInventoryBarcodeDataInvalidError,
  MerchantInventoryBarcodeGatewayUnavailableError,
} from './merchant-inventory-barcode.gateway';
import { MERCHANT_INVENTORY_BARCODE_GATEWAY } from './merchant-inventory-barcode.tokens';
import type {
  LookupMerchantInventoryByBarcodeResponse,
  MerchantInventoryBarcodeLookupRecord,
  MerchantInventoryBarcodeLookupSnapshot,
} from './merchant-inventory-barcode.types';
import {
  MerchantInventoryBarcodeValidationError,
  parseMerchantInventoryBarcode,
} from './merchant-inventory-barcode.validation';
import { MerchantShopContextService } from './merchant-shop-context.service';

@Injectable()
export class MerchantInventoryBarcodeService {
  public constructor(
    @Inject(MerchantShopContextService)
    private readonly shopContextService: MerchantShopContextService,
    @Inject(MERCHANT_INVENTORY_BARCODE_GATEWAY)
    private readonly gateway: MerchantInventoryBarcodeGateway,
  ) {}

  public async lookupBarcode(
    context: AuthenticatedRequestContext,
    shopId: string,
    barcodeValue: unknown,
  ): Promise<LookupMerchantInventoryByBarcodeResponse> {
    await this.shopContextService.requireOwnedShop(context, shopId);

    try {
      const barcode = parseMerchantInventoryBarcode(barcodeValue);
      const record = await this.gateway.findOwnedInventoryByBarcode(
        context.supabase,
        shopId,
        barcode,
      );

      if (record === null) {
        throw createInventoryBarcodeNotFoundException();
      }

      return {
        success: true,
        data: {
          scannedBarcode: barcode,
          inventory: this.toSnapshot(record),
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private toSnapshot(
    record: MerchantInventoryBarcodeLookupRecord,
  ): MerchantInventoryBarcodeLookupSnapshot {
    const balance = record.balance;

    if (balance === null) {
      return {
        barcode: {
          id: record.barcode.id,
          value: record.barcode.value,
          type: record.barcode.type,
          source: record.barcode.source,
          isPrimary: record.barcode.isPrimary,
        },
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
        balance: {
          persisted: false,
          stockOnHand: 0,
          reservedQuantity: 0,
          damagedQuantity: 0,
          availableQuantity: 0,
          reorderLevel: 0,
          version: null,
          lastCountedAt: null,
          updatedAt: null,
        },
      };
    }

    const availableQuantity =
      balance.stockOnHand - balance.reservedQuantity - balance.damagedQuantity;

    if (!Number.isSafeInteger(availableQuantity) || availableQuantity < 0) {
      throw createCatalogueStateInvalidException();
    }

    return {
      barcode: {
        id: record.barcode.id,
        value: record.barcode.value,
        type: record.barcode.type,
        source: record.barcode.source,
        isPrimary: record.barcode.isPrimary,
      },
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
      balance: {
        persisted: true,
        stockOnHand: balance.stockOnHand,
        reservedQuantity: balance.reservedQuantity,
        damagedQuantity: balance.damagedQuantity,
        availableQuantity,
        reorderLevel: balance.reorderLevel,
        version: balance.version,
        lastCountedAt: balance.lastCountedAt,
        updatedAt: balance.updatedAt,
      },
    };
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantInventoryBarcodeValidationError) {
      throw createInvalidInventoryBarcodeException();
    }

    if (error instanceof MerchantInventoryBarcodeGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof MerchantInventoryBarcodeDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
