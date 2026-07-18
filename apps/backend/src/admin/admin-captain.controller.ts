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
import { AdminCaptainService } from './admin-captain.service';

@Controller('admin/captains')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminCaptainController {
  public constructor(@Inject(AdminCaptainService) private readonly service: AdminCaptainService) {}

  @Get(':captainId')
  @RequirePermissions('admin.captains.read')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('captainId') captainId: unknown,
  ) {
    return this.service.get(context, captainId);
  }

  @Post(':captainId/suspend')
  @RequirePermissions('admin.captains.manage')
  @HttpCode(HttpStatus.OK)
  public suspend(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('captainId') captainId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.setStatus(context, captainId, idempotencyKey, requestId, body, 'SUSPENDED');
  }

  @Post(':captainId/restore')
  @RequirePermissions('admin.captains.manage')
  @HttpCode(HttpStatus.OK)
  public restore(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('captainId') captainId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.setStatus(context, captainId, idempotencyKey, requestId, body, 'ACTIVE');
  }

  @Post(':captainId/correct-availability')
  @RequirePermissions('admin.captains.manage')
  @HttpCode(HttpStatus.OK)
  public correctAvailability(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('captainId') captainId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.correctAvailability(context, captainId, idempotencyKey, requestId, body);
  }

  @Post(':captainId/release-active-assignment')
  @RequirePermissions('admin.captains.manage')
  @HttpCode(HttpStatus.OK)
  public releaseActiveAssignment(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('captainId') captainId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.releaseActiveAssignment(
      context,
      captainId,
      idempotencyKey,
      requestId,
      body,
    );
  }
}
