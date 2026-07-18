import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminOrderOperationsService } from './admin-order-operations.service';

@Controller('admin')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class AdminOrderOperationsController {
  public constructor(
    @Inject(AdminOrderOperationsService)
    private readonly service: AdminOrderOperationsService,
  ) {}

  @Post('orders/:orderId/cancel')
  @RequirePermissions('admin.orders.manage')
  @HttpCode(HttpStatus.OK)
  public cancelOrder(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.cancelOrder(context, orderId, idempotencyKey, requestId, body);
  }

  @Post('orders/:orderId/retry-dispatch')
  @RequirePermissions('admin.orders.manage')
  @HttpCode(HttpStatus.OK)
  public retryDispatch(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.retryDispatch(context, orderId, idempotencyKey, requestId, body);
  }

  @Post('delivery-tasks/:taskId/release-operation')
  @RequirePermissions('admin.orders.manage')
  @HttpCode(HttpStatus.OK)
  public releaseDelivery(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.releaseDelivery(context, taskId, idempotencyKey, requestId, body);
  }

  @Post('delivery-tasks/:taskId/reset-verification')
  @RequirePermissions('admin.orders.manage')
  @HttpCode(HttpStatus.OK)
  public resetVerification(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Headers('x-request-id') requestId: unknown,
    @Body() body: unknown,
  ) {
    return this.service.resetVerification(context, taskId, idempotencyKey, requestId, body);
  }
}
