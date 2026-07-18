import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminCaseGateway } from './admin-case.gateway';
import {
  ADMIN_CASE_CATEGORIES,
  ADMIN_CASE_PRIORITIES,
  ADMIN_CASE_STATUSES,
  type AdminAddCaseNoteInput,
  type AdminAssignCaseInput,
  type AdminCaseCategory,
  type AdminCaseListInput,
  type AdminCaseMutationContext,
  type AdminCasePriority,
  type AdminCaseSnapshot,
  type AdminCaseStatus,
  type AdminCreateCaseInput,
  type AdminResolveCaseInput,
} from './admin-case.types';
import { ADMIN_CASE_GATEWAY } from './admin.tokens';
import { ADMIN_MUTATION_REASON_CODES, type AdminMutationReasonCode } from './admin.types';

export class AdminCaseRequestInvalidError extends Error {}
export class AdminCaseNotFoundError extends Error {}
export class AdminCaseIdempotencyKeyRequiredError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminCaseRequestInvalidError();
  }
  return value as Record<string, unknown>;
}

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new AdminCaseRequestInvalidError();
  }
  return value.trim();
}

function optionalUuid(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requireUuid(value);
}

function requireIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new AdminCaseIdempotencyKeyRequiredError();
  }
  return requireUuid(value);
}

function boundedString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new AdminCaseRequestInvalidError();
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new AdminCaseRequestInvalidError();
  }
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return boundedString(value, maxLength);
}

function parseReason(record: Record<string, unknown>): AdminMutationReasonCode {
  const reasonCode = record['reasonCode'];
  if (
    typeof reasonCode !== 'string' ||
    !ADMIN_MUTATION_REASON_CODES.includes(reasonCode as AdminMutationReasonCode)
  ) {
    throw new AdminCaseRequestInvalidError();
  }
  return reasonCode as AdminMutationReasonCode;
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new AdminCaseRequestInvalidError();
  }
  return value as T;
}

@Injectable()
export class AdminCaseService {
  public constructor(
    @Inject(ADMIN_CASE_GATEWAY)
    private readonly gateway: AdminCaseGateway,
  ) {}

  private mutationContext(
    context: AuthenticatedRequestContext,
    caseId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): AdminCaseMutationContext {
    const record = requireRecord(body);
    return {
      actorId: context.actor.id,
      caseId: requireUuid(caseId),
      reasonCode: parseReason(record),
      note: optionalString(record['note'], 1000),
      requestId: optionalString(requestId, 200),
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    };
  }

  public list(
    _context: AuthenticatedRequestContext,
    status: unknown,
    priority: unknown,
    assignedTo: unknown,
    limit: unknown,
  ): Promise<readonly AdminCaseSnapshot[]> {
    const parsedLimit =
      typeof limit === 'string' && /^\d+$/u.test(limit)
        ? Math.min(100, Math.max(1, Number(limit)))
        : 50;
    const input: AdminCaseListInput = {
      status:
        status === undefined || status === null || status === ''
          ? null
          : parseEnum<AdminCaseStatus>(status, ADMIN_CASE_STATUSES),
      priority:
        priority === undefined || priority === null || priority === ''
          ? null
          : parseEnum<AdminCasePriority>(priority, ADMIN_CASE_PRIORITIES),
      assignedTo: optionalUuid(assignedTo),
      limit: parsedLimit,
    };
    return this.gateway.list(input);
  }

  public async get(
    _context: AuthenticatedRequestContext,
    caseId: unknown,
  ): Promise<AdminCaseSnapshot> {
    const snapshot = await this.gateway.get(requireUuid(caseId));
    if (snapshot === null) throw new AdminCaseNotFoundError();
    return snapshot;
  }

  public create(
    context: AuthenticatedRequestContext,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminCaseSnapshot> {
    const record = requireRecord(body);
    const input: AdminCreateCaseInput = {
      actorId: context.actor.id,
      category: parseEnum<AdminCaseCategory>(record['category'], ADMIN_CASE_CATEGORIES),
      priority: parseEnum<AdminCasePriority>(record['priority'], ADMIN_CASE_PRIORITIES),
      subject: boundedString(record['subject'], 200),
      description: boundedString(record['description'], 4000),
      orderId: optionalUuid(record['orderId']),
      shopId: optionalUuid(record['shopId']),
      deliveryTaskId: optionalUuid(record['deliveryTaskId']),
      returnRequestId: optionalUuid(record['returnRequestId']),
      merchantId: optionalUuid(record['merchantId']),
      captainId: optionalUuid(record['captainId']),
      reasonCode: parseReason(record),
      requestId: optionalString(requestId, 200),
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    };
    return this.gateway.create(input);
  }

  public assign(
    context: AuthenticatedRequestContext,
    caseId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminCaseSnapshot> {
    const record = requireRecord(body);
    const input: AdminAssignCaseInput = {
      ...this.mutationContext(context, caseId, idempotencyKey, requestId, record),
      assignedTo: requireUuid(record['assignedTo']),
      assignedTeam: optionalString(record['assignedTeam'], 120),
    };
    return this.gateway.assign(input);
  }

  public addNote(
    context: AuthenticatedRequestContext,
    caseId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminCaseSnapshot> {
    const record = requireRecord(body);
    const input: AdminAddCaseNoteInput = {
      ...this.mutationContext(context, caseId, idempotencyKey, requestId, record),
      message: boundedString(record['message'], 4000),
      attachmentObjectKey: optionalString(record['attachmentObjectKey'], 500),
    };
    return this.gateway.addNote(input);
  }

  public escalate(
    context: AuthenticatedRequestContext,
    caseId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminCaseSnapshot> {
    return this.gateway.escalate(
      this.mutationContext(context, caseId, idempotencyKey, requestId, body),
    );
  }

  public resolve(
    context: AuthenticatedRequestContext,
    caseId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminCaseSnapshot> {
    const record = requireRecord(body);
    const input: AdminResolveCaseInput = {
      ...this.mutationContext(context, caseId, idempotencyKey, requestId, record),
      resolutionCode: boundedString(record['resolutionCode'], 120),
      resolutionNote: boundedString(record['resolutionNote'], 2000),
    };
    return this.gateway.resolve(input);
  }

  public close(
    context: AuthenticatedRequestContext,
    caseId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminCaseSnapshot> {
    return this.gateway.close(
      this.mutationContext(context, caseId, idempotencyKey, requestId, body),
    );
  }
}
