import { describe, expect, it } from 'vitest';

import { writeClientLog, type LogContext } from '../src/logging.js';
import type { ApiClientLogEvent } from '../src/types.js';

describe('structured client logging', () => {
  it('uses a strict allowlist even when an unsafe object reaches the boundary', () => {
    const events: ApiClientLogEvent[] = [];
    const unsafe = {
      phase: 'failure',
      operationId: 'placeOrder',
      kind: 'TIMEOUT',
      code: 'TIMEOUT',
      status: null,
      requestId: 'request-id',
      attempt: 2,
      durationMs: 150,
      actor: 'customer',
      appVersion: '1.0.0',
      token: 'secret-token',
      cookie: 'secret-cookie',
      idempotencyKey: 'secret-key',
      otp: '123456',
      pickupCode: '9988',
      coordinates: [1, 2],
      phoneNumber: '9999999999',
      address: 'private',
      notes: 'private',
      queryKey: ['private'],
      mutationVariables: { private: true },
      providerPayload: { private: true },
      rawResponseBody: { private: true },
    } as unknown as LogContext;

    writeClientLog({ log: (event) => events.push(event) }, unsafe);
    writeClientLog(undefined, unsafe);

    expect(events).toHaveLength(1);
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
    expect(JSON.stringify(events[0])).not.toContain('secret');
    expect(JSON.stringify(events[0])).not.toContain('9999999999');
  });
});
