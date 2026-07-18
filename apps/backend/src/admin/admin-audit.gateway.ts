import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  AdminAuditEntry,
  AdminMutationReasonCode,
  AdminResourceType,
} from './admin.types';

export interface RecordAdminAuditInput {
  readonly actorId: string;
  readonly action: string;
  readonly resourceType: AdminResourceType;
  readonly resourceId: string;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
}

export interface ListAdminAuditInput {
  readonly resourceType: AdminResourceType | null;
  readonly resourceId: string | null;
  readonly actorId: string | null;
  readonly limit: number;
}

export interface AdminAuditGateway {
  record(input: RecordAdminAuditInput): Promise<AdminAuditEntry>;
  list(input: ListAdminAuditInput): Promise<readonly AdminAuditEntry[]>;
}

export class AdminAuditIdempotencyConflictError extends Error {}
export class AdminAuditGatewayUnavailableError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminAuditGatewayUnavailableError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AdminAuditGatewayUnavailableError();
  }
  return value;
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return requireString(record, key);
}

function nullableObject(
  record: Record<string, unknown>,
  key: string,
): Readonly<Record<string, unknown>> | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return requireRecord(value);
}

function parseEntry(value: unknown): AdminAuditEntry {
  const record = requireRecord(value);
  const id = requireString(record, 'id');
  const actorId = requireString(record, 'actor_id');
  const resourceId = requireString(record, 'resource_id');
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(actorId) || !UUID_PATTERN.test(resourceId)) {
    throw new AdminAuditGatewayUnavailableError();
  }
  return {
    id,
    actorId,
    action: requireString(record, 'action'),
    resourceType: requireString(record, 'resource_type') as AdminResourceType,
    resourceId,
    reasonCode: requireString(record, 'reason_code') as AdminMutationReasonCode,
    note: nullableString(record, 'note'),
    requestId: nullableString(record, 'request_id'),
    idempotencyKey: requireString(record, 'idempotency_key'),
    change: {
      before: nullableObject(record, 'before_state'),
      after: nullableObject(record, 'after_state'),
    },
    createdAt: requireString(record, 'created_at'),
  };
}

@Injectable()
export class SupabaseAdminAuditGateway implements AdminAuditGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async record(input: RecordAdminAuditInput): Promise<AdminAuditEntry> {
    const { data, error } = await this.client.rpc('record_admin_audit', {
      p_actor_id: input.actorId,
      p_action: input.action,
      p_resource_type: input.resourceType,
      p_resource_id: input.resourceId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
      p_before_state: input.before,
      p_after_state: input.after,
    });
    if (error !== null) {
      if (error.message.includes('ADMIN_IDEMPOTENCY_CONFLICT')) {
        throw new AdminAuditIdempotencyConflictError();
      }
      throw new AdminAuditGatewayUnavailableError();
    }
    return parseEntry(data);
  }

  public async list(input: ListAdminAuditInput): Promise<readonly AdminAuditEntry[]> {
    const { data, error } = await this.client.rpc('list_admin_audit', {
      p_resource_type: input.resourceType,
      p_resource_id: input.resourceId,
      p_actor_id: input.actorId,
      p_limit: input.limit,
    });
    if (error !== null || !Array.isArray(data)) {
      throw new AdminAuditGatewayUnavailableError();
    }
    return data.map(parseEntry);
  }
}
