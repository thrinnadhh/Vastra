import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Put,
  Query,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminConfigurationService } from './admin-configuration.service';

@Controller('admin/configuration')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminConfigurationController {
  public constructor(
    @Inject(AdminConfigurationService)
    private readonly service: AdminConfigurationService,
  ) {}

  @Get()
  @RequirePermissions('admin.configuration.read')
  public list(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('scopeType') scopeType: unknown,
    @Query('scopeId') scopeId: unknown,
  ) {
    return this.service.list(context, scopeType, scopeId);
  }

  @Put(':key')
  @RequirePermissions('admin.configuration.manage')
  @HttpCode(HttpStatus.OK)
  public update(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('key') key: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.update(context, key, idempotencyKey, requestId ?? null, body);
  }
}
