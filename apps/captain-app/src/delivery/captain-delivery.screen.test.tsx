import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  CaptainLocationProvider,
  CaptainLocationSample,
  CaptainPresencePort,
} from '../presence/captain-presence.types';
import { CaptainDeliveryScreen } from './captain-delivery.screen';
import type {
  CaptainDelivery,
  CaptainDeliveryPort,
  DeliveryCompletion,
  DeliveryTaskStatus,
} from './captain-delivery.types';

jest.mock('../presence/expo-captain-location.provider', () => ({
  ExpoCaptainLocationProvider: jest.fn(),
}));

const LOCATION_SAMPLE: CaptainLocationSample = {
  sampleId: '50000000-0000-4000-8000-000000000001',
  latitude: 13.628,
  longitude: 79.419,
  accuracyMeters: 8,
  recordedAt: '2026-07-21T10:00:00.000Z',
  heading: null,
  speedMps: null,
  batteryPercent: null,
  activeDeliveryTaskId: null,
};

const ORDER_STATUS: Record<DeliveryTaskStatus, CaptainDelivery['orderStatus']> = {
  OFFERED: 'CAPTAIN_SEARCHING',
  ASSIGNED: 'CAPTAIN_ASSIGNED',
  AT_PICKUP: 'CAPTAIN_AT_STORE',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  AT_DROP: 'CAPTAIN_AT_CUSTOMER',
};

function delivery(taskStatus: DeliveryTaskStatus): CaptainDelivery {
  return {
    taskId: '10000000-0000-4000-8000-000000000001',
    orderId: '20000000-0000-4000-8000-000000000001',
    orderNumber: 'VAS-CAPTAIN-1',
    taskStatus,
    orderStatus: ORDER_STATUS[taskStatus],
    assignmentId: '30000000-0000-4000-8000-000000000001',
    assignmentStatus: taskStatus === 'OFFERED' ? 'OFFERED' : 'ACCEPTED',
    offeredEarningPaise: 4000,
    pickupDistanceMeters: 500,
    offeredAt: '2026-07-21T10:00:00.000Z',
    expiresAt: '2099-07-21T10:01:00.000Z',
    assignedAt: taskStatus === 'OFFERED' ? null : '2026-07-21T10:00:10.000Z',
    pickup: {
      label: 'Shop',
      recipientName: 'Vastra Test Shop',
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
      recipientName: 'Customer One',
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

function completion(): DeliveryCompletion {
  return {
    taskId: delivery('AT_DROP').taskId,
    orderId: delivery('AT_DROP').orderId,
    orderNumber: delivery('AT_DROP').orderNumber,
    taskStatus: 'COMPLETED',
    orderStatus: 'DELIVERED',
    paymentStatus: 'COD_COLLECTED',
    collectedAmountPaise: 149900,
    captainEarningPaise: 4000,
    completedAt: '2026-07-21T11:00:00.000Z',
    replayed: false,
  };
}

function deliveryClient(
  active: CaptainDelivery | null,
  offers: readonly CaptainDelivery[] = [],
): jest.Mocked<CaptainDeliveryPort> {
  let current = active;
  return {
    listOffers: jest.fn(() => Promise.resolve(offers)),
    getActive: jest.fn(() => Promise.resolve(current)),
    getTask: jest.fn((...args: Parameters<CaptainDeliveryPort['getTask']>) => {
      void args;
      return Promise.resolve(active ?? delivery('ASSIGNED'));
    }),
    acceptOffer: jest.fn((...args: Parameters<CaptainDeliveryPort['acceptOffer']>) => {
      void args;
      current = delivery('ASSIGNED');
      return Promise.resolve(current);
    }),
    rejectOffer: jest.fn((...args: Parameters<CaptainDeliveryPort['rejectOffer']>) => {
      void args;
      return Promise.resolve();
    }),
    arrivePickup: jest.fn((...args: Parameters<CaptainDeliveryPort['arrivePickup']>) => {
      void args;
      current = delivery('AT_PICKUP');
      return Promise.resolve(current);
    }),
    verifyPickup: jest.fn((...args: Parameters<CaptainDeliveryPort['verifyPickup']>) => {
      void args;
      current = delivery('PICKED_UP');
      return Promise.resolve(current);
    }),
    departPickup: jest.fn((...args: Parameters<CaptainDeliveryPort['departPickup']>) => {
      void args;
      current = delivery('IN_TRANSIT');
      return Promise.resolve(current);
    }),
    arriveDrop: jest.fn((...args: Parameters<CaptainDeliveryPort['arriveDrop']>) => {
      void args;
      current = delivery('AT_DROP');
      return Promise.resolve(current);
    }),
    complete: jest.fn((...args: Parameters<CaptainDeliveryPort['complete']>) => {
      void args;
      current = null;
      return Promise.resolve(completion());
    }),
    reportProblem: jest.fn((...args: Parameters<CaptainDeliveryPort['reportProblem']>) => {
      void args;
      return Promise.resolve({
        taskId: delivery('AT_DROP').taskId,
        orderId: delivery('AT_DROP').orderId,
        reason: 'CUSTOMER_UNAVAILABLE' as const,
        note: 'Called twice',
        reportedAt: '2026-07-21T10:45:00.000Z',
        orderStatus: 'PROBLEM_REPORTED' as const,
        replayed: false,
      });
    }),
    release: jest.fn((...args: Parameters<CaptainDeliveryPort['release']>) => {
      void args;
      return Promise.resolve({
        taskId: delivery('ASSIGNED').taskId,
        orderId: delivery('ASSIGNED').orderId,
        reason: 'VEHICLE_ISSUE' as const,
        releasedAt: '2026-07-21T10:10:00.000Z',
        taskStatus: 'SEARCHING' as const,
        orderStatus: 'CAPTAIN_SEARCHING' as const,
        replayed: false,
      });
    }),
  };
}

function presenceClient(): jest.Mocked<CaptainPresencePort> {
  return {
    getAvailability: jest.fn(() => Promise.resolve('AVAILABLE')),
    setAvailability: jest.fn(),
    updateLocation: jest.fn((sample) =>
      Promise.resolve({
        sampleId: sample.sampleId,
        acceptedAt: sample.recordedAt,
        replayed: false,
      }),
    ),
  };
}

function locationProvider(): jest.Mocked<CaptainLocationProvider> {
  return {
    requestForegroundPermission: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true }),
    ),
    getCurrentLocation: jest.fn(() => Promise.resolve(LOCATION_SAMPLE)),
    watchLocations: jest.fn((...args: Parameters<CaptainLocationProvider['watchLocations']>) => {
      void args;
      return Promise.resolve(() => undefined);
    }),
  };
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('CaptainDeliveryScreen preservation', () => {
  it('preserves the default 10-second active-delivery and offer polling interval', async () => {
    jest.useFakeTimers();
    const client = deliveryClient(null);
    const view = render(
      <CaptainDeliveryScreen
        client={client}
        locationProvider={locationProvider()}
        presenceClient={presenceClient()}
      />,
    );

    try {
      await advance(0);
      expect(client.getActive.mock.calls).toHaveLength(1);
      expect(client.listOffers.mock.calls).toHaveLength(1);

      await advance(9_999);
      expect(client.getActive.mock.calls).toHaveLength(1);

      await advance(1);
      expect(client.getActive.mock.calls).toHaveLength(2);
      expect(client.listOffers.mock.calls).toHaveLength(2);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  it('renders an authoritative offer and accepts it with an idempotency key', async () => {
    const offer = delivery('OFFERED');
    const client = deliveryClient(null, [offer]);
    const view = render(
      <CaptainDeliveryScreen
        client={client}
        locationProvider={locationProvider()}
        presenceClient={presenceClient()}
      />,
    );

    try {
      expect(await view.findByLabelText('Delivery offer VAS-CAPTAIN-1')).toBeTruthy();
      fireEvent.press(view.getByText('Accept'));

      await waitFor(() => {
        expect(client.acceptOffer.mock.calls).toHaveLength(1);
      });
      expect(client.acceptOffer.mock.calls[0]?.[0]).toBe(offer.assignmentId);
      expect(client.acceptOffer.mock.calls[0]?.[1]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
      );
      expect(await view.findByText('I arrived at the shop')).toBeTruthy();
    } finally {
      view.unmount();
    }
  });

  it('preserves pickup code, drop arrival, exact COD, and delivery OTP sequencing', async () => {
    const client = deliveryClient(delivery('ASSIGNED'));
    const locations = locationProvider();
    const view = render(
      <CaptainDeliveryScreen
        client={client}
        locationProvider={locations}
        presenceClient={presenceClient()}
      />,
    );

    try {
      expect(await view.findByText('I arrived at the shop')).toBeTruthy();
      await waitFor(() => {
        expect(client.getActive.mock.calls.length).toBeGreaterThanOrEqual(2);
      });
      fireEvent.press(view.getByText('I arrived at the shop'));
      expect(await view.findByLabelText('Merchant pickup code')).toBeTruthy();
      expect(client.arrivePickup.mock.calls).toContainEqual([
        delivery('ASSIGNED').taskId,
        {
          latitude: LOCATION_SAMPLE.latitude,
          longitude: LOCATION_SAMPLE.longitude,
          accuracyMeters: LOCATION_SAMPLE.accuracyMeters,
          recordedAt: LOCATION_SAMPLE.recordedAt,
        },
        expect.any(String),
      ]);

      fireEvent.changeText(view.getByLabelText('Merchant pickup code'), '123456');
      fireEvent.press(view.getByText('Verify package handover'));
      expect(await view.findByText('Start customer delivery')).toBeTruthy();
      expect(client.verifyPickup.mock.calls).toContainEqual([
        delivery('AT_PICKUP').taskId,
        '123456',
        expect.any(String),
      ]);

      fireEvent.press(view.getByText('Start customer delivery'));
      expect(await view.findByText('I arrived at the customer')).toBeTruthy();
      fireEvent.press(view.getByText('I arrived at the customer'));
      expect(await view.findByLabelText('Customer delivery OTP')).toBeTruthy();

      fireEvent.changeText(view.getByLabelText('Customer delivery OTP'), '654321');
      fireEvent.press(view.getByText('Verify COD and complete'));
      expect(await view.findByText('No active offers')).toBeTruthy();
      expect(client.complete.mock.calls).toContainEqual([
        delivery('AT_DROP').taskId,
        149900,
        '654321',
        {
          latitude: LOCATION_SAMPLE.latitude,
          longitude: LOCATION_SAMPLE.longitude,
          accuracyMeters: LOCATION_SAMPLE.accuracyMeters,
          recordedAt: LOCATION_SAMPLE.recordedAt,
        },
        expect.any(String),
      ]);
    } finally {
      view.unmount();
    }
  });

  it('preserves operational notes for release and customer-unavailable reporting', async () => {
    const releaseClient = deliveryClient(delivery('ASSIGNED'));
    const releaseView = render(
      <CaptainDeliveryScreen
        client={releaseClient}
        locationProvider={locationProvider()}
        presenceClient={presenceClient()}
      />,
    );
    try {
      expect(await releaseView.findByText('Release before pickup')).toBeTruthy();
      fireEvent.changeText(releaseView.getByLabelText('Operational note'), 'Puncture');
      fireEvent.press(releaseView.getByText('Release before pickup'));
      expect(await releaseView.findByText('Delivery released for reassignment.')).toBeTruthy();
      expect(releaseClient.release.mock.calls).toContainEqual([
        delivery('ASSIGNED').taskId,
        'VEHICLE_ISSUE',
        'Puncture',
        expect.any(Object),
        expect.any(String),
      ]);
    } finally {
      releaseView.unmount();
    }

    const problemClient = deliveryClient(delivery('AT_DROP'));
    const problemView = render(
      <CaptainDeliveryScreen
        client={problemClient}
        locationProvider={locationProvider()}
        presenceClient={presenceClient()}
      />,
    );
    try {
      expect(await problemView.findByText('Report a delivery problem')).toBeTruthy();
      fireEvent.changeText(problemView.getByLabelText('Operational note'), 'Called twice');
      fireEvent.press(problemView.getByText('Report a delivery problem'));
      expect(await problemView.findByText('Problem reported to operations.')).toBeTruthy();
      expect(problemClient.reportProblem.mock.calls).toContainEqual([
        delivery('AT_DROP').taskId,
        'CUSTOMER_UNAVAILABLE',
        'Called twice',
        expect.any(Object),
        expect.any(String),
      ]);
    } finally {
      problemView.unmount();
    }
  });
});
