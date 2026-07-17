import { Module } from '@nestjs/common';

import { MerchantAlertObservabilityController } from './merchant-alert-observability.controller';
import { SupabaseMerchantAlertObservabilityGateway } from './merchant-alert-observability.gateway';
import { MerchantAlertObservabilityService } from './merchant-alert-observability.service';
import { MERCHANT_ALERT_OBSERVABILITY_GATEWAY } from './merchant-alert-observability.tokens';

@Module({
  controllers: [MerchantAlertObservabilityController],
  providers: [
    MerchantAlertObservabilityService,
    {
      provide: MERCHANT_ALERT_OBSERVABILITY_GATEWAY,
      useClass: SupabaseMerchantAlertObservabilityGateway,
    },
  ],
})
export class MerchantAlertObservabilityModule {}
