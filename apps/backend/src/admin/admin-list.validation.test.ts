import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  AdminListQueryInvalidError,
  encodeAdminListCursor,
  parseAdminListCursor,
  parseAdminListLimit,
  parseAdminOptionalSearch,
} from './admin-list.validation';

const ID = '10000000-0000-4000-8000-000000000001';
const UPDATED_AT = '2026-07-26T00:00:00.000Z';

describe('admin list validation', () => {
  it('round-trips an opaque keyset cursor', () => {
    const cursor = { updatedAt: UPDATED_AT, id: ID };
    expect(parseAdminListCursor(encodeAdminListCursor(cursor))).toStrictEqual(cursor);
  });

  it('rejects malformed or oversized cursors', () => {
    expect(() => parseAdminListCursor('not-base64-json')).toThrow(AdminListQueryInvalidError);
    expect(() => parseAdminListCursor('x'.repeat(513))).toThrow(AdminListQueryInvalidError);
    expect(() =>
      parseAdminListCursor(
        Buffer.from(JSON.stringify({ updatedAt: 'bad-date', id: ID })).toString('base64url'),
      ),
    ).toThrow(AdminListQueryInvalidError);
  });

  it('uses bounded defaults for limits and search terms', () => {
    expect(parseAdminListLimit(undefined)).toBe(25);
    expect(() => parseAdminListLimit('101')).toThrow(AdminListQueryInvalidError);
    expect(parseAdminOptionalSearch('  Vastra  ')).toBe('Vastra');
    expect(() => parseAdminOptionalSearch('x')).toThrow(AdminListQueryInvalidError);
  });
});
