import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CustomerOrderCancellationGateway,
  CustomerOrderAlreadyCancelledError,
  CustomerOrderCancellationDataInvalidError,
  CustomerOrderCancellationGatewayUnavailableError,
  CustomerOrderCancellationIdempotencyConflictError,
  CustomerOrderCancellationNotAllowedError,
  CustomerOrderCancellationNotFoundError,
} from './customer-order-cancellation.gateway';
import { CUSTOMER_ORDER_CANCELLATION_GATEWAY } from './customer-order-cancellation.tokens';
import type { CustomerOrderCancellationResponse } from './customer-order-cancellation.types';
import {
  CustomerOrderCancellationIdempotencyKeyRequiredError,
  CustomerOrderCancellationValidationError,
  parseCustomerOrderCancellationInput,
} from './customer-order-cancellation.validation';
import {
  createCustomerOrderAlreadyCancelledException,
  createCustomerOrderCancellationIdempotencyConflictException,
  createCustomerOrderCancellationIdempotencyKeyRequiredException,
  createCustomerOrderCancellationNotAllowedException,
  createCustomerOrderCancellationProviderUnavailableException,
  createCustomerOrderCancellationStateInvalidException,
  createCustomerOrderNotFoundException,
  createInvalidCustomerOrderCancellationException,
} from './order-http-error';

@Injectable()
export class CustomerOrderCancellationService {
  public constructor(
    @Inject(CUSTOMER_ORDER_CANCELLATION_GATEWAY)
    private readonly gateway: CustomerOrderCancellationGateway,
  ) {}

  public async cancel(
    context: AuthenticatedRequestContext,
    orderId: unknown,
    idempotencyKey: unknown,
  ): Promise<CustomerOrderCancellationResponse> {
    try {
      const input = parseCustomerOrderCancellationInput(orderId, idempotencyKey);
      const cancellation = await this.gateway.cancel(
        context.actor.id,
        input.orderId,
        input.idempotencyKey,
      );
      return {
        success: true,
        data: { cancellation },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CustomerOrderCancellationIdempotencyKeyRequiredError) {
      throw createCustomerOrderCancellationIdempotencyKeyRequiredException();
    }
    if (error instanceof CustomerOrderCancellationValidationError) {
      throw createInvalidCustomerOrderCancellationException();
    }
    if (error instanceof CustomerOrderCancellationNotFoundError) {
      throw createCustomerOrderNotFoundException();
    }
    if (error instanceof CustomerOrderAlreadyCancelledError) {
      throw createCustomerOrderAlreadyCancelledException();
    }
    if (error instanceof CustomerOrderCancellationNotAllowedError) {
      throw createCustomerOrderCancellationNotAllowedException();
    }
    if (error instanceof CustomerOrderCancellationIdempotencyConflictError) {
      throw createCustomerOrderCancellationIdempotencyConflictException();
    }
    if (error instanceof CustomerOrderCancellationDataInvalidError) {
      throw createCustomerOrderCancellationStateInvalidException();
    }
    if (error instanceof CustomerOrderCancellationGatewayUnavailableError) {
      throw createCustomerOrderCancellationProviderUnavailableException();
    }
    throw error;
  }
}
