import { Controller, Get, Inject, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerNearbyShopService } from './customer-nearby-shop.service';
import type { ListCustomerNearbyShopsResponse } from './customer-nearby-shop.types';

@Controller('shops')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerNearbyShopController {
  public constructor(
    @Inject(CustomerNearbyShopService)
    private readonly nearbyShopService: CustomerNearbyShopService,
  ) {}

  @Get('nearby')
  public listNearbyShops(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('latitude') latitude: unknown,
    @Query('longitude') longitude: unknown,
    @Query('limit') limit: unknown,
  ): Promise<ListCustomerNearbyShopsResponse> {
    return this.nearbyShopService.listNearbyShops(context, latitude, longitude, limit);
  }
}
