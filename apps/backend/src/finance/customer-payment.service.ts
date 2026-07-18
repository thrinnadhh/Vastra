import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  CustomerPaymentAmountMismatchError,
  type CustomerPaymentGateway,
  CustomerPaymentGatewayUnavailableError,
  CustomerPaymentIdempotencyConflictError,
  CustomerPaymentNotFoundError,
  CustomerPaymentOrderNotPayableError,
  CustomerPaymentQuoteInvalidError,
} from './customer-payment.gateway';
import type { CustomerPaymentCheckout, CustomerPaymentResponse } from './customer-payment.types';
import {
  CustomerPaymentIdempotencyKeyRequiredError,
  CustomerPaymentValidationError,
  parsePlaceCustomerOnlineOrderInput,
  requireCustomerPaymentUuid,
} from './customer-payment.validation';
import {
  PaymentProviderResponseInvalidError,
  PaymentProviderUnavailableError,
} from './cashfree-payment-provider.gateway';
import type { PaymentProviderGateway } from './payment-provider.contract';
import { CUSTOMER_PAYMENT_GATEWAY, PAYMENT_PROVIDER_GATEWAY } from './payment.tokens';

@Injectable()
export class CustomerPaymentService {
  public constructor(
    @Inject(CUSTOMER_PAYMENT_GATEWAY)
    private readonly gateway: CustomerPaymentGateway,
    @Inject(PAYMENT_PROVIDER_GATEWAY)
    private readonly provider: PaymentProviderGateway,
  ) {}

  public async createCheckout(
    context: AuthenticatedRequestContext,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<CustomerPaymentResponse<CustomerPaymentCheckout>> {
    try {
      const input = parsePlaceCustomerOnlineOrderInput(body, idempotencyKey);
      const prepared = await this.gateway.prepare(context.actor.id, input);
      if (prepared.paymentSessionId !== null && prepared.providerReferenceId !== null) {
        const existing = await this.gateway.getLatest(context.actor.id, prepared.orderId);
        if (existing === null) throw new CustomerPaymentGatewayUnavailableError();
        return this.success(existing);
      }
      const session = await this.provider.createOrder({
        internalOrderId: prepared.providerOrderId,
        customerId: context.actor.id,
        customerPhone: prepared.customerPhone,
        amountPaise: prepared.amountPaise,
        currency: prepared.currency,
        idempotencyKey: input.idempotencyKey,
        returnUrl: process.env['PAYMENT_RETURN_URL'] ?? '',
        notifyUrl: process.env['PAYMENT_NOTIFY_URL'] ?? '',
      });
      const checkout = await this.gateway.attachSession(
        context.actor.id,
        prepared.paymentId,
        session,
      );
      return this.success(checkout);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async getLatest(
    context: AuthenticatedRequestContext,
    rawOrderId: unknown,
  ): Promise<CustomerPaymentResponse<CustomerPaymentCheckout>> {
    try {
      const orderId = requireCustomerPaymentUuid(rawOrderId);
      const checkout = await this.gateway.getLatest(context.actor.id, orderId);
      if (checkout === null) throw new CustomerPaymentNotFoundError();
      return this.success(checkout);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private success(
    checkout: CustomerPaymentCheckout,
  ): CustomerPaymentResponse<CustomerPaymentCheckout> {
    return { success: true, data: checkout, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (
      error instanceof CustomerPaymentValidationError ||
      error instanceof CustomerPaymentIdempotencyKeyRequiredError
    ) {
      throw new BadRequestException('Customer payment request is invalid');
    }
    if (
      error instanceof CustomerPaymentIdempotencyConflictError ||
      error instanceof CustomerPaymentOrderNotPayableError ||
      error instanceof CustomerPaymentAmountMismatchError
    ) {
      throw new ConflictException('Customer payment state conflicts with the request');
    }
    if (error instanceof CustomerPaymentQuoteInvalidError) {
      throw new BadRequestException('Checkout quote is invalid or stale');
    }
    if (error instanceof CustomerPaymentNotFoundError) {
      throw new NotFoundException('Customer payment was not found');
    }
    if (error instanceof PaymentProviderUnavailableError) {
      throw new ServiceUnavailableException('Payment provider is unavailable');
    }
    if (error instanceof PaymentProviderResponseInvalidError) {
      throw new BadGatewayException('Payment provider returned an invalid response');
    }
    if (error instanceof CustomerPaymentGatewayUnavailableError) {
      throw new ServiceUnavailableException('Customer payment service is unavailable');
    }
    throw error;
  }
}
