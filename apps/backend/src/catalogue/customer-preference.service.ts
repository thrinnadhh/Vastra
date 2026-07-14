import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createCustomerCatalogueShopNotFoundException,
  createInvalidCustomerPreferenceRequestException,
} from './catalogue-http-error';
import {
  type CustomerPreferenceGateway,
  CustomerFavouriteShopNotFoundError,
  CustomerPreferenceDataInvalidError,
  CustomerPreferenceGatewayUnavailableError,
} from './customer-preference.gateway';
import { CUSTOMER_PREFERENCE_GATEWAY } from './customer-preference.tokens';
import type {
  GetCustomerPreferencesResponse,
  ListCustomerFavouriteShopsResponse,
  SetCustomerFavouriteShopResponse,
} from './customer-preference.types';
import {
  CustomerPreferenceValidationError,
  parseCustomerShopId,
  parseReplaceCustomerPreferencesInput,
} from './customer-preference.validation';

@Injectable()
export class CustomerPreferenceService {
  public constructor(
    @Inject(CUSTOMER_PREFERENCE_GATEWAY)
    private readonly gateway: CustomerPreferenceGateway,
  ) {}

  public async listFavouriteShops(
    context: AuthenticatedRequestContext,
  ): Promise<ListCustomerFavouriteShopsResponse> {
    try {
      const shops = await this.gateway.listFavouriteShops(context.supabase);

      return {
        success: true,
        data: { shops },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async setFavouriteShop(
    context: AuthenticatedRequestContext,
    shopIdValue: unknown,
    favourite: boolean,
  ): Promise<SetCustomerFavouriteShopResponse> {
    try {
      const shopId = parseCustomerShopId(shopIdValue);
      const result = await this.gateway.setFavouriteShop(context.supabase, shopId, favourite);

      return {
        success: true,
        data: result,
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async getPreferences(
    context: AuthenticatedRequestContext,
  ): Promise<GetCustomerPreferencesResponse> {
    try {
      const preferences = await this.gateway.getPreferences(context.supabase, context.actor.id);

      return {
        success: true,
        data: { preferences },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async replacePreferences(
    context: AuthenticatedRequestContext,
    body: unknown,
  ): Promise<GetCustomerPreferencesResponse> {
    try {
      const input = parseReplaceCustomerPreferencesInput(body);
      const preferences = await this.gateway.replacePreferences(
        context.supabase,
        context.actor.id,
        input,
      );

      return {
        success: true,
        data: { preferences },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CustomerPreferenceValidationError) {
      throw createInvalidCustomerPreferenceRequestException();
    }

    if (error instanceof CustomerFavouriteShopNotFoundError) {
      throw createCustomerCatalogueShopNotFoundException();
    }

    if (error instanceof CustomerPreferenceGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CustomerPreferenceDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
