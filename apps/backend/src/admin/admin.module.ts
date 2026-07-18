import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminConfigurationController } from './admin-configuration.controller';
import { SupabaseAdminConfigurationGateway } from './admin-configuration.gateway';
import { AdminConfigurationService } from './admin-configuration.service';
import { ADMIN_AUDIT_GATEWAY, ADMIN_CONFIGURATION_GATEWAY } from './admin.tokens';

@Module({
  controllers: [AdminAuditController, AdminConfigurationController],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
    },
    {
      provide: ADMIN_CONFIGURATION_GATEWAY,
      useClass: SupabaseAdminConfigurationGateway,
    },
    AdminAuditService,
    AdminConfigurationService,
  ],
  exports: [
    ADMIN_AUDIT_GATEWAY,
    ADMIN_CONFIGURATION_GATEWAY,
    AdminAuditService,
    AdminConfigurationService,
  ],
})
export class AdminModule {}
