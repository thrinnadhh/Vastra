import { Controller, Get, Inject, Param } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { CategoryCatalogueService } from './category-catalogue.service';
import type {
  GetMerchantCatalogueCategoryResponse,
  ListMerchantCatalogueCategoriesResponse,
} from './category-catalogue.types';

@Controller('merchant/catalogue/categories')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class CategoryCatalogueController {
  public constructor(
    @Inject(CategoryCatalogueService)
    private readonly categoryCatalogueService: CategoryCatalogueService,
  ) {}

  @Get()
  public listActiveCategories(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<ListMerchantCatalogueCategoriesResponse> {
    return this.categoryCatalogueService.listActiveCategories(context);
  }

  @Get(':categoryId')
  public getActiveCategory(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('categoryId') categoryId: string,
  ): Promise<GetMerchantCatalogueCategoryResponse> {
    return this.categoryCatalogueService.getActiveCategory(context, categoryId);
  }
}
