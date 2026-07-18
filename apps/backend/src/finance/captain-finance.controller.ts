import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CaptainFinanceService } from './captain-finance.service';

@Controller('admin')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class CaptainFinanceController {
  public constructor(
    @Inject(CaptainFinanceService)
    private readonly service: CaptainFinanceService,
  ) {}

  @Get('cod/collections')
  @RequirePermissions('admin.cod.read')
  public listCod(@Query('status') status: unknown, @Query('limit') limit: unknown) {
    return this.service.listCod(status, limit);
  }

  @Post('cod/collections/:collectionId/reconcile')
  @RequirePermissions('admin.cod.manage')
  public reconcileCod(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('collectionId') collectionId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.reconcileCod(context, collectionId, idempotencyKey, body);
  }

  @Get('payouts/eligibility')
  @RequirePermissions('admin.payouts.read')
  public eligibility(
    @Query('captainId') captainId: unknown,
    @Query('periodStart') periodStart: unknown,
    @Query('periodEnd') periodEnd: unknown,
  ) {
    return this.service.eligibility(captainId, periodStart, periodEnd);
  }

  @Post('payouts')
  @RequirePermissions('admin.payouts.manage')
  public createPayout(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.createPayout(context, idempotencyKey, body);
  }

  @Get('payouts/:payoutId')
  @RequirePermissions('admin.payouts.read')
  public getPayout(@Param('payoutId') payoutId: unknown) {
    return this.service.getPayout(payoutId);
  }
}
