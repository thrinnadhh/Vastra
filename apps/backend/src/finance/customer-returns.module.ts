import { Module } from '@nestjs/common';

import { CustomerReturnController } from './customer-return.controller';
import { SupabaseCustomerReturnGateway } from './customer-return.gateway';
import { CustomerReturnService } from './customer-return.service';
import { CUSTOMER_RETURN_GATEWAY } from './customer-return.tokens';

@Module({
  controllers: [CustomerReturnController],
  providers: [
    CustomerReturnService,
    {
      provide: CUSTOMER_RETURN_GATEWAY,
      useClass: SupabaseCustomerReturnGateway,
    },
  ],
  exports: [CUSTOMER_RETURN_GATEWAY, CustomerReturnService],
})
export class CustomerReturnsModule {}
