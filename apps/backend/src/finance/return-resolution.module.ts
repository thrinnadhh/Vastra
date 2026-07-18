import { Module } from '@nestjs/common';

import { AdminReturnDecisionController } from './admin-return-decision.controller';
import { SupabaseAdminReturnDecisionGateway } from './admin-return-decision.gateway';
import { AdminReturnDecisionService } from './admin-return-decision.service';
import { MerchantReturnController } from './merchant-return.controller';
import { SupabaseMerchantReturnGateway } from './merchant-return.gateway';
import { MerchantReturnService } from './merchant-return.service';
import { ADMIN_RETURN_DECISION_GATEWAY, MERCHANT_RETURN_GATEWAY } from './return-resolution.tokens';

@Module({
  controllers: [MerchantReturnController, AdminReturnDecisionController],
  providers: [
    MerchantReturnService,
    AdminReturnDecisionService,
    {
      provide: MERCHANT_RETURN_GATEWAY,
      useClass: SupabaseMerchantReturnGateway,
    },
    {
      provide: ADMIN_RETURN_DECISION_GATEWAY,
      useClass: SupabaseAdminReturnDecisionGateway,
    },
  ],
  exports: [
    MERCHANT_RETURN_GATEWAY,
    ADMIN_RETURN_DECISION_GATEWAY,
    MerchantReturnService,
    AdminReturnDecisionService,
  ],
})
export class ReturnResolutionModule {}
