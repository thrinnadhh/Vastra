import { Controller, Get, Inject, Param } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantShopContextService } from './merchant-shop-context.service';
import type {
  GetMerchantCatalogueShopResponse,
  ListMerchantCatalogueShopsResponse,
} from './merchant-shop-context.types';

@Controller('merchant/catalogue/shops')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantShopContextController {
  public constructor(
    @Inject(MerchantShopContextService)
    private readonly merchantShopContextService: MerchantShopContextService,
  ) {}

  @Get()
  public listOwnedShops(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<ListMerchantCatalogueShopsResponse> {
    return this.merchantShopContextService.listOwnedShops(context);
  }

  @Get(':shopId')
  public getOwnedShop(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
  ): Promise<GetMerchantCatalogueShopResponse> {
    return this.merchantShopContextService.getOwnedShop(context, shopId);
  }
}
