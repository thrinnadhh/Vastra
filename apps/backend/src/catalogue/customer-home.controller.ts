import { Controller, Get, Inject, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerHomeService } from './customer-home.service';
import type { GetCustomerHomeResponse } from './customer-home.types';

@Controller('customer')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerHomeController {
  public constructor(
    @Inject(CustomerHomeService)
    private readonly homeService: CustomerHomeService,
  ) {}

  @Get('home')
  public getHome(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('latitude') latitude: unknown,
    @Query('longitude') longitude: unknown,
    @Query('shopLimit') shopLimit: unknown,
    @Query('productLimit') productLimit: unknown,
  ): Promise<GetCustomerHomeResponse> {
    return this.homeService.getHome(context, latitude, longitude, shopLimit, productLimit);
  }
}
