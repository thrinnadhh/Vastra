import { Module } from '@nestjs/common';

import { CaptainFinanceController } from './captain-finance.controller';
import { SupabaseCaptainFinanceGateway } from './captain-finance.gateway';
import { CaptainFinanceService } from './captain-finance.service';
import { CAPTAIN_FINANCE_GATEWAY, MERCHANT_SETTLEMENT_GATEWAY } from './finance-ledger.tokens';
import { MerchantSettlementController } from './merchant-settlement.controller';
import { SupabaseMerchantSettlementGateway } from './merchant-settlement.gateway';
import { MerchantSettlementService } from './merchant-settlement.service';

@Module({
  controllers: [MerchantSettlementController, CaptainFinanceController],
  providers: [
    MerchantSettlementService,
    CaptainFinanceService,
    { provide: MERCHANT_SETTLEMENT_GATEWAY, useClass: SupabaseMerchantSettlementGateway },
    { provide: CAPTAIN_FINANCE_GATEWAY, useClass: SupabaseCaptainFinanceGateway },
  ],
  exports: [
    MERCHANT_SETTLEMENT_GATEWAY,
    CAPTAIN_FINANCE_GATEWAY,
    MerchantSettlementService,
    CaptainFinanceService,
  ],
})
export class FinanceLedgerModule {}
