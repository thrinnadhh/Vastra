import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantInventoryBalanceService } from './merchant-inventory-balance.service';
import type {
  GetMerchantInventoryBalanceResponse,
  LookupMerchantInventoryResponse,
} from './merchant-inventory-balance.types';

@Controller('merchant/catalogue/shops/:shopId/inventory')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantInventoryBalanceController {
  public constructor(
    @Inject(MerchantInventoryBalanceService)
    private readonly inventoryService: MerchantInventoryBalanceService,
  ) {}

  @Get('balances/:variantId')
  public getVariantBalance(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('variantId') variantId: string,
  ): Promise<GetMerchantInventoryBalanceResponse> {
    return this.inventoryService.getVariantBalance(context, shopId, variantId);
  }

  @Get('lookup')
  public lookupInventory(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Query('query') query: unknown,
    @Query('limit') limit: unknown,
  ): Promise<LookupMerchantInventoryResponse> {
    return this.inventoryService.lookupInventory(context, shopId, query, limit);
  }
}
