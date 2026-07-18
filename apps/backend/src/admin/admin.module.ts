import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { ADMIN_AUDIT_GATEWAY } from './admin.tokens';

@Module({
  controllers: [AdminAuditController],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
    },
    AdminAuditService,
  ],
  exports: [ADMIN_AUDIT_GATEWAY, AdminAuditService],
})
export class AdminModule {}
