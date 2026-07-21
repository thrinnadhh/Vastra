import {
  createButtonPrimitive,
  createErrorStatePrimitive,
  createFieldPrimitive,
  createToastPrimitive,
} from '@vastra/ui-primitives';
import { createAdminShellContract, createMobileShellContract } from '@vastra/app-shells';

import type { FrontendFixtureDefinition } from './types';

const COMPACT_VIEWPORT = Object.freeze({ width: 390, height: 844 });
const LARGE_VIEWPORT = Object.freeze({ width: 1440, height: 1024 });

const fixtures = [
  {
    id: 'primitive-primary-action',
    title: 'Primary action',
    description:
      'Enabled customer-facing primary action with deterministic accessibility metadata.',
    fixtureKind: 'primitive',
    route: '/fixtures/primitive-primary-action',
    viewport: COMPACT_VIEWPORT,
    contract: createButtonPrimitive({
      id: 'fixture-primary-action',
      label: 'Continue',
      accessibilityHint: 'Moves to the next deterministic fixture step',
    }),
  },
  {
    id: 'primitive-busy-action',
    title: 'Busy action',
    description: 'Duplicate-submit-safe busy action.',
    fixtureKind: 'primitive',
    route: '/fixtures/primitive-busy-action',
    viewport: COMPACT_VIEWPORT,
    contract: createButtonPrimitive({
      id: 'fixture-busy-action',
      label: 'Placing order',
      busy: true,
    }),
  },
  {
    id: 'primitive-field-error',
    title: 'Field with retained error state',
    description: 'Retains the supplied value while exposing a deterministic announced error.',
    fixtureKind: 'primitive',
    route: '/fixtures/primitive-field-error',
    viewport: COMPACT_VIEWPORT,
    contract: createFieldPrimitive({
      id: 'fixture-phone',
      label: 'Phone number',
      value: '987654321',
      inputMode: 'tel',
      autoComplete: 'tel',
      error: 'Enter a 10-digit phone number',
      required: true,
    }),
  },
  {
    id: 'primitive-offline-recovery',
    title: 'Offline recovery',
    description: 'Recoverable offline state with one explicit retry action.',
    fixtureKind: 'primitive',
    route: '/fixtures/primitive-offline-recovery',
    viewport: COMPACT_VIEWPORT,
    contract: createErrorStatePrimitive({
      id: 'fixture-offline',
      kind: 'offline',
      title: 'You are offline',
      message: 'Reconnect to refresh server-authoritative availability and prices.',
      primaryAction: {
        id: 'fixture-retry',
        label: 'Try again',
        accessibilityLabel: 'Try loading the fixture again',
      },
    }),
  },
  {
    id: 'primitive-success-toast',
    title: 'Success toast',
    description: 'Bounded polite feedback without manufacturing a feature success path.',
    fixtureKind: 'primitive',
    route: '/fixtures/primitive-success-toast',
    viewport: COMPACT_VIEWPORT,
    contract: createToastPrimitive({
      id: 'fixture-success-toast',
      message: 'Fixture saved',
      tone: 'success',
      durationMs: 4_000,
    }),
  },
  {
    id: 'mobile-customer-shell',
    title: 'Customer mobile shell',
    description:
      'Compact customer shell fixture with safe area, keyboard, header, footer, and overlay slots.',
    fixtureKind: 'mobileShell',
    route: '/fixtures/mobile-customer-shell',
    viewport: COMPACT_VIEWPORT,
    contract: createMobileShellContract({
      role: 'customer',
      mode: 'hybrid',
      hasHeader: true,
      hasFooter: true,
      hasOverlay: true,
      scrollable: true,
    }),
  },
  {
    id: 'mobile-merchant-shell',
    title: 'Merchant mobile shell',
    description: 'Commerce-only merchant operational shell fixture.',
    fixtureKind: 'mobileShell',
    route: '/fixtures/mobile-merchant-shell',
    viewport: COMPACT_VIEWPORT,
    contract: createMobileShellContract({
      role: 'merchant',
      hasHeader: true,
      hasFooter: true,
      hasOverlay: true,
    }),
  },
  {
    id: 'mobile-captain-shell',
    title: 'Captain mobile shell',
    description: 'Commerce-only captain operational shell fixture.',
    fixtureKind: 'mobileShell',
    route: '/fixtures/mobile-captain-shell',
    viewport: COMPACT_VIEWPORT,
    contract: createMobileShellContract({
      role: 'captain',
      hasHeader: true,
      hasFooter: true,
      hasOverlay: true,
    }),
  },
  {
    id: 'admin-overview-shell',
    title: 'Admin overview shell',
    description:
      'Large-screen admin landmark fixture with skip link and one current navigation item.',
    fixtureKind: 'adminShell',
    route: '/fixtures/admin-overview-shell',
    viewport: LARGE_VIEWPORT,
    contract: createAdminShellContract({
      productLabel: 'Vastra Admin',
      navigation: [{ href: '/', label: 'Overview', current: true }],
      hasSecondaryPanel: true,
    }),
  },
] as const satisfies readonly FrontendFixtureDefinition[];

export const FRONTEND_FIXTURES: readonly FrontendFixtureDefinition[] = Object.freeze(fixtures);

export function getFrontendFixture(id: string): FrontendFixtureDefinition | null {
  return FRONTEND_FIXTURES.find((fixture) => fixture.id === id) ?? null;
}
