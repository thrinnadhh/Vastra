import { FRONTEND_FIXTURES } from './fixtures';
import type { FrontendE2EEntryPoint, FrontendVisualEntryPoint } from './types';

function requireFixture(id: string) {
  const fixture = FRONTEND_FIXTURES.find((candidate) => candidate.id === id);
  if (fixture === undefined) {
    throw new Error(`Unknown frontend fixture: ${id}`);
  }
  return fixture;
}

function createE2EEntryPoint(
  id: string,
  owner: FrontendE2EEntryPoint['owner'],
  fixtureId: string,
  assertions: readonly string[],
): FrontendE2EEntryPoint {
  const fixture = requireFixture(fixtureId);
  return Object.freeze({
    id,
    owner,
    fixtureId,
    route: fixture.route,
    viewport: fixture.viewport,
    assertions: Object.freeze([...assertions]),
  });
}

export const FRONTEND_E2E_ENTRY_POINTS: readonly FrontendE2EEntryPoint[] = Object.freeze([
  createE2EEntryPoint('admin-shell-keyboard-and-responsive', 'admin', 'admin-overview-shell', [
    'skip-link-focus',
    'single-main-landmark',
    'current-navigation-item',
    'compact-navigation-reflow',
  ]),
  createE2EEntryPoint('customer-mobile-shell-contract', 'mobile', 'mobile-customer-shell', [
    'all-safe-area-edges',
    'keyboard-aware',
    'slot-order',
    'overlay-after-content',
  ]),
  createE2EEntryPoint('merchant-mobile-shell-contract', 'mobile', 'mobile-merchant-shell', [
    'commerce-mode',
    'all-safe-area-edges',
    'slot-order',
  ]),
  createE2EEntryPoint('captain-mobile-shell-contract', 'mobile', 'mobile-captain-shell', [
    'commerce-mode',
    'all-safe-area-edges',
    'slot-order',
  ]),
]);

export const FRONTEND_VISUAL_ENTRY_POINTS: readonly FrontendVisualEntryPoint[] = Object.freeze(
  FRONTEND_FIXTURES.map((fixture) =>
    Object.freeze({
      id: `${fixture.id}-visual`,
      fixtureId: fixture.id,
      route: fixture.route,
      viewport: fixture.viewport,
    }),
  ),
);
