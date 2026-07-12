import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module';

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected the HTTP response body to be a JSON object');
  }

  return value as Record<string, unknown>;
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(app: INestApplication): Server {
  const server: unknown = app.getHttpServer();

  if (!isHttpServer(server)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }

  return server;
}

describe('Health endpoint integration', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    await app.init();

    httpServer = requireHttpServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves health metadata through the HTTP application', async () => {
    const response = await request(httpServer).get('/health');
    const responseBody: unknown = response.body;
    const body = requireRecord(responseBody);

    expect(response.status).toBe(200);
    expect(response.type).toBe('application/json');
    expect(Object.keys(body).length).toBeGreaterThan(0);
  });

  it('does not expose credential fields in the HTTP response', async () => {
    const response = await request(httpServer).get('/health');
    const responseBody: unknown = response.body;
    const body = requireRecord(responseBody);
    const normalizedBody = JSON.stringify(body).toLowerCase();

    expect(response.status).toBe(200);
    expect(normalizedBody).not.toContain('password');
    expect(normalizedBody).not.toContain('service_role');
    expect(normalizedBody).not.toContain('private_key');
    expect(normalizedBody).not.toContain('database_url');
    expect(normalizedBody).not.toContain('access_token');
  });

  it('returns not found for an undefined route', async () => {
    const response = await request(httpServer).get('/undefined-foundation-route');
    const responseBody: unknown = response.body;
    const body = requireRecord(responseBody);

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      statusCode: 404,
    });
  });
});
