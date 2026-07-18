import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { MerchantSettlementService } from './merchant-settlement.service';

@Controller('admin/settlements')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class MerchantSettlementController {
  public constructor(
    @Inject(MerchantSettlementService)
    private readonly service: MerchantSettlementService,
  ) {}

  @Get('eligibility')
  @RequirePermissions('admin.settlements.read')
  public getEligibility(
    @Query('shopId') shopId: unknown,
    @Query('periodStart') periodStart: unknown,
    @Query('periodEnd') periodEnd: unknown,
  ) {
    return this.service.getEligibility(shopId, periodStart, periodEnd);
  }

  @Post()
  @RequirePermissions('admin.settlements.manage')
  @HttpCode(HttpStatus.CREATED)
  public create(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.create(context, idempotencyKey, body);
  }

  @Get(':settlementId')
  @RequirePermissions('admin.settlements.read')
  public get(@Param('settlementId') settlementId: unknown) {
    return this.service.get(settlementId);
  }
}
