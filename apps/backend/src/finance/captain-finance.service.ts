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
  type CaptainFinanceGateway,
  CaptainFinanceGatewayUnavailableError,
  CaptainFinanceIdempotencyConflictError,
  CaptainFinanceNotEligibleError,
  CaptainFinanceNotFoundError,
  CaptainFinanceStateConflictError,
} from './captain-finance.gateway';
import type { CaptainFinanceRecord, CaptainFinanceResponse } from './captain-finance.types';
import {
  CaptainFinanceValidationError,
  parseCreateCaptainPayoutInput,
  parseReconcileCodInput,
  requireCaptainFinanceUuid,
} from './captain-finance.validation';
import { CAPTAIN_FINANCE_GATEWAY } from './finance-ledger.tokens';

@Injectable()
export class CaptainFinanceService {
  public constructor(
    @Inject(CAPTAIN_FINANCE_GATEWAY)
    private readonly gateway: CaptainFinanceGateway,
  ) {}

  public async listCod(
    rawStatus: unknown,
    rawLimit: unknown,
  ): Promise<CaptainFinanceResponse<readonly CaptainFinanceRecord[]>> {
    try {
      let status: string | null = null;
      if (rawStatus !== undefined && rawStatus !== null && rawStatus !== '') {
        if (typeof rawStatus !== 'string') throw new CaptainFinanceValidationError();
        status = rawStatus.trim();
        if (status.length === 0) status = null;
      }
      if (
        status !== null &&
        !['COLLECTED', 'DEPOSIT_PENDING', 'DEPOSITED', 'RECONCILED', 'DISPUTED'].includes(status)
      ) {
        throw new CaptainFinanceValidationError();
      }
      const limit = rawLimit === undefined ? 25 : Number(rawLimit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new CaptainFinanceValidationError();
      }
      return this.success(await this.gateway.listCod(status, limit));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async reconcileCod(
    context: AuthenticatedRequestContext,
    rawCollectionId: unknown,
    rawIdempotencyKey: unknown,
    body: unknown,
  ): Promise<CaptainFinanceResponse<CaptainFinanceRecord>> {
    try {
      return this.success(
        await this.gateway.reconcileCod(
          context.actor.id,
          requireCaptainFinanceUuid(rawCollectionId),
          parseReconcileCodInput(body, rawIdempotencyKey),
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async eligibility(
    rawCaptainId: unknown,
    rawStart: unknown,
    rawEnd: unknown,
  ): Promise<CaptainFinanceResponse<CaptainFinanceRecord>> {
    try {
      const input = parseCreateCaptainPayoutInput(
        {
          captainId: rawCaptainId,
          periodStart: rawStart,
          periodEnd: rawEnd,
          reasonCode: 'PAYOUT_CYCLE',
        },
        '00000000-0000-4000-8000-000000000001',
      );
      return this.success(
        await this.gateway.getPayoutEligibility(
          input.captainId,
          input.periodStart,
          input.periodEnd,
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async createPayout(
    context: AuthenticatedRequestContext,
    rawIdempotencyKey: unknown,
    body: unknown,
  ): Promise<CaptainFinanceResponse<CaptainFinanceRecord>> {
    try {
      return this.success(
        await this.gateway.createPayout(
          context.actor.id,
          parseCreateCaptainPayoutInput(body, rawIdempotencyKey),
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async getPayout(
    rawPayoutId: unknown,
  ): Promise<CaptainFinanceResponse<CaptainFinanceRecord>> {
    try {
      const result = await this.gateway.getPayout(requireCaptainFinanceUuid(rawPayoutId));
      if (result === null) throw new CaptainFinanceNotFoundError();
      return this.success(result);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private success<T>(data: T): CaptainFinanceResponse<T> {
    return { success: true, data, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (error instanceof CaptainFinanceValidationError) {
      throw new BadRequestException('Captain finance request is invalid');
    }
    if (
      error instanceof CaptainFinanceStateConflictError ||
      error instanceof CaptainFinanceIdempotencyConflictError ||
      error instanceof CaptainFinanceNotEligibleError
    ) {
      throw new ConflictException('Captain finance conflicts with current state');
    }
    if (error instanceof CaptainFinanceNotFoundError) {
      throw new NotFoundException('Captain finance record was not found');
    }
    if (error instanceof CaptainFinanceGatewayUnavailableError) {
      throw new ServiceUnavailableException('Captain finance service is unavailable');
    }
    throw error;
  }
}
