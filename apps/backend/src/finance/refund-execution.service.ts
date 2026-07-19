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
  PaymentProviderResponseInvalidError,
  PaymentProviderUnavailableError,
} from './cashfree-payment-provider.gateway';
import type { PaymentProviderGateway, ProviderRefundSnapshot } from './payment-provider.contract';
import {
  type RefundExecutionGateway,
  RefundExecutionAmountConflictError,
  RefundExecutionGatewayUnavailableError,
  RefundExecutionIdempotencyConflictError,
  RefundExecutionNotFoundError,
  RefundExecutionStateConflictError,
} from './refund-execution.gateway';
import type { RefundExecutionRecord, RefundExecutionResponse } from './refund-execution.types';
import {
  RefundExecutionValidationError,
  parseRefundExecutionCommand,
  requireRefundExecutionUuid,
} from './refund-execution.validation';
import { PAYMENT_PROVIDER_GATEWAY, REFUND_EXECUTION_GATEWAY } from './payment.tokens';

const ALLOWED_STATUSES = new Set([
  'PENDING',
  'APPROVAL_REQUIRED',
  'INITIATED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

@Injectable()
export class RefundExecutionService {
  public constructor(
    @Inject(REFUND_EXECUTION_GATEWAY)
    private readonly gateway: RefundExecutionGateway,
    @Inject(PAYMENT_PROVIDER_GATEWAY)
    private readonly provider: PaymentProviderGateway,
  ) {}

  public async list(
    rawStatus: unknown,
    rawLimit: unknown,
  ): Promise<RefundExecutionResponse<readonly RefundExecutionRecord[]>> {
    try {
      let status: string | null = null;
      if (rawStatus !== undefined && rawStatus !== null && rawStatus !== '') {
        if (typeof rawStatus !== 'string') {
          throw new RefundExecutionValidationError();
        }
        status = rawStatus.trim().toUpperCase();
      }
      if (status !== null && !ALLOWED_STATUSES.has(status)) {
        throw new RefundExecutionValidationError();
      }
      const limit = rawLimit === undefined ? 25 : Number(rawLimit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new RefundExecutionValidationError();
      }
      return this.success(await this.gateway.list(status, limit));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async get(rawRefundId: unknown): Promise<RefundExecutionResponse<RefundExecutionRecord>> {
    try {
      return this.success(await this.requireRefund(rawRefundId));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async create(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<RefundExecutionResponse<RefundExecutionRecord>> {
    try {
      const prepared = await this.gateway.prepare(
        context.actor.id,
        requireRefundExecutionUuid(rawReturnId),
        parseRefundExecutionCommand(body, idempotencyKey),
      );
      return this.success(await this.execute(context.actor.id, prepared));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async retry(
    context: AuthenticatedRequestContext,
    rawRefundId: unknown,
  ): Promise<RefundExecutionResponse<RefundExecutionRecord>> {
    try {
      let refund = await this.requireRefund(rawRefundId);
      if (refund.status === 'FAILED') {
        refund = await this.gateway.markRetrying(context.actor.id, refund.refundId);
      } else if (!['INITIATED', 'PROCESSING'].includes(refund.status)) {
        throw new RefundExecutionStateConflictError();
      }
      return this.success(await this.execute(context.actor.id, refund));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async reconcile(
    context: AuthenticatedRequestContext,
    rawRefundId: unknown,
  ): Promise<RefundExecutionResponse<RefundExecutionRecord>> {
    try {
      const refund = await this.requireRefund(rawRefundId);
      if (!['INITIATED', 'PROCESSING', 'FAILED'].includes(refund.status)) {
        throw new RefundExecutionStateConflictError();
      }
      const snapshot = await this.provider.fetchRefund(refund.providerOrderId, refund.refundId);
      return this.success(await this.applySnapshot(context.actor.id, refund.refundId, snapshot));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private async requireRefund(rawRefundId: unknown): Promise<RefundExecutionRecord> {
    const refund = await this.gateway.get(requireRefundExecutionUuid(rawRefundId));
    if (refund === null) throw new RefundExecutionNotFoundError();
    return refund;
  }

  private async execute(
    actorId: string,
    refund: RefundExecutionRecord,
  ): Promise<RefundExecutionRecord> {
    if (refund.status === 'COMPLETED' || refund.status === 'CANCELLED') return refund;
    if (refund.providerRefundId !== null) {
      const snapshot = await this.provider.fetchRefund(refund.providerOrderId, refund.refundId);
      return this.applySnapshot(actorId, refund.refundId, snapshot);
    }
    const snapshot = await this.provider.createRefund({
      internalRefundId: refund.refundId,
      providerOrderId: refund.providerOrderId,
      providerPaymentId: refund.providerPaymentId,
      amountPaise: refund.amountPaise,
      idempotencyKey: refund.idempotencyKey,
      note: 'Approved Vastra return refund',
    });
    return this.applySnapshot(actorId, refund.refundId, snapshot);
  }

  private applySnapshot(
    actorId: string,
    refundId: string,
    snapshot: ProviderRefundSnapshot,
  ): Promise<RefundExecutionRecord> {
    return this.gateway.applyProviderResult(
      actorId,
      refundId,
      snapshot.providerRefundId,
      snapshot.status,
      snapshot.processedAt,
      snapshot.status === 'FAILED' ? 'Cashfree reported refund failure' : null,
    );
  }

  private success<T>(data: T): RefundExecutionResponse<T> {
    return { success: true, data, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (error instanceof RefundExecutionValidationError) {
      throw new BadRequestException('Refund request is invalid');
    }
    if (
      error instanceof RefundExecutionStateConflictError ||
      error instanceof RefundExecutionAmountConflictError ||
      error instanceof RefundExecutionIdempotencyConflictError
    ) {
      throw new ConflictException('Refund conflicts with current financial state');
    }
    if (error instanceof RefundExecutionNotFoundError) {
      throw new NotFoundException('Refund or return request was not found');
    }
    if (
      error instanceof RefundExecutionGatewayUnavailableError ||
      error instanceof PaymentProviderUnavailableError ||
      error instanceof PaymentProviderResponseInvalidError
    ) {
      throw new ServiceUnavailableException('Refund service is unavailable');
    }
    throw error;
  }
}
