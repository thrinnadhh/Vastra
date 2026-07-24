/**
 * FE-S06 integration-only contract.
 *
 * This module freezes composition, ownership, state, accessibility, and privacy boundaries
 * before parallel implementation begins. It intentionally contains no feature behavior,
 * network calls, storage, navigation adapter, React component, or optimistic state transition.
 */

export const MERCHANT_ROOT_DESTINATIONS = ['ORDERS', 'ALERT_DIAGNOSTICS'] as const;
export type MerchantRootDestination = (typeof MERCHANT_ROOT_DESTINATIONS)[number];

export type MerchantRootRoute =
  | { readonly destination: 'ORDERS'; readonly requestedOrderId: string | null }
  | { readonly destination: 'ALERT_DIAGNOSTICS' };

export const MERCHANT_READINESS_STATES = [
  'CHECKING',
  'READY',
  'PERMISSION_DENIED',
  'PERMISSION_BLOCKED',
  'UNSUPPORTED_PLATFORM',
  'PHYSICAL_DEVICE_REQUIRED',
  'CHANNEL_MISCONFIGURED',
  'TOKEN_UNAVAILABLE',
  'BACKEND_REGISTRATION_FAILED',
  'SESSION_EXPIRED',
  'OFFLINE_STALE',
] as const;
export type MerchantReadinessState = (typeof MERCHANT_READINESS_STATES)[number];

export const MERCHANT_ALERT_PRESENTATION_STATES = [
  'ACTIVE',
  'ACKNOWLEDGING',
  'ACKNOWLEDGEMENT_RETRY',
  'EXPIRED',
  'ALREADY_HANDLED',
  'AUTHORITATIVE_STATE_UNAVAILABLE',
  'DECISION_PENDING',
  'DECISION_COMPLETED',
] as const;
export type MerchantAlertPresentationState = (typeof MERCHANT_ALERT_PRESENTATION_STATES)[number];

export type MerchantDecisionPresentationContext = 'ORDER_DETAIL' | 'URGENT_ALERT';

export interface MerchantDecisionActionContract {
  readonly orderId: string;
  readonly context: MerchantDecisionPresentationContext;
  readonly onDecisionCompleted: () => void;
  readonly onAuthoritativeRefreshRequested: () => void;
}

export interface MerchantPackingSurfaceContract {
  readonly orderId: string;
  readonly onOrderChanged: () => void;
  readonly onSessionExpired: () => void;
}

export interface MerchantHandoverSurfaceContract {
  readonly orderId: string;
  readonly onAuthoritativePickupConfirmed: () => void;
  readonly onAuthoritativeRefreshRequested: () => void;
  readonly onSessionExpired: () => void;
}

export const MERCHANT_ORDER_TRANSITION_OWNERS = {
  acknowledgeAlert: 'BACKEND_ALERT_SERVICE',
  acceptOrder: 'BACKEND_ORDER_SERVICE',
  rejectOrder: 'BACKEND_ORDER_SERVICE',
  startPacking: 'BACKEND_ORDER_SERVICE',
  verifyPackingItem: 'BACKEND_ORDER_SERVICE',
  markReadyForPickup: 'BACKEND_ORDER_SERVICE',
  assignCaptain: 'BACKEND_DISPATCH_SERVICE',
  captainArrived: 'BACKEND_DISPATCH_SERVICE',
  verifyPickupCode: 'BACKEND_DISPATCH_SERVICE',
  confirmPickup: 'BACKEND_DISPATCH_SERVICE',
} as const;

export const MERCHANT_SPRINT_06_TEST_IDS = {
  applicationShell: 'merchant-application-shell',
  readinessGate: 'merchant-readiness-gate',
  readinessRetry: 'merchant-readiness-retry',
  diagnosticsScreen: 'merchant-alert-diagnostics-screen',
  ringtoneTest: 'merchant-ringtone-test',
  orderQueue: 'merchant-order-queue',
  orderDetail: 'merchant-order-detail',
  urgentAlert: 'merchant-urgent-alert',
  urgentAlertAccept: 'merchant-urgent-alert-accept',
  urgentAlertReject: 'merchant-urgent-alert-reject',
  decisionActions: 'merchant-order-decision-actions',
  packingChecklist: 'merchant-packing-checklist',
  readyForPickup: 'merchant-ready-for-pickup',
  captainState: 'merchant-captain-state',
  pickupCode: 'merchant-pickup-code',
  handoverState: 'merchant-handover-state',
} as const;

export const MERCHANT_SPRINT_06_ACCESSIBILITY_LABELS = {
  openAlertDiagnostics: 'Open merchant alert diagnostics',
  retryReadiness: 'Retry merchant readiness checks',
  testRingtone: 'Test urgent merchant order ringtone',
  openOrder: 'Open merchant order',
  acceptOrder: 'Accept complete merchant order',
  rejectOrder: 'Reject complete merchant order',
  refreshAuthoritativeOrder: 'Refresh authoritative merchant order',
  startPacking: 'Start packing merchant order',
  markReady: 'Mark merchant order ready for pickup',
  refreshCaptainState: 'Refresh captain and pickup state',
  revealPickupCode: 'Show authorized merchant pickup code',
} as const;

export const MERCHANT_ERROR_COPY_OWNERS = {
  sessionAndRole: 'FE-S06-01',
  notificationPermissionAndChannel: 'FE-S06-01',
  alertAcknowledgementAndExpiry: 'FE-S06-02',
  orderReadAndDecision: 'FE-S06-03',
  packingReadyAndHandover: 'FE-S06-04',
  crossJourneyEvidence: 'FE-S06-05',
} as const;

export const MERCHANT_SPRINT_06_FILE_OWNERSHIP = {
  orchestratorExclusive: [
    'apps/merchant-app/App.tsx',
    'apps/merchant-app/src/orders/default-merchant-orders.tsx',
    'apps/merchant-app/src/orders/merchant-order.types.ts',
    'apps/merchant-app/src/orders/merchant-order.client.ts',
    'apps/merchant-app/package.json',
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/**',
    'docs/api/openapi.yaml',
    'packages/api-client/**',
  ],
  readinessAgent: [
    'apps/merchant-app/src/auth/**',
    'apps/merchant-app/src/shell/**',
    'apps/merchant-app/src/readiness/**',
    'apps/merchant-app/src/alerts/merchant-alert-diagnostics.screen.tsx',
    'apps/merchant-app/src/alerts/merchant-alert-notification.runtime.tsx',
    'apps/merchant-app/src/alerts/merchant-alert-notification.types.ts',
  ],
  urgentAlertAgent: [
    'apps/merchant-app/src/alerts/merchant-urgent-alert.modal.tsx',
    'apps/merchant-app/src/alerts/merchant-alert-countdown.ts',
    'apps/merchant-app/src/alerts/merchant-alert-notification.payload.ts',
    'apps/merchant-app/src/alerts/merchant-order-alert.client.ts',
  ],
  orderDecisionAgent: [
    'apps/merchant-app/src/orders/merchant-order.screen.tsx',
    'apps/merchant-app/src/orders/merchant-order-decision.screen.tsx',
  ],
  packingHandoverAgent: [
    'apps/merchant-app/src/orders/merchant-order-packing.screen.tsx',
    'apps/merchant-app/src/orders/merchant-order-handover.types.ts',
    'apps/merchant-app/src/orders/merchant-order-handover.client.ts',
    'apps/merchant-app/src/orders/merchant-order-handover.screen.tsx',
  ],
  evidenceAgent: [
    'e2e/merchant-cod-fulfilment.spec.ts',
    'apps/merchant-app/src/orders/merchant-cod-fulfilment.journey.test.tsx',
    'docs/evidence/fe-s06-merchant-fulfilment.md',
  ],
} as const;

export const MERCHANT_SENSITIVE_VALUE_POLICY = {
  values: ['ACCESS_TOKEN', 'FCM_PUSH_TOKEN', 'DEVICE_FINGERPRINT', 'ALERT_PAYLOAD', 'PICKUP_CODE'],
  prohibitedLocations: [
    'LOGS',
    'ANALYTICS',
    'PERSISTENT_STORAGE_UNLESS_EXISTING_CONTRACT_REQUIRES_IT',
    'NAVIGATION_PARAMETERS',
    'SCREENSHOTS',
    'TEST_ARTIFACTS',
  ],
  pickupCodeRule:
    'Render only for the authorized active order state; never log, persist, route, or fabricate it.',
} as const;

export const MERCHANT_SPRINT_06_INVARIANTS = [
  'All merchant operational screens use Commerce presentation mode without ornaments.',
  'Only server-owned opaque identifiers cross navigation and composition boundaries.',
  'The UI never performs a local-only order transition or optimistic terminal success.',
  'Every mutation blocks duplicate submission and refreshes authoritative state after races.',
  'Retry-safe operations preserve the same idempotency identity for the same logical attempt.',
  'Transient reads never hide a still-valid urgent alert without authoritative proof.',
  'Pickup success is observed from authoritative dispatch state, never fabricated by the merchant UI.',
  'Sensitive alert, token, device, and pickup values never enter logs, routes, screenshots, or evidence.',
] as const;
