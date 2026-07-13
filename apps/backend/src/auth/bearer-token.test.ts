import { describe, expect, it } from 'vitest';

import { extractBearerToken } from './bearer-token';

describe('extractBearerToken', () => {
  it('extracts a bearer token case-insensitively', () => {
    expect(extractBearerToken('bearer access-token-value')).toBe('access-token-value');
  });

  it('accepts surrounding header whitespace', () => {
    expect(extractBearerToken('   Bearer access-token-value   ')).toBe('access-token-value');
  });

  it.each([
    undefined,
    '',
    'Basic credentials',
    'Bearer',
    'Bearer ',
    'Bearer first second',
    ['Bearer first', 'Bearer second'],
  ])('rejects malformed authorization input', (value) => {
    expect(extractBearerToken(value)).toBeNull();
  });
});
