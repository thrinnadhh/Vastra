import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminOrderInvestigationController } from './admin-order-investigation.controller';
import { SupabaseAdminOrderInvestigationGateway } from './admin-order-investigation.gateway';
import { AdminOrderInvestigationService } from './admin-order-investigation.service';
import { ADMIN_AUDIT_GATEWAY, ADMIN_ORDER_INVESTIGATION_GATEWAY } from './admin.tokens';

@Module({
  controllers: [AdminAuditController, AdminOrderInvestigationController],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
    },
    {
      provide: ADMIN_ORDER_INVESTIGATION_GATEWAY,
      useClass: SupabaseAdminOrderInvestigationGateway,
    },
    AdminAuditService,
    AdminOrderInvestigationService,
  ],
  exports: [
    ADMIN_AUDIT_GATEWAY,
    ADMIN_ORDER_INVESTIGATION_GATEWAY,
    AdminAuditService,
    AdminOrderInvestigationService,
  ],
})
export class AdminModule {}
