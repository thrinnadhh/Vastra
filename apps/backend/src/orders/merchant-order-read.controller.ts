import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantOrderReadService } from './merchant-order-read.service';
import type {
  GetMerchantOrderResponse,
  ListMerchantOrdersResponse,
} from './merchant-order-read.types';

@Controller('merchant/orders')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantOrderReadController {
  public constructor(
    @Inject(MerchantOrderReadService)
    private readonly orderReadService: MerchantOrderReadService,
  ) {}

  @Get()
  public listOrders(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('cursor') cursor: unknown,
    @Query('limit') limit: unknown,
  ): Promise<ListMerchantOrdersResponse> {
    return this.orderReadService.listOrders(context, cursor, limit);
  }

  @Get(':orderId')
  public getOrder(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ): Promise<GetMerchantOrderResponse> {
    return this.orderReadService.getOrder(context, orderId);
  }
}
