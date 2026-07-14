import { Buffer } from 'node:buffer';

import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createInvalidMerchantOrderReadException,
  createMerchantOrderNotFoundException,
  createMerchantOrderReadProviderUnavailableException,
  createMerchantOrderReadStateInvalidException,
} from './order-http-error';
import {
  type MerchantOrderReadGateway,
  MerchantOrderReadDataInvalidError,
  MerchantOrderReadGatewayUnavailableError,
  MerchantOrderReadNotFoundError,
} from './merchant-order-read.gateway';
import { MERCHANT_ORDER_READ_GATEWAY } from './merchant-order-read.tokens';
import type {
  GetMerchantOrderResponse,
  ListMerchantOrdersResponse,
} from './merchant-order-read.types';
import {
  MerchantOrderReadValidationError,
  parseMerchantOrderId,
  parseMerchantOrderListQuery,
} from './merchant-order-read.validation';

function encodeCursor(offset: number | null): string | null {
  if (offset === null) {
    return null;
  }

  return Buffer.from(`v1:${String(offset)}`, 'utf8').toString('base64url');
}

@Injectable()
export class MerchantOrderReadService {
  public constructor(
    @Inject(MERCHANT_ORDER_READ_GATEWAY)
    private readonly gateway: MerchantOrderReadGateway,
  ) {}

  public async listOrders(
    context: AuthenticatedRequestContext,
    cursorValue: unknown,
    limitValue: unknown,
  ): Promise<ListMerchantOrdersResponse> {
    try {
      const query = parseMerchantOrderListQuery(cursorValue, limitValue);
      const page = await this.gateway.listMerchantOrders(context.supabase, context.actor.id, query);

      return {
        success: true,
        data: {
          orders: page.orders,
          nextCursor: encodeCursor(page.nextOffset),
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async getOrder(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
  ): Promise<GetMerchantOrderResponse> {
    try {
      const orderId = parseMerchantOrderId(orderIdValue);
      const order = await this.gateway.getMerchantOrder(
        context.supabase,
        context.actor.id,
        orderId,
      );

      return {
        success: true,
        data: { order },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantOrderReadValidationError) {
      throw createInvalidMerchantOrderReadException();
    }

    if (error instanceof MerchantOrderReadNotFoundError) {
      throw createMerchantOrderNotFoundException();
    }

    if (error instanceof MerchantOrderReadDataInvalidError) {
      throw createMerchantOrderReadStateInvalidException();
    }

    if (error instanceof MerchantOrderReadGatewayUnavailableError) {
      throw createMerchantOrderReadProviderUnavailableException();
    }

    throw error;
  }
}
