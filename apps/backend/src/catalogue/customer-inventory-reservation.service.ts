import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCartNotFoundException,
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createIdempotencyConflictException,
  createInsufficientInventoryException,
  createInventoryReservationConflictException,
  createInventoryReservationIdempotencyKeyRequiredException,
  createInventoryReservationNotFoundException,
  createInvalidInventoryReservationException,
  createProductVariantNotFoundException,
} from './catalogue-http-error';
import {
  type CustomerInventoryReservationGateway,
  CustomerInventoryReservationConflictError,
  CustomerInventoryReservationConstraintError,
  CustomerInventoryReservationDataInvalidError,
  CustomerInventoryReservationGatewayUnavailableError,
  CustomerInventoryReservationIdempotencyConflictError,
  CustomerInventoryReservationInsufficientInventoryError,
  CustomerInventoryReservationNotFoundError,
} from './customer-inventory-reservation.gateway';
import { CUSTOMER_INVENTORY_RESERVATION_GATEWAY } from './customer-inventory-reservation.tokens';
import type { CustomerInventoryReservationResponse } from './customer-inventory-reservation.types';
import {
  CustomerInventoryReservationIdempotencyKeyRequiredError,
  CustomerInventoryReservationValidationError,
  parseCreateCustomerInventoryReservation,
  parseReleaseCustomerInventoryReservation,
} from './customer-inventory-reservation.validation';

@Injectable()
export class CustomerInventoryReservationService {
  public constructor(
    @Inject(CUSTOMER_INVENTORY_RESERVATION_GATEWAY)
    private readonly gateway: CustomerInventoryReservationGateway,
  ) {}

  public async createReservation(
    context: AuthenticatedRequestContext,
    idempotencyHeader: unknown,
    body: unknown,
  ): Promise<CustomerInventoryReservationResponse> {
    try {
      const input = parseCreateCustomerInventoryReservation(body, idempotencyHeader);
      const cart = await this.gateway.findOwnedActiveCart(context.supabase, input.cartId);

      if (cart?.status !== 'ACTIVE') {
        throw createCartNotFoundException();
      }

      const variant = await this.gateway.findVisibleVariant(context.supabase, input.variantId);

      if (variant?.isActive !== true || variant.shopId !== cart.shopId) {
        throw createProductVariantNotFoundException();
      }

      const reservation = await this.gateway.createReservation({
        ...input,
        actorId: context.actor.id,
      });

      return {
        success: true,
        data: {
          reservation,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  public async releaseReservation(
    context: AuthenticatedRequestContext,
    reservationIdValue: unknown,
    body: unknown,
  ): Promise<CustomerInventoryReservationResponse> {
    try {
      const input = parseReleaseCustomerInventoryReservation(reservationIdValue, body);
      const reservation = await this.gateway.findOwnedReservation(
        context.supabase,
        input.reservationId,
      );

      if (reservation === null) {
        throw createInventoryReservationNotFoundException();
      }

      const released = await this.gateway.releaseReservation({
        ...input,
        actorId: context.actor.id,
      });

      return {
        success: true,
        data: {
          reservation: released,
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
    if (error instanceof CustomerInventoryReservationIdempotencyKeyRequiredError) {
      throw createInventoryReservationIdempotencyKeyRequiredException();
    }

    if (
      error instanceof CustomerInventoryReservationValidationError ||
      error instanceof CustomerInventoryReservationConstraintError
    ) {
      throw createInvalidInventoryReservationException();
    }

    if (error instanceof CustomerInventoryReservationIdempotencyConflictError) {
      throw createIdempotencyConflictException();
    }

    if (error instanceof CustomerInventoryReservationInsufficientInventoryError) {
      throw createInsufficientInventoryException();
    }

    if (error instanceof CustomerInventoryReservationConflictError) {
      throw createInventoryReservationConflictException();
    }

    if (error instanceof CustomerInventoryReservationNotFoundError) {
      throw createInventoryReservationNotFoundException();
    }

    if (error instanceof CustomerInventoryReservationGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CustomerInventoryReservationDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
