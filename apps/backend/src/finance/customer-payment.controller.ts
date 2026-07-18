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
import { CustomerPaymentService } from './customer-payment.service';

@Controller('orders')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerPaymentController {
  public constructor(
    @Inject(CustomerPaymentService)
    private readonly service: CustomerPaymentService,
  ) {}

  @Post('online')
  @HttpCode(HttpStatus.OK)
  public createCheckout(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.createCheckout(context, idempotencyKey, body);
  }

  @Get(':orderId/payments/latest')
  public getLatest(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ) {
    return this.service.getLatest(context, orderId);
  }
}
