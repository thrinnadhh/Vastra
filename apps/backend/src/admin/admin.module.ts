import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminCaseController } from './admin-case.controller';
import { SupabaseAdminCaseGateway } from './admin-case.gateway';
import { AdminCaseService } from './admin-case.service';
import { AdminConfigurationController } from './admin-configuration.controller';
import { SupabaseAdminConfigurationGateway } from './admin-configuration.gateway';
import { AdminConfigurationService } from './admin-configuration.service';
import {
  ADMIN_AUDIT_GATEWAY,
  ADMIN_CASE_GATEWAY,
  ADMIN_CONFIGURATION_GATEWAY,
} from './admin.tokens';

@Module({
  controllers: [AdminAuditController, AdminConfigurationController, AdminCaseController],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
    },
    {
      provide: ADMIN_CONFIGURATION_GATEWAY,
      useClass: SupabaseAdminConfigurationGateway,
    },
    {
      provide: ADMIN_CASE_GATEWAY,
      useClass: SupabaseAdminCaseGateway,
    },
    AdminAuditService,
    AdminConfigurationService,
    AdminCaseService,
  ],
  exports: [
    ADMIN_AUDIT_GATEWAY,
    ADMIN_CONFIGURATION_GATEWAY,
    ADMIN_CASE_GATEWAY,
    AdminAuditService,
    AdminConfigurationService,
    AdminCaseService,
  ],
})
export class AdminModule {}
