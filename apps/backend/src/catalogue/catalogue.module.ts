import { Module } from '@nestjs/common';

import { CategoryCatalogueController } from './category-catalogue.controller';
import { SupabaseCategoryCatalogueGateway } from './category-catalogue.gateway';
import { CategoryCatalogueService } from './category-catalogue.service';
import { CATEGORY_CATALOGUE_GATEWAY } from './category-catalogue.tokens';
import { MerchantShopContextController } from './merchant-shop-context.controller';
import { SupabaseMerchantShopContextGateway } from './merchant-shop-context.gateway';
import { MerchantShopContextService } from './merchant-shop-context.service';
import { MERCHANT_SHOP_CONTEXT_GATEWAY } from './merchant-shop-context.tokens';
import { MerchantProductController } from './merchant-product.controller';
import { SupabaseMerchantProductGateway } from './merchant-product.gateway';
import { MerchantProductService } from './merchant-product.service';
import { MERCHANT_PRODUCT_GATEWAY } from './merchant-product.tokens';
import { ProductImageController } from './product-image.controller';
import { SupabaseProductImageGateway } from './product-image.gateway';
import { ProductImageService } from './product-image.service';
import { PRODUCT_IMAGE_GATEWAY } from './product-image.tokens';

@Module({
  controllers: [
    MerchantShopContextController,
    CategoryCatalogueController,
    MerchantProductController,
    ProductImageController,
  ],
  providers: [
    MerchantShopContextService,
    CategoryCatalogueService,
    MerchantProductService,
    ProductImageService,
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
    MERCHANT_PRODUCT_GATEWAY,
    PRODUCT_IMAGE_GATEWAY,
  ],
})
export class CatalogueModule {}
