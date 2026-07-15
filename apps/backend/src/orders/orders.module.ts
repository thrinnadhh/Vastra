import { Module } from '@nestjs/common';

import { CustomerOrderController } from './customer-order.controller';
import { SupabaseCustomerOrderGateway } from './customer-order.gateway';
import { CustomerOrderReadController } from './customer-order-read.controller';
import { SupabaseCustomerOrderReadGateway } from './customer-order-read.gateway';
import { CustomerOrderReadService } from './customer-order-read.service';
import { CUSTOMER_ORDER_READ_GATEWAY } from './customer-order-read.tokens';
import { CustomerOrderService } from './customer-order.service';
import { CUSTOMER_ORDER_GATEWAY } from './customer-order.tokens';
import { MerchantOrderAlertController } from './merchant-order-alert.controller';
import { SupabaseMerchantOrderAlertGateway } from './merchant-order-alert.gateway';
import { MerchantOrderAlertService } from './merchant-order-alert.service';
import { MERCHANT_ORDER_ALERT_GATEWAY } from './merchant-order-alert.tokens';
import { MerchantOrderReadController } from './merchant-order-read.controller';
import { SupabaseMerchantOrderReadGateway } from './merchant-order-read.gateway';
import { MerchantOrderReadService } from './merchant-order-read.service';
import { MERCHANT_ORDER_READ_GATEWAY } from './merchant-order-read.tokens';

@Module({
  controllers: [
    CustomerOrderController,
    CustomerOrderReadController,
    MerchantOrderAlertController,
    MerchantOrderReadController,
  ],
  providers: [
    CustomerOrderService,
    CustomerOrderReadService,
    MerchantOrderAlertService,
    MerchantOrderReadService,
    {
      provide: CUSTOMER_ORDER_GATEWAY,
      useClass: SupabaseCustomerOrderGateway,
    },
    {
      provide: CUSTOMER_ORDER_READ_GATEWAY,
      useClass: SupabaseCustomerOrderReadGateway,
    },
    {
      provide: MERCHANT_ORDER_ALERT_GATEWAY,
      useClass: SupabaseMerchantOrderAlertGateway,
    },
    {
      provide: MERCHANT_ORDER_READ_GATEWAY,
      useClass: SupabaseMerchantOrderReadGateway,
    },
  ],
  exports: [
    CUSTOMER_ORDER_GATEWAY,
    CUSTOMER_ORDER_READ_GATEWAY,
    MERCHANT_ORDER_ALERT_GATEWAY,
    MERCHANT_ORDER_READ_GATEWAY,
  ],
})
export class OrdersModule {}
