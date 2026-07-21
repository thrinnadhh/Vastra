import { describe, expect, it } from 'vitest';

import { validateJsonSchema } from '../src/schema.js';

const schemas = {
  Entity: {
    type: 'object',
    required: ['id', 'tags'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      count: { type: 'integer' },
    },
  },
};

describe('generated schema decoding', () => {
  it('validates references, required properties, arrays, integers, and additional properties', () => {
    const reference = { $ref: '#/components/schemas/Entity' };
    expect(validateJsonSchema(reference, { id: '1', tags: ['a'], count: 2 }, schemas)).toBe(true);
    expect(validateJsonSchema(reference, { id: '1', tags: [2] }, schemas)).toBe(false);
    expect(validateJsonSchema(reference, { id: '1', tags: [], extra: true }, schemas)).toBe(false);
    expect(validateJsonSchema(reference, { tags: [] }, schemas)).toBe(false);
    expect(validateJsonSchema({ $ref: '#/other/Entity' }, {}, schemas)).toBe(false);
  });

  it('supports const, enum, nullable types, unions, and intersections', () => {
    expect(validateJsonSchema({ const: true }, true, schemas)).toBe(true);
    expect(validateJsonSchema({ enum: ['A', 'B'] }, 'C', schemas)).toBe(false);
    expect(validateJsonSchema({ type: ['string', 'null'] }, null, schemas)).toBe(true);
    expect(validateJsonSchema({ anyOf: [{ type: 'string' }, { type: 'number' }] }, 5, schemas)).toBe(true);
    expect(validateJsonSchema({ oneOf: [{ type: 'number' }, { type: 'integer' }] }, 5, schemas)).toBe(false);
    expect(validateJsonSchema({ allOf: [{ type: 'object' }, { type: 'object', required: ['id'] }] }, { id: '1' }, schemas)).toBe(true);
  });

  it('validates typed additional properties', () => {
    expect(validateJsonSchema({ type: 'object', additionalProperties: { type: 'boolean' } }, { active: true }, schemas)).toBe(true);
    expect(validateJsonSchema({ type: 'object', additionalProperties: { type: 'boolean' } }, { active: 'yes' }, schemas)).toBe(false);
  });
});
