/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type {
  AdminAuditEntry,
  AdminCapabilities,
  AdminCaptainPage,
  AdminCaptainSnapshot,
  AdminDashboardSummary,
  AdminMerchantPage,
  AdminMerchantSnapshot,
  AdminMutationInput,
  AdminOperationOutcome,
  AdminOperationalOrder,
  AdminOrderInvestigation,
  AdminOrderPage,
  AdminPort,
  AdminResult,
  AdminSearchResult,
} from './admin-types';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const TASK_ID = '20000000-0000-4000-8000-000000000001';
const MERCHANT_ID = '30000000-0000-4000-8000-000000000001';
const CAPTAIN_ID = '40000000-0000-4000-8000-000000000001';
const AUDIT_ID = '50000000-0000-4000-8000-000000000001';
const NOW = '2026-07-26T10:00:00.000Z';

const capabilities: AdminCapabilities = {
  assuranceLevel: 'aal2',
  permissions: [
    'operations.read',
    'operations.manage',
    'admin.dashboard.read',
    'admin.orders.read',
    'admin.orders.manage',
    'admin.merchants.read',
    'admin.merchants.manage',
    'admin.captains.read',
    'admin.captains.manage',
    'admin.audit.read',
  ],
  mfaRequiredForSensitiveOperations: true,
};

const operationalOrder: AdminOperationalOrder = {
  id: ORDER_ID,
  orderNumber: 'VAS-260726-001',
  orderStatus: 'PROBLEM_REPORTED',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  totalPaise: 249900,
  operationalQueue: 'PROBLEM',
  shop: { id: '31000000-0000-4000-8000-000000000001', name: 'Sri Fashion Hub' },
  customer: {
    id: '11000000-0000-4000-8000-000000000001',
    displayName: 'Pilot customer',
    phoneLast4: '8842',
  },
  delivery: { taskId: TASK_ID, status: 'ASSIGNED', assignedCaptainId: CAPTAIN_ID, updatedAt: NOW },
  attention: { alert: false, payment: false, refund: false, case: true },
  updatedAt: NOW,
};

let auditEntries: AdminAuditEntry[] = [
  {
    id: AUDIT_ID,
    actorId: '90000000-0000-4000-8000-000000000001',
    action: 'admin.order.retry_dispatch',
    resourceType: 'ORDER',
    resourceId: ORDER_ID,
    reasonCode: 'OPERATIONAL_RECOVERY',
    note: 'Synthetic FE08 browser evidence',
    requestId: 'fixture-request-1',
    idempotencyKey: '60000000-0000-4000-8000-000000000001',
    before: { status: 'PROBLEM_REPORTED' },
    after: { status: 'CAPTAIN_SEARCHING' },
    createdAt: NOW,
  },
];

const dashboard: AdminDashboardSummary = {
  openOrders: 28,
  interventionOrders: 7,
  waitingMerchantOrders: 3,
  stuckOrders: 2,
  unassignedDeliveries: 4,
  searchingDeliveries: 5,
  activeDeliveries: 14,
  alertAttention: 1,
  paymentAttention: 2,
  refundAttention: 1,
  openCases: 6,
  suspendedMerchants: 1,
  suspendedCaptains: 2,
  generatedAt: NOW,
};

const investigation: AdminOrderInvestigation = {
  order: {
    id: ORDER_ID,
    orderNumber: operationalOrder.orderNumber,
    customerId: operationalOrder.customer.id,
    shopId: operationalOrder.shop.id,
    status: operationalOrder.orderStatus,
    paymentStatus: operationalOrder.paymentStatus,
    fulfilmentType: 'DELIVERY',
    totalPaise: operationalOrder.totalPaise,
    placedAt: '2026-07-26T09:00:00.000Z',
    acceptedAt: '2026-07-26T09:03:00.000Z',
    readyAt: '2026-07-26T09:20:00.000Z',
    pickedUpAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    updatedAt: NOW,
    version: 8,
  },
  customer: {
    id: operationalOrder.customer.id,
    fullName: 'Pilot customer',
    phoneNumber: '+91 ••••••8842',
    status: 'ACTIVE',
  },
  statusHistory: [
    {
      id: '71000000-0000-4000-8000-000000000001',
      previousStatus: null,
      newStatus: 'WAITING_FOR_MERCHANT',
      changedByRole: 'SYSTEM',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-26T09:00:00.000Z',
    },
    {
      id: '71000000-0000-4000-8000-000000000002',
      previousStatus: 'WAITING_FOR_MERCHANT',
      newStatus: 'READY_FOR_PICKUP',
      changedByRole: 'MERCHANT',
      reasonCode: null,
      note: null,
      createdAt: '2026-07-26T09:20:00.000Z',
    },
    {
      id: '71000000-0000-4000-8000-000000000003',
      previousStatus: 'READY_FOR_PICKUP',
      newStatus: 'PROBLEM_REPORTED',
      changedByRole: 'CAPTAIN',
      reasonCode: 'MERCHANT_DELAY',
      note: 'Store handover delayed',
      createdAt: NOW,
    },
  ],
  delivery: {
    taskId: TASK_ID,
    status: 'ASSIGNED',
    assignedCaptainId: CAPTAIN_ID,
    assignmentAttempts: 2,
    assignedAt: '2026-07-26T09:23:00.000Z',
    pickedUpAt: null,
    completedAt: null,
    updatedAt: NOW,
  },
  cases: [
    {
      id: '72000000-0000-4000-8000-000000000001',
      ticketNumber: 'CASE-1042',
      category: 'DELIVERY',
      priority: 'HIGH',
      status: 'OPEN',
      subject: 'Store handover delay',
      assignedTo: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
  audit: auditEntries,
};

const merchantSnapshot: AdminMerchantSnapshot = {
  merchant: {
    id: MERCHANT_ID,
    fullName: 'S. Ramesh',
    phoneNumber: '+91 ••••••4108',
    profileStatus: 'ACTIVE',
    legalName: 'Sri Fashion Hub Private Limited',
    onboardingStatus: 'ACTIVE',
    kycStatus: 'VERIFIED',
    updatedAt: NOW,
  },
  shops: [
    {
      id: operationalOrder.shop.id,
      shopCode: 'TSH-001',
      name: operationalOrder.shop.name,
      verificationStatus: 'VERIFIED',
      operationalStatus: 'OPEN',
      acceptsOnlineOrders: true,
      updatedAt: NOW,
    },
  ],
  metrics: { openOrders: 5, cancelledOrders30d: 1, problemOrders30d: 2 },
};

const captainSnapshot: AdminCaptainSnapshot = {
  captain: {
    id: CAPTAIN_ID,
    captainCode: 'CAP-1008',
    fullName: 'K. Arjun',
    phoneNumber: '+91 ••••••7311',
    profileStatus: 'ACTIVE',
    kycStatus: 'VERIFIED',
    availabilityStatus: 'ASSIGNED',
    vehicleType: 'BIKE',
    vehicleNumber: 'AP 03 XX 1088',
    ratingAverage: 4.8,
    ratingCount: 119,
    completedDeliveries: 408,
    cashBalancePaise: 125000,
    approvedAt: '2026-06-02T10:00:00.000Z',
    updatedAt: NOW,
  },
  activeDelivery: {
    taskId: TASK_ID,
    orderId: ORDER_ID,
    status: 'ASSIGNED',
    assignedAt: '2026-07-26T09:23:00.000Z',
    pickedUpAt: null,
    problemReportedAt: NOW,
  },
  location: {
    latitude: 13.6288,
    longitude: 79.4192,
    accuracyMeters: 18,
    recordedAt: NOW,
    activeDeliveryTaskId: TASK_ID,
    updatedAt: NOW,
  },
  metrics: { problemDeliveries30d: 2, pendingEarningsPaise: 184500 },
};

function success<T>(data: T): AdminResult<T> {
  return { kind: 'SUCCESS', data, requestId: 'fixture-request' };
}

function outcome(
  action: string,
  resourceType: string,
  resourceId: string,
  input: AdminMutationInput,
): AdminResult<AdminOperationOutcome> {
  auditEntries = [
    {
      id: globalThis.crypto?.randomUUID?.() ?? AUDIT_ID,
      actorId: '90000000-0000-4000-8000-000000000001',
      action,
      resourceType,
      resourceId,
      reasonCode: input.reasonCode,
      note: input.note,
      requestId: 'fixture-mutation',
      idempotencyKey: input.idempotencyKey,
      before: { status: 'PROBLEM_REPORTED' },
      after: { status: 'CAPTAIN_SEARCHING' },
      createdAt: NOW,
    },
    ...auditEntries,
  ];
  return success({ replayed: false, summary: { resourceId, status: 'CAPTAIN_SEARCHING' } });
}

export class FixtureAdminPort implements AdminPort {
  public capabilities() {
    return Promise.resolve(success(capabilities));
  }
  public dashboard() {
    return Promise.resolve(success(dashboard));
  }
  public search(query: string): Promise<AdminResult<readonly AdminSearchResult[]>> {
    const normalized = query.toLowerCase();
    const candidates = [
      {
        type: 'ORDER',
        id: ORDER_ID,
        primaryText: operationalOrder.orderNumber,
        secondaryText: operationalOrder.shop.name,
        status: operationalOrder.orderStatus,
        updatedAt: NOW,
      },
      {
        type: 'MERCHANT',
        id: MERCHANT_ID,
        primaryText: merchantSnapshot.merchant.legalName,
        secondaryText: 'Merchant · ••••4108',
        status: merchantSnapshot.merchant.profileStatus,
        updatedAt: NOW,
      },
      {
        type: 'CAPTAIN',
        id: CAPTAIN_ID,
        primaryText: captainSnapshot.captain.fullName,
        secondaryText: 'Captain · ••••7311',
        status: captainSnapshot.captain.availabilityStatus,
        updatedAt: NOW,
      },
    ] satisfies readonly AdminSearchResult[];
    const results = candidates.filter(
      (item) =>
        `${item.primaryText} ${item.secondaryText}`.toLowerCase().includes(normalized) ||
        normalized.includes('vas'),
    );
    return Promise.resolve(success(results));
  }
  public orders(): Promise<AdminResult<AdminOrderPage>> {
    return Promise.resolve(success({ orders: [operationalOrder], nextCursor: null }));
  }
  public order(): Promise<AdminResult<AdminOrderInvestigation>> {
    return Promise.resolve(success({ ...investigation, audit: auditEntries }));
  }
  public merchants(): Promise<AdminResult<AdminMerchantPage>> {
    return Promise.resolve(
      success({
        merchants: [
          {
            id: MERCHANT_ID,
            fullName: merchantSnapshot.merchant.fullName,
            legalName: merchantSnapshot.merchant.legalName,
            phoneLast4: '4108',
            profileStatus: 'ACTIVE',
            onboardingStatus: 'ACTIVE',
            kycStatus: 'VERIFIED',
            shopCount: 1,
            openOrders: 5,
            problemOrders30d: 2,
            updatedAt: NOW,
          },
        ],
        nextCursor: null,
      }),
    );
  }
  public merchant(): Promise<AdminResult<AdminMerchantSnapshot>> {
    return Promise.resolve(success(merchantSnapshot));
  }
  public captains(): Promise<AdminResult<AdminCaptainPage>> {
    return Promise.resolve(
      success({
        captains: [
          {
            id: CAPTAIN_ID,
            captainCode: captainSnapshot.captain.captainCode,
            fullName: captainSnapshot.captain.fullName,
            phoneLast4: '7311',
            profileStatus: 'ACTIVE',
            kycStatus: 'VERIFIED',
            availabilityStatus: 'ASSIGNED',
            vehicleType: 'BIKE',
            ratingAverage: 4.8,
            completedDeliveries: 408,
            activeDeliveryTaskId: TASK_ID,
            locationRecordedAt: NOW,
            problemDeliveries30d: 2,
            updatedAt: NOW,
          },
        ],
        nextCursor: null,
      }),
    );
  }
  public captain(): Promise<AdminResult<AdminCaptainSnapshot>> {
    return Promise.resolve(success(captainSnapshot));
  }
  public audit(input: Parameters<AdminPort['audit']>[0] = {}) {
    const entries = auditEntries.filter(
      (entry) =>
        (input.resourceId === undefined || entry.resourceId === input.resourceId) &&
        (input.resourceType === undefined || entry.resourceType === input.resourceType),
    );
    return Promise.resolve(success(entries));
  }
  public cancelOrder(orderId: string, input: AdminMutationInput) {
    return Promise.resolve(outcome('admin.order.cancel', 'ORDER', orderId, input));
  }
  public retryDispatch(orderId: string, input: AdminMutationInput) {
    return Promise.resolve(outcome('admin.order.retry_dispatch', 'ORDER', orderId, input));
  }
  public releaseDelivery(taskId: string, input: AdminMutationInput) {
    return Promise.resolve(outcome('admin.delivery.release', 'DELIVERY_TASK', taskId, input));
  }
  public resetVerification(
    taskId: string,
    _kind: 'PICKUP_CODE' | 'DELIVERY_OTP',
    input: AdminMutationInput,
  ) {
    return Promise.resolve(
      outcome('admin.delivery.reset_verification', 'DELIVERY_TASK', taskId, input),
    );
  }
  public assignCaptain(taskId: string, _captainId: string, idempotencyKey: string) {
    return Promise.resolve(
      outcome('admin.delivery.assign', 'DELIVERY_TASK', taskId, {
        reasonCode: 'OPERATIONAL_RECOVERY',
        note: 'Assigned from admin control plane',
        idempotencyKey,
      }),
    );
  }
  public overrideDeliveryOtp(
    taskId: string,
    _amount: number,
    reason: string,
    idempotencyKey: string,
  ) {
    return Promise.resolve(
      outcome('admin.delivery.otp_override', 'DELIVERY_TASK', taskId, {
        reasonCode: 'OPERATIONAL_RECOVERY',
        note: reason,
        idempotencyKey,
      }),
    );
  }
  public approveMerchant(merchantId: string, input: AdminMutationInput) {
    outcome('admin.merchant.approved', 'MERCHANT', merchantId, input);
    return Promise.resolve(
      success({
        ...merchantSnapshot,
        merchant: {
          ...merchantSnapshot.merchant,
          profileStatus: 'ACTIVE',
          onboardingStatus: 'ACTIVE',
          kycStatus: 'VERIFIED',
        },
      }),
    );
  }
  public pauseMerchant(merchantId: string, input: AdminMutationInput) {
    outcome('admin.merchant.paused', 'MERCHANT', merchantId, input);
    return Promise.resolve(
      success({
        ...merchantSnapshot,
        merchant: { ...merchantSnapshot.merchant, onboardingStatus: 'PAUSED' },
      }),
    );
  }
  public suspendMerchant(merchantId: string, input: AdminMutationInput) {
    outcome('admin.merchant.suspended', 'MERCHANT', merchantId, input);
    return Promise.resolve(
      success({
        ...merchantSnapshot,
        merchant: {
          ...merchantSnapshot.merchant,
          profileStatus: 'SUSPENDED',
          onboardingStatus: 'SUSPENDED',
        },
      }),
    );
  }
  public restoreMerchant(merchantId: string, input: AdminMutationInput) {
    outcome('admin.merchant.active', 'MERCHANT', merchantId, input);
    return Promise.resolve(success(merchantSnapshot));
  }
  public approveCaptain(captainId: string, input: AdminMutationInput) {
    outcome('admin.captain.approved', 'CAPTAIN', captainId, input);
    return Promise.resolve(
      success({
        ...captainSnapshot,
        captain: {
          ...captainSnapshot.captain,
          profileStatus: 'ACTIVE',
          kycStatus: 'VERIFIED',
          availabilityStatus: 'OFFLINE',
          approvedAt: new Date().toISOString(),
        },
      }),
    );
  }
  public suspendCaptain(captainId: string, input: AdminMutationInput) {
    outcome('admin.captain.suspended', 'CAPTAIN', captainId, input);
    return Promise.resolve(
      success({
        ...captainSnapshot,
        captain: {
          ...captainSnapshot.captain,
          profileStatus: 'SUSPENDED',
          availabilityStatus: 'SUSPENDED',
        },
      }),
    );
  }
  public restoreCaptain(captainId: string, input: AdminMutationInput) {
    outcome('admin.captain.active', 'CAPTAIN', captainId, input);
    return Promise.resolve(success(captainSnapshot));
  }
  public correctCaptainAvailability(
    captainId: string,
    targetAvailability: 'OFFLINE' | 'AVAILABLE' | 'ON_BREAK',
    input: AdminMutationInput,
  ) {
    outcome('admin.captain.correct_availability', 'CAPTAIN', captainId, input);
    return Promise.resolve(
      success({
        ...captainSnapshot,
        captain: { ...captainSnapshot.captain, availabilityStatus: targetAvailability },
      }),
    );
  }
  public releaseCaptainAssignment(captainId: string, input: AdminMutationInput) {
    outcome('admin.captain.release_assignment', 'CAPTAIN', captainId, input);
    return Promise.resolve(
      success({
        ...captainSnapshot,
        activeDelivery: null,
        captain: { ...captainSnapshot.captain, availabilityStatus: 'AVAILABLE' },
      }),
    );
  }
}

export const FE08_FIXTURE_IDS = { ORDER_ID, TASK_ID, MERCHANT_ID, CAPTAIN_ID } as const;
