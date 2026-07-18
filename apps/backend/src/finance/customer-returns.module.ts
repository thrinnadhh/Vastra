import { Module } from '@nestjs/common';

import { CustomerReturnController } from './customer-return.controller';
import { SupabaseCustomerReturnGateway } from './customer-return.gateway';
import { CustomerReturnService } from './customer-return.service';
import { CUSTOMER_RETURN_GATEWAY, RETURN_EVIDENCE_GATEWAY } from './customer-return.tokens';
import {
  AdminReturnPickupController,
  CustomerReturnEvidenceController,
} from './return-evidence.controller';
import { SupabaseReturnEvidenceGateway } from './return-evidence.gateway';
import { ReturnEvidenceService } from './return-evidence.service';

@Module({
  controllers: [
    CustomerReturnController,
    CustomerReturnEvidenceController,
    AdminReturnPickupController,
  ],
  providers: [
    CustomerReturnService,
    ReturnEvidenceService,
    {
      provide: CUSTOMER_RETURN_GATEWAY,
      useClass: SupabaseCustomerReturnGateway,
    },
    {
      provide: RETURN_EVIDENCE_GATEWAY,
      useClass: SupabaseReturnEvidenceGateway,
    },
  ],
  exports: [
    CUSTOMER_RETURN_GATEWAY,
    RETURN_EVIDENCE_GATEWAY,
    CustomerReturnService,
    ReturnEvidenceService,
  ],
})
export class CustomerReturnsModule {}
