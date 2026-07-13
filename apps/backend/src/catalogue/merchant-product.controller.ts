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
import { MerchantProductService } from './merchant-product.service';
import type {
  ArchiveMerchantProductResponse,
  ListMerchantProductsResponse,
  MerchantProductResponse,
} from './merchant-product.types';

@Controller('merchant/catalogue/shops/:shopId/products')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantProductController {
  public constructor(
    @Inject(MerchantProductService)
    private readonly merchantProductService: MerchantProductService,
  ) {}

  @Get()
  public listProducts(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
  ): Promise<ListMerchantProductsResponse> {
    return this.merchantProductService.listProducts(context, shopId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public createProduct(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Body() body: unknown,
  ): Promise<MerchantProductResponse> {
    return this.merchantProductService.createProduct(context, shopId, body);
  }

  @Get(':productId')
  public getProduct(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ): Promise<MerchantProductResponse> {
    return this.merchantProductService.getProduct(context, shopId, productId);
  }

  @Patch(':productId')
  public updateProduct(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Body() body: unknown,
  ): Promise<MerchantProductResponse> {
    return this.merchantProductService.updateProduct(context, shopId, productId, body);
  }

  @Delete(':productId')
  public archiveProduct(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ): Promise<ArchiveMerchantProductResponse> {
    return this.merchantProductService.archiveProduct(context, shopId, productId);
  }
}
