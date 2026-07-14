import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerOrderService } from './customer-order.service';
import type { CustomerOrderResponse } from './customer-order.types';

@Controller('orders')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerOrderController {
  public constructor(
    @Inject(CustomerOrderService)
    private readonly orderService: CustomerOrderService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  public placeCodOrder(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<CustomerOrderResponse> {
    return this.orderService.placeCodOrder(context, idempotencyKey, body);
  }
}
