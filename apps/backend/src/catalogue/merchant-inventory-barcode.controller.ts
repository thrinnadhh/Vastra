import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantInventoryBarcodeService } from './merchant-inventory-barcode.service';
import type { LookupMerchantInventoryByBarcodeResponse } from './merchant-inventory-barcode.types';

@Controller('merchant/catalogue/shops/:shopId/inventory')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantInventoryBarcodeController {
  public constructor(
    @Inject(MerchantInventoryBarcodeService)
    private readonly barcodeService: MerchantInventoryBarcodeService,
  ) {}

  @Get('barcode-lookup')
  public lookupBarcode(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Query('barcode') barcode: unknown,
  ): Promise<LookupMerchantInventoryByBarcodeResponse> {
    return this.barcodeService.lookupBarcode(context, shopId, barcode);
  }
}
