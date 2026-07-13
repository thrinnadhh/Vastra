import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidProductVariantIdException,
  createInvalidProductVariantInputException,
  createProductVariantNotFoundException,
  createProductVariantSkuConflictException,
} from './catalogue-http-error';
import type { MerchantProductVariantGateway } from './merchant-product-variant.gateway';
import {
  MerchantProductVariantConstraintError,
  MerchantProductVariantDataInvalidError,
  MerchantProductVariantGatewayUnavailableError,
  MerchantProductVariantSkuConflictError,
} from './merchant-product-variant.gateway';
import { MERCHANT_PRODUCT_VARIANT_GATEWAY } from './merchant-product-variant.tokens';
import type {
  DeactivateMerchantProductVariantResponse,
  ListMerchantProductVariantsResponse,
  MerchantProductVariantResponse,
  MerchantProductVariantSnapshot,
} from './merchant-product-variant.types';
import {
  assertVariantPricePair,
  MerchantProductVariantValidationError,
  parseCreateMerchantProductVariantBody,
  parseUpdateMerchantProductVariantBody,
} from './merchant-product-variant.validation';
import { MerchantProductService } from './merchant-product.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class MerchantProductVariantService {
  public constructor(
    @Inject(MerchantProductService)
    private readonly productService: MerchantProductService,
    @Inject(MERCHANT_PRODUCT_VARIANT_GATEWAY)
    private readonly gateway: MerchantProductVariantGateway,
  ) {}

  public async listVariants(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
  ): Promise<ListMerchantProductVariantsResponse> {
    await this.productService.requireOwnedProduct(context, shopId, productId);

    try {
      const variants = await this.gateway.findOwnedVariants(context.supabase, shopId, productId);

      return {
        success: true,
        data: {
          variants,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async getVariant(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantResponse> {
    const variant = await this.requireOwnedVariant(context, shopId, productId, variantId);
    return this.variantResponse(variant);
  }

  public async createVariant(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    body: unknown,
  ): Promise<MerchantProductVariantResponse> {
    await this.productService.requireOwnedProduct(context, shopId, productId);

    try {
      const input = parseCreateMerchantProductVariantBody(body);
      const variant = await this.gateway.createVariant(shopId, productId, input);
      return this.variantResponse(variant);
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async updateVariant(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    variantId: string,
    body: unknown,
  ): Promise<MerchantProductVariantResponse> {
    const existing = await this.requireOwnedVariant(context, shopId, productId, variantId);

    try {
      const input = parseUpdateMerchantProductVariantBody(body);
      assertVariantPricePair(
        input.mrpPaise ?? existing.mrpPaise,
        input.sellingPricePaise ?? existing.sellingPricePaise,
      );

      const variant = await this.gateway.updateVariant(shopId, productId, variantId, input);

      if (variant === null) {
        throw createProductVariantNotFoundException();
      }

      return this.variantResponse(variant);
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async deactivateVariant(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    variantId: string,
  ): Promise<DeactivateMerchantProductVariantResponse> {
    await this.productService.requireOwnedProduct(context, shopId, productId);
    this.assertVariantId(variantId);

    try {
      const variant = await this.gateway.deactivateVariant(shopId, productId, variantId);

      if (variant === null) {
        throw createProductVariantNotFoundException();
      }

      return {
        success: true,
        data: {
          deactivatedVariantId: variant.id,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async requireOwnedVariant(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    variantId: string,
  ): Promise<MerchantProductVariantSnapshot> {
    await this.productService.requireOwnedProduct(context, shopId, productId);
    this.assertVariantId(variantId);

    try {
      const variant = await this.gateway.findOwnedVariantById(
        context.supabase,
        shopId,
        productId,
        variantId,
      );

      if (variant === null) {
        throw createProductVariantNotFoundException();
      }

      return variant;
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private assertVariantId(variantId: string): void {
    if (!UUID_PATTERN.test(variantId)) {
      throw createInvalidProductVariantIdException();
    }
  }

  private variantResponse(variant: MerchantProductVariantSnapshot): MerchantProductVariantResponse {
    return {
      success: true,
      data: {
        variant,
      },
      meta: {
        requestId: null,
      },
    };
  }

  private rethrowMappedError(error: unknown): never {
    if (
      error instanceof MerchantProductVariantValidationError ||
      error instanceof MerchantProductVariantConstraintError
    ) {
      throw createInvalidProductVariantInputException();
    }

    if (error instanceof MerchantProductVariantSkuConflictError) {
      throw createProductVariantSkuConflictException();
    }

    if (error instanceof MerchantProductVariantGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof MerchantProductVariantDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
