import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RefundExecutionService } from './refund-execution.service';

@Controller('admin')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class RefundExecutionController {
  public constructor(
    @Inject(RefundExecutionService)
    private readonly service: RefundExecutionService,
  ) {}

  @Get('refunds')
  @RequirePermissions('admin.refunds.read')
  public list(@Query('status') status: unknown, @Query('limit') limit: unknown) {
    return this.service.list(status, limit);
  }

  @Get('refunds/:refundId')
  @RequirePermissions('admin.refunds.read')
  public get(@Param('refundId') refundId: unknown) {
    return this.service.get(refundId);
  }

  @Post('returns/:returnId/refunds')
  @RequirePermissions('admin.refunds.manage')
  public create(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.create(context, returnId, idempotencyKey, body);
  }

  @Post('refunds/:refundId/retry')
  @RequirePermissions('admin.refunds.manage')
  public retry(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('refundId') refundId: unknown,
  ) {
    return this.service.retry(context, refundId);
  }

  @Post('refunds/:refundId/reconcile')
  @RequirePermissions('admin.refunds.manage')
  public reconcile(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('refundId') refundId: unknown,
  ) {
    return this.service.reconcile(context, refundId);
  }
}
