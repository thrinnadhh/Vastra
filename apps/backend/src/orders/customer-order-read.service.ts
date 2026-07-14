import { Buffer } from 'node:buffer';

import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCustomerOrderNotFoundException,
  createCustomerOrderReadProviderUnavailableException,
  createCustomerOrderReadStateInvalidException,
  createInvalidCustomerOrderReadException,
} from './order-http-error';
import {
  type CustomerOrderReadGateway,
  CustomerOrderReadDataInvalidError,
  CustomerOrderReadGatewayUnavailableError,
  CustomerOrderReadNotFoundError,
} from './customer-order-read.gateway';
import { CUSTOMER_ORDER_READ_GATEWAY } from './customer-order-read.tokens';
import type {
  GetCustomerOrderResponse,
  ListCustomerOrdersResponse,
} from './customer-order-read.types';
import {
  CustomerOrderReadValidationError,
  parseCustomerOrderId,
  parseCustomerOrderListQuery,
} from './customer-order-read.validation';

function encodeCursor(offset: number | null): string | null {
  if (offset === null) {
    return null;
  }

  return Buffer.from(`v1:${String(offset)}`, 'utf8').toString('base64url');
}

@Injectable()
export class CustomerOrderReadService {
  public constructor(
    @Inject(CUSTOMER_ORDER_READ_GATEWAY)
    private readonly gateway: CustomerOrderReadGateway,
  ) {}

  public async listOrders(
    context: AuthenticatedRequestContext,
    cursorValue: unknown,
    limitValue: unknown,
  ): Promise<ListCustomerOrdersResponse> {
    try {
      const query = parseCustomerOrderListQuery(cursorValue, limitValue);
      const page = await this.gateway.listCustomerOrders(context.supabase, context.actor.id, query);

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
  ): Promise<GetCustomerOrderResponse> {
    try {
      const orderId = parseCustomerOrderId(orderIdValue);
      const order = await this.gateway.getCustomerOrder(
        context.supabase,
        context.actor.id,
        orderId,
      );

      return {
        success: true,
        data: {
          order,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CustomerOrderReadValidationError) {
      throw createInvalidCustomerOrderReadException();
    }

    if (error instanceof CustomerOrderReadNotFoundError) {
      throw createCustomerOrderNotFoundException();
    }

    if (error instanceof CustomerOrderReadDataInvalidError) {
      throw createCustomerOrderReadStateInvalidException();
    }

    if (error instanceof CustomerOrderReadGatewayUnavailableError) {
      throw createCustomerOrderReadProviderUnavailableException();
    }

    throw error;
  }
}
