import { describe, expect, it } from 'vitest';

import { createApiClientForTesting } from '../src/client.js';
import { ApiClientError } from '../src/errors.js';
import type { ApiClientLogEvent, FetchRequestInitLike } from '../src/types.js';
import {
  TEST_OPERATIONS,
  TEST_SCHEMAS,
  clientOptions,
  errorPayload,
  response,
  successPayload,
} from './fixtures.js';

const expectKind = async (promise: Promise<unknown>, kind: string): Promise<void> => {
  try {
    await promise;
    throw new Error('Expected request to fail');
  } catch (cause) {
    expect(cause).toBeInstanceOf(ApiClientError);
    expect((cause as ApiClientError).normalized.kind).toBe(kind);
  }
};

describe('typed API transport', () => {
  it('injects bearer auth, protects reserved headers, builds path/query, and propagates request IDs', async () => {
    const calls: Array<Readonly<{ url: string; init: FetchRequestInitLike }>> = [];
    const client = createApiClientForTesting(
      clientOptions(async (url, init) => {
        calls.push({ url, init });
        return response(200, successPayload('payload-request-id'), {
          'x-request-id': 'header-request-id',
        });
      }),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );

    const result = await client.request('getWidget', {
      path: { widgetId: 'widget/1' },
      query: { z: 2, a: ['first', 'second'] },
      headers: {
        Authorization: 'attacker-token',
        Cookie: 'session=secret',
        'X-Request-Id': 'attacker-request-id',
        'Idempotency-Key': 'safe-command-id',
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'https://api.example.test/v1/widgets/widget%2F1?a=first&a=second&z=2',
    );
    expect(calls[0]?.init.headers['Authorization']).toBe('Bearer access-token');
    expect(calls[0]?.init.headers['X-Request-Id']).toBe('client-request-id');
    expect(calls[0]?.init.headers['Cookie']).toBeUndefined();
    expect(calls[0]?.init.headers['Idempotency-Key']).toBe('safe-command-id');
    expect(result.requestId).toBe('header-request-id');
    expect(result.status).toBe(200);
    expect(result.data).toEqual(successPayload('payload-request-id'));
  });

  it('returns an authentication error before fetch when a required token is missing', async () => {
    let called = false;
    const client = createApiClientForTesting(
      clientOptions(
        async () => {
          called = true;
          return response(200, successPayload());
        },
        { accessTokenProvider: { getAccessToken: () => null } },
      ),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );

    await expectKind(client.request('getWidget', { path: { widgetId: '1' } }), 'AUTHENTICATION');
    expect(called).toBe(false);
  });

  it('permits explicitly public operations without a session', async () => {
    const client = createApiClientForTesting(
      clientOptions(async () => response(200, successPayload()), {
        accessTokenProvider: { getAccessToken: () => null },
      }),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );

    await expect(client.request('publicWidget', {})).resolves.toMatchObject({ status: 200 });
  });

  it('classifies malformed success and error envelopes as contract failures', async () => {
    const successClient = createApiClientForTesting(
      clientOptions(async () => response(200, { success: true })),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );
    await expectKind(successClient.request('getWidget', { path: { widgetId: '1' } }), 'CONTRACT');

    const errorClient = createApiClientForTesting(
      clientOptions(async () => response(500, { error: 'malformed' })),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );
    await expectKind(errorClient.request('getWidget', { path: { widgetId: '1' } }), 'CONTRACT');
  });

  it('normalizes transport failures separately from timeouts', async () => {
    const transportClient = createApiClientForTesting(
      clientOptions(async () => {
        throw new TypeError('network down');
      }),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );
    await expectKind(
      transportClient.request('getWidget', { path: { widgetId: '1' } }),
      'TRANSPORT',
    );

    const timeoutClient = createApiClientForTesting(
      clientOptions(async () => await new Promise(() => undefined)),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );
    await expectKind(
      timeoutClient.request(
        'updateWidget',
        { path: { widgetId: '1' }, body: { name: 'new' } },
        { timeoutMs: 1 },
      ),
      'TIMEOUT',
    );
  });

  it('normalizes a valid API error and allowlists validation fields', async () => {
    const client = createApiClientForTesting(
      clientOptions(async () =>
        response(
          422,
          errorPayload('INVALID_INPUT', {
            details: {
              fieldErrors: {
                name: ['Required'],
                phoneNumber: ['must never escape'],
              },
            },
          }),
          { 'x-request-id': 'safe-response-id' },
        ),
      ),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );

    try {
      await client.request(
        'getWidget',
        { path: { widgetId: '1' } },
        { allowedFieldErrors: ['name'] },
      );
      throw new Error('Expected validation failure');
    } catch (cause) {
      const normalized = (cause as ApiClientError).normalized;
      expect(normalized.kind).toBe('VALIDATION');
      expect(normalized.requestId).toBe('safe-response-id');
      expect(normalized.fieldErrors).toEqual({ name: ['Required'] });
    }
  });

  it('emits only structured allowlisted diagnostics', async () => {
    const events: ApiClientLogEvent[] = [];
    const client = createApiClientForTesting(
      clientOptions(async () => response(500, errorPayload('SERVICE_DOWN', { retryable: true })), {
        logger: { log: (event) => events.push(event) },
        actor: 'merchant',
        appVersion: '1.2.3',
      }),
      TEST_OPERATIONS,
      TEST_SCHEMAS,
    );

    await expectKind(client.request('getWidget', { path: { widgetId: '1' } }), 'API');
    expect(events.map((event) => event.phase)).toEqual(['request', 'failure']);
    expect(JSON.stringify(events)).not.toContain('access-token');
    expect(JSON.stringify(events)).not.toContain('widgetId');
    expect(Object.keys(events[0] ?? {}).sort()).toEqual(
      [
        'actor',
        'appVersion',
        'attempt',
        'code',
        'durationMs',
        'kind',
        'operationId',
        'phase',
        'requestId',
        'status',
      ].sort(),
    );
  });
});
