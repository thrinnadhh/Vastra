import { Module } from '@nestjs/common';

import { CustomerOrderController } from './customer-order.controller';
import { SupabaseCustomerOrderGateway } from './customer-order.gateway';
import { CustomerOrderService } from './customer-order.service';
import { CUSTOMER_ORDER_GATEWAY } from './customer-order.tokens';

@Module({
  controllers: [CustomerOrderController],
  providers: [
    CustomerOrderService,
    {
      provide: CUSTOMER_ORDER_GATEWAY,
      useClass: SupabaseCustomerOrderGateway,
    },
  ],
  exports: [CUSTOMER_ORDER_GATEWAY],
})
export class OrdersModule {}
