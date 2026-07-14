import { Body, Controller, Delete, Get, Inject, Param, Put } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerPreferenceService } from './customer-preference.service';
import type {
  GetCustomerPreferencesResponse,
  ListCustomerFavouriteShopsResponse,
  SetCustomerFavouriteShopResponse,
} from './customer-preference.types';

@Controller('customer')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerPreferenceController {
  public constructor(
    @Inject(CustomerPreferenceService)
    private readonly preferenceService: CustomerPreferenceService,
  ) {}

  @Get('favourite-shops')
  public listFavouriteShops(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<ListCustomerFavouriteShopsResponse> {
    return this.preferenceService.listFavouriteShops(context);
  }

  @Put('favourite-shops/:shopId')
  public addFavouriteShop(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: unknown,
  ): Promise<SetCustomerFavouriteShopResponse> {
    return this.preferenceService.setFavouriteShop(context, shopId, true);
  }

  @Delete('favourite-shops/:shopId')
  public removeFavouriteShop(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: unknown,
  ): Promise<SetCustomerFavouriteShopResponse> {
    return this.preferenceService.setFavouriteShop(context, shopId, false);
  }

  @Get('preferences')
  public getPreferences(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<GetCustomerPreferencesResponse> {
    return this.preferenceService.getPreferences(context);
  }

  @Put('preferences')
  public replacePreferences(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body() body: unknown,
  ): Promise<GetCustomerPreferencesResponse> {
    return this.preferenceService.replacePreferences(context, body);
  }
}
