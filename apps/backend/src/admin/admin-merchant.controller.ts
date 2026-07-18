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
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminMerchantService } from './admin-merchant.service';

@Controller('admin/merchants')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminMerchantController {
  public constructor(@Inject(AdminMerchantService) private readonly service: AdminMerchantService) {}

  @Get(':merchantId')
  @RequirePermissions('admin.merchants.read')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('merchantId') merchantId: unknown,
  ) {
    return this.service.get(context, merchantId);
  }

  @Post(':merchantId/pause-orders')
  @RequirePermissions('admin.merchants.manage')
  @HttpCode(HttpStatus.OK)
  public pauseOrders(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('merchantId') merchantId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.setStatus(
      context,
      merchantId,
      idempotencyKey,
      body,
      'PAUSED',
      requestId ?? null,
    );
  }

  @Post(':merchantId/suspend')
  @RequirePermissions('admin.merchants.manage')
  @HttpCode(HttpStatus.OK)
  public suspend(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('merchantId') merchantId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.setStatus(
      context,
      merchantId,
      idempotencyKey,
      body,
      'SUSPENDED',
      requestId ?? null,
    );
  }

  @Post(':merchantId/restore')
  @RequirePermissions('admin.merchants.manage')
  @HttpCode(HttpStatus.OK)
  public restore(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('merchantId') merchantId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.setStatus(
      context,
      merchantId,
      idempotencyKey,
      body,
      'ACTIVE',
      requestId ?? null,
    );
  }
}
