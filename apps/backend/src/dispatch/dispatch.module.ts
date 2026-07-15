import { Module } from '@nestjs/common';

import { SupabaseOrderDispatchGateway } from './order-dispatch.gateway';
import { OrderDispatchService } from './order-dispatch.service';
import { ORDER_DISPATCH_GATEWAY } from './order-dispatch.tokens';

@Module({
  providers: [
    OrderDispatchService,
    { provide: ORDER_DISPATCH_GATEWAY, useClass: SupabaseOrderDispatchGateway },
  ],
  exports: [OrderDispatchService],
})
export class DispatchModule {}
