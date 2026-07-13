import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { MerchantProductVariantService } from './merchant-product-variant.service';
import type {
  DeactivateMerchantProductVariantResponse,
  ListMerchantProductVariantsResponse,
  MerchantProductVariantResponse,
} from './merchant-product-variant.types';

@Controller('merchant/catalogue/shops/:shopId/products/:productId/variants')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantProductVariantController {
  public constructor(
    @Inject(MerchantProductVariantService)
    private readonly variantService: MerchantProductVariantService,
  ) {}

  @Get()
  public listVariants(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ): Promise<ListMerchantProductVariantsResponse> {
    return this.variantService.listVariants(context, shopId, productId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public createVariant(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Body() body: unknown,
  ): Promise<MerchantProductVariantResponse> {
    return this.variantService.createVariant(context, shopId, productId, body);
  }

  @Get(':variantId')
  public getVariant(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ): Promise<MerchantProductVariantResponse> {
    return this.variantService.getVariant(context, shopId, productId, variantId);
  }

  @Patch(':variantId')
  public updateVariant(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() body: unknown,
  ): Promise<MerchantProductVariantResponse> {
    return this.variantService.updateVariant(context, shopId, productId, variantId, body);
  }

  @Delete(':variantId')
  public deactivateVariant(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ): Promise<DeactivateMerchantProductVariantResponse> {
    return this.variantService.deactivateVariant(context, shopId, productId, variantId);
  }
}
