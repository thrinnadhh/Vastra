import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CategoryCatalogueService } from './category-catalogue.service';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createInvalidProductIdException,
  createInvalidProductInputException,
  createProductNotFoundException,
  createProductSlugConflictException,
} from './catalogue-http-error';
import {
  type MerchantProductGateway,
  MerchantProductDataInvalidError,
  MerchantProductGatewayUnavailableError,
  MerchantProductSlugConflictError,
} from './merchant-product.gateway';
import { MERCHANT_PRODUCT_GATEWAY } from './merchant-product.tokens';
import type {
  ArchiveMerchantProductResponse,
  ListMerchantProductsResponse,
  MerchantProductResponse,
  MerchantProductSnapshot,
} from './merchant-product.types';
import {
  MerchantProductValidationError,
  parseCreateMerchantProductBody,
  parseUpdateMerchantProductBody,
} from './merchant-product.validation';
import { MerchantShopContextService } from './merchant-shop-context.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class MerchantProductService {
  public constructor(
    @Inject(MerchantShopContextService)
    private readonly shopContextService: MerchantShopContextService,
    @Inject(CategoryCatalogueService)
    private readonly categoryCatalogueService: CategoryCatalogueService,
    @Inject(MERCHANT_PRODUCT_GATEWAY)
    private readonly gateway: MerchantProductGateway,
  ) {}

  public async listProducts(
    context: AuthenticatedRequestContext,
    shopId: string,
  ): Promise<ListMerchantProductsResponse> {
    await this.shopContextService.requireOwnedShop(context, shopId);

    try {
      const products = await this.gateway.findOwnedProducts(context.supabase, shopId);

      return {
        success: true,
        data: {
          products,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async getProduct(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
  ): Promise<MerchantProductResponse> {
    const product = await this.requireOwnedProduct(context, shopId, productId);

    return this.productResponse(product);
  }

  public async createProduct(
    context: AuthenticatedRequestContext,
    shopId: string,
    body: unknown,
  ): Promise<MerchantProductResponse> {
    await this.shopContextService.requireOwnedShop(context, shopId);

    try {
      const input = parseCreateMerchantProductBody(body);
      await this.categoryCatalogueService.requireActiveCategory(context, input.categoryId);
      const product = await this.gateway.createProduct(shopId, input);

      return this.productResponse(product);
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async updateProduct(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
    body: unknown,
  ): Promise<MerchantProductResponse> {
    await this.shopContextService.requireOwnedShop(context, shopId);
    this.assertProductId(productId);

    try {
      const update = parseUpdateMerchantProductBody(body);

      if (update.input.categoryId !== undefined) {
        await this.categoryCatalogueService.requireActiveCategory(context, update.input.categoryId);
      }

      const product = await this.gateway.updateProduct(
        shopId,
        productId,
        update.input,
        update.moderationRelevant,
      );

      if (product === null) {
        throw createProductNotFoundException();
      }

      return this.productResponse(product);
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async archiveProduct(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
  ): Promise<ArchiveMerchantProductResponse> {
    await this.shopContextService.requireOwnedShop(context, shopId);
    this.assertProductId(productId);

    try {
      const archived = await this.gateway.archiveProduct(
        shopId,
        productId,
        new Date().toISOString(),
      );

      if (!archived) {
        throw createProductNotFoundException();
      }

      return {
        success: true,
        data: {
          archivedProductId: productId,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private async requireOwnedProduct(
    context: AuthenticatedRequestContext,
    shopId: string,
    productId: string,
  ): Promise<MerchantProductSnapshot> {
    await this.shopContextService.requireOwnedShop(context, shopId);
    this.assertProductId(productId);

    try {
      const product = await this.gateway.findOwnedProductById(context.supabase, shopId, productId);

      if (product === null) {
        throw createProductNotFoundException();
      }

      return product;
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private assertProductId(productId: string): void {
    if (!UUID_PATTERN.test(productId)) {
      throw createInvalidProductIdException();
    }
  }

  private productResponse(product: MerchantProductSnapshot): MerchantProductResponse {
    return {
      success: true,
      data: {
        product,
      },
      meta: {
        requestId: null,
      },
    };
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantProductValidationError) {
      throw createInvalidProductInputException();
    }

    if (error instanceof MerchantProductSlugConflictError) {
      throw createProductSlugConflictException();
    }

    if (error instanceof MerchantProductGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof MerchantProductDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
