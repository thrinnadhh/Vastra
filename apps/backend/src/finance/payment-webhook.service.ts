import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  PaymentProviderUnavailableError,
  PaymentWebhookPayloadInvalidError,
  PaymentWebhookSignatureInvalidError,
} from './cashfree-payment-provider.gateway';
import type { PaymentProviderGateway } from './payment-provider.contract';
import {
  type PaymentWebhookGateway,
  PaymentWebhookGatewayUnavailableError,
  PaymentWebhookIdempotencyConflictError,
} from './payment-webhook.gateway';
import type { PaymentWebhookResponse } from './payment-webhook.types';
import { PAYMENT_PROVIDER_GATEWAY, PAYMENT_WEBHOOK_GATEWAY } from './payment.tokens';

const MAXIMUM_WEBHOOK_BYTES = 256 * 1024;

export class PaymentWebhookRequestInvalidError extends Error {}

function requireHeader(value: unknown): string {
  if (typeof value !== 'string') throw new PaymentWebhookRequestInvalidError();
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 512) {
    throw new PaymentWebhookRequestInvalidError();
  }
  return normalized;
}

@Injectable()
export class PaymentWebhookService {
  public constructor(
    @Inject(PAYMENT_PROVIDER_GATEWAY)
    private readonly provider: PaymentProviderGateway,
    @Inject(PAYMENT_WEBHOOK_GATEWAY)
    private readonly gateway: PaymentWebhookGateway,
  ) {}

  public async ingest(
    rawBody: Buffer | undefined,
    signature: unknown,
    timestamp: unknown,
    version: unknown,
    idempotencyKey: unknown,
  ): Promise<PaymentWebhookResponse> {
    try {
      if (rawBody === undefined || rawBody.length === 0 || rawBody.length > MAXIMUM_WEBHOOK_BYTES) {
        throw new PaymentWebhookRequestInvalidError();
      }
      const event = this.provider.verifyWebhook({
        rawBody: rawBody.toString('utf8'),
        signature: requireHeader(signature),
        timestamp: requireHeader(timestamp),
        version: requireHeader(version),
        idempotencyKey: requireHeader(idempotencyKey),
      });
      const receipt = await this.gateway.ingest(event);
      return { success: true, data: receipt, meta: { requestId: null } };
    } catch (error: unknown) {
      if (
        error instanceof PaymentWebhookRequestInvalidError ||
        error instanceof PaymentWebhookPayloadInvalidError
      ) {
        throw new BadRequestException('Payment webhook is invalid');
      }
      if (error instanceof PaymentWebhookSignatureInvalidError) {
        throw new UnauthorizedException('Payment webhook signature is invalid');
      }
      if (error instanceof PaymentWebhookIdempotencyConflictError) {
        throw new ConflictException('Payment webhook identity conflicts with stored event');
      }
      if (
        error instanceof PaymentWebhookGatewayUnavailableError ||
        error instanceof PaymentProviderUnavailableError
      ) {
        throw new ServiceUnavailableException('Payment webhook service is unavailable');
      }
      throw error;
    }
  }
}
