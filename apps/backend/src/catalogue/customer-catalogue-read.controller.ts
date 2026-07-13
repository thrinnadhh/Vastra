import { Controller, Get, Inject, Param, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerCatalogueReadService } from './customer-catalogue-read.service';
import type {
  GetCustomerCatalogueProductResponse,
  ListCustomerCatalogueProductsResponse,
} from './customer-catalogue-read.types';

@Controller()
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerCatalogueReadController {
  public constructor(
    @Inject(CustomerCatalogueReadService)
    private readonly catalogueService: CustomerCatalogueReadService,
  ) {}

  @Get('shops/:shopId/products')
  public listShopProducts(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: unknown,
    @Query('cursor') cursor: unknown,
    @Query('limit') limit: unknown,
  ): Promise<ListCustomerCatalogueProductsResponse> {
    return this.catalogueService.listShopProducts(context, shopId, cursor, limit);
  }

  @Get('products/:productId')
  public getProduct(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('productId') productId: unknown,
  ): Promise<GetCustomerCatalogueProductResponse> {
    return this.catalogueService.getProduct(context, productId);
  }
}
