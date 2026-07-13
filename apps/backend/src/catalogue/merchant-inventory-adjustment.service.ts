import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createIdempotencyConflictException,
  createIdempotencyKeyRequiredException,
  createInventoryConflictException,
  createInvalidInventoryAdjustmentException,
  createInvalidInventoryMovementQueryException,
  createNegativeInventoryRejectedException,
  createProductVariantNotFoundException,
} from './catalogue-http-error';
import {
  type MerchantInventoryAdjustmentGateway,
  MerchantInventoryAdjustmentConstraintError,
  MerchantInventoryAdjustmentDataInvalidError,
  MerchantInventoryAdjustmentGatewayUnavailableError,
  MerchantInventoryAdjustmentIdempotencyConflictError,
  MerchantInventoryAdjustmentNegativeInventoryError,
  MerchantInventoryAdjustmentVariantNotFoundError,
  MerchantInventoryAdjustmentVersionConflictError,
} from './merchant-inventory-adjustment.gateway';
import { MERCHANT_INVENTORY_ADJUSTMENT_GATEWAY } from './merchant-inventory-adjustment.tokens';
import type {
  ListMerchantInventoryMovementsResponse,
  MerchantInventoryAdjustmentResponse,
} from './merchant-inventory-adjustment.types';
import {
  MerchantInventoryAdjustmentValidationError,
  MerchantInventoryIdempotencyKeyRequiredError,
  MerchantInventoryMovementQueryValidationError,
  parseCreateMerchantInventoryAdjustment,
  parseMerchantInventoryMovementQuery,
} from './merchant-inventory-adjustment.validation';

@Injectable()
export class MerchantInventoryAdjustmentService {
  public constructor(
    @Inject(MERCHANT_INVENTORY_ADJUSTMENT_GATEWAY)
    private readonly gateway: MerchantInventoryAdjustmentGateway,
  ) {}

  public async adjustInventory(
    context: AuthenticatedRequestContext,
    idempotencyHeader: unknown,
    body: unknown,
  ): Promise<MerchantInventoryAdjustmentResponse> {
    try {
      const input = parseCreateMerchantInventoryAdjustment(body, idempotencyHeader);
      const variant = await this.gateway.findOwnedVariant(context.supabase, input.variantId);

      if (variant === null) {
        throw createProductVariantNotFoundException();
      }

      const adjustment = await this.gateway.applyAdjustment({
        ...input,
        shopId: variant.shopId,
        actorId: context.actor.id,
      });

      return {
        success: true,
        data: {
          adjustment,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async listMovements(
    context: AuthenticatedRequestContext,
    variantIdValue: unknown,
    cursorValue: unknown,
    limitValue: unknown,
  ): Promise<ListMerchantInventoryMovementsResponse> {
    try {
      const query = parseMerchantInventoryMovementQuery(variantIdValue, cursorValue, limitValue);
      const variant = await this.gateway.findOwnedVariant(context.supabase, query.variantId);

      if (variant === null) {
        throw createProductVariantNotFoundException();
      }

      const page = await this.gateway.listOwnedMovements(
        context.supabase,
        query.variantId,
        query.cursor,
        query.limit,
      );

      return {
        success: true,
        data: {
          variantId: query.variantId,
          movements: page.movements,
          nextCursor: page.nextCursor,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantInventoryIdempotencyKeyRequiredError) {
      throw createIdempotencyKeyRequiredException();
    }

    if (error instanceof MerchantInventoryAdjustmentValidationError) {
      throw createInvalidInventoryAdjustmentException();
    }

    if (error instanceof MerchantInventoryMovementQueryValidationError) {
      throw createInvalidInventoryMovementQueryException();
    }

    if (error instanceof MerchantInventoryAdjustmentIdempotencyConflictError) {
      throw createIdempotencyConflictException();
    }

    if (error instanceof MerchantInventoryAdjustmentVersionConflictError) {
      throw createInventoryConflictException();
    }

    if (error instanceof MerchantInventoryAdjustmentNegativeInventoryError) {
      throw createNegativeInventoryRejectedException();
    }

    if (error instanceof MerchantInventoryAdjustmentVariantNotFoundError) {
      throw createProductVariantNotFoundException();
    }

    if (error instanceof MerchantInventoryAdjustmentConstraintError) {
      throw createInvalidInventoryAdjustmentException();
    }

    if (error instanceof MerchantInventoryAdjustmentGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof MerchantInventoryAdjustmentDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
