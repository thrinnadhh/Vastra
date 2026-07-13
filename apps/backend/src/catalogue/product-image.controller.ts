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
import { ProductImageService } from './product-image.service';
import type {
  DeleteMerchantProductImageResponse,
  ListMerchantProductImagesResponse,
  MerchantProductImageResponse,
  ProductImageUploadIntentResponse,
} from './product-image.types';

@Controller('merchant/catalogue/shops/:shopId/products/:productId/images')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class ProductImageController {
  public constructor(
    @Inject(ProductImageService)
    private readonly productImageService: ProductImageService,
  ) {}

  @Get()
  public listImages(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ): Promise<ListMerchantProductImagesResponse> {
    return this.productImageService.listImages(context, shopId, productId);
  }

  @Post('upload-intents')
  @HttpCode(HttpStatus.CREATED)
  public createUploadIntent(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Body() body: unknown,
  ): Promise<ProductImageUploadIntentResponse> {
    return this.productImageService.createUploadIntent(context, shopId, productId, body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public finalizeImage(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Body() body: unknown,
  ): Promise<MerchantProductImageResponse> {
    return this.productImageService.finalizeImage(context, shopId, productId, body);
  }

  @Patch(':imageId')
  public updateImage(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Body() body: unknown,
  ): Promise<MerchantProductImageResponse> {
    return this.productImageService.updateImage(context, shopId, productId, imageId, body);
  }

  @Delete(':imageId')
  public deleteImage(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ): Promise<DeleteMerchantProductImageResponse> {
    return this.productImageService.deleteImage(context, shopId, productId, imageId);
  }
}
