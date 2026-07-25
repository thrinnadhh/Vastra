import { CaptainDeliveryApiError } from './captain-delivery.client';
import { ResilientCaptainDeliveryPort } from './resilient-captain-delivery.port';
import type { CaptainDelivery, CaptainDeliveryPort } from './captain-delivery.types';

const OFFER: CaptainDelivery = {
  taskId: '10000000-0000-4000-8000-000000000001',
  orderId: '20000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-S7-1',
  taskStatus: 'OFFERED',
  orderStatus: 'CAPTAIN_SEARCHING',
  assignmentId: '30000000-0000-4000-8000-000000000001',
  assignmentStatus: 'OFFERED',
  offeredEarningPaise: 4000,
  pickupDistanceMeters: 500,
  offeredAt: '2026-07-25T10:00:00.000Z',
  expiresAt: '2026-07-25T10:00:30.000Z',
  assignedAt: null,
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

const ASSIGNED: CaptainDelivery = {
  ...OFFER,
  taskStatus: 'ASSIGNED',
  orderStatus: 'CAPTAIN_ASSIGNED',
  assignmentStatus: 'ACCEPTED',
  assignedAt: '2026-07-25T10:00:05.000Z',
};

const AT_PICKUP: CaptainDelivery = {
  ...ASSIGNED,
  taskStatus: 'AT_PICKUP',
  orderStatus: 'CAPTAIN_AT_STORE',
};

const PICKED_UP: CaptainDelivery = {
  ...ASSIGNED,
  taskStatus: 'PICKED_UP',
  orderStatus: 'PICKED_UP',
};

function delegate(): jest.Mocked<CaptainDeliveryPort> {
  return {
    listOffers: jest.fn(),
    getActive: jest.fn(),
    getTask: jest.fn(),
    acceptOffer: jest.fn(),
    rejectOffer: jest.fn(),
    arrivePickup: jest.fn(),
    verifyPickup: jest.fn(),
    departPickup: jest.fn(),
    arriveDrop: jest.fn(),
    complete: jest.fn(),
    reportProblem: jest.fn(),
    release: jest.fn(),
  };
}

describe('ResilientCaptainDeliveryPort', () => {
  it('shares overlapping authoritative reads', async () => {
    const base = delegate();
    let resolveActive: ((delivery: CaptainDelivery | null) => void) | undefined;
    base.getActive.mockReturnValue(
      new Promise<CaptainDelivery | null>((resolve) => {
        resolveActive = resolve;
      }),
    );
    const client = new ResilientCaptainDeliveryPort(base, jest.fn());

    const first = client.getActive();
    const second = client.getActive();

    expect(base.getActive.mock.calls).toHaveLength(1);
    resolveActive?.(ASSIGNED);
    await expect(Promise.all([first, second])).resolves.toEqual([ASSIGNED, ASSIGNED]);
  });

  it('expires the local session after an authenticated polling failure', async () => {
    const base = delegate();
    base.getActive.mockRejectedValue(
      new CaptainDeliveryApiError('AUTHENTICATION_INVALID', 'Sign in again.', false),
    );
    const expireSession = jest.fn().mockResolvedValue(undefined);
    const client = new ResilientCaptainDeliveryPort(base, expireSession);

    await expect(client.getActive()).rejects.toThrow('Sign in again.');
    expect(expireSession).toHaveBeenCalledTimes(1);
  });

  it('retains the first idempotency key across a retryable accept failure', async () => {
    const base = delegate();
    base.acceptOffer
      .mockRejectedValueOnce(new CaptainDeliveryApiError('NETWORK_UNAVAILABLE', 'Retry.', true))
      .mockResolvedValueOnce(ASSIGNED);
    base.getActive.mockResolvedValue(null);
    const client = new ResilientCaptainDeliveryPort(base, jest.fn());

    await expect(client.acceptOffer(OFFER.assignmentId, 'first-key')).rejects.toThrow('Retry.');
    await expect(client.acceptOffer(OFFER.assignmentId, 'second-key')).resolves.toEqual(ASSIGNED);

    expect(base.acceptOffer.mock.calls).toEqual([
      [OFFER.assignmentId, 'first-key'],
      [OFFER.assignmentId, 'first-key'],
    ]);
  });

  it('reconciles an accept race from the authoritative active delivery', async () => {
    const base = delegate();
    base.acceptOffer.mockRejectedValue(
      new CaptainDeliveryApiError(
        'DELIVERY_TASK_ALREADY_ASSIGNED',
        'Another request completed first.',
        false,
      ),
    );
    base.getActive.mockResolvedValue(ASSIGNED);
    const client = new ResilientCaptainDeliveryPort(base, jest.fn());

    await expect(client.acceptOffer(OFFER.assignmentId, 'accept-key')).resolves.toEqual(ASSIGNED);
  });

  it('reconciles a reject only when the assignment is neither offered nor active', async () => {
    const base = delegate();
    base.rejectOffer.mockRejectedValue(
      new CaptainDeliveryApiError('NETWORK_UNAVAILABLE', 'Result unknown.', true),
    );
    base.listOffers.mockResolvedValue([]);
    base.getActive.mockResolvedValue(null);
    const client = new ResilientCaptainDeliveryPort(base, jest.fn());

    await expect(
      client.rejectOffer(OFFER.assignmentId, 'OTHER', 'reject-key'),
    ).resolves.toBeUndefined();
  });

  it('does not report rejection success when the assignment became active', async () => {
    const base = delegate();
    base.rejectOffer.mockRejectedValue(
      new CaptainDeliveryApiError('NETWORK_UNAVAILABLE', 'Result unknown.', true),
    );
    base.listOffers.mockResolvedValue([]);
    base.getActive.mockResolvedValue(ASSIGNED);
    const client = new ResilientCaptainDeliveryPort(base, jest.fn());

    await expect(client.rejectOffer(OFFER.assignmentId, 'OTHER', 'reject-key')).rejects.toThrow(
      'Result unknown.',
    );
  });

  it('clears a rejected secret attempt so corrected input uses a new key', async () => {
    const base = delegate();
    base.verifyPickup
      .mockRejectedValueOnce(
        new CaptainDeliveryApiError('PICKUP_CODE_INVALID', 'Incorrect pickup code.', false),
      )
      .mockResolvedValueOnce(PICKED_UP);
    base.getTask.mockResolvedValue(AT_PICKUP);
    const client = new ResilientCaptainDeliveryPort(base, jest.fn());

    await expect(client.verifyPickup(OFFER.taskId, '111111', 'wrong-key')).rejects.toThrow(
      'Incorrect pickup code.',
    );
    await expect(client.verifyPickup(OFFER.taskId, '222222', 'correct-key')).resolves.toEqual(
      PICKED_UP,
    );

    expect(base.verifyPickup.mock.calls).toEqual([
      [OFFER.taskId, '111111', 'wrong-key'],
      [OFFER.taskId, '222222', 'correct-key'],
    ]);
  });

  it('expires the local session after an authenticated mutation failure', async () => {
    const base = delegate();
    base.complete.mockRejectedValue(
      new CaptainDeliveryApiError('SESSION_EXPIRED', 'Sign in again.', false),
    );
    const expireSession = jest.fn().mockResolvedValue(undefined);
    const client = new ResilientCaptainDeliveryPort(base, expireSession);

    await expect(
      client.complete(OFFER.taskId, OFFER.totalPaise, '123456', null, 'complete-key'),
    ).rejects.toThrow('Sign in again.');
    expect(expireSession).toHaveBeenCalledTimes(1);
  });
});
