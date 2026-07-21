import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  OPENAPI_OPERATIONS,
  OPENAPI_SCHEMAS,
  type OperationId,
  type OperationRequest,
  type OperationResponse,
  type operations,
} from '../src/index.js';

describe('generated OpenAPI boundary', () => {
  it('exposes generated operation metadata and component schemas', () => {
    expect(Object.keys(OPENAPI_OPERATIONS).length).toBeGreaterThan(0);
    expect(Object.keys(OPENAPI_SCHEMAS)).toContain('ApiError');
    for (const contract of Object.values(OPENAPI_OPERATIONS)) {
      expect(contract.method).toMatch(/^(GET|PUT|POST|DELETE|PATCH|OPTIONS|HEAD|TRACE)$/u);
      expect(contract.path.startsWith('/')).toBe(true);
    }
  });

  it('keeps operation request and response types indexed by generated operation IDs', () => {
    expectTypeOf<OperationId>().toEqualTypeOf<keyof operations>();
    expectTypeOf<OperationRequest<OperationId>>().not.toBeNever();
    expectTypeOf<OperationResponse<OperationId>>().not.toBeNever();
    expect(OPENAPI_OPERATIONS).toBeDefined();
  });
});
