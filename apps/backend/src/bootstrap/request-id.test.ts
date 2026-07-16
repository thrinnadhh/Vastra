import { describe, expect, it } from 'vitest';

import { attachRequestIdToPayload, resolveRequestId } from './request-id';

const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('request identifiers', () => {
  it('preserves a valid caller-provided UUID', () => {
    expect(resolveRequestId({ 'x-request-id': REQUEST_ID.toUpperCase() })).toBe(REQUEST_ID);
  });

  it('replaces missing and malformed identifiers', () => {
    expect(resolveRequestId({})).toMatch(/^[0-9a-f-]{36}$/u);
    expect(resolveRequestId({ 'x-request-id': 'not-a-uuid' })).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it('attaches the identifier to success metadata without mutating the source', () => {
    const source = { success: true, data: {}, meta: { requestId: null } };

    expect(attachRequestIdToPayload(source, REQUEST_ID)).toStrictEqual({
      success: true,
      data: {},
      meta: { requestId: REQUEST_ID },
    });
    expect(source.meta.requestId).toBeNull();
  });

  it('attaches the identifier to error payloads', () => {
    expect(
      attachRequestIdToPayload(
        { success: false, error: { code: 'VALIDATION_ERROR' }, requestId: null },
        REQUEST_ID,
      ),
    ).toStrictEqual({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
      requestId: REQUEST_ID,
    });
  });
});
