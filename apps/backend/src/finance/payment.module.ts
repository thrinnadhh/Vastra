import { Module } from '@nestjs/common';

import { CashfreePaymentProviderGateway } from './cashfree-payment-provider.gateway';
import { CustomerPaymentController } from './customer-payment.controller';
import { SupabaseCustomerPaymentGateway } from './customer-payment.gateway';
import { CustomerPaymentService } from './customer-payment.service';
import { PaymentProcessingController } from './payment-processing.controller';
import { SupabasePaymentProcessingGateway } from './payment-processing.gateway';
import { PaymentProcessingService } from './payment-processing.service';
import { PaymentProcessingWorker } from './payment-processing.worker';
import { PaymentWebhookController } from './payment-webhook.controller';
import { SupabasePaymentWebhookGateway } from './payment-webhook.gateway';
import { PaymentWebhookService } from './payment-webhook.service';
import {
  CUSTOMER_PAYMENT_GATEWAY,
  PAYMENT_PROCESSING_GATEWAY,
  PAYMENT_PROVIDER_GATEWAY,
  PAYMENT_WEBHOOK_GATEWAY,
} from './payment.tokens';

@Module({
  controllers: [CustomerPaymentController, PaymentWebhookController, PaymentProcessingController],
  providers: [
    CustomerPaymentService,
    PaymentWebhookService,
    PaymentProcessingService,
    PaymentProcessingWorker,
    { provide: CUSTOMER_PAYMENT_GATEWAY, useClass: SupabaseCustomerPaymentGateway },
    { provide: PAYMENT_PROVIDER_GATEWAY, useClass: CashfreePaymentProviderGateway },
    { provide: PAYMENT_WEBHOOK_GATEWAY, useClass: SupabasePaymentWebhookGateway },
    { provide: PAYMENT_PROCESSING_GATEWAY, useClass: SupabasePaymentProcessingGateway },
  ],
  exports: [
    CUSTOMER_PAYMENT_GATEWAY,
    PAYMENT_PROVIDER_GATEWAY,
    PAYMENT_WEBHOOK_GATEWAY,
    PAYMENT_PROCESSING_GATEWAY,
    CustomerPaymentService,
    PaymentWebhookService,
    PaymentProcessingService,
  ],
})
export class PaymentModule {}
