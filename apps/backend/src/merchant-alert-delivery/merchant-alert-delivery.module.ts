import { Module } from '@nestjs/common';

import { FcmMerchantAlertSender } from './fcm-merchant-alert.sender';
import { FirebaseAccessTokenService } from './firebase-access-token.service';
import { loadMerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import { SupabaseMerchantAlertDeliveryGateway } from './merchant-alert-delivery.gateway';
import { SupabaseMerchantAlertSchedulerGateway } from './merchant-alert-scheduler.gateway';
import {
  FCM_ACCESS_TOKEN_PROVIDER,
  MERCHANT_ALERT_DELIVERY_CONFIGURATION,
  MERCHANT_ALERT_DELIVERY_GATEWAY,
  MERCHANT_ALERT_SENDER,
  MERCHANT_ALERT_SCHEDULER_GATEWAY,
} from './merchant-alert-delivery.tokens';
import { MerchantAlertDispatchService } from './merchant-alert-dispatch.service';
import { MerchantAlertDispatchWorker } from './merchant-alert-dispatch.worker';
import { MerchantAlertSchedulerService } from './merchant-alert-scheduler.service';

@Module({
  providers: [
    {
      provide: MERCHANT_ALERT_DELIVERY_CONFIGURATION,
      useFactory: loadMerchantAlertDeliveryConfiguration,
    },
    {
      provide: FCM_ACCESS_TOKEN_PROVIDER,
      useClass: FirebaseAccessTokenService,
    },
    {
      provide: MERCHANT_ALERT_DELIVERY_GATEWAY,
      useClass: SupabaseMerchantAlertDeliveryGateway,
    },
    {
      provide: MERCHANT_ALERT_SENDER,
      useClass: FcmMerchantAlertSender,
    },
    {
      provide: MERCHANT_ALERT_SCHEDULER_GATEWAY,
      useClass: SupabaseMerchantAlertSchedulerGateway,
    },
    MerchantAlertSchedulerService,
    MerchantAlertDispatchService,
    MerchantAlertDispatchWorker,
  ],
})
export class MerchantAlertDeliveryModule {}
