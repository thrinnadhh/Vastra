import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type {
  AdminCaptainAvailability,
  AdminCaptainAvailabilityInput,
  AdminCaptainGateway,
  AdminCaptainMutationInput,
  AdminCaptainSnapshot,
  AdminCaptainStatusInput,
  AdminCaptainTargetStatus,
} from './admin-captain.gateway';
import { ADMIN_CAPTAIN_GATEWAY } from './admin.tokens';
import {
  ADMIN_MUTATION_REASON_CODES,
  type AdminMutationReasonCode,
} from './admin.types';

export class AdminCaptainRequestInvalidError extends Error {}
export class AdminCaptainNotFoundError extends Error {}
export class AdminCaptainIdempotencyKeyRequiredError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new AdminCaptainRequestInvalidError();
  }
  return value.trim();
}

function requireIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new AdminCaptainIdempotencyKeyRequiredError();
  }
  return requireUuid(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminCaptainRequestInvalidError();
  }
  return value as Record<string, unknown>;
}

function parseReason(record: Record<string, unknown>): AdminMutationReasonCode {
  const reasonCode = record['reasonCode'];
  if (
    typeof reasonCode !== 'string' ||
    !ADMIN_MUTATION_REASON_CODES.includes(reasonCode as AdminMutationReasonCode)
  ) {
    throw new AdminCaptainRequestInvalidError();
  }
  return reasonCode as AdminMutationReasonCode;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AdminCaptainRequestInvalidError();
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new AdminCaptainRequestInvalidError();
  }
  return normalized;
}

@Injectable()
export class AdminCaptainService {
  public constructor(
    @Inject(ADMIN_CAPTAIN_GATEWAY)
    private readonly gateway: AdminCaptainGateway,
  ) {}

  private parseMutation(
    context: AuthenticatedRequestContext,
    captainId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): AdminCaptainMutationInput {
    const record = requireRecord(body);
    return {
      actorId: context.actor.id,
      captainId: requireUuid(captainId),
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      reasonCode: parseReason(record),
      note: optionalString(record['note'], 1000),
      requestId: optionalString(requestId, 200),
    };
  }

  public async get(
    _context: AuthenticatedRequestContext,
    captainId: unknown,
  ): Promise<AdminCaptainSnapshot> {
    const snapshot = await this.gateway.get(requireUuid(captainId));
    if (snapshot === null) throw new AdminCaptainNotFoundError();
    return snapshot;
  }

  public setStatus(
    context: AuthenticatedRequestContext,
    captainId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
    targetStatus: AdminCaptainTargetStatus,
  ): Promise<AdminCaptainSnapshot> {
    const input: AdminCaptainStatusInput = {
      ...this.parseMutation(context, captainId, idempotencyKey, requestId, body),
      targetStatus,
    };
    return this.gateway.setStatus(input);
  }

  public correctAvailability(
    context: AuthenticatedRequestContext,
    captainId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminCaptainSnapshot> {
    const record = requireRecord(body);
    const targetAvailability = record['targetAvailability'];
    if (!['OFFLINE', 'AVAILABLE', 'ON_BREAK'].includes(String(targetAvailability))) {
      throw new AdminCaptainRequestInvalidError();
    }
    const input: AdminCaptainAvailabilityInput = {
      ...this.parseMutation(context, captainId, idempotencyKey, requestId, record),
      targetAvailability: targetAvailability as AdminCaptainAvailability,
    };
    return this.gateway.correctAvailability(input);
  }

  public releaseActiveAssignment(
    context: AuthenticatedRequestContext,
    captainId: unknown,
    idempotencyKey: unknown,
    requestId: unknown,
    body: unknown,
  ): Promise<AdminCaptainSnapshot> {
    return this.gateway.releaseActiveAssignment(
      this.parseMutation(context, captainId, idempotencyKey, requestId, body),
    );
  }
}
