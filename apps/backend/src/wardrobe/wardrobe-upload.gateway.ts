import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CreateWardrobeUploadIntentInput,
  WardrobeUploadIntentRecord,
} from './wardrobe-upload.types';
import { extensionForWardrobeContentType } from './wardrobe-upload.validation';

const WARDROBE_MEDIA_BUCKET = 'wardrobe-media';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface WardrobeUploadGateway {
  createIntent(
    actorId: string,
    input: CreateWardrobeUploadIntentInput,
  ): Promise<WardrobeUploadIntentRecord>;

  createSignedUploadUrl(objectKey: string): Promise<string>;
}

export class WardrobeUploadGatewayUnavailableError extends Error {
  public constructor() {
    super('Wardrobe upload provider unavailable');
    this.name = 'WardrobeUploadGatewayUnavailableError';
  }
}

export class WardrobeUploadDataInvalidError extends Error {
  public constructor() {
    super('Wardrobe upload data invalid');
    this.name = 'WardrobeUploadDataInvalidError';
  }
}

export class WardrobeUploadIdempotencyConflictError extends Error {
  public constructor() {
    super('Wardrobe upload idempotency conflict');
    this.name = 'WardrobeUploadIdempotencyConflictError';
  }
}

export class WardrobeUploadAccessDeniedError extends Error {
  public constructor() {
    super('Wardrobe upload access denied');
    this.name = 'WardrobeUploadAccessDeniedError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new WardrobeUploadDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new WardrobeUploadDataInvalidError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new WardrobeUploadDataInvalidError();
  }

  return value;
}

function parseIntentRecord(
  value: unknown,
  actorId: string,
  input: CreateWardrobeUploadIntentInput,
): WardrobeUploadIntentRecord {
  if (!isRecord(value)) {
    throw new WardrobeUploadDataInvalidError();
  }

  const uploadId = requireString(value, 'uploadId').toLowerCase();
  const objectKey = requireString(value, 'objectKey');
  const extension = extensionForWardrobeContentType(input.contentType);
  const expectedObjectKey = `${actorId}/${uploadId}.${extension}`;

  if (!UUID_PATTERN.test(uploadId) || objectKey !== expectedObjectKey) {
    throw new WardrobeUploadDataInvalidError();
  }

  return {
    uploadId,
    objectKey,
    expiresAt: requireTimestamp(value, 'expiresAt'),
    replayed: requireBoolean(value, 'replayed'),
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  if (error.code === undefined) {
    return new WardrobeUploadGatewayUnavailableError();
  }

  switch (error.code) {
    case 'P0010':
      return new WardrobeUploadIdempotencyConflictError();
    case '42501':
      return new WardrobeUploadAccessDeniedError();
    case '22023':
      return new WardrobeUploadDataInvalidError();
    default:
      return new WardrobeUploadGatewayUnavailableError();
  }
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof WardrobeUploadGatewayUnavailableError ||
    error instanceof WardrobeUploadDataInvalidError ||
    error instanceof WardrobeUploadIdempotencyConflictError ||
    error instanceof WardrobeUploadAccessDeniedError
  ) {
    throw error;
  }

  throw new WardrobeUploadGatewayUnavailableError();
}

@Injectable()
export class SupabaseWardrobeUploadGateway implements WardrobeUploadGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async createIntent(
    actorId: string,
    input: CreateWardrobeUploadIntentInput,
  ): Promise<WardrobeUploadIntentRecord> {
    try {
      const response = await this.trustedClient.rpc('create_wardrobe_upload_intent', {
        p_actor: actorId,
        p_idempotency_key: input.idempotencyKey,
        p_content_type: input.contentType,
        p_content_length: input.contentLength,
      });

      if (response.error !== null) {
        throw mapRpcError(response.error);
      }

      return parseIntentRecord(response.data, actorId, input);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async createSignedUploadUrl(objectKey: string): Promise<string> {
    try {
      const response = await this.trustedClient.storage
        .from(WARDROBE_MEDIA_BUCKET)
        .createSignedUploadUrl(objectKey, { upsert: false });

      if (response.data === null) {
        throw new WardrobeUploadGatewayUnavailableError();
      }

      return response.data.signedUrl;
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
