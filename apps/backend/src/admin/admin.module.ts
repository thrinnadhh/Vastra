import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminCaptainController } from './admin-captain.controller';
import { SupabaseAdminCaptainGateway } from './admin-captain.gateway';
import { AdminCaptainService } from './admin-captain.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { SupabaseAdminDashboardGateway } from './admin-dashboard.gateway';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminMerchantController } from './admin-merchant.controller';
import { SupabaseAdminMerchantGateway } from './admin-merchant.gateway';
import { AdminMerchantService } from './admin-merchant.service';
import { AdminOrderInvestigationController } from './admin-order-investigation.controller';
import { SupabaseAdminOrderInvestigationGateway } from './admin-order-investigation.gateway';
import { AdminOrderInvestigationService } from './admin-order-investigation.service';
import { AdminOrderOperationsController } from './admin-order-operations.controller';
import { SupabaseAdminOrderOperationsGateway } from './admin-order-operations.gateway';
import { AdminOrderOperationsService } from './admin-order-operations.service';
import {
  ADMIN_AUDIT_GATEWAY,
  ADMIN_CAPTAIN_GATEWAY,
  ADMIN_DASHBOARD_GATEWAY,
  ADMIN_MERCHANT_GATEWAY,
  ADMIN_ORDER_INVESTIGATION_GATEWAY,
  ADMIN_ORDER_OPERATIONS_GATEWAY,
} from './admin.tokens';

@Module({
  controllers: [
    AdminAuditController,
    AdminDashboardController,
    AdminOrderInvestigationController,
    AdminOrderOperationsController,
    AdminMerchantController,
    AdminCaptainController,
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
    {
      provide: ADMIN_MERCHANT_GATEWAY,
      useClass: SupabaseAdminMerchantGateway,
    },
    {
      provide: ADMIN_CAPTAIN_GATEWAY,
      useClass: SupabaseAdminCaptainGateway,
    },
    AdminAuditService,
    AdminDashboardService,
    AdminOrderInvestigationService,
    AdminOrderOperationsService,
    AdminMerchantService,
    AdminCaptainService,
  ],
  exports: [
    ADMIN_AUDIT_GATEWAY,
    ADMIN_DASHBOARD_GATEWAY,
    ADMIN_ORDER_INVESTIGATION_GATEWAY,
    ADMIN_ORDER_OPERATIONS_GATEWAY,
    ADMIN_MERCHANT_GATEWAY,
    ADMIN_CAPTAIN_GATEWAY,
    AdminAuditService,
    AdminDashboardService,
    AdminOrderInvestigationService,
    AdminOrderOperationsService,
    AdminMerchantService,
    AdminCaptainService,
  ],
})
export class AdminModule {}
