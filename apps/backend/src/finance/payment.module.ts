import { Module } from '@nestjs/common';

import { CashfreePaymentProviderGateway } from './cashfree-payment-provider.gateway';
import { CustomerPaymentController } from './customer-payment.controller';
import { SupabaseCustomerPaymentGateway } from './customer-payment.gateway';
import { CustomerPaymentService } from './customer-payment.service';
import { PaymentWebhookController } from './payment-webhook.controller';
import { SupabasePaymentWebhookGateway } from './payment-webhook.gateway';
import { PaymentWebhookService } from './payment-webhook.service';
import {
  CUSTOMER_PAYMENT_GATEWAY,
  PAYMENT_PROVIDER_GATEWAY,
  PAYMENT_WEBHOOK_GATEWAY,
} from './payment.tokens';

@Module({
  controllers: [CustomerPaymentController, PaymentWebhookController],
  providers: [
    CustomerPaymentService,
    PaymentWebhookService,
    {
      provide: CUSTOMER_PAYMENT_GATEWAY,
      useClass: SupabaseCustomerPaymentGateway,
    },
    {
      provide: PAYMENT_PROVIDER_GATEWAY,
      useClass: CashfreePaymentProviderGateway,
    },
    {
      provide: PAYMENT_WEBHOOK_GATEWAY,
      useClass: SupabasePaymentWebhookGateway,
    },
  ],
  exports: [
    CUSTOMER_PAYMENT_GATEWAY,
    PAYMENT_PROVIDER_GATEWAY,
    PAYMENT_WEBHOOK_GATEWAY,
    CustomerPaymentService,
    PaymentWebhookService,
  ],
})
export class PaymentModule {}
