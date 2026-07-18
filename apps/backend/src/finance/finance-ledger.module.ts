import { Module } from '@nestjs/common';

import { MerchantSettlementController } from './merchant-settlement.controller';
import { SupabaseMerchantSettlementGateway } from './merchant-settlement.gateway';
import { MerchantSettlementService } from './merchant-settlement.service';
import { MERCHANT_SETTLEMENT_GATEWAY } from './finance-ledger.tokens';

@Module({
  controllers: [MerchantSettlementController],
  providers: [
    MerchantSettlementService,
    {
      provide: MERCHANT_SETTLEMENT_GATEWAY,
      useClass: SupabaseMerchantSettlementGateway,
    },
  ],
  exports: [MERCHANT_SETTLEMENT_GATEWAY, MerchantSettlementService],
})
export class FinanceLedgerModule {}
