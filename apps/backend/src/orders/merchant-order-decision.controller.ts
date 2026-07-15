import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantOrderDecisionService } from './merchant-order-decision.service';
import type { MerchantOrderDecisionResponse } from './merchant-order-decision.types';
@Controller('merchant/orders')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantOrderDecisionController {
  public constructor(
    @Inject(MerchantOrderDecisionService) private readonly service: MerchantOrderDecisionService,
  ) {}
  @Post(':orderId/accept') @HttpCode(HttpStatus.OK) accept(
    @CurrentAuthContext() c: AuthenticatedRequestContext,
    @Param('orderId') id: unknown,
    @Body() body: unknown,
  ): Promise<MerchantOrderDecisionResponse> {
    return this.service.accept(c, id, body);
  }
  @Post(':orderId/reject') @HttpCode(HttpStatus.OK) reject(
    @CurrentAuthContext() c: AuthenticatedRequestContext,
    @Param('orderId') id: unknown,
    @Body() body: unknown,
  ): Promise<MerchantOrderDecisionResponse> {
    return this.service.reject(c, id, body);
  }
}
