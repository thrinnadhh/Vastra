import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type AdminReturnDecisionGateway,
  AdminReturnDecisionGatewayUnavailableError,
  AdminReturnDecisionIdempotencyConflictError,
  AdminReturnDecisionNotFoundError,
  AdminReturnDecisionStateConflictError,
} from './admin-return-decision.gateway';
import type { AdminReturnRecord, AdminReturnResponse } from './admin-return-decision.types';
import {
  AdminReturnDecisionValidationError,
  parseAdminReturnDecision,
  requireAdminReturnUuid,
} from './admin-return-decision.validation';
import { ADMIN_RETURN_DECISION_GATEWAY } from './return-resolution.tokens';

const ALLOWED_STATUSES = new Set([
  'REQUESTED',
  'REVIEW',
  'APPROVED',
  'REJECTED',
  'PICKUP_ASSIGNED',
  'PICKED_UP',
  'RECEIVED',
  'VERIFIED',
  'REFUND_PENDING',
  'REFUNDED',
  'CLOSED',
]);

@Injectable()
export class AdminReturnDecisionService {
  public constructor(
    @Inject(ADMIN_RETURN_DECISION_GATEWAY)
    private readonly gateway: AdminReturnDecisionGateway,
  ) {}

  public async list(
    rawStatus: unknown,
    rawLimit: unknown,
  ): Promise<AdminReturnResponse<readonly AdminReturnRecord[]>> {
    try {
      const status =
        rawStatus === undefined || rawStatus === null || rawStatus === ''
          ? null
          : String(rawStatus).trim().toUpperCase();
      if (status !== null && !ALLOWED_STATUSES.has(status)) {
        throw new AdminReturnDecisionValidationError();
      }
      const limit = rawLimit === undefined ? 25 : Number(rawLimit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new AdminReturnDecisionValidationError();
      }
      return this.success(await this.gateway.list(status, limit));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async get(rawReturnId: unknown): Promise<AdminReturnResponse<AdminReturnRecord>> {
    try {
      const result = await this.gateway.get(requireAdminReturnUuid(rawReturnId));
      if (result === null) throw new AdminReturnDecisionNotFoundError();
      return this.success(result);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async decide(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<AdminReturnResponse<AdminReturnRecord>> {
    try {
      return this.success(
        await this.gateway.decide(
          context.actor.id,
          requireAdminReturnUuid(rawReturnId),
          parseAdminReturnDecision(body, idempotencyKey),
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private success<T>(data: T): AdminReturnResponse<T> {
    return { success: true, data, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (error instanceof AdminReturnDecisionValidationError) {
      throw new BadRequestException('Admin return decision is invalid');
    }
    if (
      error instanceof AdminReturnDecisionStateConflictError ||
      error instanceof AdminReturnDecisionIdempotencyConflictError
    ) {
      throw new ConflictException('Admin return decision conflicts with current state');
    }
    if (error instanceof AdminReturnDecisionNotFoundError) {
      throw new NotFoundException('Return request was not found');
    }
    if (error instanceof AdminReturnDecisionGatewayUnavailableError) {
      throw new ServiceUnavailableException('Admin return service is unavailable');
    }
    throw error;
  }
}
