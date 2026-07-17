import { Module } from '@nestjs/common';

import { AdminDeliveryController } from './admin-delivery.controller';
import { CaptainPresenceController } from './captain-presence.controller';
import { SupabaseCaptainPresenceGateway } from './captain-presence.gateway';
import { CaptainPresenceService } from './captain-presence.service';
import { CAPTAIN_PRESENCE_GATEWAY } from './captain-presence.tokens';
import { loadDeliveryDispatchConfiguration } from './delivery-dispatch.configuration';
import { DeliveryDispatchWorker } from './delivery-dispatch.worker';
import {
  CustomerDeliveryController,
  MerchantDeliveryController,
} from './delivery-secret.controller';
import { DeliveryController } from './delivery.controller';
import { SupabaseDeliveryGateway } from './delivery.gateway';
import { DeliveryService } from './delivery.service';
import { DELIVERY_DISPATCH_CONFIGURATION, DELIVERY_GATEWAY } from './delivery.tokens';
import { SupabaseOrderDispatchGateway } from './order-dispatch.gateway';
import { OrderDispatchService } from './order-dispatch.service';
import { ORDER_DISPATCH_GATEWAY } from './order-dispatch.tokens';

@Module({
  controllers: [
    CaptainPresenceController,
    DeliveryController,
    MerchantDeliveryController,
    CustomerDeliveryController,
    AdminDeliveryController,
  ],
  providers: [
    CaptainPresenceService,
    { provide: CAPTAIN_PRESENCE_GATEWAY, useClass: SupabaseCaptainPresenceGateway },
    DeliveryService,
    { provide: DELIVERY_GATEWAY, useClass: SupabaseDeliveryGateway },
    {
      provide: DELIVERY_DISPATCH_CONFIGURATION,
      useFactory: loadDeliveryDispatchConfiguration,
    },
    DeliveryDispatchWorker,
    OrderDispatchService,
    { provide: ORDER_DISPATCH_GATEWAY, useClass: SupabaseOrderDispatchGateway },
  ],
  exports: [OrderDispatchService, DeliveryService],
})
export class DispatchModule {}
