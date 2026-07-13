import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantOfflineSaleService } from './merchant-offline-sale.service';
import type { MerchantOfflineSaleResponse } from './merchant-offline-sale.types';

@Controller('merchant/offline-sales')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantOfflineSaleController {
  public constructor(
    @Inject(MerchantOfflineSaleService)
    private readonly offlineSaleService: MerchantOfflineSaleService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  public createOfflineSale(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<MerchantOfflineSaleResponse> {
    return this.offlineSaleService.createOfflineSale(context, idempotencyKey, body);
  }
}
