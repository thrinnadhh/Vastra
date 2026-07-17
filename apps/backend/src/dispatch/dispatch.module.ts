import { Module } from '@nestjs/common';

import { CaptainPresenceController } from './captain-presence.controller';
import { SupabaseCaptainPresenceGateway } from './captain-presence.gateway';
import { CaptainPresenceService } from './captain-presence.service';
import { CAPTAIN_PRESENCE_GATEWAY } from './captain-presence.tokens';
import { SupabaseOrderDispatchGateway } from './order-dispatch.gateway';
import { OrderDispatchService } from './order-dispatch.service';
import { ORDER_DISPATCH_GATEWAY } from './order-dispatch.tokens';

@Module({
  controllers: [CaptainPresenceController],
  providers: [
    CaptainPresenceService,
    { provide: CAPTAIN_PRESENCE_GATEWAY, useClass: SupabaseCaptainPresenceGateway },
    OrderDispatchService,
    { provide: ORDER_DISPATCH_GATEWAY, useClass: SupabaseOrderDispatchGateway },
  ],
  exports: [OrderDispatchService],
})
export class DispatchModule {}
