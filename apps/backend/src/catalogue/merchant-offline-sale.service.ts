import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createIdempotencyConflictException,
  createInvalidOfflineSaleException,
  createNegativeInventoryRejectedException,
  createOfflineSaleIdempotencyKeyRequiredException,
  createProductVariantNotFoundException,
} from './catalogue-http-error';
import {
  type MerchantOfflineSaleGateway,
  MerchantOfflineSaleConstraintError,
  MerchantOfflineSaleDataInvalidError,
  MerchantOfflineSaleGatewayUnavailableError,
  MerchantOfflineSaleIdempotencyConflictError,
  MerchantOfflineSaleInsufficientInventoryError,
  MerchantOfflineSaleVariantNotFoundError,
} from './merchant-offline-sale.gateway';
import { MERCHANT_OFFLINE_SALE_GATEWAY } from './merchant-offline-sale.tokens';
import type { MerchantOfflineSaleResponse } from './merchant-offline-sale.types';
import {
  MerchantOfflineSaleIdempotencyKeyRequiredError,
  MerchantOfflineSaleValidationError,
  parseCreateMerchantOfflineSale,
} from './merchant-offline-sale.validation';
import { MerchantShopContextService } from './merchant-shop-context.service';

@Injectable()
export class MerchantOfflineSaleService {
  public constructor(
    @Inject(MerchantShopContextService)
    private readonly shopContextService: MerchantShopContextService,
    @Inject(MERCHANT_OFFLINE_SALE_GATEWAY)
    private readonly gateway: MerchantOfflineSaleGateway,
  ) {}

  public async createOfflineSale(
    context: AuthenticatedRequestContext,
    idempotencyHeader: unknown,
    body: unknown,
  ): Promise<MerchantOfflineSaleResponse> {
    try {
      const input = parseCreateMerchantOfflineSale(body, idempotencyHeader);
      await this.shopContextService.requireOwnedShop(context, input.shopId);

      const sale = await this.gateway.createOfflineSale({
        ...input,
        actorId: context.actor.id,
      });

      return {
        success: true,
        data: { sale },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantOfflineSaleIdempotencyKeyRequiredError) {
      throw createOfflineSaleIdempotencyKeyRequiredException();
    }

    if (
      error instanceof MerchantOfflineSaleValidationError ||
      error instanceof MerchantOfflineSaleConstraintError
    ) {
      throw createInvalidOfflineSaleException();
    }

    if (error instanceof MerchantOfflineSaleIdempotencyConflictError) {
      throw createIdempotencyConflictException();
    }

    if (error instanceof MerchantOfflineSaleInsufficientInventoryError) {
      throw createNegativeInventoryRejectedException();
    }

    if (error instanceof MerchantOfflineSaleVariantNotFoundError) {
      throw createProductVariantNotFoundException();
    }

    if (error instanceof MerchantOfflineSaleGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof MerchantOfflineSaleDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
