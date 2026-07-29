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
  Put,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminCityService } from './admin-city.service';

@Controller('admin/cities')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminCityController {
  public constructor(@Inject(AdminCityService) private readonly service: AdminCityService) {}

  @Get()
  @RequirePermissions('admin.configuration.read')
  public list(@CurrentAuthContext() context: AuthenticatedRequestContext) {
    return this.service.list(context);
  }

  @Get(':cityId')
  @RequirePermissions('admin.configuration.read')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
  ) {
    return this.service.get(context, cityId);
  }

  @Put(':cityId/configuration')
  @RequirePermissions('admin.configuration.manage')
  public updateConfiguration(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.updateConfiguration(
      context,
      cityId,
      idempotencyKey,
      requestId ?? null,
      body,
    );
  }

  @Post(':cityId/zones')
  @RequirePermissions('admin.configuration.manage')
  @HttpCode(HttpStatus.OK)
  public createZone(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.upsertZone(context, cityId, null, idempotencyKey, requestId ?? null, body);
  }

  @Put(':cityId/zones/:zoneId')
  @RequirePermissions('admin.configuration.manage')
  public updateZone(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Param('zoneId') zoneId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.upsertZone(
      context,
      cityId,
      zoneId,
      idempotencyKey,
      requestId ?? null,
      body,
    );
  }

  @Post(':cityId/zones/:zoneId/pincodes')
  @RequirePermissions('admin.configuration.manage')
  @HttpCode(HttpStatus.OK)
  public createPincode(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Param('zoneId') zoneId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.upsertPincode(
      context,
      cityId,
      zoneId,
      null,
      idempotencyKey,
      requestId ?? null,
      body,
    );
  }

  @Put(':cityId/zones/:zoneId/pincodes/:mappingId')
  @RequirePermissions('admin.configuration.manage')
  public updatePincode(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Param('zoneId') zoneId: unknown,
    @Param('mappingId') mappingId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.upsertPincode(
      context,
      cityId,
      zoneId,
      mappingId,
      idempotencyKey,
      requestId ?? null,
      body,
    );
  }

  @Put(':cityId/readiness')
  @RequirePermissions('admin.configuration.manage')
  public updateReadiness(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.updateReadiness(context, cityId, idempotencyKey, requestId ?? null, body);
  }

  @Post(':cityId/preflight')
  @RequirePermissions('admin.configuration.manage')
  @HttpCode(HttpStatus.OK)
  public runPreflight(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.runPreflight(context, cityId, idempotencyKey, requestId ?? null, body);
  }

  @Post(':cityId/activate')
  @RequirePermissions('admin.configuration.manage')
  @HttpCode(HttpStatus.OK)
  public activate(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.transition(
      context,
      cityId,
      idempotencyKey,
      requestId ?? null,
      body,
      'ACTIVE',
    );
  }

  @Post(':cityId/pause')
  @RequirePermissions('admin.configuration.manage')
  @HttpCode(HttpStatus.OK)
  public pause(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('cityId') cityId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.transition(
      context,
      cityId,
      idempotencyKey,
      requestId ?? null,
      body,
      'PAUSED',
    );
  }
}
