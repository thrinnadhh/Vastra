import { describe, expect, it } from 'vitest';

import {
  FRONTEND_E2E_ENTRY_POINTS,
  FRONTEND_FIXTURES,
  FRONTEND_VISUAL_ENTRY_POINTS,
  getFrontendFixture,
} from '../src';

describe('frontend fixture registry', () => {
  it('is deterministic, uniquely addressed, and JSON serializable', () => {
    const ids = FRONTEND_FIXTURES.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FRONTEND_FIXTURES.every((fixture) => fixture.route === `/fixtures/${fixture.id}`)).toBe(
      true,
    );
    expect(() => JSON.stringify(FRONTEND_FIXTURES)).not.toThrow();
    expect(JSON.stringify(FRONTEND_FIXTURES)).not.toMatch(/202\d-|random|Date\(/i);
  });

  it('covers shared primitive states and every mobile/admin shell owner', () => {
    expect(FRONTEND_FIXTURES.filter((fixture) => fixture.fixtureKind === 'primitive')).toHaveLength(
      5,
    );
    expect(
      FRONTEND_FIXTURES.filter((fixture) => fixture.fixtureKind === 'mobileShell').map(
        (fixture) => fixture.contract.role,
      ),
    ).toEqual(['customer', 'merchant', 'captain']);
    expect(FRONTEND_FIXTURES.some((fixture) => fixture.fixtureKind === 'adminShell')).toBe(true);
  });

  it('keeps merchant and captain fixture contracts in Commerce mode', () => {
    const operationalShells = FRONTEND_FIXTURES.filter(
      (fixture) =>
        fixture.fixtureKind === 'mobileShell' &&
        (fixture.contract.role === 'merchant' || fixture.contract.role === 'captain'),
    );

    expect(operationalShells.map((fixture) => fixture.contract.role)).toEqual([
      'merchant',
      'captain',
    ]);
    expect(operationalShells.every((fixture) => fixture.contract.mode === 'commerce')).toBe(true);
  });

  it('maps every E2E and visual entry point to a real fixture', () => {
    for (const entryPoint of [...FRONTEND_E2E_ENTRY_POINTS, ...FRONTEND_VISUAL_ENTRY_POINTS]) {
      const fixture = getFrontendFixture(entryPoint.fixtureId);
      expect(fixture?.route).toBe(entryPoint.route);
      expect(entryPoint.viewport.width).toBeGreaterThan(0);
      expect(entryPoint.viewport.height).toBeGreaterThan(0);
    }
  });
});
