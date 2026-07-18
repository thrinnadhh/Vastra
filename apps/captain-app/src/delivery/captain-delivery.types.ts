import type { CaptainLocationSample } from '../presence/captain-presence.types';

export const DELIVERY_REJECTION_REASONS = [
  'TOO_FAR',
  'VEHICLE_ISSUE',
  'SHIFT_ENDING',
  'LOW_BATTERY',
  'OTHER',
] as const;

export const DELIVERY_RELEASE_REASONS = [
  'VEHICLE_ISSUE',
  'PERSONAL_EMERGENCY',
  'CANNOT_REACH_STORE',
  'MERCHANT_UNAVAILABLE',
  'APP_OR_NAVIGATION_FAILURE',
  'OTHER',
] as const;

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

export type DeliveryRejectionReason = (typeof DELIVERY_REJECTION_REASONS)[number];
export type DeliveryReleaseReason = (typeof DELIVERY_RELEASE_REASONS)[number];
export type DeliveryProblemReason = (typeof DELIVERY_PROBLEM_REASONS)[number];
export type DeliveryTaskStatus =
  'OFFERED' | 'ASSIGNED' | 'AT_PICKUP' | 'PICKED_UP' | 'IN_TRANSIT' | 'AT_DROP';

export interface DeliveryAddress {
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
  readonly location: { readonly latitude: number; readonly longitude: number };
}

export interface CaptainDelivery {
  readonly taskId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly taskStatus: DeliveryTaskStatus;
  readonly orderStatus:
    | 'CAPTAIN_SEARCHING'
    | 'CAPTAIN_ASSIGNED'
    | 'CAPTAIN_AT_STORE'
    | 'PICKED_UP'
    | 'OUT_FOR_DELIVERY'
    | 'CAPTAIN_AT_CUSTOMER';
  readonly assignmentId: string;
  readonly assignmentStatus: 'OFFERED' | 'ACCEPTED';
  readonly offeredEarningPaise: number;
  readonly pickupDistanceMeters: number | null;
  readonly offeredAt: string;
  readonly expiresAt: string;
  readonly assignedAt: string | null;
  readonly pickup: DeliveryAddress;
  readonly drop: DeliveryAddress;
  readonly totalPaise: number;
  readonly paymentStatus: 'COD_PENDING' | 'COD_COLLECTED';
  readonly replayed: boolean;
}

export interface DeliveryCompletion {
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

export interface DeliveryProblem {
  readonly taskId: string;
  readonly orderId: string;
  readonly reason: DeliveryProblemReason;
  readonly note: string | null;
  readonly reportedAt: string;
  readonly orderStatus: 'PROBLEM_REPORTED';
  readonly replayed: boolean;
}

export interface DeliveryRelease {
  readonly taskId: string;
  readonly orderId: string;
  readonly reason: DeliveryReleaseReason;
  readonly releasedAt: string;
  readonly taskStatus: 'SEARCHING';
  readonly orderStatus: 'CAPTAIN_SEARCHING';
  readonly replayed: boolean;
}

export type DeliveryLocation = Pick<
  CaptainLocationSample,
  'latitude' | 'longitude' | 'accuracyMeters' | 'recordedAt'
>;

export interface CaptainDeliveryPort {
  listOffers(): Promise<readonly CaptainDelivery[]>;
  getActive(): Promise<CaptainDelivery | null>;
  getTask(taskId: string): Promise<CaptainDelivery>;
  acceptOffer(assignmentId: string, idempotencyKey: string): Promise<CaptainDelivery>;
  rejectOffer(
    assignmentId: string,
    reason: DeliveryRejectionReason,
    idempotencyKey: string,
  ): Promise<void>;
  arrivePickup(
    taskId: string,
    location: DeliveryLocation,
    idempotencyKey: string,
  ): Promise<CaptainDelivery>;
  verifyPickup(
    taskId: string,
    pickupCode: string,
    idempotencyKey: string,
  ): Promise<CaptainDelivery>;
  departPickup(
    taskId: string,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<CaptainDelivery>;
  arriveDrop(
    taskId: string,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<CaptainDelivery>;
  complete(
    taskId: string,
    collectedAmountPaise: number,
    deliveryOtp: string,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<DeliveryCompletion>;
  reportProblem(
    taskId: string,
    reason: DeliveryProblemReason,
    note: string | null,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<DeliveryProblem>;
  release(
    taskId: string,
    reason: DeliveryReleaseReason,
    note: string | null,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<DeliveryRelease>;
}
