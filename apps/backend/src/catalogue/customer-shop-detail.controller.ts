import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerShopDetailService } from './customer-shop-detail.service';
import type { GetCustomerShopDetailResponse } from './customer-shop-detail.types';

@Controller('shops')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerShopDetailController {
  public constructor(
    @Inject(CustomerShopDetailService)
    private readonly shopDetailService: CustomerShopDetailService,
  ) {}

  @Get(':shopId')
  public getShopDetail(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: unknown,
    @Query('latitude') latitude: unknown,
    @Query('longitude') longitude: unknown,
  ): Promise<GetCustomerShopDetailResponse> {
    return this.shopDetailService.getShopDetail(context, shopId, latitude, longitude);
  }
}
