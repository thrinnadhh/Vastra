import { describe, expect, it } from 'vitest';

import {
  isRecord,
  nullableNumber,
  nullableString,
  nullableTimestamp,
  parseNumeric,
  requireBoolean,
  requireNonNegativeInteger,
  requireNumber,
  requirePositiveInteger,
  requireRecord,
  requireString,
  requireTimestamp,
  requireUuid,
} from './record-parser';

class TestParseError extends Error {
  public constructor() {
    super('test parse error');
    this.name = 'TestParseError';
  }
}

describe('record-parser', () => {
  describe('isRecord', () => {
    it('returns true for plain objects', () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
    });

    it('returns false for non-objects', () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord(undefined)).toBe(false);
      expect(isRecord(42)).toBe(false);
      expect(isRecord('string')).toBe(false);
      expect(isRecord([])).toBe(false);
      expect(isRecord([1, 2])).toBe(false);
    });
  });

  describe('requireRecord', () => {
    it('returns the record for valid objects', () => {
      const obj = { key: 'value' };
      expect(requireRecord(obj, TestParseError)).toBe(obj);
    });

    it('throws the provided error class for non-records', () => {
      expect(() => requireRecord(null, TestParseError)).toThrow(TestParseError);
      expect(() => requireRecord([], TestParseError)).toThrow(TestParseError);
      expect(() => requireRecord('string', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('requireString', () => {
    it('extracts a string value', () => {
      expect(requireString({ name: 'hello' }, 'name', TestParseError)).toBe('hello');
    });

    it('throws on empty strings', () => {
      expect(() => requireString({ name: '' }, 'name', TestParseError)).toThrow(TestParseError);
      expect(() => requireString({ name: '  ' }, 'name', TestParseError)).toThrow(TestParseError);
    });

    it('throws on non-string values', () => {
      expect(() => requireString({ name: 42 }, 'name', TestParseError)).toThrow(TestParseError);
      expect(() => requireString({ name: null }, 'name', TestParseError)).toThrow(TestParseError);
      expect(() => requireString({}, 'name', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('nullableString', () => {
    it('extracts a string value', () => {
      expect(nullableString({ name: 'hello' }, 'name', TestParseError)).toBe('hello');
    });

    it('returns null for null or undefined', () => {
      expect(nullableString({ name: null }, 'name', TestParseError)).toBeNull();
      expect(nullableString({}, 'name', TestParseError)).toBeNull();
    });

    it('throws on non-string, non-null values', () => {
      expect(() => nullableString({ name: 42 }, 'name', TestParseError)).toThrow(TestParseError);
      expect(() => nullableString({ name: true }, 'name', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('requireBoolean', () => {
    it('extracts boolean values', () => {
      expect(requireBoolean({ active: true }, 'active', TestParseError)).toBe(true);
      expect(requireBoolean({ active: false }, 'active', TestParseError)).toBe(false);
    });

    it('throws on non-boolean values', () => {
      expect(() => requireBoolean({ active: 'true' }, 'active', TestParseError)).toThrow(
        TestParseError,
      );
      expect(() => requireBoolean({ active: 1 }, 'active', TestParseError)).toThrow(
        TestParseError,
      );
      expect(() => requireBoolean({}, 'active', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('parseNumeric', () => {
    it('returns numbers as-is', () => {
      expect(parseNumeric(42)).toBe(42);
      expect(parseNumeric(3.14)).toBe(3.14);
      expect(parseNumeric(0)).toBe(0);
      expect(parseNumeric(-10)).toBe(-10);
    });

    it('coerces numeric strings', () => {
      expect(parseNumeric('42')).toBe(42);
      expect(parseNumeric('3.14')).toBe(3.14);
      expect(parseNumeric('0')).toBe(0);
    });

    it('returns NaN for non-numeric values', () => {
      expect(parseNumeric(null)).toBeNaN();
      expect(parseNumeric(undefined)).toBeNaN();
      expect(parseNumeric('')).toBeNaN();
      expect(parseNumeric('  ')).toBeNaN();
      expect(parseNumeric('abc')).toBeNaN();
      expect(parseNumeric(true)).toBeNaN();
    });
  });

  describe('requireNumber', () => {
    it('extracts finite numbers', () => {
      expect(requireNumber({ price: 100 }, 'price', TestParseError)).toBe(100);
      expect(requireNumber({ price: '200' }, 'price', TestParseError)).toBe(200);
    });

    it('throws on non-finite values', () => {
      expect(() => requireNumber({ price: Infinity }, 'price', TestParseError)).toThrow(
        TestParseError,
      );
      expect(() => requireNumber({ price: 'abc' }, 'price', TestParseError)).toThrow(
        TestParseError,
      );
      expect(() => requireNumber({}, 'price', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('nullableNumber', () => {
    it('extracts numbers', () => {
      expect(nullableNumber({ v: 42 }, 'v', TestParseError)).toBe(42);
    });

    it('returns null for null or undefined', () => {
      expect(nullableNumber({ v: null }, 'v', TestParseError)).toBeNull();
      expect(nullableNumber({}, 'v', TestParseError)).toBeNull();
    });

    it('throws on non-numeric, non-null values', () => {
      expect(() => nullableNumber({ v: 'abc' }, 'v', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('requireNonNegativeInteger', () => {
    it('extracts non-negative integers', () => {
      expect(requireNonNegativeInteger({ qty: 0 }, 'qty', TestParseError)).toBe(0);
      expect(requireNonNegativeInteger({ qty: 5 }, 'qty', TestParseError)).toBe(5);
      expect(requireNonNegativeInteger({ qty: '10' }, 'qty', TestParseError)).toBe(10);
    });

    it('throws on negative values', () => {
      expect(() => requireNonNegativeInteger({ qty: -1 }, 'qty', TestParseError)).toThrow(
        TestParseError,
      );
    });

    it('throws on floating-point values', () => {
      expect(() => requireNonNegativeInteger({ qty: 1.5 }, 'qty', TestParseError)).toThrow(
        TestParseError,
      );
    });

    it('throws on unsafe integers', () => {
      expect(() =>
        requireNonNegativeInteger(
          { qty: Number.MAX_SAFE_INTEGER + 1 },
          'qty',
          TestParseError,
        ),
      ).toThrow(TestParseError);
    });
  });

  describe('requirePositiveInteger', () => {
    it('extracts positive integers', () => {
      expect(requirePositiveInteger({ qty: 1 }, 'qty', TestParseError)).toBe(1);
      expect(requirePositiveInteger({ qty: 100 }, 'qty', TestParseError)).toBe(100);
    });

    it('throws on zero', () => {
      expect(() => requirePositiveInteger({ qty: 0 }, 'qty', TestParseError)).toThrow(
        TestParseError,
      );
    });
  });

  describe('requireUuid', () => {
    it('extracts valid UUIDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(requireUuid({ id: uuid }, 'id', TestParseError)).toBe(uuid);
    });

    it('is case-insensitive', () => {
      const uuid = '550E8400-E29B-41D4-A716-446655440000';
      expect(requireUuid({ id: uuid }, 'id', TestParseError)).toBe(uuid);
    });

    it('throws on invalid UUIDs', () => {
      expect(() => requireUuid({ id: 'not-a-uuid' }, 'id', TestParseError)).toThrow(
        TestParseError,
      );
      expect(() => requireUuid({ id: '' }, 'id', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('requireTimestamp', () => {
    it('extracts valid ISO timestamps', () => {
      const ts = '2026-07-15T10:00:00Z';
      expect(requireTimestamp({ t: ts }, 't', TestParseError)).toBe(ts);
    });

    it('throws on unparseable strings', () => {
      expect(() => requireTimestamp({ t: 'not-a-date' }, 't', TestParseError)).toThrow(
        TestParseError,
      );
    });

    it('throws on non-string values', () => {
      expect(() => requireTimestamp({ t: 12345 }, 't', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('nullableTimestamp', () => {
    it('extracts valid timestamps', () => {
      const ts = '2026-07-15T10:00:00Z';
      expect(nullableTimestamp({ t: ts }, 't', TestParseError)).toBe(ts);
    });

    it('returns null for null or undefined', () => {
      expect(nullableTimestamp({ t: null }, 't', TestParseError)).toBeNull();
      expect(nullableTimestamp({}, 't', TestParseError)).toBeNull();
    });

    it('throws on invalid timestamps', () => {
      expect(() => nullableTimestamp({ t: 'bad' }, 't', TestParseError)).toThrow(TestParseError);
    });
  });

  describe('custom error class usage', () => {
    class CustomDomainError extends Error {
      public constructor() {
        super('custom domain error');
        this.name = 'CustomDomainError';
      }
    }

    it('throws the caller-specified error class', () => {
      expect(() => requireString({}, 'x', CustomDomainError)).toThrow(CustomDomainError);
      expect(() => requireNumber({}, 'x', CustomDomainError)).toThrow(CustomDomainError);
      expect(() => requireUuid({ id: 'bad' }, 'id', CustomDomainError)).toThrow(CustomDomainError);
    });
  });
});
