import { Module } from '@nestjs/common';

import { CustomerOrderController } from './customer-order.controller';
import { SupabaseCustomerOrderGateway } from './customer-order.gateway';
import { CustomerOrderReadController } from './customer-order-read.controller';
import { SupabaseCustomerOrderReadGateway } from './customer-order-read.gateway';
import { CustomerOrderReadService } from './customer-order-read.service';
import { CUSTOMER_ORDER_READ_GATEWAY } from './customer-order-read.tokens';
import { CustomerOrderService } from './customer-order.service';
import { CUSTOMER_ORDER_GATEWAY } from './customer-order.tokens';

@Module({
  controllers: [CustomerOrderController, CustomerOrderReadController],
  providers: [
    CustomerOrderService,
    CustomerOrderReadService,
    {
      provide: CUSTOMER_ORDER_GATEWAY,
      useClass: SupabaseCustomerOrderGateway,
    },
    {
      provide: CUSTOMER_ORDER_READ_GATEWAY,
      useClass: SupabaseCustomerOrderReadGateway,
    },
  ],
  exports: [CUSTOMER_ORDER_GATEWAY, CUSTOMER_ORDER_READ_GATEWAY],
})
export class OrdersModule {}
