import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantOrderPackingService } from './merchant-order-packing.service';
import type {
  GetMerchantOrderPackingListResponse,
  StartMerchantOrderPackingResponse,
  VerifyMerchantOrderItemResponse,
} from './merchant-order-packing.types';

@Controller('merchant/orders')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantOrderPackingController {
  public constructor(
    @Inject(MerchantOrderPackingService)
    private readonly service: MerchantOrderPackingService,
  ) {}

  @Post(':orderId/start-packing')
  @HttpCode(HttpStatus.OK)
  public startPacking(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
    @Body() body: unknown,
  ): Promise<StartMerchantOrderPackingResponse> {
    return this.service.startPacking(context, orderId, body);
  }

  @Get(':orderId/packing-list')
  public getPackingList(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ): Promise<GetMerchantOrderPackingListResponse> {
    return this.service.getPackingList(context, orderId);
  }

  @Post(':orderId/items/:orderItemId/verify')
  @HttpCode(HttpStatus.OK)
  public verifyItem(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
    @Param('orderItemId') orderItemId: unknown,
    @Body() body: unknown,
  ): Promise<VerifyMerchantOrderItemResponse> {
    return this.service.verifyItem(context, orderId, orderItemId, body);
  }
}
