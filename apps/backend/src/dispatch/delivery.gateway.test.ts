import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '../auth/supabase-client.type';
import {
  DeliveryGatewayUnavailableError,
  parseCaptainDeliverySnapshot,
  SupabaseDeliveryGateway,
} from './delivery.gateway';

const TASK_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const ASSIGNMENT_ID = '30000000-0000-4000-8000-000000000001';

const valid = {
  taskId: TASK_ID,
  orderId: ORDER_ID,
  orderNumber: 'VAS-DELIVERY-1',
  taskStatus: 'OFFERED',
  orderStatus: 'CAPTAIN_SEARCHING',
  assignmentId: ASSIGNMENT_ID,
  assignmentStatus: 'OFFERED',
  offeredEarningPaise: 4500,
  pickupDistanceMeters: 850,
  offeredAt: '2026-07-17T12:00:00.000Z',
  expiresAt: '2026-07-17T12:00:30.000Z',
  assignedAt: null,
  pickup: {
    label: 'Store',
    recipientName: 'Vastra Test Shop',
    phoneNumber: '+919999999999',
    line1: '1 Main Road',
    line2: null,
    landmark: null,
    area: 'Tirupati',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517501',
    countryCode: 'IN',
    location: { latitude: 13.6288, longitude: 79.4192 },
  },
  drop: {
    label: 'Home',
    recipientName: 'Customer',
    phoneNumber: '+919999999998',
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

describe('delivery gateway parser', () => {
  it('maps a safe captain delivery payload', () => {
    expect(parseCaptainDeliverySnapshot(valid)).toMatchObject({
      taskId: TASK_ID,
      assignmentId: ASSIGNMENT_ID,
      taskStatus: 'OFFERED',
      pickup: { recipientName: 'Vastra Test Shop' },
      totalPaise: 149900,
    });
  });

  it('rejects terminal states and malformed identifiers', () => {
    expect(() => parseCaptainDeliverySnapshot({ ...valid, taskStatus: 'COMPLETED' })).toThrow(
      DeliveryGatewayUnavailableError,
    );
    expect(() => parseCaptainDeliverySnapshot({ ...valid, assignmentId: 'bad' })).toThrow(
      DeliveryGatewayUnavailableError,
    );
  });
});

describe('delivery gateway command replay parsing', () => {
  it('propagates an accepted offer replay from the command envelope', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          outcome: 'ACCEPTED',
          delivery: valid,
          replayed: true,
        },
        error: null,
      }),
    } as unknown as SupabaseClient;
    const gateway = new SupabaseDeliveryGateway(client);

    await expect(
      gateway.acceptOffer(
        '40000000-0000-4000-8000-000000000001',
        ASSIGNMENT_ID,
        '50000000-0000-4000-8000-000000000001',
      ),
    ).resolves.toMatchObject({ replayed: true });
  });

  it('propagates a rejected offer replay from the command envelope', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          outcome: 'REJECTED',
          rejection: {
            assignmentId: ASSIGNMENT_ID,
            deliveryTaskId: TASK_ID,
            assignmentStatus: 'REJECTED',
            reason: 'TOO_FAR',
            respondedAt: '2026-07-17T12:00:10.000Z',
            replayed: false,
          },
          replayed: true,
        },
        error: null,
      }),
    } as unknown as SupabaseClient;
    const gateway = new SupabaseDeliveryGateway(client);

    await expect(
      gateway.rejectOffer(
        '40000000-0000-4000-8000-000000000001',
        ASSIGNMENT_ID,
        'TOO_FAR',
        '50000000-0000-4000-8000-000000000001',
      ),
    ).resolves.toMatchObject({ replayed: true });
  });
});
