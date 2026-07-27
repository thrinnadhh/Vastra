export const ADMIN_PERMISSIONS = [
  'operations.read',
  'operations.manage',
  'admin.dashboard.read',
  'admin.orders.read',
  'admin.orders.manage',
  'admin.merchants.read',
  'admin.merchants.manage',
  'admin.captains.read',
  'admin.captains.manage',
  'admin.cases.read',
  'admin.cases.manage',
  'admin.configuration.read',
  'admin.configuration.manage',
  'admin.audit.read',
  'admin.payments.read',
  'admin.payments.manage',
  'admin.returns.read',
  'admin.returns.manage',
  'admin.refunds.read',
  'admin.refunds.manage',
  'admin.settlements.read',
  'admin.settlements.manage',
  'admin.payouts.read',
  'admin.payouts.manage',
  'admin.cod.read',
  'admin.cod.manage',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export type AssuranceLevel = 'aal1' | 'aal2';

export interface AdminCapabilities {
  readonly assuranceLevel: AssuranceLevel;
  readonly permissions: readonly AdminPermission[];
  readonly mfaRequiredForSensitiveOperations: true;
}

export type AdminFailureKind =
  | 'OFFLINE'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'CONTRACT'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export interface AdminFailure {
  readonly kind: AdminFailureKind;
  readonly message: string;
  readonly requestId: string | null;
  readonly requiresRefresh: boolean;
}

export type AdminResult<T> =
  | { readonly kind: 'SUCCESS'; readonly data: T; readonly requestId: string | null }
  | { readonly kind: 'FAILURE'; readonly failure: AdminFailure };

export interface AdminDashboardSummary {
  readonly openOrders: number;
  readonly interventionOrders: number;
  readonly waitingMerchantOrders: number;
  readonly stuckOrders: number;
  readonly unassignedDeliveries: number;
  readonly searchingDeliveries: number;
  readonly activeDeliveries: number;
  readonly alertAttention: number;
  readonly paymentAttention: number;
  readonly refundAttention: number;
  readonly openCases: number;
  readonly suspendedMerchants: number;
  readonly suspendedCaptains: number;
  readonly generatedAt: string;
}

export type AdminSearchResultType = 'ORDER' | 'DELIVERY_TASK' | 'MERCHANT' | 'CAPTAIN' | 'CASE';

export interface AdminSearchResult {
  readonly type: AdminSearchResultType;
  readonly id: string;
  readonly primaryText: string;
  readonly secondaryText: string;
  readonly status: string;
  readonly updatedAt: string;
}

export type AdminOperationalQueue =
  | 'ALL'
  | 'WAITING'
  | 'STUCK'
  | 'UNASSIGNED'
  | 'ACTIVE'
  | 'ALERT'
  | 'PAYMENT'
  | 'REFUND'
  | 'CASE'
  | 'PROBLEM';

export interface AdminOperationalOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly orderStatus: string;
  readonly paymentStatus: string;
  readonly fulfilmentType: string;
  readonly totalPaise: number;
  readonly operationalQueue: Exclude<AdminOperationalQueue, 'ALL'>;
  readonly shop: { readonly id: string; readonly name: string };
  readonly customer: {
    readonly id: string;
    readonly displayName: string;
    readonly phoneLast4: string | null;
  };
  readonly delivery: {
    readonly taskId: string;
    readonly status: string;
    readonly assignedCaptainId: string | null;
    readonly updatedAt: string;
  } | null;
  readonly attention: {
    readonly alert: boolean;
    readonly payment: boolean;
    readonly refund: boolean;
    readonly case: boolean;
  };
  readonly updatedAt: string;
}

export interface AdminOrderPage {
  readonly orders: readonly AdminOperationalOrder[];
  readonly nextCursor: string | null;
}

export interface AdminStatusHistoryEntry {
  readonly id: string;
  readonly previousStatus: string | null;
  readonly newStatus: string;
  readonly changedByRole: string;
  readonly reasonCode: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface AdminAuditEntry {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly reasonCode: string;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
}

export const ADMIN_AUDIT_RESOURCE_TYPES = [
  'ORDER',
  'DELIVERY_TASK',
  'MERCHANT',
  'CAPTAIN',
  'CASE',
  'CONFIGURATION',
] as const;

export type AdminAuditResourceType = (typeof ADMIN_AUDIT_RESOURCE_TYPES)[number];

export interface AdminOrderInvestigation {
  readonly order: {
    readonly id: string;
    readonly orderNumber: string;
    readonly customerId: string;
    readonly shopId: string;
    readonly status: string;
    readonly paymentStatus: string;
    readonly fulfilmentType: string;
    readonly totalPaise: number;
    readonly placedAt: string;
    readonly acceptedAt: string | null;
    readonly readyAt: string | null;
    readonly pickedUpAt: string | null;
    readonly deliveredAt: string | null;
    readonly completedAt: string | null;
    readonly cancelledAt: string | null;
    readonly updatedAt: string;
    readonly version: number;
  };
  readonly customer: {
    readonly id: string;
    readonly fullName: string;
    readonly phoneNumber: string;
    readonly status: string;
  };
  readonly statusHistory: readonly AdminStatusHistoryEntry[];
  readonly delivery: {
    readonly taskId: string;
    readonly status: string;
    readonly assignedCaptainId: string | null;
    readonly assignmentAttempts: number;
    readonly assignedAt: string | null;
    readonly pickedUpAt: string | null;
    readonly completedAt: string | null;
    readonly updatedAt: string;
  } | null;
  readonly cases: readonly {
    readonly id: string;
    readonly ticketNumber: string;
    readonly category: string;
    readonly priority: string;
    readonly status: string;
    readonly subject: string;
    readonly assignedTo: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
  }[];
  readonly audit: readonly AdminAuditEntry[];
}

export interface AdminMerchantListItem {
  readonly id: string;
  readonly fullName: string;
  readonly legalName: string;
  readonly phoneLast4: string | null;
  readonly profileStatus: string;
  readonly onboardingStatus: string;
  readonly kycStatus: string;
  readonly shopCount: number;
  readonly openOrders: number;
  readonly problemOrders30d: number;
  readonly updatedAt: string;
}

export interface AdminMerchantPage {
  readonly merchants: readonly AdminMerchantListItem[];
  readonly nextCursor: string | null;
}

export interface AdminMerchantSnapshot {
  readonly merchant: {
    readonly id: string;
    readonly fullName: string;
    readonly phoneNumber: string;
    readonly profileStatus: string;
    readonly legalName: string;
    readonly onboardingStatus: string;
    readonly kycStatus: string;
    readonly updatedAt: string;
  };
  readonly shops: readonly {
    readonly id: string;
    readonly shopCode: string;
    readonly name: string;
    readonly verificationStatus: string;
    readonly operationalStatus: string;
    readonly acceptsOnlineOrders: boolean;
    readonly updatedAt: string;
  }[];
  readonly metrics: {
    readonly openOrders: number;
    readonly cancelledOrders30d: number;
    readonly problemOrders30d: number;
  };
}

export interface AdminCaptainListItem {
  readonly id: string;
  readonly captainCode: string;
  readonly fullName: string;
  readonly phoneLast4: string | null;
  readonly profileStatus: string;
  readonly kycStatus: string;
  readonly availabilityStatus: string;
  readonly vehicleType: string | null;
  readonly ratingAverage: number | null;
  readonly completedDeliveries: number;
  readonly activeDeliveryTaskId: string | null;
  readonly locationRecordedAt: string | null;
  readonly problemDeliveries30d: number;
  readonly updatedAt: string;
}

export interface AdminCaptainPage {
  readonly captains: readonly AdminCaptainListItem[];
  readonly nextCursor: string | null;
}

export interface AdminCaptainSnapshot {
  readonly captain: {
    readonly id: string;
    readonly captainCode: string;
    readonly fullName: string;
    readonly phoneNumber: string;
    readonly profileStatus: string;
    readonly kycStatus: string;
    readonly availabilityStatus: string;
    readonly vehicleType: string | null;
    readonly vehicleNumber: string | null;
    readonly ratingAverage: number | null;
    readonly ratingCount: number;
    readonly completedDeliveries: number;
    readonly cashBalancePaise: number;
    readonly approvedAt: string | null;
    readonly updatedAt: string;
  };
  readonly activeDelivery: {
    readonly taskId: string;
    readonly orderId: string;
    readonly status: string;
    readonly assignedAt: string | null;
    readonly pickedUpAt: string | null;
    readonly problemReportedAt: string | null;
  } | null;
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyMeters: number;
    readonly recordedAt: string;
    readonly activeDeliveryTaskId: string | null;
    readonly updatedAt: string;
  } | null;
  readonly metrics: {
    readonly problemDeliveries30d: number;
    readonly pendingEarningsPaise: number;
  };
}

export const ADMIN_REASON_CODES = [
  'CUSTOMER_REQUEST',
  'MERCHANT_REQUEST',
  'CAPTAIN_REQUEST',
  'DELIVERY_FAILURE',
  'PAYMENT_RISK',
  'FRAUD_RISK',
  'POLICY_VIOLATION',
  'SAFETY_INCIDENT',
  'OPERATIONAL_RECOVERY',
  'DATA_CORRECTION',
  'OTHER',
] as const;

export type AdminReasonCode = (typeof ADMIN_REASON_CODES)[number];

export interface AdminMutationInput {
  readonly reasonCode: AdminReasonCode;
  readonly note: string | null;
  readonly idempotencyKey: string;
}

export interface AdminOperationOutcome {
  readonly replayed: boolean;
  readonly summary: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AdminPort {
  capabilities(): Promise<AdminResult<AdminCapabilities>>;
  dashboard(): Promise<AdminResult<AdminDashboardSummary>>;
  search(query: string, limit?: number): Promise<AdminResult<readonly AdminSearchResult[]>>;
  orders(input: {
    readonly queue?: AdminOperationalQueue;
    readonly status?: string;
    readonly shopId?: string;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<AdminResult<AdminOrderPage>>;
  order(orderId: string): Promise<AdminResult<AdminOrderInvestigation>>;
  merchants(input: {
    readonly query?: string;
    readonly profileStatus?: string;
    readonly onboardingStatus?: string;
    readonly kycStatus?: string;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<AdminResult<AdminMerchantPage>>;
  merchant(merchantId: string): Promise<AdminResult<AdminMerchantSnapshot>>;
  captains(input: {
    readonly query?: string;
    readonly profileStatus?: string;
    readonly kycStatus?: string;
    readonly availabilityStatus?: string;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<AdminResult<AdminCaptainPage>>;
  captain(captainId: string): Promise<AdminResult<AdminCaptainSnapshot>>;
  audit(input?: {
    readonly resourceType?: AdminAuditResourceType;
    readonly resourceId?: string;
    readonly actorId?: string;
    readonly limit?: number;
  }): Promise<AdminResult<readonly AdminAuditEntry[]>>;
  cancelOrder(
    orderId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminOperationOutcome>>;
  retryDispatch(
    orderId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminOperationOutcome>>;
  releaseDelivery(
    taskId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminOperationOutcome>>;
  resetVerification(
    taskId: string,
    verificationKind: 'PICKUP_CODE' | 'DELIVERY_OTP',
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminOperationOutcome>>;
  assignCaptain(
    taskId: string,
    captainId: string,
    idempotencyKey: string,
  ): Promise<AdminResult<AdminOperationOutcome>>;
  overrideDeliveryOtp(
    taskId: string,
    collectedAmountPaise: number,
    reason: string,
    idempotencyKey: string,
  ): Promise<AdminResult<AdminOperationOutcome>>;
  approveMerchant(
    merchantId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminMerchantSnapshot>>;
  pauseMerchant(
    merchantId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminMerchantSnapshot>>;
  suspendMerchant(
    merchantId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminMerchantSnapshot>>;
  restoreMerchant(
    merchantId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminMerchantSnapshot>>;
  approveCaptain(
    captainId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminCaptainSnapshot>>;
  suspendCaptain(
    captainId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminCaptainSnapshot>>;
  restoreCaptain(
    captainId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminCaptainSnapshot>>;
  correctCaptainAvailability(
    captainId: string,
    targetAvailability: 'OFFLINE' | 'AVAILABLE' | 'ON_BREAK',
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminCaptainSnapshot>>;
  releaseCaptainAssignment(
    captainId: string,
    input: AdminMutationInput,
  ): Promise<AdminResult<AdminCaptainSnapshot>>;
}
