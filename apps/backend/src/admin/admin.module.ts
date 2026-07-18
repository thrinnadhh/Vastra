import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { SupabaseAdminDashboardGateway } from './admin-dashboard.gateway';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminOrderInvestigationController } from './admin-order-investigation.controller';
import { SupabaseAdminOrderInvestigationGateway } from './admin-order-investigation.gateway';
import { AdminOrderInvestigationService } from './admin-order-investigation.service';
import { AdminOrderOperationsController } from './admin-order-operations.controller';
import { SupabaseAdminOrderOperationsGateway } from './admin-order-operations.gateway';
import { AdminOrderOperationsService } from './admin-order-operations.service';
import {
  ADMIN_AUDIT_GATEWAY,
  ADMIN_DASHBOARD_GATEWAY,
  ADMIN_ORDER_INVESTIGATION_GATEWAY,
  ADMIN_ORDER_OPERATIONS_GATEWAY,
} from './admin.tokens';

@Module({
  controllers: [
    AdminAuditController,
    AdminDashboardController,
    AdminOrderInvestigationController,
    AdminOrderOperationsController,
  ],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
    },
    {
      provide: ADMIN_DASHBOARD_GATEWAY,
      useClass: SupabaseAdminDashboardGateway,
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
    AdminDashboardService,
    AdminOrderInvestigationService,
    AdminOrderOperationsService,
  ],
  exports: [
    ADMIN_AUDIT_GATEWAY,
    ADMIN_DASHBOARD_GATEWAY,
    ADMIN_ORDER_INVESTIGATION_GATEWAY,
    ADMIN_ORDER_OPERATIONS_GATEWAY,
    AdminAuditService,
    AdminDashboardService,
    AdminOrderInvestigationService,
    AdminOrderOperationsService,
  ],
})
export class AdminModule {}
