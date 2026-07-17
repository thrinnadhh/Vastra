import type { SupabaseClient } from '../auth/supabase-client.type';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  CaptainNotAtPickupError,
  CodAmountMismatchError,
  DeliveryAlreadyAssignedError,
  type DeliveryGateway,
  DeliveryOtpInvalidError,
  DeliverySecretLockedError,
  PickupCodeInvalidError,
} from './delivery.gateway';
import { DeliveryService } from './delivery.service';
import type {
  AdminAssignInput,
  AdminDeliveryOverrideInput,
  AdminReleaseInput,
  ArrivePickupInput,
  CaptainDeliverySnapshot,
  CompleteDeliveryInput,
  DeliveryCompletionSnapshot,
  DeliveryDispatchCycleResult,
  DeliveryLifecycleLocationInput,
  DeliveryOfferRejectionReason,
  DeliveryOfferRejectionResult,
  DeliveryOfferWaveConfiguration,
  DeliveryProblemSnapshot,
  DeliveryReleaseSnapshot,
  DeliverySecretResult,
  DeliveryTrackingSnapshot,
  MerchantDeliverySnapshot,
  ReleaseDeliveryInput,
  ReportDeliveryProblemInput,
  VerifyPickupInput,
} from './delivery.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const TASK_ID = '20000000-0000-4000-8000-000000000001';
const ASSIGNMENT_ID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';
const ORDER_ID = '50000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;
const context: AuthenticatedRequestContext = {
  actor: { id: ACTOR_ID, email: 'captain@example.test', accountType: 'CAPTAIN', status: 'ACTIVE' },
  accessToken: 'token',
  supabase: emptyClient,
};

function snapshot(
  taskStatus: CaptainDeliverySnapshot['taskStatus'] = 'ASSIGNED',
): CaptainDeliverySnapshot {
  return {
    taskId: TASK_ID,
    orderId: ORDER_ID,
    orderNumber: 'VAS-S8-1',
    taskStatus,
    orderStatus: taskStatus === 'AT_PICKUP' ? 'CAPTAIN_AT_STORE' : 'CAPTAIN_ASSIGNED',
    assignmentId: ASSIGNMENT_ID,
    assignmentStatus: 'ACCEPTED',
    offeredEarningPaise: 4000,
    pickupDistanceMeters: 500,
    offeredAt: '2026-07-17T09:59:30.000Z',
    expiresAt: '2026-07-17T10:00:30.000Z',
    assignedAt: '2026-07-17T10:00:00.000Z',
    pickup: {
      label: 'Shop',
      recipientName: 'Test Shop',
      phoneNumber: '9000000000',
      line1: 'Main Road',
      line2: null,
      landmark: null,
      area: 'Tirupati',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      postalCode: '517501',
      countryCode: 'IN',
      location: { latitude: 13.628, longitude: 79.419 },
    },
    drop: {
      label: 'Home',
      recipientName: 'Customer',
      phoneNumber: '9000000001',
      line1: 'Renigunta Road',
      line2: null,
      landmark: null,
      area: 'Tirupati',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      postalCode: '517501',
      countryCode: 'IN',
      location: { latitude: 13.63, longitude: 79.42 },
    },
    totalPaise: 149900,
    paymentStatus: 'COD_PENDING',
    replayed: false,
  };
}

const tracking: DeliveryTrackingSnapshot = {
  orderId: ORDER_ID,
  deliveryTaskId: TASK_ID,
  orderNumber: 'VAS-S8-1',
  orderStatus: 'OUT_FOR_DELIVERY',
  taskStatus: 'IN_TRANSIT',
  captain: {
    id: ACTOR_ID,
    displayName: 'Captain',
    phoneLast4: '0000',
    vehicleType: 'BIKE',
    vehicleNumberLast4: '1234',
  },
  location: {
    latitude: 13.628,
    longitude: 79.419,
    recordedAt: '2026-07-17T10:00:00.000Z',
    stale: false,
  },
  estimatedArrivalAt: null,
  updatedAt: '2026-07-17T10:00:00.000Z',
};

class StubGateway implements DeliveryGateway {
  public error: Error | null = null;
  public acceptCall: readonly string[] | null = null;
  public arrival: ArrivePickupInput | null = null;
  public verification: VerifyPickupInput | null = null;
  public completion: CompleteDeliveryInput | null = null;

  private result<T>(value: T): Promise<T> {
    return this.error === null ? Promise.resolve(value) : Promise.reject(this.error);
  }

  public listOffers(): Promise<readonly CaptainDeliverySnapshot[]> {
    return this.result([snapshot()]);
  }
  public getActive(): Promise<CaptainDeliverySnapshot | null> {
    return this.result(snapshot());
  }
  public getTask(): Promise<CaptainDeliverySnapshot | null> {
    return this.result(snapshot());
  }
  public acceptOffer(
    actorId: string,
    assignmentId: string,
    idempotencyKey: string,
  ): Promise<CaptainDeliverySnapshot> {
    this.acceptCall = [actorId, assignmentId, idempotencyKey];
    return this.result(snapshot());
  }
  public rejectOffer(
    _actorId: string,
    _assignmentId: string,
    reason: DeliveryOfferRejectionReason,
  ): Promise<DeliveryOfferRejectionResult> {
    return this.result({
      assignmentId: ASSIGNMENT_ID,
      deliveryTaskId: TASK_ID,
      assignmentStatus: 'REJECTED',
      reason,
      respondedAt: '2026-07-17T10:00:00.000Z',
      replayed: false,
    });
  }
  public arrivePickup(input: ArrivePickupInput): Promise<CaptainDeliverySnapshot> {
    this.arrival = input;
    return this.result(snapshot('AT_PICKUP'));
  }
  public verifyPickup(input: VerifyPickupInput): Promise<CaptainDeliverySnapshot> {
    this.verification = input;
    return this.result(snapshot('PICKED_UP'));
  }
  public departPickup(_input: DeliveryLifecycleLocationInput): Promise<CaptainDeliverySnapshot> {
    return this.result(snapshot('IN_TRANSIT'));
  }
  public arriveDrop(_input: DeliveryLifecycleLocationInput): Promise<CaptainDeliverySnapshot> {
    return this.result(snapshot('AT_DROP'));
  }
  public complete(input: CompleteDeliveryInput): Promise<DeliveryCompletionSnapshot> {
    this.completion = input;
    return this.result({
      taskId: TASK_ID,
      orderId: ORDER_ID,
      orderNumber: 'VAS-S8-1',
      taskStatus: 'COMPLETED',
      orderStatus: 'DELIVERED',
      paymentStatus: 'COD_COLLECTED',
      collectedAmountPaise: 149900,
      captainEarningPaise: 4000,
      completedAt: '2026-07-17T11:00:00.000Z',
      replayed: false,
    });
  }
  public reportProblem(input: ReportDeliveryProblemInput): Promise<DeliveryProblemSnapshot> {
    return this.result({
      taskId: TASK_ID,
      orderId: ORDER_ID,
      reason: input.reason,
      note: input.note,
      reportedAt: '2026-07-17T11:00:00.000Z',
      orderStatus: 'PROBLEM_REPORTED',
      replayed: false,
    });
  }
  public release(input: ReleaseDeliveryInput): Promise<DeliveryReleaseSnapshot> {
    return this.result({
      taskId: TASK_ID,
      orderId: ORDER_ID,
      reason: input.reason,
      releasedAt: '2026-07-17T11:00:00.000Z',
      taskStatus: 'SEARCHING',
      orderStatus: 'CAPTAIN_SEARCHING',
      replayed: false,
    });
  }
  public issuePickupCode(): Promise<DeliverySecretResult> {
    return this.result({
      orderId: ORDER_ID,
      deliveryTaskId: TASK_ID,
      kind: 'PICKUP_CODE',
      secret: '123456',
      issuedAt: '2026-07-17T10:00:00.000Z',
      expiresAt: '2026-07-17T10:30:00.000Z',
    });
  }
  public issueDeliveryOtp(): Promise<DeliverySecretResult> {
    return this.result({
      orderId: ORDER_ID,
      deliveryTaskId: TASK_ID,
      kind: 'DELIVERY_OTP',
      secret: '654321',
      issuedAt: '2026-07-17T10:00:00.000Z',
      expiresAt: '2026-07-17T11:00:00.000Z',
    });
  }
  public getCustomerTracking(): Promise<DeliveryTrackingSnapshot> {
    return this.result(tracking);
  }
  public getMerchantDelivery(): Promise<MerchantDeliverySnapshot> {
    return this.result({
      orderId: ORDER_ID,
      deliveryTaskId: TASK_ID,
      orderNumber: 'VAS-S8-1',
      orderStatus: 'OUT_FOR_DELIVERY',
      taskStatus: 'IN_TRANSIT',
      captainAssigned: true,
      captainAtStore: false,
      pickedUpAt: '2026-07-17T10:15:00.000Z',
      updatedAt: '2026-07-17T10:30:00.000Z',
    });
  }
  public adminAssign(_input: AdminAssignInput): Promise<CaptainDeliverySnapshot> {
    return this.result(snapshot());
  }
  public adminRelease(input: AdminReleaseInput): Promise<DeliveryReleaseSnapshot> {
    return this.release({ ...input, location: null });
  }
  public adminOverride(_input: AdminDeliveryOverrideInput): Promise<DeliveryCompletionSnapshot> {
    return this.complete({} as CompleteDeliveryInput);
  }
  public getAdminTask(): Promise<DeliveryTrackingSnapshot> {
    return this.result(tracking);
  }
  public runDispatchCycle(
    _configuration: DeliveryOfferWaveConfiguration,
  ): Promise<DeliveryDispatchCycleResult> {
    return this.result({
      workerId: 'worker',
      dispatchesStarted: 0,
      dispatchFailures: [],
      taskResults: [],
    });
  }
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('getResponse' in error)) return null;
  const response = (error as { getResponse(): unknown }).getResponse();
  if (typeof response !== 'object' || response === null) return null;
  const nested = (response as Record<string, unknown>)['error'];
  if (typeof nested !== 'object' || nested === null) return null;
  const code = (nested as Record<string, unknown>)['code'];
  return typeof code === 'string' ? code : null;
}

describe('DeliveryService', () => {
  let gateway: StubGateway;
  let service: DeliveryService;

  beforeEach(() => {
    gateway = new StubGateway();
    service = new DeliveryService(gateway);
  });

  it('passes actor, assignment and idempotency key into exclusive acceptance', async () => {
    const response = await service.acceptOffer(context, ASSIGNMENT_ID, KEY);
    expect(gateway.acceptCall).toStrictEqual([ACTOR_ID, ASSIGNMENT_ID, KEY]);
    expect(response.data.delivery.taskStatus).toBe('ASSIGNED');
  });

  it('passes nested arrival location and pickup code into lifecycle commands', async () => {
    const location = {
      latitude: 13.628,
      longitude: 79.419,
      accuracyMeters: 10,
      recordedAt: '2026-07-17T10:00:00.000Z',
    };
    await service.arrivePickup(context, TASK_ID, KEY, { location });
    await service.verifyPickup(context, TASK_ID, KEY, { pickupCode: '123456' });
    expect(gateway.arrival).toMatchObject({ actorId: ACTOR_ID, ...location });
    expect(gateway.verification?.pickupCode).toBe('123456');
  });

  it('passes exact COD amount and OTP into atomic completion', async () => {
    const response = await service.complete(context, TASK_ID, KEY, {
      collectedAmountPaise: 149900,
      deliveryOtp: '654321',
    });
    expect(gateway.completion).toMatchObject({
      actorId: ACTOR_ID,
      collectedAmountPaise: 149900,
      deliveryOtp: '654321',
    });
    expect(response.data.completion.orderStatus).toBe('DELIVERED');
  });

  it.each([
    [new DeliveryAlreadyAssignedError(), 'DELIVERY_TASK_ALREADY_ASSIGNED'],
    [new CaptainNotAtPickupError(), 'CAPTAIN_NOT_AT_PICKUP'],
    [new PickupCodeInvalidError(), 'PICKUP_CODE_INVALID'],
    [new DeliveryOtpInvalidError(), 'DELIVERY_OTP_INVALID'],
    [new DeliverySecretLockedError(), 'DELIVERY_SECRET_LOCKED'],
    [new CodAmountMismatchError(), 'COD_AMOUNT_MISMATCH'],
  ])('maps delivery gateway errors to stable API codes', async (failure: Error, code: string) => {
    gateway.error = failure;
    await expect(service.acceptOffer(context, ASSIGNMENT_ID, KEY)).rejects.toSatisfy(
      (candidate: unknown) => errorCode(candidate) === code,
    );
  });
});
