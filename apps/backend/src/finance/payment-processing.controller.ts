import { Body, Controller, Headers, Inject, Param, Post, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PaymentProcessingService } from './payment-processing.service';

@Controller('admin/payments')
@AllowAccountTypes('ADMIN')
@RequireOperationalReadiness()
export class PaymentProcessingController {
  public constructor(
    @Inject(PaymentProcessingService)
    private readonly service: PaymentProcessingService,
  ) {}

  @Post('process-events')
  @RequirePermissions('admin.payments.manage')
  public process(@Query('limit') limit: unknown) {
    return this.service.process(limit);
  }

  @Post('events/:eventId/retry')
  @RequirePermissions('admin.payments.manage')
  public retry(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('eventId') eventId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.retry(context, eventId, idempotencyKey, body);
  }
}
