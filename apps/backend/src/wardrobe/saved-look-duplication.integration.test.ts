import { describe, expect, it } from 'vitest';
import { parseDuplicateSavedLookName } from './saved-look.validation';

describe('saved look duplication contract', () => {
  it('uses the source name when name is omitted or null', () => {
    expect(parseDuplicateSavedLookName({})).toBeNull();
    expect(parseDuplicateSavedLookName({ name: null })).toBeNull();
  });
  it('normalizes an explicit replacement name', () => {
    expect(parseDuplicateSavedLookName({ name: ' Copy ' })).toBe('Copy');
  });
});
