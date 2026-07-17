import { Module } from '@nestjs/common';

import { FcmMerchantAlertSender } from './fcm-merchant-alert.sender';
import { FirebaseAccessTokenService } from './firebase-access-token.service';
import { loadMerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import { SupabaseMerchantAlertDeliveryGateway } from './merchant-alert-delivery.gateway';
import {
  FCM_ACCESS_TOKEN_PROVIDER,
  MERCHANT_ALERT_DELIVERY_CONFIGURATION,
  MERCHANT_ALERT_DELIVERY_GATEWAY,
  MERCHANT_ALERT_SENDER,
} from './merchant-alert-delivery.tokens';
import { MerchantAlertDispatchService } from './merchant-alert-dispatch.service';
import { MerchantAlertDispatchWorker } from './merchant-alert-dispatch.worker';

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
    MerchantAlertDispatchService,
    MerchantAlertDispatchWorker,
  ],
})
export class MerchantAlertDeliveryModule {}
