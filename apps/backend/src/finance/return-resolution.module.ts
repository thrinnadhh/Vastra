import { Module } from '@nestjs/common';

import { MerchantReturnController } from './merchant-return.controller';
import { SupabaseMerchantReturnGateway } from './merchant-return.gateway';
import { MerchantReturnService } from './merchant-return.service';
import { MERCHANT_RETURN_GATEWAY } from './return-resolution.tokens';

@Module({
  controllers: [MerchantReturnController],
  providers: [
    MerchantReturnService,
    { provide: MERCHANT_RETURN_GATEWAY, useClass: SupabaseMerchantReturnGateway },
  ],
  exports: [MERCHANT_RETURN_GATEWAY, MerchantReturnService],
})
export class ReturnResolutionModule {}
