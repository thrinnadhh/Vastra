import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCartItemNotFoundException,
  createCartShopConflictException,
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInsufficientInventoryException,
  createInvalidCustomerCartRequestException,
  createCustomerCartVariantNotFoundException,
} from './catalogue-http-error';
import {
  type CustomerCartGateway,
  CustomerCartDataInvalidError,
  CustomerCartGatewayUnavailableError,
  CustomerCartInsufficientInventoryError,
  CustomerCartItemNotFoundError,
  CustomerCartShopConflictError,
  CustomerCartVariantNotFoundError,
} from './customer-cart.gateway';
import { CUSTOMER_CART_GATEWAY } from './customer-cart.tokens';
import type { CustomerCartResponse } from './customer-cart.types';
import {
  CustomerCartValidationError,
  parseCustomerCartItemId,
  parseSetCustomerCartItemInput,
  parseUpdateCustomerCartItemInput,
} from './customer-cart.validation';

@Injectable()
export class CustomerCartService {
  public constructor(
    @Inject(CUSTOMER_CART_GATEWAY)
    private readonly gateway: CustomerCartGateway,
  ) {}

  public async getCart(context: AuthenticatedRequestContext): Promise<CustomerCartResponse> {
    return this.respond(this.gateway.getCart(context.supabase));
  }

  public async setItem(
    context: AuthenticatedRequestContext,
    body: unknown,
  ): Promise<CustomerCartResponse> {
    try {
      const input = parseSetCustomerCartItemInput(body);

      return await this.respond(this.gateway.setItem(context.actor.id, input));
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async updateItem(
    context: AuthenticatedRequestContext,
    cartItemIdValue: unknown,
    body: unknown,
  ): Promise<CustomerCartResponse> {
    try {
      const cartItemId = parseCustomerCartItemId(cartItemIdValue);
      const input = parseUpdateCustomerCartItemInput(body);

      return await this.respond(this.gateway.updateItem(context.actor.id, cartItemId, input));
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async removeItem(
    context: AuthenticatedRequestContext,
    cartItemIdValue: unknown,
  ): Promise<CustomerCartResponse> {
    try {
      const cartItemId = parseCustomerCartItemId(cartItemIdValue);

      return await this.respond(this.gateway.removeItem(context.actor.id, cartItemId));
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async clearCart(context: AuthenticatedRequestContext): Promise<CustomerCartResponse> {
    return this.respond(this.gateway.clearCart(context.actor.id));
  }

  private async respond(
    cartPromise: ReturnType<CustomerCartGateway['getCart']>,
  ): Promise<CustomerCartResponse> {
    try {
      const cart = await cartPromise;

      return {
        success: true,
        data: { cart },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CustomerCartValidationError) {
      throw createInvalidCustomerCartRequestException();
    }

    if (error instanceof CustomerCartItemNotFoundError) {
      throw createCartItemNotFoundException();
    }

    if (error instanceof CustomerCartVariantNotFoundError) {
      throw createCustomerCartVariantNotFoundException();
    }

    if (error instanceof CustomerCartShopConflictError) {
      throw createCartShopConflictException();
    }

    if (error instanceof CustomerCartInsufficientInventoryError) {
      throw createInsufficientInventoryException();
    }

    if (error instanceof CustomerCartGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CustomerCartDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
