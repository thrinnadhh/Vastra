import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCustomerOrderAddressNotServiceableException,
  createCustomerOrderCartNotFoundException,
  createCustomerOrderIdempotencyConflictException,
  createCustomerOrderIdempotencyKeyRequiredException,
  createCustomerOrderInsufficientStockException,
  createCustomerOrderProviderUnavailableException,
  createCustomerOrderQuoteExpiredException,
  createCustomerOrderQuoteNotFoundException,
  createCustomerOrderQuoteStaleException,
  createCustomerOrderShopUnavailableException,
  createCustomerOrderStateInvalidException,
  createInvalidCustomerOrderRequestException,
} from './order-http-error';
import {
  type CustomerOrderGateway,
  CustomerOrderAddressNotServiceableError,
  CustomerOrderBranchUnavailableError,
  CustomerOrderCartNotFoundError,
  CustomerOrderCodNotEligibleError,
  CustomerOrderDataInvalidError,
  CustomerOrderGatewayUnavailableError,
  CustomerOrderIdempotencyConflictError,
  CustomerOrderInsufficientStockError,
  CustomerOrderNoFulfilmentBranchError,
  CustomerOrderPostalPricingRequiredError,
  CustomerOrderQuoteExpiredError,
  CustomerOrderQuoteNotFoundError,
  CustomerOrderQuoteStaleError,
  CustomerOrderQuoteVersionUnsupportedError,
  CustomerOrderShopUnavailableError,
} from './customer-order.gateway';
import { CUSTOMER_ORDER_GATEWAY } from './customer-order.tokens';
import type { CustomerOrderResponse } from './customer-order.types';
import {
  CustomerOrderIdempotencyKeyRequiredError,
  CustomerOrderValidationError,
  parsePlaceCustomerCodOrderInput,
} from './customer-order.validation';
import {
  createBranchUnavailableOrderException,
  createCodNotEligibleOrderException,
  createNoFulfilmentBranchOrderException,
  createPostalPricingRequiredOrderException,
  createQuoteVersionUnsupportedException,
} from './phase-2d-order-http-error';

@Injectable()
export class CustomerOrderService {
  public constructor(
    @Inject(CUSTOMER_ORDER_GATEWAY)
    private readonly gateway: CustomerOrderGateway,
  ) {}

  public async placeCodOrder(
    context: AuthenticatedRequestContext,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<CustomerOrderResponse> {
    try {
      const input = parsePlaceCustomerCodOrderInput(body, idempotencyKey);
      const order = await this.gateway.placeCodOrder(context.actor.id, input);
      return {
        success: true,
        data: { order },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CustomerOrderIdempotencyKeyRequiredError) {
      throw createCustomerOrderIdempotencyKeyRequiredException();
    }
    if (error instanceof CustomerOrderValidationError) {
      throw createInvalidCustomerOrderRequestException();
    }
    if (error instanceof CustomerOrderIdempotencyConflictError) {
      throw createCustomerOrderIdempotencyConflictException();
    }
    if (error instanceof CustomerOrderCartNotFoundError) {
      throw createCustomerOrderCartNotFoundException();
    }
    if (error instanceof CustomerOrderQuoteNotFoundError) {
      throw createCustomerOrderQuoteNotFoundException();
    }
    if (error instanceof CustomerOrderQuoteExpiredError) {
      throw createCustomerOrderQuoteExpiredException();
    }
    if (error instanceof CustomerOrderQuoteStaleError) {
      throw createCustomerOrderQuoteStaleException();
    }
    if (error instanceof CustomerOrderShopUnavailableError) {
      throw createCustomerOrderShopUnavailableException();
    }
    if (error instanceof CustomerOrderAddressNotServiceableError) {
      throw createCustomerOrderAddressNotServiceableException();
    }
    if (error instanceof CustomerOrderInsufficientStockError) {
      throw createCustomerOrderInsufficientStockException();
    }
    if (error instanceof CustomerOrderQuoteVersionUnsupportedError) {
      throw createQuoteVersionUnsupportedException();
    }
    if (error instanceof CustomerOrderNoFulfilmentBranchError) {
      throw createNoFulfilmentBranchOrderException();
    }
    if (error instanceof CustomerOrderPostalPricingRequiredError) {
      throw createPostalPricingRequiredOrderException();
    }
    if (error instanceof CustomerOrderBranchUnavailableError) {
      throw createBranchUnavailableOrderException();
    }
    if (error instanceof CustomerOrderCodNotEligibleError) {
      throw createCodNotEligibleOrderException();
    }
    if (error instanceof CustomerOrderDataInvalidError) {
      throw createCustomerOrderStateInvalidException();
    }
    if (error instanceof CustomerOrderGatewayUnavailableError) {
      throw createCustomerOrderProviderUnavailableException();
    }
    throw error;
  }
}
