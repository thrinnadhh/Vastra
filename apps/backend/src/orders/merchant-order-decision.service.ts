import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { MERCHANT_ORDER_DECISION_GATEWAY } from './merchant-order-decision.tokens';
import type { MerchantOrderDecisionGateway } from './merchant-order-decision.gateway';
import {
  MerchantOrderDecisionConflictError,
  MerchantOrderDecisionDataInvalidError,
  MerchantOrderDecisionExpiredError,
  MerchantOrderDecisionGatewayUnavailableError,
  MerchantOrderDecisionInvalidStateError,
  MerchantOrderDecisionNotFoundError,
} from './merchant-order-decision.gateway';
import type { MerchantOrderDecisionResponse } from './merchant-order-decision.types';
import {
  MerchantOrderDecisionValidationError,
  parseMerchantAcceptOrderInput,
  parseMerchantDecisionOrderId,
  parseMerchantRejectOrderInput,
} from './merchant-order-decision.validation';
import {
  createInvalidMerchantOrderDecisionException,
  createMerchantOrderDecisionConflictException,
  createMerchantOrderDecisionExpiredException,
  createMerchantOrderDecisionInvalidStateException,
  createMerchantOrderDecisionNotFoundException,
  createMerchantOrderDecisionProviderUnavailableException,
  createMerchantOrderDecisionStateInvalidException,
} from './order-http-error';
@Injectable()
export class MerchantOrderDecisionService {
  public constructor(
    @Inject(MERCHANT_ORDER_DECISION_GATEWAY) private readonly gateway: MerchantOrderDecisionGateway,
  ) {}
  public async accept(
    c: AuthenticatedRequestContext,
    id: unknown,
    body: unknown,
  ): Promise<MerchantOrderDecisionResponse> {
    try {
      return {
        success: true,
        data: {
          order: await this.gateway.accept(
            c.actor.id,
            parseMerchantDecisionOrderId(id),
            parseMerchantAcceptOrderInput(body),
          ),
        },
        meta: { requestId: null },
      };
    } catch (e) {
      return this.map(e);
    }
  }
  public async reject(
    c: AuthenticatedRequestContext,
    id: unknown,
    body: unknown,
  ): Promise<MerchantOrderDecisionResponse> {
    try {
      return {
        success: true,
        data: {
          order: await this.gateway.reject(
            c.actor.id,
            parseMerchantDecisionOrderId(id),
            parseMerchantRejectOrderInput(body),
          ),
        },
        meta: { requestId: null },
      };
    } catch (e) {
      return this.map(e);
    }
  }
  private map(e: unknown): never {
    if (e instanceof MerchantOrderDecisionValidationError)
      throw createInvalidMerchantOrderDecisionException();
    if (e instanceof MerchantOrderDecisionNotFoundError)
      throw createMerchantOrderDecisionNotFoundException();
    if (e instanceof MerchantOrderDecisionExpiredError)
      throw createMerchantOrderDecisionExpiredException();
    if (e instanceof MerchantOrderDecisionInvalidStateError)
      throw createMerchantOrderDecisionInvalidStateException();
    if (e instanceof MerchantOrderDecisionConflictError)
      throw createMerchantOrderDecisionConflictException();
    if (e instanceof MerchantOrderDecisionDataInvalidError)
      throw createMerchantOrderDecisionStateInvalidException();
    if (e instanceof MerchantOrderDecisionGatewayUnavailableError)
      throw createMerchantOrderDecisionProviderUnavailableException();
    throw e;
  }
}
