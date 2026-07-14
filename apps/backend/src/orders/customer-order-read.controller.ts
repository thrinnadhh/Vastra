import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerOrderReadService } from './customer-order-read.service';
import type {
  GetCustomerOrderResponse,
  ListCustomerOrdersResponse,
} from './customer-order-read.types';

@Controller('orders')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerOrderReadController {
  public constructor(
    @Inject(CustomerOrderReadService)
    private readonly orderReadService: CustomerOrderReadService,
  ) {}

  @Get()
  public listOrders(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('cursor') cursor: unknown,
    @Query('limit') limit: unknown,
  ): Promise<ListCustomerOrdersResponse> {
    return this.orderReadService.listOrders(context, cursor, limit);
  }

  @Get(':orderId')
  public getOrder(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ): Promise<GetCustomerOrderResponse> {
    return this.orderReadService.getOrder(context, orderId);
  }
}
