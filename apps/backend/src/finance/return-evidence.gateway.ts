import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  AssignReturnPickupInput,
  ReturnEvidenceRecord,
  ReturnEvidenceUploadIntent,
  ReturnPickupResult,
} from './return-evidence.types';

const RETURN_EVIDENCE_BUCKET = 'return-evidence';

export interface ReturnEvidenceGateway {
  createUploadIntent(
    actorId: string,
    returnId: string,
    intentId: string,
    objectKey: string,
    evidenceType: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<ReturnEvidenceUploadIntent>;
  createSignedUploadUrl(objectKey: string): Promise<string>;
  objectExists(objectKey: string): Promise<boolean>;
  finalize(
    actorId: string,
    returnId: string,
    objectKey: string,
    description: string | null,
  ): Promise<ReturnEvidenceRecord>;
  getOwnedObjectKey(actorId: string, returnId: string, evidenceId: string): Promise<string | null>;
  createSignedReadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
  assignPickup(
    actorId: string,
    returnId: string,
    input: AssignReturnPickupInput,
  ): Promise<ReturnPickupResult>;
}

export class ReturnEvidenceGatewayUnavailableError extends Error {}
export class ReturnEvidenceStateConflictError extends Error {}
export class ReturnEvidenceNotFoundError extends Error {}
export class ReturnPickupIdempotencyConflictError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ReturnEvidenceGatewayUnavailableError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ReturnEvidenceGatewayUnavailableError();
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ReturnEvidenceGatewayUnavailableError();
  }
  return value;
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') throw new ReturnEvidenceGatewayUnavailableError();
  return value;
}

function parseIntent(value: unknown): ReturnEvidenceUploadIntent {
  const record = requireRecord(value);
  return {
    intentId: requireString(record, 'intentId'),
    returnId: requireString(record, 'returnId'),
    objectKey: requireString(record, 'objectKey'),
    evidenceType: requireString(record, 'evidenceType') as ReturnEvidenceUploadIntent['evidenceType'],
    mimeType: requireString(record, 'mimeType') as ReturnEvidenceUploadIntent['mimeType'],
    sizeBytes: requireNumber(record, 'sizeBytes'),
    expiresAt: requireString(record, 'expiresAt'),
  };
}

function parseEvidence(value: unknown): ReturnEvidenceRecord {
  const record = requireRecord(value);
  return {
    evidenceId: requireString(record, 'evidenceId'),
    returnId: requireString(record, 'returnId'),
    evidenceType: requireString(record, 'evidenceType') as ReturnEvidenceRecord['evidenceType'],
    objectKey: requireString(record, 'objectKey'),
    mimeType: requireString(record, 'mimeType') as ReturnEvidenceRecord['mimeType'],
    sizeBytes: requireNumber(record, 'sizeBytes'),
    description: nullableString(record, 'description'),
    createdAt: requireString(record, 'createdAt'),
  };
}

@Injectable()
export class SupabaseReturnEvidenceGateway implements ReturnEvidenceGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) {
      throw new ReturnPickupIdempotencyConflictError();
    }
    if (message.includes('FINANCE_RETURN_NOT_FOUND')) throw new ReturnEvidenceNotFoundError();
    if (message.includes('FINANCE_RETURN_STATE_CONFLICT')) {
      throw new ReturnEvidenceStateConflictError();
    }
    throw new ReturnEvidenceGatewayUnavailableError();
  }

  public async createUploadIntent(
    actorId: string,
    returnId: string,
    intentId: string,
    objectKey: string,
    evidenceType: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<ReturnEvidenceUploadIntent> {
    const { data, error } = await this.client.rpc('create_customer_return_evidence_intent', {
      p_actor_id: actorId,
      p_return_id: returnId,
      p_intent_id: intentId,
      p_object_key: objectKey,
      p_evidence_type: evidenceType,
      p_mime_type: mimeType,
      p_size_bytes: sizeBytes,
    });
    if (error !== null) this.mapError(error.message);
    return parseIntent(data);
  }

  public async createSignedUploadUrl(objectKey: string): Promise<string> {
    const response = await this.client.storage
      .from(RETURN_EVIDENCE_BUCKET)
      .createSignedUploadUrl(objectKey, { upsert: false });
    if (response.data === null) throw new ReturnEvidenceGatewayUnavailableError();
    return response.data.signedUrl;
  }

  public async objectExists(objectKey: string): Promise<boolean> {
    const separatorIndex = objectKey.lastIndexOf('/');
    if (separatorIndex < 1 || separatorIndex === objectKey.length - 1) {
      throw new ReturnEvidenceGatewayUnavailableError();
    }
    const response = await this.client.storage.from(RETURN_EVIDENCE_BUCKET).list(
      objectKey.slice(0, separatorIndex),
      { limit: 10, search: objectKey.slice(separatorIndex + 1) },
    );
    if (response.data === null) throw new ReturnEvidenceGatewayUnavailableError();
    return response.data.some((entry) => entry.name === objectKey.slice(separatorIndex + 1));
  }

  public async finalize(
    actorId: string,
    returnId: string,
    objectKey: string,
    description: string | null,
  ): Promise<ReturnEvidenceRecord> {
    const { data, error } = await this.client.rpc('finalize_customer_return_evidence', {
      p_actor_id: actorId,
      p_return_id: returnId,
      p_object_key: objectKey,
      p_description: description,
    });
    if (error !== null) this.mapError(error.message);
    return parseEvidence(data);
  }

  public async getOwnedObjectKey(
    actorId: string,
    returnId: string,
    evidenceId: string,
  ): Promise<string | null> {
    const { data, error } = await this.client.rpc('get_customer_return_evidence_object', {
      p_actor_id: actorId,
      p_return_id: returnId,
      p_evidence_id: evidenceId,
    });
    if (error !== null) this.mapError(error.message);
    if (data === null) return null;
    const record = requireRecord(data);
    return requireString(record, 'objectKey');
  }

  public async createSignedReadUrl(objectKey: string, expiresInSeconds: number): Promise<string> {
    const response = await this.client.storage
      .from(RETURN_EVIDENCE_BUCKET)
      .createSignedUrl(objectKey, expiresInSeconds);
    if (response.data === null) throw new ReturnEvidenceGatewayUnavailableError();
    return response.data.signedUrl;
  }

  public async assignPickup(
    actorId: string,
    returnId: string,
    input: AssignReturnPickupInput,
  ): Promise<ReturnPickupResult> {
    const { data, error } = await this.client.rpc('admin_assign_return_pickup', {
      p_actor_id: actorId,
      p_return_id: returnId,
      p_scheduled_at: input.scheduledAt,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) this.mapError(error.message);
    return requireRecord(data);
  }
}
