import { Module } from '@nestjs/common';

import { CategoryCatalogueController } from './category-catalogue.controller';
import { CustomerCatalogueReadController } from './customer-catalogue-read.controller';
import { SupabaseCustomerCatalogueReadGateway } from './customer-catalogue-read.gateway';
import { CustomerCatalogueReadService } from './customer-catalogue-read.service';
import { CUSTOMER_CATALOGUE_READ_GATEWAY } from './customer-catalogue-read.tokens';
import { CustomerCartController } from './customer-cart.controller';
import { SupabaseCustomerCartGateway } from './customer-cart.gateway';
import { CustomerCartService } from './customer-cart.service';
import { CUSTOMER_CART_GATEWAY } from './customer-cart.tokens';
import { CustomerHomeController } from './customer-home.controller';
import { CustomerHomeService } from './customer-home.service';
import { CustomerPreferenceController } from './customer-preference.controller';
import { SupabaseCustomerPreferenceGateway } from './customer-preference.gateway';
import { CustomerPreferenceService } from './customer-preference.service';
import { CUSTOMER_PREFERENCE_GATEWAY } from './customer-preference.tokens';
import { CustomerInventoryReservationController } from './customer-inventory-reservation.controller';
import { CustomerNearbyShopController } from './customer-nearby-shop.controller';
import { CustomerProductSearchController } from './customer-product-search.controller';
import { SupabaseCustomerProductSearchGateway } from './customer-product-search.gateway';
import { CustomerProductSearchService } from './customer-product-search.service';
import { CUSTOMER_PRODUCT_SEARCH_GATEWAY } from './customer-product-search.tokens';
import { CustomerShopDetailController } from './customer-shop-detail.controller';
import { SupabaseCustomerShopDetailGateway } from './customer-shop-detail.gateway';
import { CustomerShopDetailService } from './customer-shop-detail.service';
import { CUSTOMER_SHOP_DETAIL_GATEWAY } from './customer-shop-detail.tokens';
import { SupabaseCustomerNearbyShopGateway } from './customer-nearby-shop.gateway';
import { CustomerNearbyShopService } from './customer-nearby-shop.service';
import { CUSTOMER_NEARBY_SHOP_GATEWAY } from './customer-nearby-shop.tokens';
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
    CustomerCartController,
    CustomerHomeController,
    CustomerPreferenceController,
    CustomerInventoryReservationController,
    CustomerNearbyShopController,
    CustomerProductSearchController,
    CustomerShopDetailController,
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
    CustomerCartService,
    CustomerHomeService,
    CustomerPreferenceService,
    CustomerInventoryReservationService,
    CustomerNearbyShopService,
    CustomerProductSearchService,
    CustomerShopDetailService,
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
      provide: CUSTOMER_CART_GATEWAY,
      useClass: SupabaseCustomerCartGateway,
    },
    {
      provide: CUSTOMER_PREFERENCE_GATEWAY,
      useClass: SupabaseCustomerPreferenceGateway,
    },
    {
      provide: CUSTOMER_INVENTORY_RESERVATION_GATEWAY,
      useClass: SupabaseCustomerInventoryReservationGateway,
    },
    {
      provide: CUSTOMER_NEARBY_SHOP_GATEWAY,
      useClass: SupabaseCustomerNearbyShopGateway,
    },
    {
      provide: CUSTOMER_PRODUCT_SEARCH_GATEWAY,
      useClass: SupabaseCustomerProductSearchGateway,
    },
    {
      provide: CUSTOMER_SHOP_DETAIL_GATEWAY,
      useClass: SupabaseCustomerShopDetailGateway,
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
    CUSTOMER_CART_GATEWAY,
    CUSTOMER_PREFERENCE_GATEWAY,
    CUSTOMER_INVENTORY_RESERVATION_GATEWAY,
    CUSTOMER_NEARBY_SHOP_GATEWAY,
    CUSTOMER_PRODUCT_SEARCH_GATEWAY,
    CUSTOMER_SHOP_DETAIL_GATEWAY,
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
