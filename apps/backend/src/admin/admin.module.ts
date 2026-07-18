import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminCaptainController } from './admin-captain.controller';
import { SupabaseAdminCaptainGateway } from './admin-captain.gateway';
import { AdminCaptainService } from './admin-captain.service';
import { AdminMerchantController } from './admin-merchant.controller';
import { SupabaseAdminMerchantGateway } from './admin-merchant.gateway';
import { AdminMerchantService } from './admin-merchant.service';
import { ADMIN_AUDIT_GATEWAY, ADMIN_CAPTAIN_GATEWAY, ADMIN_MERCHANT_GATEWAY } from './admin.tokens';

@Module({
  controllers: [AdminAuditController, AdminMerchantController, AdminCaptainController],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
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
    AdminMerchantService,
    AdminCaptainService,
  ],
  exports: [
    ADMIN_AUDIT_GATEWAY,
    ADMIN_MERCHANT_GATEWAY,
    ADMIN_CAPTAIN_GATEWAY,
    AdminAuditService,
    AdminMerchantService,
    AdminCaptainService,
  ],
})
export class AdminModule {}
