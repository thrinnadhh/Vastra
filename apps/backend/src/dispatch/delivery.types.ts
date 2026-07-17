export const DELIVERY_TASK_STATUSES = [
  'SEARCHING',
  'OFFERED',
  'ASSIGNED',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DROP',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type DeliveryTaskStatus = (typeof DELIVERY_TASK_STATUSES)[number];

export const DELIVERY_ASSIGNMENT_STATUSES = [
  'OFFERED',
  'ACCEPTED',
  'REJECTED',
  'TIMED_OUT',
  'CANCELLED',
  'RELEASED',
  'COMPLETED',
] as const;

export type DeliveryAssignmentStatus = (typeof DELIVERY_ASSIGNMENT_STATUSES)[number];

export type CaptainVisibleDeliveryTaskStatus = Exclude<
  DeliveryTaskStatus,
  'SEARCHING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
>;
export type CaptainVisibleAssignmentStatus = Extract<
  DeliveryAssignmentStatus,
  'OFFERED' | 'ACCEPTED'
>;

export const DELIVERY_OFFER_REJECTION_REASONS = [
  'TOO_FAR',
  'VEHICLE_ISSUE',
  'SHIFT_ENDING',
  'LOW_BATTERY',
  'OTHER',
] as const;
export type DeliveryOfferRejectionReason = (typeof DELIVERY_OFFER_REJECTION_REASONS)[number];

export const DELIVERY_RELEASE_REASONS = [
  'VEHICLE_ISSUE',
  'PERSONAL_EMERGENCY',
  'CANNOT_REACH_STORE',
  'MERCHANT_UNAVAILABLE',
  'APP_OR_NAVIGATION_FAILURE',
  'OTHER',
] as const;
export type DeliveryReleaseReason = (typeof DELIVERY_RELEASE_REASONS)[number];

export const DELIVERY_PROBLEM_REASONS = [
  'CUSTOMER_UNAVAILABLE',
  'INVALID_ADDRESS',
  'CUSTOMER_REFUSED',
  'PACKAGE_DAMAGED',
  'PAYMENT_NOT_AVAILABLE',
  'SAFETY_CONCERN',
  'VEHICLE_ISSUE',
  'OTHER',
] as const;
export type DeliveryProblemReason = (typeof DELIVERY_PROBLEM_REASONS)[number];

export interface DeliveryLocationInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly recordedAt: string;
}

export interface DeliveryPartyLocation {
  readonly latitude: number;
  readonly longitude: number;
}

export interface DeliveryAddressSnapshot {
  readonly label: string | null;
  readonly recipientName: string | null;
  readonly phoneNumber: string | null;
  readonly line1: string;
  readonly line2: string | null;
  readonly landmark: string | null;
  readonly area: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly location: DeliveryPartyLocation;
}

export interface CaptainDeliverySnapshot {
  readonly taskId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly taskStatus: CaptainVisibleDeliveryTaskStatus;
  readonly orderStatus:
    | 'CAPTAIN_SEARCHING'
    | 'CAPTAIN_ASSIGNED'
    | 'CAPTAIN_AT_STORE'
    | 'PICKED_UP'
    | 'OUT_FOR_DELIVERY'
    | 'CAPTAIN_AT_CUSTOMER';
  readonly assignmentId: string;
  readonly assignmentStatus: CaptainVisibleAssignmentStatus;
  readonly offeredEarningPaise: number;
  readonly pickupDistanceMeters: number | null;
  readonly offeredAt: string;
  readonly expiresAt: string;
  readonly assignedAt: string | null;
  readonly pickup: DeliveryAddressSnapshot;
  readonly drop: DeliveryAddressSnapshot;
  readonly totalPaise: number;
  readonly paymentStatus: 'COD_PENDING' | 'COD_COLLECTED';
  readonly replayed: boolean;
}

export interface DeliveryOfferRejectionResult {
  readonly assignmentId: string;
  readonly deliveryTaskId: string;
  readonly assignmentStatus: 'REJECTED';
  readonly reason: DeliveryOfferRejectionReason;
  readonly respondedAt: string;
  readonly replayed: boolean;
}

export interface DeliverySecretResult {
  readonly orderId: string;
  readonly deliveryTaskId: string;
  readonly kind: 'PICKUP_CODE' | 'DELIVERY_OTP';
  readonly secret: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface DeliveryTrackingSnapshot {
  readonly orderId: string;
  readonly deliveryTaskId: string;
  readonly orderNumber: string;
  readonly orderStatus:
    | 'CAPTAIN_SEARCHING'
    | 'CAPTAIN_ASSIGNED'
    | 'CAPTAIN_AT_STORE'
    | 'PICKED_UP'
    | 'OUT_FOR_DELIVERY'
    | 'CAPTAIN_AT_CUSTOMER'
    | 'DELIVERED'
    | 'PROBLEM_REPORTED';
  readonly taskStatus: DeliveryTaskStatus;
  readonly captain: {
    readonly id: string;
    readonly displayName: string | null;
    readonly phoneLast4: string | null;
    readonly vehicleType: string | null;
    readonly vehicleNumberLast4: string | null;
  } | null;
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly recordedAt: string;
    readonly stale: boolean;
  } | null;
  readonly estimatedArrivalAt: string | null;
  readonly updatedAt: string;
}

export interface MerchantDeliverySnapshot {
  readonly orderId: string;
  readonly deliveryTaskId: string;
  readonly orderNumber: string;
  readonly orderStatus: string;
  readonly taskStatus: DeliveryTaskStatus;
  readonly captainAssigned: boolean;
  readonly captainAtStore: boolean;
  readonly pickedUpAt: string | null;
  readonly updatedAt: string;
}

export interface DeliveryCompletionSnapshot {
  readonly taskId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly taskStatus: 'COMPLETED';
  readonly orderStatus: 'DELIVERED';
  readonly paymentStatus: 'COD_COLLECTED';
  readonly collectedAmountPaise: number;
  readonly captainEarningPaise: number;
  readonly completedAt: string;
  readonly replayed: boolean;
}

export interface DeliveryProblemSnapshot {
  readonly taskId: string;
  readonly orderId: string;
  readonly reason: DeliveryProblemReason;
  readonly note: string | null;
  readonly reportedAt: string;
  readonly orderStatus: 'PROBLEM_REPORTED';
  readonly replayed: boolean;
}

export interface DeliveryReleaseSnapshot {
  readonly taskId: string;
  readonly orderId: string;
  readonly reason: DeliveryReleaseReason;
  readonly releasedAt: string;
  readonly taskStatus: 'SEARCHING';
  readonly orderStatus: 'CAPTAIN_SEARCHING';
  readonly replayed: boolean;
}

export interface ArrivePickupInput extends DeliveryLocationInput {
  readonly actorId: string;
  readonly taskId: string;
  readonly idempotencyKey: string;
}

export interface VerifyPickupInput {
  readonly actorId: string;
  readonly taskId: string;
  readonly idempotencyKey: string;
  readonly pickupCode: string;
}

export interface DeliveryLifecycleLocationInput {
  readonly actorId: string;
  readonly taskId: string;
  readonly idempotencyKey: string;
  readonly location: DeliveryLocationInput | null;
}

export interface CompleteDeliveryInput extends DeliveryLifecycleLocationInput {
  readonly collectedAmountPaise: number;
  readonly deliveryOtp: string;
}

export interface ReportDeliveryProblemInput extends DeliveryLifecycleLocationInput {
  readonly reason: DeliveryProblemReason;
  readonly note: string | null;
  readonly evidenceObjectKey: string | null;
}

export interface ReleaseDeliveryInput extends DeliveryLifecycleLocationInput {
  readonly reason: DeliveryReleaseReason;
  readonly note: string | null;
}

export interface AdminAssignInput {
  readonly actorId: string;
  readonly taskId: string;
  readonly captainId: string;
  readonly idempotencyKey: string;
}

export interface AdminReleaseInput {
  readonly actorId: string;
  readonly taskId: string;
  readonly reason: DeliveryReleaseReason;
  readonly note: string | null;
  readonly idempotencyKey: string;
}

export interface AdminDeliveryOverrideInput {
  readonly actorId: string;
  readonly taskId: string;
  readonly idempotencyKey: string;
  readonly collectedAmountPaise: number;
  readonly reason: string;
}

export interface DeliveryOfferWaveConfiguration {
  readonly workerId: string;
  readonly limit: number;
  readonly initialRadiusMeters: number;
  readonly radiusStepMeters: number;
  readonly maxRadiusMeters: number;
  readonly captainsPerWave: number;
  readonly offerLifetimeSeconds: number;
  readonly waveIntervalSeconds: number;
}

export interface DeliveryOfferWaveResult {
  readonly deliveryTaskId: string;
  readonly taskStatus: 'SEARCHING' | 'OFFERED';
  readonly waveNumber: number;
  readonly radiusMeters: number;
  readonly offersCreated: number;
  readonly offersExpired: number;
  readonly nextOfferWaveAt: string;
  readonly replayed: boolean;
}

export interface DeliveryDispatchCycleResult {
  readonly workerId: string;
  readonly dispatchesStarted: number;
  readonly dispatchFailures: readonly {
    readonly resourceId: string;
    readonly sqlState: string;
  }[];
  readonly taskResults: readonly DeliveryOfferWaveResult[];
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface DeliveryOffersResponse {
  readonly success: true;
  readonly data: { readonly offers: readonly CaptainDeliverySnapshot[] };
  readonly meta: ResponseMeta;
}

export interface CaptainDeliveryResponse {
  readonly success: true;
  readonly data: { readonly delivery: CaptainDeliverySnapshot | null };
  readonly meta: ResponseMeta;
}

export interface DeliveryMutationResponse {
  readonly success: true;
  readonly data: { readonly delivery: CaptainDeliverySnapshot };
  readonly meta: ResponseMeta;
}

export interface DeliveryRejectionResponse {
  readonly success: true;
  readonly data: { readonly rejection: DeliveryOfferRejectionResult };
  readonly meta: ResponseMeta;
}

export interface DeliverySecretResponse {
  readonly success: true;
  readonly data: { readonly secret: DeliverySecretResult };
  readonly meta: ResponseMeta;
}

export interface DeliveryTrackingResponse {
  readonly success: true;
  readonly data: { readonly tracking: DeliveryTrackingSnapshot };
  readonly meta: ResponseMeta;
}

export interface MerchantDeliveryResponse {
  readonly success: true;
  readonly data: { readonly delivery: MerchantDeliverySnapshot };
  readonly meta: ResponseMeta;
}

export interface DeliveryCompletionResponse {
  readonly success: true;
  readonly data: { readonly completion: DeliveryCompletionSnapshot };
  readonly meta: ResponseMeta;
}

export interface DeliveryProblemResponse {
  readonly success: true;
  readonly data: { readonly problem: DeliveryProblemSnapshot };
  readonly meta: ResponseMeta;
}

export interface DeliveryReleaseResponse {
  readonly success: true;
  readonly data: { readonly release: DeliveryReleaseSnapshot };
  readonly meta: ResponseMeta;
}
