import { Module } from '@nestjs/common';

import { CashfreePaymentProviderGateway } from './cashfree-payment-provider.gateway';
import { CustomerPaymentController } from './customer-payment.controller';
import { SupabaseCustomerPaymentGateway } from './customer-payment.gateway';
import { CustomerPaymentService } from './customer-payment.service';
import { CUSTOMER_PAYMENT_GATEWAY, PAYMENT_PROVIDER_GATEWAY } from './payment.tokens';

@Module({
  controllers: [CustomerPaymentController],
  providers: [
    CustomerPaymentService,
    {
      provide: CUSTOMER_PAYMENT_GATEWAY,
      useClass: SupabaseCustomerPaymentGateway,
    },
    {
      provide: PAYMENT_PROVIDER_GATEWAY,
      useClass: CashfreePaymentProviderGateway,
    },
  ],
  exports: [CUSTOMER_PAYMENT_GATEWAY, PAYMENT_PROVIDER_GATEWAY, CustomerPaymentService],
})
export class PaymentModule {}
