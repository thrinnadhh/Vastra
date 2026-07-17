import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SupabaseClient } from '../auth/supabase-client.type';
import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { DeliveryController } from './delivery.controller';
import type { DeliveryGateway } from './delivery.gateway';
import { DeliveryService } from './delivery.service';
import { DELIVERY_GATEWAY } from './delivery.tokens';
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
const context: AuthenticatedRequestContext = {
  actor: { id: ACTOR_ID, email: 'captain@example.test', accountType: 'CAPTAIN', status: 'ACTIVE' },
  accessToken: 'token',
  supabase: Object.freeze({}) as unknown as SupabaseClient,
};

function delivery(status: CaptainDeliverySnapshot['taskStatus']): CaptainDeliverySnapshot {
  const orderStatus =
    status === 'OFFERED'
      ? 'CAPTAIN_SEARCHING'
      : status === 'AT_PICKUP'
        ? 'CAPTAIN_AT_STORE'
        : status === 'PICKED_UP'
          ? 'PICKED_UP'
          : status === 'IN_TRANSIT'
            ? 'OUT_FOR_DELIVERY'
            : status === 'AT_DROP'
              ? 'CAPTAIN_AT_CUSTOMER'
              : 'CAPTAIN_ASSIGNED';
  return {
    taskId: TASK_ID,
    orderId: ORDER_ID,
    orderNumber: 'VAS-S8-1',
    taskStatus: status,
    orderStatus,
    assignmentId: ASSIGNMENT_ID,
    assignmentStatus: status === 'OFFERED' ? 'OFFERED' : 'ACCEPTED',
    offeredEarningPaise: 4000,
    pickupDistanceMeters: 500,
    offeredAt: '2026-07-17T10:00:00.000Z',
    expiresAt: '2026-07-17T10:00:30.000Z',
    assignedAt: status === 'OFFERED' ? null : '2026-07-17T10:00:05.000Z',
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
  location: null,
  estimatedArrivalAt: null,
  updatedAt: '2026-07-17T10:00:00.000Z',
};

class Gateway implements DeliveryGateway {
  public listOffers(): Promise<readonly CaptainDeliverySnapshot[]> {
    return Promise.resolve([delivery('OFFERED')]);
  }
  public getActive(): Promise<CaptainDeliverySnapshot | null> {
    return Promise.resolve(delivery('ASSIGNED'));
  }
  public getTask(): Promise<CaptainDeliverySnapshot | null> {
    return Promise.resolve(delivery('ASSIGNED'));
  }
  public acceptOffer(): Promise<CaptainDeliverySnapshot> {
    return Promise.resolve(delivery('ASSIGNED'));
  }
  public rejectOffer(
    _actorId: string,
    _assignmentId: string,
    reason: DeliveryOfferRejectionReason,
  ): Promise<DeliveryOfferRejectionResult> {
    return Promise.resolve({
      assignmentId: ASSIGNMENT_ID,
      deliveryTaskId: TASK_ID,
      assignmentStatus: 'REJECTED',
      reason,
      respondedAt: '2026-07-17T10:00:00.000Z',
      replayed: false,
    });
  }
  public arrivePickup(_input: ArrivePickupInput): Promise<CaptainDeliverySnapshot> {
    return Promise.resolve(delivery('AT_PICKUP'));
  }
  public verifyPickup(_input: VerifyPickupInput): Promise<CaptainDeliverySnapshot> {
    return Promise.resolve(delivery('PICKED_UP'));
  }
  public departPickup(_input: DeliveryLifecycleLocationInput): Promise<CaptainDeliverySnapshot> {
    return Promise.resolve(delivery('IN_TRANSIT'));
  }
  public arriveDrop(_input: DeliveryLifecycleLocationInput): Promise<CaptainDeliverySnapshot> {
    return Promise.resolve(delivery('AT_DROP'));
  }
  public complete(_input: CompleteDeliveryInput): Promise<DeliveryCompletionSnapshot> {
    return Promise.resolve({
      taskId: TASK_ID,
      orderId: ORDER_ID,
      orderNumber: 'VAS-S8-1',
      taskStatus: 'COMPLETED' as const,
      orderStatus: 'DELIVERED' as const,
      paymentStatus: 'COD_COLLECTED' as const,
      collectedAmountPaise: 149900,
      captainEarningPaise: 4000,
      completedAt: '2026-07-17T11:00:00.000Z',
      replayed: false,
    });
  }
  public reportProblem(input: ReportDeliveryProblemInput): Promise<DeliveryProblemSnapshot> {
    return Promise.resolve({
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
    return Promise.resolve({
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
    throw new Error('not used');
  }
  public issueDeliveryOtp(): Promise<DeliverySecretResult> {
    throw new Error('not used');
  }
  public getCustomerTracking(): Promise<DeliveryTrackingSnapshot> {
    return Promise.resolve(tracking);
  }
  public getMerchantDelivery(): Promise<MerchantDeliverySnapshot> {
    throw new Error('not used');
  }
  public adminAssign(_input: AdminAssignInput): Promise<CaptainDeliverySnapshot> {
    return Promise.resolve(delivery('ASSIGNED'));
  }
  public adminRelease(input: AdminReleaseInput): Promise<DeliveryReleaseSnapshot> {
    return this.release({ ...input, location: null });
  }
  public adminOverride(_input: AdminDeliveryOverrideInput): Promise<DeliveryCompletionSnapshot> {
    return this.complete({} as CompleteDeliveryInput);
  }
  public getAdminTask(): Promise<DeliveryTrackingSnapshot> {
    return Promise.resolve(tracking);
  }
  public runDispatchCycle(
    _configuration: DeliveryOfferWaveConfiguration,
  ): Promise<DeliveryDispatchCycleResult> {
    return Promise.resolve({
      workerId: 'worker',
      dispatchesStarted: 0,
      dispatchFailures: [],
      taskResults: [],
    });
  }
}

describe('delivery HTTP integration', () => {
  let app: INestApplication | undefined;
  let server: Server;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DeliveryController],
      providers: [DeliveryService, { provide: DELIVERY_GATEWAY, useClass: Gateway }],
    }).compile();
    app = module.createNestApplication();
    app.use((incoming: AuthenticatedHttpRequest, _response: unknown, next: () => void) => {
      incoming.authContext = context;
      next();
    });
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(async () => app?.close());

  it('lists and accepts captain offers', async () => {
    expect((await request(server).get('/captain/delivery-offers')).body.data.offers).toHaveLength(
      1,
    );
    const response = await request(server)
      .post(`/captain/delivery-offers/${ASSIGNMENT_ID}/accept`)
      .set('Idempotency-Key', KEY);
    expect(response.status).toBe(200);
    expect(response.body.data.delivery.taskStatus).toBe('ASSIGNED');
  });

  it('confirms pickup arrival and handover through task routes', async () => {
    const arrival = await request(server)
      .post(`/captain/deliveries/${TASK_ID}/arrive-pickup`)
      .set('Idempotency-Key', KEY)
      .send({
        location: {
          latitude: 13.628,
          longitude: 79.419,
          accuracyMeters: 10,
          recordedAt: '2026-07-17T10:00:00.000Z',
        },
      });
    expect(arrival.status).toBe(200);
    expect(arrival.body.data.delivery.taskStatus).toBe('AT_PICKUP');
    const pickup = await request(server)
      .post(`/captain/deliveries/${TASK_ID}/verify-pickup`)
      .set('Idempotency-Key', KEY)
      .send({ pickupCode: '123456' });
    expect(pickup.status).toBe(200);
    expect(pickup.body.data.delivery.taskStatus).toBe('PICKED_UP');
  });

  it('completes exact COD and OTP at the customer', async () => {
    const response = await request(server)
      .post(`/captain/deliveries/${TASK_ID}/complete`)
      .set('Idempotency-Key', KEY)
      .send({ collectedAmountPaise: 149900, deliveryOtp: '654321', location: null });
    expect(response.status).toBe(200);
    expect(response.body.data.completion.orderStatus).toBe('DELIVERED');
  });
});
