import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { VerifiedProviderPaymentEvent } from './payment-provider.contract';
import type { PaymentWebhookReceipt } from './payment-webhook.types';

export interface PaymentWebhookGateway {
  ingest(event: VerifiedProviderPaymentEvent): Promise<PaymentWebhookReceipt>;
}

export class PaymentWebhookGatewayUnavailableError extends Error {}
export class PaymentWebhookIdempotencyConflictError extends Error {}

function parseReceipt(value: unknown): PaymentWebhookReceipt {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PaymentWebhookGatewayUnavailableError();
  }
  const record = value as Record<string, unknown>;
  const paymentId = record['paymentId'];
  if (paymentId !== null && typeof paymentId !== 'string') {
    throw new PaymentWebhookGatewayUnavailableError();
  }
  if (
    typeof record['eventId'] !== 'string' ||
    typeof record['providerEventId'] !== 'string' ||
    record['processingStatus'] !== 'RECEIVED' ||
    typeof record['replayed'] !== 'boolean'
  ) {
    throw new PaymentWebhookGatewayUnavailableError();
  }
  return {
    eventId: record['eventId'],
    providerEventId: record['providerEventId'],
    paymentId,
    processingStatus: 'RECEIVED',
    replayed: record['replayed'],
  };
}

@Injectable()
export class SupabasePaymentWebhookGateway implements PaymentWebhookGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async ingest(event: VerifiedProviderPaymentEvent): Promise<PaymentWebhookReceipt> {
    const { data, error } = await this.client.rpc('ingest_verified_payment_event', {
      p_provider_event_id: event.providerEventId,
      p_event_type: event.eventType,
      p_provider_order_id: event.providerOrderId,
      p_provider_payment_id: event.providerPaymentId,
      p_amount_paise: event.amountPaise,
      p_currency: event.currency,
      p_occurred_at: event.occurredAt,
      p_payload: event.payload,
    });
    if (error !== null) {
      if (error.message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) {
        throw new PaymentWebhookIdempotencyConflictError();
      }
      throw new PaymentWebhookGatewayUnavailableError();
    }
    return parseReceipt(data);
  }
}
