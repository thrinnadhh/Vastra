import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCartNotFoundException,
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createCheckoutAddressNotFoundException,
  createCheckoutMinimumOrderNotMetException,
  createCheckoutOutsideServiceAreaException,
  createCheckoutShopUnavailableException,
  createInsufficientInventoryException,
  createInvalidCheckoutQuoteRequestException,
} from './catalogue-http-error';
import {
  type CustomerCheckoutQuoteGateway,
  CustomerCheckoutQuoteAddressNotFoundError,
  CustomerCheckoutQuoteCartNotFoundError,
  CustomerCheckoutQuoteDataInvalidError,
  CustomerCheckoutQuoteGatewayUnavailableError,
  CustomerCheckoutQuoteInsufficientInventoryError,
  CustomerCheckoutQuoteMinimumOrderError,
  CustomerCheckoutQuoteOutsideServiceAreaError,
  CustomerCheckoutQuoteShopUnavailableError,
} from './customer-checkout-quote.gateway';
import { CUSTOMER_CHECKOUT_QUOTE_GATEWAY } from './customer-checkout-quote.tokens';
import type { CustomerCheckoutQuoteResponse } from './customer-checkout-quote.types';
import {
  CustomerCheckoutQuoteValidationError,
  parseCreateCustomerCheckoutQuoteInput,
} from './customer-checkout-quote.validation';

@Injectable()
export class CustomerCheckoutQuoteService {
  public constructor(
    @Inject(CUSTOMER_CHECKOUT_QUOTE_GATEWAY)
    private readonly gateway: CustomerCheckoutQuoteGateway,
  ) {}

  public async createQuote(
    context: AuthenticatedRequestContext,
    body: unknown,
  ): Promise<CustomerCheckoutQuoteResponse> {
    try {
      const input = parseCreateCustomerCheckoutQuoteInput(body);
      const quote = await this.gateway.createQuote(context.actor.id, input);

      return {
        success: true,
        data: { quote },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CustomerCheckoutQuoteValidationError) {
      throw createInvalidCheckoutQuoteRequestException();
    }

    if (error instanceof CustomerCheckoutQuoteCartNotFoundError) {
      throw createCartNotFoundException();
    }

    if (error instanceof CustomerCheckoutQuoteAddressNotFoundError) {
      throw createCheckoutAddressNotFoundException();
    }

    if (error instanceof CustomerCheckoutQuoteShopUnavailableError) {
      throw createCheckoutShopUnavailableException();
    }

    if (error instanceof CustomerCheckoutQuoteOutsideServiceAreaError) {
      throw createCheckoutOutsideServiceAreaException();
    }

    if (error instanceof CustomerCheckoutQuoteMinimumOrderError) {
      throw createCheckoutMinimumOrderNotMetException();
    }

    if (error instanceof CustomerCheckoutQuoteInsufficientInventoryError) {
      throw createInsufficientInventoryException();
    }

    if (error instanceof CustomerCheckoutQuoteGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CustomerCheckoutQuoteDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
