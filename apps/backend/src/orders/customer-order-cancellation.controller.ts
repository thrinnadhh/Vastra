import { Controller, Headers, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerOrderCancellationService } from './customer-order-cancellation.service';
import type { CustomerOrderCancellationResponse } from './customer-order-cancellation.types';

@Controller('customer/orders')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerOrderCancellationController {
  public constructor(
    @Inject(CustomerOrderCancellationService)
    private readonly service: CustomerOrderCancellationService,
  ) {}

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  public cancel(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
  ): Promise<CustomerOrderCancellationResponse> {
    return this.service.cancel(context, orderId, idempotencyKey);
  }
}
