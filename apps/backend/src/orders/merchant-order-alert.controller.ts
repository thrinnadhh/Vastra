import { Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantOrderAlertService } from './merchant-order-alert.service';
import type { AcknowledgeMerchantOrderAlertResponse } from './merchant-order-alert.types';

@Controller('merchant/order-alerts')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantOrderAlertController {
  public constructor(
    @Inject(MerchantOrderAlertService)
    private readonly alertService: MerchantOrderAlertService,
  ) {}

  @Post(':alertId/acknowledge')
  @HttpCode(HttpStatus.OK)
  public acknowledgeAlert(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('alertId') alertId: unknown,
  ): Promise<AcknowledgeMerchantOrderAlertResponse> {
    return this.alertService.acknowledgeAlert(context, alertId);
  }
}
