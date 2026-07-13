import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantInventoryLowStockService } from './merchant-inventory-low-stock.service';
import type { ListMerchantLowStockInventoryResponse } from './merchant-inventory-low-stock.types';

@Controller('merchant/catalogue/shops/:shopId/inventory')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantInventoryLowStockController {
  public constructor(
    @Inject(MerchantInventoryLowStockService)
    private readonly lowStockService: MerchantInventoryLowStockService,
  ) {}

  @Get('low-stock')
  public listLowStock(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Query('limit') limit: unknown,
    @Query('includeInactive') includeInactive: unknown,
  ): Promise<ListMerchantLowStockInventoryResponse> {
    return this.lowStockService.listLowStock(context, shopId, limit, includeInactive);
  }
}
