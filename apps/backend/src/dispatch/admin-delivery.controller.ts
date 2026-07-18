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
import { DeliveryService } from './delivery.service';
import type {
  DeliveryCompletionResponse,
  DeliveryMutationResponse,
  DeliveryReleaseResponse,
  DeliveryTrackingResponse,
} from './delivery.types';

@Controller('admin/delivery-tasks')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminDeliveryController {
  public constructor(@Inject(DeliveryService) private readonly service: DeliveryService) {}

  @Get(':taskId')
  @RequirePermissions('operations.read')
  public getTask(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
  ): Promise<DeliveryTrackingResponse> {
    return this.service.getAdminTask(context, taskId);
  }

  @Post(':taskId/assign')
  @RequirePermissions('operations.manage')
  @HttpCode(HttpStatus.OK)
  public assign(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.service.adminAssign(context, taskId, idempotencyKey, body);
  }

  @Post(':taskId/delivery-override')
  @RequirePermissions('operations.manage')
  @HttpCode(HttpStatus.OK)
  public deliveryOverride(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryCompletionResponse> {
    return this.service.adminOverride(context, taskId, idempotencyKey, body);
  }

  @Post(':taskId/release')
  @RequirePermissions('operations.manage')
  @HttpCode(HttpStatus.OK)
  public release(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryReleaseResponse> {
    return this.service.adminRelease(context, taskId, idempotencyKey, body);
  }
}
