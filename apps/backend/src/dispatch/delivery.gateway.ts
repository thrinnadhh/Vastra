import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  AdminAssignInput,
  AdminDeliveryOverrideInput,
  AdminReleaseInput,
  ArrivePickupInput,
  CaptainDeliverySnapshot,
  CompleteDeliveryInput,
  DeliveryCompletionSnapshot,
  DeliveryDispatchCycleResult,
  DeliveryOfferRejectionReason,
  DeliveryOfferRejectionResult,
  DeliveryOfferWaveConfiguration,
  DeliveryOfferWaveResult,
  DeliveryProblemSnapshot,
  DeliveryReleaseSnapshot,
  DeliverySecretResult,
  DeliveryTrackingSnapshot,
  DeliveryLifecycleLocationInput,
  MerchantDeliverySnapshot,
  ReleaseDeliveryInput,
  ReportDeliveryProblemInput,
  VerifyPickupInput,
} from './delivery.types';

export interface DeliveryGateway {
  listOffers(actorId: string): Promise<readonly CaptainDeliverySnapshot[]>;
  getActive(actorId: string): Promise<CaptainDeliverySnapshot | null>;
  getTask(actorId: string, taskId: string): Promise<CaptainDeliverySnapshot | null>;
  acceptOffer(
    actorId: string,
    assignmentId: string,
    idempotencyKey: string,
  ): Promise<CaptainDeliverySnapshot>;
  rejectOffer(
    actorId: string,
    assignmentId: string,
    reason: DeliveryOfferRejectionReason,
    idempotencyKey: string,
  ): Promise<DeliveryOfferRejectionResult>;
  arrivePickup(input: ArrivePickupInput): Promise<CaptainDeliverySnapshot>;
  verifyPickup(input: VerifyPickupInput): Promise<CaptainDeliverySnapshot>;
  departPickup(input: DeliveryLifecycleLocationInput): Promise<CaptainDeliverySnapshot>;
  arriveDrop(input: DeliveryLifecycleLocationInput): Promise<CaptainDeliverySnapshot>;
  complete(input: CompleteDeliveryInput): Promise<DeliveryCompletionSnapshot>;
  reportProblem(input: ReportDeliveryProblemInput): Promise<DeliveryProblemSnapshot>;
  release(input: ReleaseDeliveryInput): Promise<DeliveryReleaseSnapshot>;
  issuePickupCode(actorId: string, orderId: string): Promise<DeliverySecretResult>;
  issueDeliveryOtp(actorId: string, orderId: string): Promise<DeliverySecretResult>;
  getCustomerTracking(actorId: string, orderId: string): Promise<DeliveryTrackingSnapshot>;
  getMerchantDelivery(actorId: string, orderId: string): Promise<MerchantDeliverySnapshot>;
  adminAssign(input: AdminAssignInput): Promise<CaptainDeliverySnapshot>;
  adminRelease(input: AdminReleaseInput): Promise<DeliveryReleaseSnapshot>;
  adminOverride(input: AdminDeliveryOverrideInput): Promise<DeliveryCompletionSnapshot>;
  getAdminTask(actorId: string, taskId: string): Promise<DeliveryTrackingSnapshot>;
  runDispatchCycle(
    configuration: DeliveryOfferWaveConfiguration,
  ): Promise<DeliveryDispatchCycleResult>;
}

export class DeliveryRequestInvalidError extends Error {}
export class DeliveryAccessDeniedError extends Error {}
export class CaptainNotEligibleError extends Error {}
export class DeliveryTaskNotFoundError extends Error {}
export class DeliveryOfferNotFoundError extends Error {}
export class DeliveryStateConflictError extends Error {}
export class DeliveryAlreadyAssignedError extends Error {}
export class CaptainAlreadyAssignedError extends Error {}
export class DeliveryIdempotencyConflictError extends Error {}
export class DeliveryOfferExpiredError extends Error {}
export class CaptainNotAtPickupError extends Error {}
export class PickupCodeInvalidError extends Error {}
export class DeliveryOtpInvalidError extends Error {}
export class DeliverySecretLockedError extends Error {}
export class CodAmountMismatchError extends Error {}
export class DeliveryGatewayUnavailableError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DeliveryGatewayUnavailableError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeliveryGatewayUnavailableError();
  }
  return value;
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return requireString(record, key);
}

function requireUuid(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!UUID_PATTERN.test(value)) throw new DeliveryGatewayUnavailableError();
  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (Number.isNaN(Date.parse(value))) throw new DeliveryGatewayUnavailableError();
  return value;
}

function nullableTimestamp(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return requireTimestamp(record, key);
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new DeliveryGatewayUnavailableError();
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const raw = record[key];
  const value = typeof raw === 'string' && raw.trim().length > 0 ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DeliveryGatewayUnavailableError();
  }
  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNumber(record, key);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DeliveryGatewayUnavailableError();
  }
  return value;
}

function nullableNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return requireNumber(record, key);
}

function parseAddress(value: unknown) {
  const record = requireRecord(value);
  const location = requireRecord(record['location']);
  return {
    label: nullableString(record, 'label'),
    recipientName: nullableString(record, 'recipientName'),
    phoneNumber: nullableString(record, 'phoneNumber'),
    line1: requireString(record, 'line1'),
    line2: nullableString(record, 'line2'),
    landmark: nullableString(record, 'landmark'),
    area: requireString(record, 'area'),
    city: requireString(record, 'city'),
    state: requireString(record, 'state'),
    postalCode: requireString(record, 'postalCode'),
    countryCode: requireString(record, 'countryCode'),
    location: {
      latitude: requireNumber(location, 'latitude'),
      longitude: requireNumber(location, 'longitude'),
    },
  };
}

export function parseCaptainDeliverySnapshot(value: unknown): CaptainDeliverySnapshot {
  const record = requireRecord(value);
  const taskStatus = record['taskStatus'];
  const assignmentStatus = record['assignmentStatus'];
  const orderStatus = record['orderStatus'];
  const paymentStatus = record['paymentStatus'];
  if (
    !['OFFERED', 'ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROP'].includes(
      String(taskStatus),
    ) ||
    !['OFFERED', 'ACCEPTED'].includes(String(assignmentStatus)) ||
    ![
      'CAPTAIN_SEARCHING',
      'CAPTAIN_ASSIGNED',
      'CAPTAIN_AT_STORE',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'CAPTAIN_AT_CUSTOMER',
    ].includes(String(orderStatus)) ||
    !['COD_PENDING', 'COD_COLLECTED'].includes(String(paymentStatus))
  ) {
    throw new DeliveryGatewayUnavailableError();
  }

  return {
    taskId: requireUuid(record, 'taskId'),
    orderId: requireUuid(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    taskStatus: taskStatus as CaptainDeliverySnapshot['taskStatus'],
    orderStatus: orderStatus as CaptainDeliverySnapshot['orderStatus'],
    assignmentId: requireUuid(record, 'assignmentId'),
    assignmentStatus: assignmentStatus as CaptainDeliverySnapshot['assignmentStatus'],
    offeredEarningPaise: requireNonNegativeInteger(record, 'offeredEarningPaise'),
    pickupDistanceMeters: nullableNumber(record, 'pickupDistanceMeters'),
    offeredAt: requireTimestamp(record, 'offeredAt'),
    expiresAt: requireTimestamp(record, 'expiresAt'),
    assignedAt: nullableTimestamp(record, 'assignedAt'),
    pickup: parseAddress(record['pickup']),
    drop: parseAddress(record['drop']),
    totalPaise: requireNonNegativeInteger(record, 'totalPaise'),
    paymentStatus: paymentStatus as CaptainDeliverySnapshot['paymentStatus'],
    replayed: requireBoolean(record, 'replayed'),
  };
}

export function parseDeliverySecret(value: unknown): DeliverySecretResult {
  const record = requireRecord(value);
  const kind = record['kind'];
  const secret = requireString(record, 'secret');
  if ((kind !== 'PICKUP_CODE' && kind !== 'DELIVERY_OTP') || !/^\d{6}$/u.test(secret)) {
    throw new DeliveryGatewayUnavailableError();
  }
  return {
    orderId: requireUuid(record, 'orderId'),
    deliveryTaskId: requireUuid(record, 'deliveryTaskId'),
    kind,
    secret,
    issuedAt: requireTimestamp(record, 'issuedAt'),
    expiresAt: requireTimestamp(record, 'expiresAt'),
  };
}

function parseRejection(value: unknown): DeliveryOfferRejectionResult {
  const record = requireRecord(value);
  const reason = requireString(record, 'reason') as DeliveryOfferRejectionReason;
  return {
    assignmentId: requireUuid(record, 'assignmentId'),
    deliveryTaskId: requireUuid(record, 'deliveryTaskId'),
    assignmentStatus: 'REJECTED',
    reason,
    respondedAt: requireTimestamp(record, 'respondedAt'),
    replayed: requireBoolean(record, 'replayed'),
  };
}

function parseCompletion(value: unknown): DeliveryCompletionSnapshot {
  const record = requireRecord(value);
  if (
    record['taskStatus'] !== 'COMPLETED' ||
    record['orderStatus'] !== 'DELIVERED' ||
    record['paymentStatus'] !== 'COD_COLLECTED'
  ) {
    throw new DeliveryGatewayUnavailableError();
  }
  return {
    taskId: requireUuid(record, 'taskId'),
    orderId: requireUuid(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    taskStatus: 'COMPLETED',
    orderStatus: 'DELIVERED',
    paymentStatus: 'COD_COLLECTED',
    collectedAmountPaise: requireNonNegativeInteger(record, 'collectedAmountPaise'),
    captainEarningPaise: requireNonNegativeInteger(record, 'captainEarningPaise'),
    completedAt: requireTimestamp(record, 'completedAt'),
    replayed: requireBoolean(record, 'replayed'),
  };
}

function parseProblem(value: unknown): DeliveryProblemSnapshot {
  const record = requireRecord(value);
  if (record['orderStatus'] !== 'PROBLEM_REPORTED') {
    throw new DeliveryGatewayUnavailableError();
  }
  return {
    taskId: requireUuid(record, 'taskId'),
    orderId: requireUuid(record, 'orderId'),
    reason: requireString(record, 'reason') as DeliveryProblemSnapshot['reason'],
    note: nullableString(record, 'note'),
    reportedAt: requireTimestamp(record, 'reportedAt'),
    orderStatus: 'PROBLEM_REPORTED',
    replayed: requireBoolean(record, 'replayed'),
  };
}

function parseRelease(value: unknown): DeliveryReleaseSnapshot {
  const record = requireRecord(value);
  if (record['taskStatus'] !== 'SEARCHING' || record['orderStatus'] !== 'CAPTAIN_SEARCHING') {
    throw new DeliveryGatewayUnavailableError();
  }
  return {
    taskId: requireUuid(record, 'taskId'),
    orderId: requireUuid(record, 'orderId'),
    reason: requireString(record, 'reason') as DeliveryReleaseSnapshot['reason'],
    releasedAt: requireTimestamp(record, 'releasedAt'),
    taskStatus: 'SEARCHING',
    orderStatus: 'CAPTAIN_SEARCHING',
    replayed: requireBoolean(record, 'replayed'),
  };
}

function parseTracking(value: unknown): DeliveryTrackingSnapshot {
  const record = requireRecord(value);
  const captainValue = record['captain'];
  const locationValue = record['location'];
  return {
    orderId: requireUuid(record, 'orderId'),
    deliveryTaskId: requireUuid(record, 'deliveryTaskId'),
    orderNumber: requireString(record, 'orderNumber'),
    orderStatus: requireString(record, 'orderStatus') as DeliveryTrackingSnapshot['orderStatus'],
    taskStatus: requireString(record, 'taskStatus') as DeliveryTrackingSnapshot['taskStatus'],
    captain:
      captainValue === null
        ? null
        : (() => {
            const captain = requireRecord(captainValue);
            return {
              id: requireUuid(captain, 'id'),
              displayName: nullableString(captain, 'displayName'),
              phoneLast4: nullableString(captain, 'phoneLast4'),
              vehicleType: nullableString(captain, 'vehicleType'),
              vehicleNumberLast4: nullableString(captain, 'vehicleNumberLast4'),
            };
          })(),
    location:
      locationValue === null
        ? null
        : (() => {
            const location = requireRecord(locationValue);
            return {
              latitude: requireNumber(location, 'latitude'),
              longitude: requireNumber(location, 'longitude'),
              recordedAt: requireTimestamp(location, 'recordedAt'),
              stale: requireBoolean(location, 'stale'),
            };
          })(),
    estimatedArrivalAt: nullableTimestamp(record, 'estimatedArrivalAt'),
    updatedAt: requireTimestamp(record, 'updatedAt'),
  };
}

function parseMerchantDelivery(value: unknown): MerchantDeliverySnapshot {
  const record = requireRecord(value);
  return {
    orderId: requireUuid(record, 'orderId'),
    deliveryTaskId: requireUuid(record, 'deliveryTaskId'),
    orderNumber: requireString(record, 'orderNumber'),
    orderStatus: requireString(record, 'orderStatus'),
    taskStatus: requireString(record, 'taskStatus') as MerchantDeliverySnapshot['taskStatus'],
    captainAssigned: requireBoolean(record, 'captainAssigned'),
    captainAtStore: requireBoolean(record, 'captainAtStore'),
    pickedUpAt: nullableTimestamp(record, 'pickedUpAt'),
    updatedAt: requireTimestamp(record, 'updatedAt'),
  };
}

function parseOfferWave(value: unknown): DeliveryOfferWaveResult {
  const record = requireRecord(value);
  const taskStatus = record['taskStatus'];
  if (taskStatus !== 'SEARCHING' && taskStatus !== 'OFFERED') {
    throw new DeliveryGatewayUnavailableError();
  }
  return {
    deliveryTaskId: requireUuid(record, 'deliveryTaskId'),
    taskStatus,
    waveNumber: requireNonNegativeInteger(record, 'waveNumber'),
    radiusMeters: requireNonNegativeInteger(record, 'radiusMeters'),
    offersCreated: requireNonNegativeInteger(record, 'offersCreated'),
    offersExpired: requireNonNegativeInteger(record, 'offersExpired'),
    nextOfferWaveAt: requireTimestamp(record, 'nextOfferWaveAt'),
    replayed: requireBoolean(record, 'replayed'),
  };
}

export function parseDispatchCycle(value: unknown): DeliveryDispatchCycleResult {
  const record = requireRecord(value);
  const failures = record['dispatchFailures'];
  const taskResults = record['taskResults'];
  if (!Array.isArray(failures) || !Array.isArray(taskResults)) {
    throw new DeliveryGatewayUnavailableError();
  }
  return {
    workerId: requireString(record, 'workerId'),
    dispatchesStarted: requireNonNegativeInteger(record, 'dispatchesStarted'),
    dispatchFailures: failures.map((failure) => {
      const item = requireRecord(failure);
      return {
        resourceId: requireUuid(item, 'resourceId'),
        sqlState: requireString(item, 'sqlState'),
      };
    }),
    taskResults: taskResults.map(parseOfferWave),
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  switch (error.code) {
    case 'P0050':
      return new DeliveryRequestInvalidError();
    case 'P0051':
      return new DeliveryAccessDeniedError();
    case 'P0052':
      return new DeliveryTaskNotFoundError();
    case 'P0053':
      return new DeliveryOfferNotFoundError();
    case 'P0054':
      return new DeliveryStateConflictError();
    case 'P0055':
      return new DeliveryAlreadyAssignedError();
    case 'P0056':
      return new CaptainAlreadyAssignedError();
    case 'P0057':
      return new DeliveryIdempotencyConflictError();
    case 'P0058':
      return new DeliveryOfferExpiredError();
    case 'P0059':
      return new CaptainNotAtPickupError();
    case 'P0060':
      return new CaptainNotEligibleError();
    case 'P0061':
      return new PickupCodeInvalidError();
    case 'P0062':
      return new DeliveryOtpInvalidError();
    case 'P0063':
      return new DeliverySecretLockedError();
    case 'P0064':
      return new CodAmountMismatchError();
    default:
      return new DeliveryGatewayUnavailableError();
  }
}

function isKnown(error: unknown): boolean {
  return (
    error instanceof DeliveryRequestInvalidError ||
    error instanceof DeliveryAccessDeniedError ||
    error instanceof CaptainNotEligibleError ||
    error instanceof DeliveryTaskNotFoundError ||
    error instanceof DeliveryOfferNotFoundError ||
    error instanceof DeliveryStateConflictError ||
    error instanceof DeliveryAlreadyAssignedError ||
    error instanceof CaptainAlreadyAssignedError ||
    error instanceof DeliveryIdempotencyConflictError ||
    error instanceof DeliveryOfferExpiredError ||
    error instanceof CaptainNotAtPickupError ||
    error instanceof PickupCodeInvalidError ||
    error instanceof DeliveryOtpInvalidError ||
    error instanceof DeliverySecretLockedError ||
    error instanceof CodAmountMismatchError ||
    error instanceof DeliveryGatewayUnavailableError
  );
}

function locationArgs(location: DeliveryLifecycleLocationInput['location']) {
  return {
    p_latitude: location?.latitude ?? null,
    p_longitude: location?.longitude ?? null,
    p_accuracy_meters: location?.accuracyMeters ?? null,
    p_recorded_at: location?.recordedAt ?? null,
  };
}

@Injectable()
export class SupabaseDeliveryGateway implements DeliveryGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await this.client.rpc(name, args);
      if (response.error !== null) throw mapRpcError(response.error);
      return response.data;
    } catch (error: unknown) {
      if (isKnown(error)) throw error;
      throw new DeliveryGatewayUnavailableError();
    }
  }

  public async listOffers(actorId: string): Promise<readonly CaptainDeliverySnapshot[]> {
    const data = await this.rpc('list_captain_delivery_offers', { p_actor: actorId });
    if (!Array.isArray(data)) throw new DeliveryGatewayUnavailableError();
    return data.map(parseCaptainDeliverySnapshot);
  }

  public async getActive(actorId: string): Promise<CaptainDeliverySnapshot | null> {
    const data = await this.rpc('get_captain_active_delivery', { p_actor: actorId });
    return data === null ? null : parseCaptainDeliverySnapshot(data);
  }

  public async getTask(actorId: string, taskId: string): Promise<CaptainDeliverySnapshot | null> {
    const data = await this.rpc('get_captain_delivery', {
      p_actor: actorId,
      p_delivery_task_id: taskId,
    });
    return data === null ? null : parseCaptainDeliverySnapshot(data);
  }

  public async acceptOffer(
    actorId: string,
    assignmentId: string,
    idempotencyKey: string,
  ): Promise<CaptainDeliverySnapshot> {
    const data = requireRecord(
      await this.rpc('respond_delivery_offer', {
        p_actor: actorId,
        p_assignment_id: assignmentId,
        p_action: 'ACCEPT',
        p_rejection_reason: null,
        p_idempotency_key: idempotencyKey,
      }),
    );
    if (data['outcome'] === 'EXPIRED') throw new DeliveryOfferExpiredError();
    if (data['outcome'] !== 'ACCEPTED') throw new DeliveryGatewayUnavailableError();
    return {
      ...parseCaptainDeliverySnapshot(data['delivery']),
      replayed: requireBoolean(data, 'replayed'),
    };
  }

  public async rejectOffer(
    actorId: string,
    assignmentId: string,
    reason: DeliveryOfferRejectionReason,
    idempotencyKey: string,
  ): Promise<DeliveryOfferRejectionResult> {
    const data = requireRecord(
      await this.rpc('respond_delivery_offer', {
        p_actor: actorId,
        p_assignment_id: assignmentId,
        p_action: 'REJECT',
        p_rejection_reason: reason,
        p_idempotency_key: idempotencyKey,
      }),
    );
    if (data['outcome'] === 'EXPIRED') throw new DeliveryOfferExpiredError();
    if (data['outcome'] !== 'REJECTED') throw new DeliveryGatewayUnavailableError();
    return {
      ...parseRejection(data['rejection']),
      replayed: requireBoolean(data, 'replayed'),
    };
  }

  public async arrivePickup(input: ArrivePickupInput): Promise<CaptainDeliverySnapshot> {
    return parseCaptainDeliverySnapshot(
      await this.rpc('arrive_delivery_pickup', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_idempotency_key: input.idempotencyKey,
        p_latitude: input.latitude,
        p_longitude: input.longitude,
        p_accuracy_meters: input.accuracyMeters,
        p_recorded_at: input.recordedAt,
      }),
    );
  }

  public async verifyPickup(input: VerifyPickupInput): Promise<CaptainDeliverySnapshot> {
    const result = requireRecord(
      await this.rpc('verify_delivery_pickup', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_pickup_code: input.pickupCode,
        p_idempotency_key: input.idempotencyKey,
      }),
    );
    if (result['outcome'] === 'INVALID') throw new PickupCodeInvalidError();
    if (result['outcome'] === 'LOCKED') throw new DeliverySecretLockedError();
    return parseCaptainDeliverySnapshot(result);
  }

  public async departPickup(
    input: DeliveryLifecycleLocationInput,
  ): Promise<CaptainDeliverySnapshot> {
    return parseCaptainDeliverySnapshot(
      await this.rpc('depart_delivery_pickup', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_idempotency_key: input.idempotencyKey,
        ...locationArgs(input.location),
      }),
    );
  }

  public async arriveDrop(input: DeliveryLifecycleLocationInput): Promise<CaptainDeliverySnapshot> {
    return parseCaptainDeliverySnapshot(
      await this.rpc('arrive_delivery_drop', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_idempotency_key: input.idempotencyKey,
        ...locationArgs(input.location),
      }),
    );
  }

  public async complete(input: CompleteDeliveryInput): Promise<DeliveryCompletionSnapshot> {
    const result = requireRecord(
      await this.rpc('complete_cod_delivery', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_collected_amount_paise: input.collectedAmountPaise,
        p_delivery_otp: input.deliveryOtp,
        p_idempotency_key: input.idempotencyKey,
        ...locationArgs(input.location),
      }),
    );
    if (result['outcome'] === 'INVALID') throw new DeliveryOtpInvalidError();
    if (result['outcome'] === 'LOCKED') throw new DeliverySecretLockedError();
    return parseCompletion(result);
  }

  public async reportProblem(input: ReportDeliveryProblemInput): Promise<DeliveryProblemSnapshot> {
    return parseProblem(
      await this.rpc('report_delivery_problem', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_reason: input.reason,
        p_note: input.note,
        p_evidence_object_key: input.evidenceObjectKey,
        p_idempotency_key: input.idempotencyKey,
        ...locationArgs(input.location),
      }),
    );
  }

  public async release(input: ReleaseDeliveryInput): Promise<DeliveryReleaseSnapshot> {
    return parseRelease(
      await this.rpc('release_delivery_task', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_reason: input.reason,
        p_note: input.note,
        p_admin_override: false,
        p_idempotency_key: input.idempotencyKey,
        ...locationArgs(input.location),
      }),
    );
  }

  public async issuePickupCode(actorId: string, orderId: string): Promise<DeliverySecretResult> {
    return parseDeliverySecret(
      await this.rpc('issue_merchant_pickup_code', { p_actor: actorId, p_order_id: orderId }),
    );
  }

  public async issueDeliveryOtp(actorId: string, orderId: string): Promise<DeliverySecretResult> {
    return parseDeliverySecret(
      await this.rpc('issue_customer_delivery_otp', { p_actor: actorId, p_order_id: orderId }),
    );
  }

  public async getCustomerTracking(
    actorId: string,
    orderId: string,
  ): Promise<DeliveryTrackingSnapshot> {
    return parseTracking(
      await this.rpc('get_customer_delivery_tracking', {
        p_actor: actorId,
        p_order_id: orderId,
      }),
    );
  }

  public async getMerchantDelivery(
    actorId: string,
    orderId: string,
  ): Promise<MerchantDeliverySnapshot> {
    return parseMerchantDelivery(
      await this.rpc('get_merchant_order_delivery', {
        p_actor: actorId,
        p_order_id: orderId,
      }),
    );
  }

  public async adminAssign(input: AdminAssignInput): Promise<CaptainDeliverySnapshot> {
    return parseCaptainDeliverySnapshot(
      await this.rpc('admin_assign_delivery_task', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_captain_id: input.captainId,
        p_idempotency_key: input.idempotencyKey,
      }),
    );
  }

  public async adminRelease(input: AdminReleaseInput): Promise<DeliveryReleaseSnapshot> {
    return parseRelease(
      await this.rpc('release_delivery_task', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_reason: input.reason,
        p_note: input.note,
        p_admin_override: true,
        p_idempotency_key: input.idempotencyKey,
        p_latitude: null,
        p_longitude: null,
        p_accuracy_meters: null,
        p_recorded_at: null,
      }),
    );
  }

  public async adminOverride(
    input: AdminDeliveryOverrideInput,
  ): Promise<DeliveryCompletionSnapshot> {
    return parseCompletion(
      await this.rpc('admin_override_cod_delivery', {
        p_actor: input.actorId,
        p_delivery_task_id: input.taskId,
        p_collected_amount_paise: input.collectedAmountPaise,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
      }),
    );
  }

  public async getAdminTask(actorId: string, taskId: string): Promise<DeliveryTrackingSnapshot> {
    return parseTracking(
      await this.rpc('get_admin_delivery_task', {
        p_actor: actorId,
        p_delivery_task_id: taskId,
      }),
    );
  }

  public async runDispatchCycle(
    configuration: DeliveryOfferWaveConfiguration,
  ): Promise<DeliveryDispatchCycleResult> {
    return parseDispatchCycle(
      await this.rpc('run_delivery_dispatch_cycle', {
        p_worker_id: configuration.workerId,
        p_limit: configuration.limit,
        p_initial_radius_meters: configuration.initialRadiusMeters,
        p_radius_step_meters: configuration.radiusStepMeters,
        p_max_radius_meters: configuration.maxRadiusMeters,
        p_captains_per_wave: configuration.captainsPerWave,
        p_offer_lifetime_seconds: configuration.offerLifetimeSeconds,
        p_wave_interval_seconds: configuration.waveIntervalSeconds,
      }),
    );
  }
}
