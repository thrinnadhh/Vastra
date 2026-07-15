import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  AuthenticatedHttpRequest,
  AuthenticatedRequestContext,
} from '../auth/auth.types';
import { WardrobeUploadController } from './wardrobe-upload.controller';
import type { WardrobeUploadGateway } from './wardrobe-upload.gateway';
import { WardrobeUploadService } from './wardrobe-upload.service';
import { WARDROBE_UPLOAD_GATEWAY } from './wardrobe-upload.tokens';
import type {
  CreateWardrobeUploadIntentInput,
  WardrobeUploadIntentRecord,
} from './wardrobe-upload.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '90000000-0000-4000-8000-000000000001';
const UPLOAD_ID = '80000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
  supabase: emptyClient,
};

class IntegrationWardrobeUploadGateway implements WardrobeUploadGateway {
  public createIntent(
    actorId: string,
    input: CreateWardrobeUploadIntentInput,
  ): Promise<WardrobeUploadIntentRecord> {
    const extension = input.contentType === 'image/jpeg' ? 'jpg' : 'webp';

    return Promise.resolve({
      uploadId: UPLOAD_ID,
      objectKey: `${actorId}/${UPLOAD_ID}.${extension}`,
      expiresAt: '2099-07-15T18:00:00.000Z',
      replayed: false,
    });
  }

  public createSignedUploadUrl(): Promise<string> {
    return Promise.resolve('https://storage.example.test/signed-upload');
  }
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();

  if (!isHttpServer(server)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }

  return server;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} object`);
  }

  return value as Record<string, unknown>;
}

function readErrorCode(body: unknown): string {
  const error = requireRecord(requireRecord(body, 'response')['error'], 'response error');
  const code = error['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('wardrobe upload intent integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [WardrobeUploadController],
      providers: [
        WardrobeUploadService,
        {
          provide: WARDROBE_UPLOAD_GATEWAY,
          useValue: new IntegrationWardrobeUploadGateway(),
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, response: unknown, next: () => void): void => {
        void response;
        incomingRequest.authContext = context;
        next();
      },
    );

    app = application;
    await application.init();
    httpServer = requireHttpServer(application);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('returns the canonical bare upload-intent response', async () => {
    const response = await request(httpServer)
      .post('/customer/wardrobe/upload-intents')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        contentType: 'image/webp',
        contentLength: 4096,
      });

    expect(response.status).toBe(201);
    expect(response.body).toStrictEqual({
      uploadId: UPLOAD_ID,
      uploadUrl: 'https://storage.example.test/signed-upload',
      expiresAt: '2099-07-15T18:00:00.000Z',
    });
    expect(response.body).not.toHaveProperty('objectKey');
  });

  it('rejects a missing idempotency key', async () => {
    const response = await request(httpServer)
      .post('/customer/wardrobe/upload-intents')
      .send({
        contentType: 'image/webp',
        contentLength: 4096,
      });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects unsupported media', async () => {
    const response = await request(httpServer)
      .post('/customer/wardrobe/upload-intents')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        contentType: 'image/gif',
        contentLength: 4096,
      });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });
});
