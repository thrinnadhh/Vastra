import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantOrderReadyGateway,
  MerchantOrderReadyDataInvalidError,
  MerchantOrderReadyGatewayUnavailableError,
  MerchantOrderReadyInvalidStateError,
  MerchantOrderReadyItemNotVerifiedError,
  MerchantOrderReadyNotFoundError,
} from './merchant-order-ready.gateway';
import { MERCHANT_ORDER_READY_GATEWAY } from './merchant-order-ready.tokens';
import type { MarkMerchantOrderReadyResponse } from './merchant-order-ready.types';
import {
  MerchantOrderReadyIdempotencyKeyError,
  MerchantOrderReadyValidationError,
  parseMerchantOrderReadyBody,
  parseMerchantOrderReadyIdempotencyKey,
  parseMerchantOrderReadyOrderId,
} from './merchant-order-ready.validation';
import {
  createInvalidMerchantOrderReadyException,
  createMerchantOrderReadyIdempotencyKeyRequiredException,
  createMerchantOrderReadyInvalidStateException,
  createMerchantOrderReadyItemNotVerifiedException,
  createMerchantOrderReadyNotFoundException,
  createMerchantOrderReadyProviderUnavailableException,
  createMerchantOrderReadyStateInvalidException,
} from './order-http-error';

@Injectable()
export class MerchantOrderReadyService {
  public constructor(
    @Inject(MERCHANT_ORDER_READY_GATEWAY)
    private readonly gateway: MerchantOrderReadyGateway,
  ) {}

  public async markReady(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
    idempotencyKeyValue: unknown,
    bodyValue: unknown,
  ): Promise<MarkMerchantOrderReadyResponse> {
    try {
      const orderId = parseMerchantOrderReadyOrderId(orderIdValue);
      const idempotencyKey = parseMerchantOrderReadyIdempotencyKey(idempotencyKeyValue);
      parseMerchantOrderReadyBody(bodyValue);
      const order = await this.gateway.markReady(context.actor.id, orderId, idempotencyKey);
      return { success: true, data: { order }, meta: { requestId: null } };
    } catch (error: unknown) {
      if (error instanceof MerchantOrderReadyValidationError) {
        throw createInvalidMerchantOrderReadyException();
      }
      if (error instanceof MerchantOrderReadyIdempotencyKeyError) {
        throw createMerchantOrderReadyIdempotencyKeyRequiredException();
      }
      if (error instanceof MerchantOrderReadyNotFoundError) {
        throw createMerchantOrderReadyNotFoundException();
      }
      if (error instanceof MerchantOrderReadyInvalidStateError) {
        throw createMerchantOrderReadyInvalidStateException();
      }
      if (error instanceof MerchantOrderReadyItemNotVerifiedError) {
        throw createMerchantOrderReadyItemNotVerifiedException();
      }
      if (error instanceof MerchantOrderReadyDataInvalidError) {
        throw createMerchantOrderReadyStateInvalidException();
      }
      if (error instanceof MerchantOrderReadyGatewayUnavailableError) {
        throw createMerchantOrderReadyProviderUnavailableException();
      }
      throw error;
    }
  }
}
