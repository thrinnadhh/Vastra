import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminConfigurationGateway } from './admin-configuration.gateway';
import {
  ADMIN_OPERATIONAL_SETTING_KEYS,
  type AdminOperationalSetting,
  type AdminOperationalSettingKey,
  type AdminSettingScopeType,
} from './admin-configuration.types';
import { ADMIN_CONFIGURATION_GATEWAY } from './admin.tokens';
import { ADMIN_MUTATION_REASON_CODES, type AdminMutationReasonCode } from './admin.types';

export class AdminConfigurationRequestInvalidError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function parseKey(value: unknown): AdminOperationalSettingKey {
  if (
    typeof value !== 'string' ||
    !ADMIN_OPERATIONAL_SETTING_KEYS.includes(value as AdminOperationalSettingKey)
  ) {
    throw new AdminConfigurationRequestInvalidError();
  }
  return value as AdminOperationalSettingKey;
}

function parseScope(typeValue: unknown, idValue: unknown) {
  const scopeType = (typeValue ?? 'GLOBAL') as AdminSettingScopeType;
  if (!['GLOBAL', 'CITY', 'SHOP'].includes(scopeType)) {
    throw new AdminConfigurationRequestInvalidError();
  }
  if (scopeType === 'GLOBAL') return { scopeType, scopeId: null };
  if (typeof idValue !== 'string' || idValue.trim().length === 0 || idValue.length > 120) {
    throw new AdminConfigurationRequestInvalidError();
  }
  return { scopeType, scopeId: idValue.trim() };
}

@Injectable()
export class AdminConfigurationService {
  public constructor(
    @Inject(ADMIN_CONFIGURATION_GATEWAY)
    private readonly gateway: AdminConfigurationGateway,
  ) {}

  public list(
    _context: AuthenticatedRequestContext,
    scopeType: unknown,
    scopeId: unknown,
  ): Promise<readonly AdminOperationalSetting[]> {
    const parsed = parseScope(scopeType, scopeId);
    return this.gateway.list(parsed.scopeType, parsed.scopeId);
  }

  public update(
    context: AuthenticatedRequestContext,
    key: unknown,
    idempotencyKey: unknown,
    requestId: string | null,
    body: unknown,
  ): Promise<AdminOperationalSetting> {
    if (typeof idempotencyKey !== 'string' || !UUID_PATTERN.test(idempotencyKey)) {
      throw new AdminConfigurationRequestInvalidError();
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new AdminConfigurationRequestInvalidError();
    }
    const record = body as Record<string, unknown>;
    const scope = parseScope(record['scopeType'], record['scopeId']);
    const reasonCode = record['reasonCode'];
    if (
      typeof reasonCode !== 'string' ||
      !ADMIN_MUTATION_REASON_CODES.includes(reasonCode as AdminMutationReasonCode)
    ) {
      throw new AdminConfigurationRequestInvalidError();
    }
    const expectedVersion = record['expectedVersion'];
    if (
      expectedVersion !== null &&
      expectedVersion !== undefined &&
      (typeof expectedVersion !== 'number' ||
        !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 1)
    ) {
      throw new AdminConfigurationRequestInvalidError();
    }
    const normalizedExpectedVersion =
      expectedVersion === undefined || expectedVersion === null ? null : expectedVersion;
    const rawNote = record['note'];
    let note: string | null = null;
    if (rawNote !== undefined && rawNote !== null) {
      if (typeof rawNote !== 'string') throw new AdminConfigurationRequestInvalidError();
      note = rawNote.trim();
      if (note.length === 0 || note.length > 1000) {
        throw new AdminConfigurationRequestInvalidError();
      }
    }
    return this.gateway.update({
      actorId: context.actor.id,
      key: parseKey(key),
      value: record['value'],
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      expectedVersion: normalizedExpectedVersion,
      reasonCode: reasonCode as AdminMutationReasonCode,
      note,
      requestId,
      idempotencyKey,
    });
  }
}
