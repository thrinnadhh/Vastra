import { Controller, Headers, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import { PaymentWebhookService } from './payment-webhook.service';

type RawPaymentWebhookRequest = Readonly<{ rawBody?: Buffer }>;

@Controller('webhooks/payments')
export class PaymentWebhookController {
  public constructor(
    @Inject(PaymentWebhookService)
    private readonly service: PaymentWebhookService,
  ) {}

  @Public()
  @Post('cashfree')
  @HttpCode(HttpStatus.OK)
  public ingest(
    @Req() request: RawPaymentWebhookRequest,
    @Headers('x-webhook-signature') signature: unknown,
    @Headers('x-webhook-timestamp') timestamp: unknown,
    @Headers('x-webhook-version') version: unknown,
    @Headers('x-idempotency-key') idempotencyKey: unknown,
  ) {
    return this.service.ingest(request.rawBody, signature, timestamp, version, idempotencyKey);
  }
}
