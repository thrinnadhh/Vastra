import { Module } from '@nestjs/common';

import { CategoryCatalogueController } from './category-catalogue.controller';
import { CustomerCatalogueReadController } from './customer-catalogue-read.controller';
import { SupabaseCustomerCatalogueReadGateway } from './customer-catalogue-read.gateway';
import { CustomerCatalogueReadService } from './customer-catalogue-read.service';
import { CUSTOMER_CATALOGUE_READ_GATEWAY } from './customer-catalogue-read.tokens';
import { CustomerInventoryReservationController } from './customer-inventory-reservation.controller';
import { SupabaseCustomerInventoryReservationGateway } from './customer-inventory-reservation.gateway';
import { CustomerInventoryReservationService } from './customer-inventory-reservation.service';
import { CUSTOMER_INVENTORY_RESERVATION_GATEWAY } from './customer-inventory-reservation.tokens';
import { SupabaseCategoryCatalogueGateway } from './category-catalogue.gateway';
import { CategoryCatalogueService } from './category-catalogue.service';
import { CATEGORY_CATALOGUE_GATEWAY } from './category-catalogue.tokens';
import { MerchantInventoryAdjustmentController } from './merchant-inventory-adjustment.controller';
import { SupabaseMerchantInventoryAdjustmentGateway } from './merchant-inventory-adjustment.gateway';
import { MerchantInventoryAdjustmentService } from './merchant-inventory-adjustment.service';
import { MERCHANT_INVENTORY_ADJUSTMENT_GATEWAY } from './merchant-inventory-adjustment.tokens';
import { MerchantInventoryBarcodeController } from './merchant-inventory-barcode.controller';
import { SupabaseMerchantInventoryBarcodeGateway } from './merchant-inventory-barcode.gateway';
import { MerchantInventoryBarcodeService } from './merchant-inventory-barcode.service';
import { MERCHANT_INVENTORY_BARCODE_GATEWAY } from './merchant-inventory-barcode.tokens';
import { MerchantInventoryBalanceController } from './merchant-inventory-balance.controller';
import { SupabaseMerchantInventoryBalanceGateway } from './merchant-inventory-balance.gateway';
import { MerchantInventoryBalanceService } from './merchant-inventory-balance.service';
import { MERCHANT_INVENTORY_BALANCE_GATEWAY } from './merchant-inventory-balance.tokens';
import { MerchantInventoryLowStockController } from './merchant-inventory-low-stock.controller';
import { SupabaseMerchantInventoryLowStockGateway } from './merchant-inventory-low-stock.gateway';
import { MerchantInventoryLowStockService } from './merchant-inventory-low-stock.service';
import { MERCHANT_INVENTORY_LOW_STOCK_GATEWAY } from './merchant-inventory-low-stock.tokens';
import { MerchantShopContextController } from './merchant-shop-context.controller';
import { SupabaseMerchantShopContextGateway } from './merchant-shop-context.gateway';
import { MerchantShopContextService } from './merchant-shop-context.service';
import { MERCHANT_SHOP_CONTEXT_GATEWAY } from './merchant-shop-context.tokens';
import { MerchantOfflineSaleController } from './merchant-offline-sale.controller';
import { SupabaseMerchantOfflineSaleGateway } from './merchant-offline-sale.gateway';
import { MerchantOfflineSaleService } from './merchant-offline-sale.service';
import { MERCHANT_OFFLINE_SALE_GATEWAY } from './merchant-offline-sale.tokens';
import { MerchantProductController } from './merchant-product.controller';
import { SupabaseMerchantProductGateway } from './merchant-product.gateway';
import { MerchantProductService } from './merchant-product.service';
import { MERCHANT_PRODUCT_GATEWAY } from './merchant-product.tokens';
import { MerchantProductVariantController } from './merchant-product-variant.controller';
import { SupabaseMerchantProductVariantGateway } from './merchant-product-variant.gateway';
import { MerchantProductVariantService } from './merchant-product-variant.service';
import { MERCHANT_PRODUCT_VARIANT_GATEWAY } from './merchant-product-variant.tokens';
import { ProductImageController } from './product-image.controller';
import { SupabaseProductImageGateway } from './product-image.gateway';
import { ProductImageService } from './product-image.service';
import { PRODUCT_IMAGE_GATEWAY } from './product-image.tokens';

@Module({
  controllers: [
    CustomerCatalogueReadController,
    CustomerInventoryReservationController,
    MerchantInventoryAdjustmentController,
    MerchantInventoryBarcodeController,
    MerchantInventoryBalanceController,
    MerchantInventoryLowStockController,
    MerchantOfflineSaleController,
    MerchantShopContextController,
    CategoryCatalogueController,
    MerchantProductController,
    MerchantProductVariantController,
    ProductImageController,
  ],
  providers: [
    MerchantShopContextService,
    CategoryCatalogueService,
    CustomerCatalogueReadService,
    CustomerInventoryReservationService,
    MerchantInventoryAdjustmentService,
    MerchantInventoryBarcodeService,
    MerchantInventoryBalanceService,
    MerchantInventoryLowStockService,
    MerchantOfflineSaleService,
    MerchantProductService,
    MerchantProductVariantService,
    ProductImageService,
    {
      provide: CUSTOMER_CATALOGUE_READ_GATEWAY,
      useClass: SupabaseCustomerCatalogueReadGateway,
    },
    {
      provide: CUSTOMER_INVENTORY_RESERVATION_GATEWAY,
      useClass: SupabaseCustomerInventoryReservationGateway,
    },
    {
      provide: MERCHANT_INVENTORY_ADJUSTMENT_GATEWAY,
      useClass: SupabaseMerchantInventoryAdjustmentGateway,
    },
    {
      provide: MERCHANT_INVENTORY_BARCODE_GATEWAY,
      useClass: SupabaseMerchantInventoryBarcodeGateway,
    },
    {
      provide: MERCHANT_INVENTORY_BALANCE_GATEWAY,
      useClass: SupabaseMerchantInventoryBalanceGateway,
    },
    {
      provide: MERCHANT_INVENTORY_LOW_STOCK_GATEWAY,
      useClass: SupabaseMerchantInventoryLowStockGateway,
    },
    {
      provide: MERCHANT_OFFLINE_SALE_GATEWAY,
      useClass: SupabaseMerchantOfflineSaleGateway,
    },
    {
      provide: MERCHANT_PRODUCT_VARIANT_GATEWAY,
      useClass: SupabaseMerchantProductVariantGateway,
    },
    {
      provide: PRODUCT_IMAGE_GATEWAY,
      useClass: SupabaseProductImageGateway,
    },
    {
      provide: MERCHANT_PRODUCT_GATEWAY,
      useClass: SupabaseMerchantProductGateway,
    },
    {
      provide: CATEGORY_CATALOGUE_GATEWAY,
      useClass: SupabaseCategoryCatalogueGateway,
    },
    {
      provide: MERCHANT_SHOP_CONTEXT_GATEWAY,
      useClass: SupabaseMerchantShopContextGateway,
    },
  ],
  exports: [
    MerchantShopContextService,
    CategoryCatalogueService,
    MERCHANT_SHOP_CONTEXT_GATEWAY,
    CATEGORY_CATALOGUE_GATEWAY,
    CUSTOMER_CATALOGUE_READ_GATEWAY,
    CUSTOMER_INVENTORY_RESERVATION_GATEWAY,
    MERCHANT_INVENTORY_ADJUSTMENT_GATEWAY,
    MERCHANT_INVENTORY_BARCODE_GATEWAY,
    MERCHANT_INVENTORY_BALANCE_GATEWAY,
    MERCHANT_INVENTORY_LOW_STOCK_GATEWAY,
    MERCHANT_OFFLINE_SALE_GATEWAY,
    MERCHANT_PRODUCT_GATEWAY,
    MERCHANT_PRODUCT_VARIANT_GATEWAY,
    PRODUCT_IMAGE_GATEWAY,
  ],
})
export class CatalogueModule {}
