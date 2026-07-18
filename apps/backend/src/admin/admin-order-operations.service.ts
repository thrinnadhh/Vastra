import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type {
  AdminOperationInput,
  AdminOperationResult,
  AdminOrderOperationsGateway,
  AdminResetVerificationInput,
} from './admin-order-operations.gateway';
import { ADMIN_ORDER_OPERATIONS_GATEWAY } from './admin.tokens';
import { ADMIN_MUTATION_REASON_CODES, type AdminMutationReasonCode } from './admin.types';

export class AdminOrderOperationRequestInvalidError extends Error {}
export class AdminOrderOperationIdempotencyKeyRequiredError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminOrderOperationRequestInvalidError();
  }
  return value as Record<string, unknown>;
}

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new AdminOrderOperationRequestInvalidError();
  }
  return value.trim();
}

function requireIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new AdminOrderOperationIdempotencyKeyRequiredError();
  }
  return requireUuid(value);
}

function parseReason(record: Record<string, unknown>): AdminMutationReasonCode {
  const value = record['reasonCode'];
  if (
    typeof value !== 'string' ||
    !ADMIN_MUTATION_REASON_CODES.includes(value as AdminMutationReasonCode)
  ) {
    throw new AdminOrderOperationRequestInvalidError();
  }
  return value as AdminMutationReasonCode;
}

function optionalBoundedString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AdminOrderOperationRequestInvalidError();
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new AdminOrderOperationRequestInvalidError();
  }
  return normalized;
}

@Injectable()
export class AdminOrderOperationsService {
  public constructor(
    @Inject(ADMIN_ORDER_OPERATIONS_GATEWAY)
    private readonly gateway: AdminOrderOperationsGateway,
  ) {}

  private parseInput(
    context: AuthenticatedRequestContext,
    resourceId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): AdminOperationInput {
    const record = requireRecord(body);
    return {
      actorId: context.actor.id,
      resourceId: requireUuid(resourceId),
      reasonCode: parseReason(record),
      note: optionalBoundedString(record['note'], 1000),
      requestId: optionalBoundedString(requestId, 200),
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    };
  }

  public cancelOrder(
    context: AuthenticatedRequestContext,
    orderId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminOperationResult> {
    return this.gateway.cancelOrder(
      this.parseInput(context, orderId, idempotencyKey, requestId, body),
    );
  }

  public retryDispatch(
    context: AuthenticatedRequestContext,
    orderId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminOperationResult> {
    return this.gateway.retryDispatch(
      this.parseInput(context, orderId, idempotencyKey, requestId, body),
    );
  }

  public releaseDelivery(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminOperationResult> {
    return this.gateway.releaseDelivery(
      this.parseInput(context, taskId, idempotencyKey, requestId, body),
    );
  }

  public resetVerification(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminOperationResult> {
    const record = requireRecord(body);
    const verificationKind = record['verificationKind'];
    if (verificationKind !== 'PICKUP_CODE' && verificationKind !== 'DELIVERY_OTP') {
      throw new AdminOrderOperationRequestInvalidError();
    }
    const input: AdminResetVerificationInput = {
      ...this.parseInput(context, taskId, idempotencyKey, requestId, record),
      verificationKind,
    };
    return this.gateway.resetVerification(input);
  }
}
