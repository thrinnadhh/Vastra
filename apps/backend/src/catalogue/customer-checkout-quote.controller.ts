import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerCheckoutQuoteService } from './customer-checkout-quote.service';
import type { CustomerCheckoutQuoteResponse } from './customer-checkout-quote.types';

@Controller('checkout')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerCheckoutQuoteController {
  public constructor(
    @Inject(CustomerCheckoutQuoteService)
    private readonly quoteService: CustomerCheckoutQuoteService,
  ) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  public createQuote(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Body() body: unknown,
  ): Promise<CustomerCheckoutQuoteResponse> {
    return this.quoteService.createQuote(context, body);
  }
}
