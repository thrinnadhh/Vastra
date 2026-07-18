import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantReturnService } from './merchant-return.service';

@Controller('merchant/returns')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantReturnController {
  public constructor(
    @Inject(MerchantReturnService)
    private readonly service: MerchantReturnService,
  ) {}

  @Get()
  public list(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('limit') limit: unknown,
  ) {
    return this.service.list(context, limit);
  }

  @Get(':returnId')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
  ) {
    return this.service.get(context, returnId);
  }

  @Post(':returnId/receive')
  public receive(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.receive(context, returnId, idempotencyKey, body);
  }

  @Post(':returnId/inspection')
  public inspect(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.inspect(context, returnId, idempotencyKey, body);
  }
}
