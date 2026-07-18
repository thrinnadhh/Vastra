import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { SupabaseAdminDashboardGateway } from './admin-dashboard.gateway';
import { AdminDashboardService } from './admin-dashboard.service';
import { ADMIN_AUDIT_GATEWAY, ADMIN_DASHBOARD_GATEWAY } from './admin.tokens';

@Module({
  controllers: [AdminAuditController, AdminDashboardController],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
    },
    {
      provide: ADMIN_DASHBOARD_GATEWAY,
      useClass: SupabaseAdminDashboardGateway,
    },
    AdminAuditService,
    AdminDashboardService,
  ],
  exports: [ADMIN_AUDIT_GATEWAY, ADMIN_DASHBOARD_GATEWAY, AdminAuditService, AdminDashboardService],
})
export class AdminModule {}
