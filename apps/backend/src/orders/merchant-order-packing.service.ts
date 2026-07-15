import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type MerchantOrderPackingGateway,
  MerchantOrderPackingConflictError,
  MerchantOrderPackingDataInvalidError,
  MerchantOrderPackingGatewayUnavailableError,
  MerchantOrderPackingInvalidStateError,
  MerchantOrderPackingNotFoundError,
} from './merchant-order-packing.gateway';
import { MERCHANT_ORDER_PACKING_GATEWAY } from './merchant-order-packing.tokens';
import type {
  GetMerchantOrderPackingListResponse,
  StartMerchantOrderPackingResponse,
  VerifyMerchantOrderItemResponse,
} from './merchant-order-packing.types';
import {
  MerchantOrderPackingValidationError,
  parseMerchantOrderItemVerificationBody,
  parseMerchantOrderPackingId,
  parseStartMerchantOrderPackingBody,
} from './merchant-order-packing.validation';
import {
  createInvalidMerchantOrderPackingException,
  createMerchantOrderPackingConflictException,
  createMerchantOrderPackingInvalidStateException,
  createMerchantOrderPackingNotFoundException,
  createMerchantOrderPackingProviderUnavailableException,
  createMerchantOrderPackingStateInvalidException,
} from './order-http-error';

@Injectable()
export class MerchantOrderPackingService {
  public constructor(
    @Inject(MERCHANT_ORDER_PACKING_GATEWAY)
    private readonly gateway: MerchantOrderPackingGateway,
  ) {}

  public async startPacking(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
    bodyValue: unknown,
  ): Promise<StartMerchantOrderPackingResponse> {
    try {
      const orderId = parseMerchantOrderPackingId(orderIdValue);
      parseStartMerchantOrderPackingBody(bodyValue);
      const order = await this.gateway.startPacking(context.actor.id, orderId);
      return { success: true, data: { order }, meta: { requestId: null } };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async getPackingList(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
  ): Promise<GetMerchantOrderPackingListResponse> {
    try {
      const packingList = await this.gateway.getPackingList(
        context.actor.id,
        parseMerchantOrderPackingId(orderIdValue),
      );
      return { success: true, data: { packingList }, meta: { requestId: null } };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async verifyItem(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
    orderItemIdValue: unknown,
    bodyValue: unknown,
  ): Promise<VerifyMerchantOrderItemResponse> {
    try {
      const verification = await this.gateway.verifyItem(
        context.actor.id,
        parseMerchantOrderPackingId(orderIdValue),
        parseMerchantOrderPackingId(orderItemIdValue),
        parseMerchantOrderItemVerificationBody(bodyValue),
      );
      return { success: true, data: { verification }, meta: { requestId: null } };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantOrderPackingValidationError) {
      throw createInvalidMerchantOrderPackingException();
    }
    if (error instanceof MerchantOrderPackingNotFoundError) {
      throw createMerchantOrderPackingNotFoundException();
    }
    if (error instanceof MerchantOrderPackingInvalidStateError) {
      throw createMerchantOrderPackingInvalidStateException();
    }
    if (error instanceof MerchantOrderPackingConflictError) {
      throw createMerchantOrderPackingConflictException();
    }
    if (error instanceof MerchantOrderPackingDataInvalidError) {
      throw createMerchantOrderPackingStateInvalidException();
    }
    if (error instanceof MerchantOrderPackingGatewayUnavailableError) {
      throw createMerchantOrderPackingProviderUnavailableException();
    }
    throw error;
  }
}
