import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type WardrobeUploadGateway,
  WardrobeUploadGatewayUnavailableError,
  WardrobeUploadIdempotencyConflictError,
} from './wardrobe-upload.gateway';
import { WardrobeUploadService } from './wardrobe-upload.service';
import type {
  CreateWardrobeUploadIntentInput,
  WardrobeUploadIntentRecord,
} from './wardrobe-upload.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '90000000-0000-4000-8000-000000000001';
const UPLOAD_ID = '80000000-0000-4000-8000-000000000001';
const OBJECT_KEY = `${ACTOR_ID}/${UPLOAD_ID}.webp`;
const EXPIRES_AT = '2099-07-15T18:00:00.000Z';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

function createContext(): AuthenticatedRequestContext {
  return {
    actor: {
      id: ACTOR_ID,
      email: 'customer@example.test',
      accountType: 'CUSTOMER',
      status: 'ACTIVE',
    },
    accessToken: 'customer-token',
    supabase: emptyClient,
  };
}

class RecordingWardrobeUploadGateway implements WardrobeUploadGateway {
  public lastActorId: string | null = null;
  public lastInput: CreateWardrobeUploadIntentInput | null = null;
  public conflict = false;
  public unavailable = false;
  public signedObjectKey: string | null = null;

  public createIntent(
    actorId: string,
    input: CreateWardrobeUploadIntentInput,
  ): Promise<WardrobeUploadIntentRecord> {
    this.lastActorId = actorId;
    this.lastInput = input;

    if (this.conflict) {
      return Promise.reject(new WardrobeUploadIdempotencyConflictError());
    }

    if (this.unavailable) {
      return Promise.reject(new WardrobeUploadGatewayUnavailableError());
    }

    return Promise.resolve({
      uploadId: UPLOAD_ID,
      objectKey: OBJECT_KEY,
      expiresAt: EXPIRES_AT,
      replayed: false,
    });
  }

  public createSignedUploadUrl(objectKey: string): Promise<string> {
    this.signedObjectKey = objectKey;

    if (this.unavailable) {
      return Promise.reject(new WardrobeUploadGatewayUnavailableError());
    }

    return Promise.resolve('https://storage.example.test/signed-upload');
  }
}

function requireHttpErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected object response');
  }

  const bodyError = (response as Record<string, unknown>)['error'];

  if (typeof bodyError !== 'object' || bodyError === null || Array.isArray(bodyError)) {
    throw new TypeError('Expected error object');
  }

  const code = (bodyError as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('WardrobeUploadService', () => {
  let gateway: RecordingWardrobeUploadGateway;
  let service: WardrobeUploadService;

  beforeEach(() => {
    gateway = new RecordingWardrobeUploadGateway();
    service = new WardrobeUploadService(gateway);
  });

  it('creates an owner-scoped private upload intent', async () => {
    const result = await service.createUploadIntent(createContext(), IDEMPOTENCY_KEY, {
      contentType: 'image/webp',
      contentLength: 2048,
    });

    expect(result).toStrictEqual({
      uploadId: UPLOAD_ID,
      uploadUrl: 'https://storage.example.test/signed-upload',
      expiresAt: EXPIRES_AT,
    });
    expect(gateway.lastActorId).toBe(ACTOR_ID);
    expect(gateway.signedObjectKey).toBe(OBJECT_KEY);
    expect(gateway.lastInput).toStrictEqual({
      contentType: 'image/webp',
      contentLength: 2048,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });

  it('requires an idempotency key', async () => {
    await expect(
      service.createUploadIntent(createContext(), undefined, {
        contentType: 'image/webp',
        contentLength: 2048,
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'IDEMPOTENCY_KEY_REQUIRED',
    );
  });

  it('rejects unsupported media and excessive sizes', async () => {
    await expect(
      service.createUploadIntent(createContext(), IDEMPOTENCY_KEY, {
        contentType: 'image/gif',
        contentLength: 20 * 1024 * 1024,
      }),
    ).rejects.toSatisfy((error: unknown) => requireHttpErrorCode(error) === 'VALIDATION_ERROR');
  });

  it('maps an idempotency mismatch to conflict', async () => {
    gateway.conflict = true;

    await expect(
      service.createUploadIntent(createContext(), IDEMPOTENCY_KEY, {
        contentType: 'image/webp',
        contentLength: 2048,
      }),
    ).rejects.toSatisfy((error: unknown) => requireHttpErrorCode(error) === 'IDEMPOTENCY_CONFLICT');
  });

  it('maps storage failures to a retryable provider error', async () => {
    gateway.unavailable = true;

    await expect(
      service.createUploadIntent(createContext(), IDEMPOTENCY_KEY, {
        contentType: 'image/webp',
        contentLength: 2048,
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });
});
