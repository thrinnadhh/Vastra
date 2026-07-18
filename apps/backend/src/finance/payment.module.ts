import { Module } from '@nestjs/common';

import { CashfreeFinanceProviderGateway } from './cashfree-finance-provider.gateway';
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
  REFUND_EXECUTION_GATEWAY,
} from './payment.tokens';
import { RefundExecutionController } from './refund-execution.controller';
import { SupabaseRefundExecutionGateway } from './refund-execution.gateway';
import { RefundExecutionService } from './refund-execution.service';

@Module({
  controllers: [
    CustomerPaymentController,
    PaymentWebhookController,
    PaymentProcessingController,
    RefundExecutionController,
  ],
  providers: [
    CustomerPaymentService,
    PaymentWebhookService,
    PaymentProcessingService,
    PaymentProcessingWorker,
    RefundExecutionService,
    {
      provide: CUSTOMER_PAYMENT_GATEWAY,
      useClass: SupabaseCustomerPaymentGateway,
    },
    {
      provide: PAYMENT_PROVIDER_GATEWAY,
      useClass: CashfreeFinanceProviderGateway,
    },
    {
      provide: PAYMENT_WEBHOOK_GATEWAY,
      useClass: SupabasePaymentWebhookGateway,
    },
    {
      provide: PAYMENT_PROCESSING_GATEWAY,
      useClass: SupabasePaymentProcessingGateway,
    },
    {
      provide: REFUND_EXECUTION_GATEWAY,
      useClass: SupabaseRefundExecutionGateway,
    },
  ],
  exports: [
    CUSTOMER_PAYMENT_GATEWAY,
    PAYMENT_PROVIDER_GATEWAY,
    PAYMENT_WEBHOOK_GATEWAY,
    PAYMENT_PROCESSING_GATEWAY,
    REFUND_EXECUTION_GATEWAY,
    CustomerPaymentService,
    PaymentWebhookService,
    PaymentProcessingService,
    RefundExecutionService,
  ],
})
export class PaymentModule {}
