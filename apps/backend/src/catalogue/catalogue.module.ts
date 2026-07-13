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

@Module({
  controllers: [
    MerchantShopContextController,
    CategoryCatalogueController,
    MerchantProductController,
  ],
  providers: [
    MerchantShopContextService,
    CategoryCatalogueService,
    MerchantProductService,
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
  ],
})
export class CatalogueModule {}
