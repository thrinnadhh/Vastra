import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminReturnDecisionService } from './admin-return-decision.service';

@Controller('admin/returns')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminReturnDecisionController {
  public constructor(
    @Inject(AdminReturnDecisionService)
    private readonly service: AdminReturnDecisionService,
  ) {}

  @Get()
  @RequirePermissions('admin.returns.read')
  public list(@Query('status') status: unknown, @Query('limit') limit: unknown) {
    return this.service.list(status, limit);
  }

  @Get(':returnId')
  @RequirePermissions('admin.returns.read')
  public get(@Param('returnId') returnId: unknown) {
    return this.service.get(returnId);
  }

  @Post(':returnId/decision')
  @RequirePermissions('admin.returns.manage')
  public decide(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.decide(context, returnId, idempotencyKey, body);
  }
}
