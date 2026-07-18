import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CustomerPaymentCheckout,
  PlaceCustomerOnlineOrderInput,
  PreparedCustomerPayment,
} from './customer-payment.types';
import type { ProviderCheckoutSession } from './payment-provider.contract';

export interface CustomerPaymentGateway {
  prepare(actorId: string, input: PlaceCustomerOnlineOrderInput): Promise<PreparedCustomerPayment>;
  attachSession(
    actorId: string,
    paymentId: string,
    session: ProviderCheckoutSession,
  ): Promise<CustomerPaymentCheckout>;
  getLatest(actorId: string, orderId: string): Promise<CustomerPaymentCheckout | null>;
}

export class CustomerPaymentGatewayUnavailableError extends Error {}
export class CustomerPaymentIdempotencyConflictError extends Error {}
export class CustomerPaymentOrderNotPayableError extends Error {}
export class CustomerPaymentQuoteInvalidError extends Error {}
export class CustomerPaymentAmountMismatchError extends Error {}
export class CustomerPaymentNotFoundError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CustomerPaymentGatewayUnavailableError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new CustomerPaymentGatewayUnavailableError();
  }
  return value;
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    throw new CustomerPaymentGatewayUnavailableError();
  }
  return value;
}

function requireAmount(record: Record<string, unknown>): number {
  const value = record['amountPaise'];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new CustomerPaymentGatewayUnavailableError();
  }
  return value;
}

function parsePrepared(value: unknown): PreparedCustomerPayment {
  const record = requireRecord(value);
  const replayed = record['replayed'];
  if (typeof replayed !== 'boolean') throw new CustomerPaymentGatewayUnavailableError();
  const currency = requireString(record, 'currency');
  const paymentStatus = requireString(record, 'paymentStatus');
  if (currency !== 'INR' || !['CREATED', 'PENDING'].includes(paymentStatus)) {
    throw new CustomerPaymentGatewayUnavailableError();
  }
  return {
    orderId: requireString(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    paymentId: requireString(record, 'paymentId'),
    providerOrderId: requireString(record, 'providerOrderId'),
    amountPaise: requireAmount(record),
    currency,
    customerPhone: requireString(record, 'customerPhone'),
    paymentStatus: paymentStatus as PreparedCustomerPayment['paymentStatus'],
    providerReferenceId: nullableString(record, 'providerReferenceId'),
    paymentSessionId: nullableString(record, 'paymentSessionId'),
    paymentSessionExpiresAt: nullableString(record, 'paymentSessionExpiresAt'),
    replayed,
  };
}

function parseCheckout(value: unknown): CustomerPaymentCheckout {
  const record = requireRecord(value);
  const replayed = record['replayed'];
  if (typeof replayed !== 'boolean') throw new CustomerPaymentGatewayUnavailableError();
  if (record['provider'] !== 'cashfree' || record['currency'] !== 'INR') {
    throw new CustomerPaymentGatewayUnavailableError();
  }
  if (record['paymentStatus'] !== 'PENDING') throw new CustomerPaymentGatewayUnavailableError();
  return {
    orderId: requireString(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    paymentId: requireString(record, 'paymentId'),
    provider: 'cashfree',
    providerOrderId: requireString(record, 'providerOrderId'),
    providerReferenceId: requireString(record, 'providerReferenceId'),
    paymentSessionId: requireString(record, 'paymentSessionId'),
    amountPaise: requireAmount(record),
    currency: 'INR',
    paymentStatus: 'PENDING',
    expiresAt: nullableString(record, 'expiresAt'),
    replayed,
  };
}

@Injectable()
export class SupabaseCustomerPaymentGateway implements CustomerPaymentGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) {
      throw new CustomerPaymentIdempotencyConflictError();
    }
    if (message.includes('FINANCE_ORDER_NOT_PAYABLE')) {
      throw new CustomerPaymentOrderNotPayableError();
    }
    if (message.includes('FINANCE_PAYMENT_AMOUNT_MISMATCH')) {
      throw new CustomerPaymentAmountMismatchError();
    }
    if (message.includes('FINANCE_PAYMENT_NOT_FOUND')) {
      throw new CustomerPaymentNotFoundError();
    }
    if (message.includes('FINANCE_QUOTE_INVALID')) {
      throw new CustomerPaymentQuoteInvalidError();
    }
    throw new CustomerPaymentGatewayUnavailableError();
  }

  public async prepare(
    actorId: string,
    input: PlaceCustomerOnlineOrderInput,
  ): Promise<PreparedCustomerPayment> {
    const { data, error } = await this.client.rpc('prepare_customer_online_payment', {
      p_actor_id: actorId,
      p_cart_id: input.cartId,
      p_quote_id: input.quoteId,
      p_address_id: input.addressId,
      p_customer_note: input.customerNote,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) this.mapError(error.message);
    return parsePrepared(data);
  }

  public async attachSession(
    actorId: string,
    paymentId: string,
    session: ProviderCheckoutSession,
  ): Promise<CustomerPaymentCheckout> {
    const { data, error } = await this.client.rpc('attach_customer_payment_session', {
      p_actor_id: actorId,
      p_payment_id: paymentId,
      p_provider_order_id: session.providerOrderId,
      p_provider_reference_id: session.providerReferenceId,
      p_payment_session_id: session.paymentSessionId,
      p_amount_paise: session.amountPaise,
      p_currency: session.currency,
      p_expires_at: session.expiresAt,
    });
    if (error !== null) this.mapError(error.message);
    return parseCheckout(data);
  }

  public async getLatest(
    actorId: string,
    orderId: string,
  ): Promise<CustomerPaymentCheckout | null> {
    const { data, error } = await this.client.rpc('get_customer_latest_payment_session', {
      p_actor_id: actorId,
      p_order_id: orderId,
    });
    if (error !== null) this.mapError(error.message);
    if (data === null) return null;
    return parseCheckout(data);
  }
}
