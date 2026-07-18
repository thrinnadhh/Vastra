import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  AdminOperationalSetting,
  AdminSettingScopeType,
  AdminUpdateSettingInput,
} from './admin-configuration.types';

export interface AdminConfigurationGateway {
  list(
    scopeType: AdminSettingScopeType | null,
    scopeId: string | null,
  ): Promise<readonly AdminOperationalSetting[]>;
  update(input: AdminUpdateSettingInput): Promise<AdminOperationalSetting>;
}

export class AdminConfigurationGatewayUnavailableError extends Error {}
export class AdminConfigurationVersionConflictError extends Error {}
export class AdminConfigurationIdempotencyConflictError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminConfigurationGatewayUnavailableError();
  }
  return value as Record<string, unknown>;
}

function parseSetting(value: unknown): AdminOperationalSetting {
  const record = requireRecord(value);
  const version = record['version'];
  const scopeId = record['scope_id'];
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
    throw new AdminConfigurationGatewayUnavailableError();
  }
  if (scopeId !== null && typeof scopeId !== 'string') {
    throw new AdminConfigurationGatewayUnavailableError();
  }
  return {
    id: String(record['id']),
    key: String(record['setting_key']) as AdminOperationalSetting['key'],
    value: record['setting_value'],
    valueType: String(record['value_type']) as AdminOperationalSetting['valueType'],
    scopeType: String(record['scope_type']) as AdminOperationalSetting['scopeType'],
    scopeId,
    version,
    updatedBy: String(record['updated_by']),
    updatedAt: String(record['updated_at']),
  };
}

@Injectable()
export class SupabaseAdminConfigurationGateway implements AdminConfigurationGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async list(
    scopeType: AdminSettingScopeType | null,
    scopeId: string | null,
  ): Promise<readonly AdminOperationalSetting[]> {
    const { data, error } = await this.client.rpc('list_admin_operational_settings', {
      p_scope_type: scopeType,
      p_scope_id: scopeId,
    });
    if (error !== null || !Array.isArray(data)) {
      throw new AdminConfigurationGatewayUnavailableError();
    }
    return data.map(parseSetting);
  }

  public async update(input: AdminUpdateSettingInput): Promise<AdminOperationalSetting> {
    const { data, error } = await this.client.rpc('admin_update_operational_setting', {
      p_actor_id: input.actorId,
      p_setting_key: input.key,
      p_setting_value: input.value,
      p_scope_type: input.scopeType,
      p_scope_id: input.scopeId,
      p_expected_version: input.expectedVersion,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) {
      if (error.message.includes('ADMIN_SETTING_VERSION_CONFLICT')) {
        throw new AdminConfigurationVersionConflictError();
      }
      if (error.message.includes('ADMIN_IDEMPOTENCY_CONFLICT')) {
        throw new AdminConfigurationIdempotencyConflictError();
      }
      throw new AdminConfigurationGatewayUnavailableError();
    }
    return parseSetting(data);
  }
}
