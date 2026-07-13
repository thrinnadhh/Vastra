import { Module } from '@nestjs/common';

import { MerchantShopContextController } from './merchant-shop-context.controller';
import { SupabaseMerchantShopContextGateway } from './merchant-shop-context.gateway';
import { MerchantShopContextService } from './merchant-shop-context.service';
import { MERCHANT_SHOP_CONTEXT_GATEWAY } from './merchant-shop-context.tokens';

@Module({
  controllers: [MerchantShopContextController],
  providers: [
    MerchantShopContextService,
    {
      provide: MERCHANT_SHOP_CONTEXT_GATEWAY,
      useClass: SupabaseMerchantShopContextGateway,
    },
  ],
  exports: [MerchantShopContextService, MERCHANT_SHOP_CONTEXT_GATEWAY],
})
export class CatalogueModule {}
