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
import { CustomerReturnService } from './customer-return.service';

@Controller()
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerReturnController {
  public constructor(
    @Inject(CustomerReturnService)
    private readonly service: CustomerReturnService,
  ) {}

  @Get('orders/:orderId/return-eligibility')
  public getEligibility(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ) {
    return this.service.getEligibility(context, orderId);
  }

  @Post('orders/:orderId/returns')
  @HttpCode(HttpStatus.CREATED)
  public create(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ) {
    return this.service.create(context, orderId, idempotencyKey, body);
  }

  @Get('returns/:returnId')
  public get(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('returnId') returnId: unknown,
  ) {
    return this.service.get(context, returnId);
  }
}
