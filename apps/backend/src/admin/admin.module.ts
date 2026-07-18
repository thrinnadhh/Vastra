import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminOrderInvestigationController } from './admin-order-investigation.controller';
import { SupabaseAdminOrderInvestigationGateway } from './admin-order-investigation.gateway';
import { AdminOrderInvestigationService } from './admin-order-investigation.service';
import { AdminOrderOperationsController } from './admin-order-operations.controller';
import { SupabaseAdminOrderOperationsGateway } from './admin-order-operations.gateway';
import { AdminOrderOperationsService } from './admin-order-operations.service';
import {
  ADMIN_AUDIT_GATEWAY,
  ADMIN_ORDER_INVESTIGATION_GATEWAY,
  ADMIN_ORDER_OPERATIONS_GATEWAY,
} from './admin.tokens';

@Module({
  controllers: [
    AdminAuditController,
    AdminOrderInvestigationController,
    AdminOrderOperationsController,
  ],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
    },
    {
      provide: ADMIN_ORDER_INVESTIGATION_GATEWAY,
      useClass: SupabaseAdminOrderInvestigationGateway,
    },
    {
      provide: ADMIN_ORDER_OPERATIONS_GATEWAY,
      useClass: SupabaseAdminOrderOperationsGateway,
    },
    AdminAuditService,
    AdminOrderInvestigationService,
    AdminOrderOperationsService,
  ],
  exports: [
    ADMIN_AUDIT_GATEWAY,
    ADMIN_ORDER_INVESTIGATION_GATEWAY,
    ADMIN_ORDER_OPERATIONS_GATEWAY,
    AdminAuditService,
    AdminOrderInvestigationService,
    AdminOrderOperationsService,
  ],
})
export class AdminModule {}
