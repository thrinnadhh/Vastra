import { Controller, Get, type INestApplication, type LoggerService, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendBootstrapConfiguration } from './bootstrap.configuration';
import { configureBackendApplication } from './configure-application';

const configuration: BackendBootstrapConfiguration = {
  port: 3000,
  corsAllowedOrigins: ['http://localhost:3000'],
};

const logger: LoggerService = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

@Controller('probe')
class ProbeController {
  @Get()
  public readProbe() {
    return {
      success: true,
      data: { status: 'ok' },
      meta: { requestId: '' },
    };
  }

  @Get('failure')
  public failProbe(): never {
    throw new Error('sensitive implementation detail');
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('configured backend application', () => {
  let application: INestApplication;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    application = module.createNestApplication();
    configureBackendApplication(application, configuration, logger);
    await application.init();
  });

  afterEach(async () => {
    await application.close();
  });

  it('serves endpoints under /v1 with request IDs and security headers', async () => {
    await request(application.getHttpServer()).get('/probe').expect(404);

    const response = await request(application.getHttpServer()).get('/v1/probe').expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'ok' },
      meta: { requestId: response.headers['x-request-id'] },
    });
  });

  it('preserves a valid caller-provided request ID', async () => {
    const requestId = 'ca2fe0f8-4c1c-4d1b-b4d7-3cbf22a76235';
    const response = await request(application.getHttpServer())
      .get('/v1/probe')
      .set('X-Request-Id', requestId)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(requestId);
    expect(response.body.meta.requestId).toBe(requestId);
  });

  it('returns a safe error response without leaking internal details', async () => {
    const response = await request(application.getHttpServer())
      .get('/v1/probe/failure')
      .expect(500);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        details: null,
        retryable: false,
      },
      requestId: response.headers['x-request-id'],
    });
    expect(JSON.stringify(response.body)).not.toContain('sensitive implementation detail');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http.request.failed',
        requestId: response.headers['x-request-id'],
        statusCode: 500,
      }),
    );
  });
});
