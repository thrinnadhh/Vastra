import { Controller, Get, Inject, Query } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CustomerProductSearchService } from './customer-product-search.service';
import type { SearchCustomerProductsResponse } from './customer-product-search.types';

@Controller('customer/products')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerProductSearchController {
  public constructor(
    @Inject(CustomerProductSearchService)
    private readonly searchService: CustomerProductSearchService,
  ) {}

  @Get('search')
  public searchProducts(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Query('q') term: unknown,
    @Query('latitude') latitude: unknown,
    @Query('longitude') longitude: unknown,
    @Query('categoryId') categoryId: unknown,
    @Query('gender') gender: unknown,
    @Query('shopId') shopId: unknown,
    @Query('minPricePaise') minPricePaise: unknown,
    @Query('maxPricePaise') maxPricePaise: unknown,
    @Query('availableOnly') availableOnly: unknown,
    @Query('sort') sort: unknown,
    @Query('cursor') cursor: unknown,
    @Query('limit') limit: unknown,
  ): Promise<SearchCustomerProductsResponse> {
    return this.searchService.searchProducts(
      context,
      term,
      latitude,
      longitude,
      categoryId,
      gender,
      shopId,
      minPricePaise,
      maxPricePaise,
      availableOnly,
      sort,
      cursor,
      limit,
    );
  }
}
