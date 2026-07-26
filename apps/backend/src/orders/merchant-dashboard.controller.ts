import { Controller, Get, Inject } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantDashboardService } from './merchant-dashboard.service';
import type { MerchantDashboardResponse } from './merchant-dashboard.types';

@Controller('merchant/dashboard')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantDashboardController {
  public constructor(
    @Inject(MerchantDashboardService)
    private readonly service: MerchantDashboardService,
  ) {}

  @Get()
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<MerchantDashboardResponse> {
    return this.service.get(context);
  }
}
