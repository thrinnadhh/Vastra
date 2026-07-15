import {
  Body,
  Controller,
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
import { MerchantOrderReadyService } from './merchant-order-ready.service';
import type { MarkMerchantOrderReadyResponse } from './merchant-order-ready.types';

@Controller('merchant/orders')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantOrderReadyController {
  public constructor(
    @Inject(MerchantOrderReadyService)
    private readonly service: MerchantOrderReadyService,
  ) {}

  @Post(':orderId/ready-for-pickup')
  @HttpCode(HttpStatus.OK)
  public markReady(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<MarkMerchantOrderReadyResponse> {
    return this.service.markReady(context, orderId, idempotencyKey, body);
  }
}
