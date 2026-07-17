import { Controller, Get, Inject, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { MerchantAlertObservabilityService } from './merchant-alert-observability.service';
import type {
  MerchantAlertActivityResponse,
  MerchantAlertMetricsResponse,
} from './merchant-alert-observability.types';

@Controller('admin/merchant-alerts')
@AllowAccountTypes('ADMIN')
@RequirePermissions('operations.manage')
@RequireOperationalReadiness()
export class MerchantAlertObservabilityController {
  public constructor(
    @Inject(MerchantAlertObservabilityService)
    private readonly service: MerchantAlertObservabilityService,
  ) {}

  @Get('metrics')
  public getMetrics(@Query('windowMinutes') windowMinutes: unknown): Promise<MerchantAlertMetricsResponse> {
    return this.service.getMetrics(windowMinutes);
  }

  @Get('activity')
  public listActivity(
    @Query('limit') limit: unknown,
    @Query('before') before: unknown,
  ): Promise<MerchantAlertActivityResponse> {
    return this.service.listActivity(limit, before);
  }
}
