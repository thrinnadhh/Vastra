import { Module } from '@nestjs/common';

import { AdminAuditController } from './admin-audit.controller';
import { SupabaseAdminAuditGateway } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';
import { AdminMerchantController } from './admin-merchant.controller';
import { SupabaseAdminMerchantGateway } from './admin-merchant.gateway';
import { AdminMerchantService } from './admin-merchant.service';
import { ADMIN_AUDIT_GATEWAY, ADMIN_MERCHANT_GATEWAY } from './admin.tokens';

@Module({
  controllers: [AdminAuditController, AdminMerchantController],
  providers: [
    {
      provide: ADMIN_AUDIT_GATEWAY,
      useClass: SupabaseAdminAuditGateway,
    },
    {
      provide: ADMIN_MERCHANT_GATEWAY,
      useClass: SupabaseAdminMerchantGateway,
    },
    AdminAuditService,
    AdminMerchantService,
  ],
  exports: [
    ADMIN_AUDIT_GATEWAY,
    ADMIN_MERCHANT_GATEWAY,
    AdminAuditService,
    AdminMerchantService,
  ],
})
export class AdminModule {}
