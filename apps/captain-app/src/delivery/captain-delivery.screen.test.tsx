import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  CaptainLocationProvider,
  CaptainLocationSample,
  CaptainPresencePort,
} from '../presence/captain-presence.types';
import { CaptainDeliveryScreen } from './captain-delivery.screen';
import { ResilientCaptainDeliveryPort } from './resilient-captain-delivery.port';
import type {
  CaptainDelivery,
  CaptainDeliveryPort,
  DeliveryCompletion,
  DeliveryTaskStatus,
} from './captain-delivery.types';

const LOCATION: CaptainLocationSample = {
  sampleId: '50000000-0000-4000-8000-000000000001',
  latitude: 13.628,
  longitude: 79.419,
  accuracyMeters: 8,
  recordedAt: '2026-07-25T10:00:00.000Z',
  heading: null,
  speedMps: null,
  batteryPercent: null,
  activeDeliveryTaskId: null,
};

const ORDER_STATUS: Readonly<Record<DeliveryTaskStatus, CaptainDelivery['orderStatus']>> = {
  OFFERED: 'CAPTAIN_SEARCHING',
  ASSIGNED: 'CAPTAIN_ASSIGNED',
  AT_PICKUP: 'CAPTAIN_AT_STORE',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  AT_DROP: 'CAPTAIN_AT_CUSTOMER',
};

function delivery(
  taskStatus: DeliveryTaskStatus,
  expiresAt = '2099-07-25T10:01:00.000Z',
): CaptainDelivery {
  return {
    taskId: '10000000-0000-4000-8000-000000000001',
    orderId: '20000000-0000-4000-8000-000000000001',
    orderNumber: 'VAS-FE-S07-1',
    taskStatus,
    orderStatus: ORDER_STATUS[taskStatus],
    assignmentId: '30000000-0000-4000-8000-000000000001',
    assignmentStatus: taskStatus === 'OFFERED' ? 'OFFERED' : 'ACCEPTED',
    offeredEarningPaise: 4000,
    pickupDistanceMeters: 500,
    offeredAt: '2026-07-25T10:00:00.000Z',
    expiresAt,
    assignedAt: taskStatus === 'OFFERED' ? null : '2026-07-25T10:00:10.000Z',
    pickup: {
      label: 'Shop',
      recipientName: 'Vastra Pilot Shop',
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
      recipientName: 'Pilot Customer',
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
    completedAt: '2026-07-25T11:00:00.000Z',
    replayed: false,
  };
}

function deliveryClient(
  initialActive: CaptainDelivery | null,
  initialOffers: readonly CaptainDelivery[] = [],
): jest.Mocked<CaptainDeliveryPort> {
  let current = initialActive;
  let offers = initialOffers;

  return {
    listOffers: jest.fn(() => Promise.resolve(offers)),
    getActive: jest.fn(() => Promise.resolve(current)),
    getTask: jest.fn((..._args: Parameters<CaptainDeliveryPort['getTask']>) =>
      Promise.resolve(current ?? delivery('ASSIGNED')),
    ),
    acceptOffer: jest.fn((..._args: Parameters<CaptainDeliveryPort['acceptOffer']>) => {
      current = delivery('ASSIGNED');
      offers = [];
      return Promise.resolve(current);
    }),
    rejectOffer: jest.fn((..._args: Parameters<CaptainDeliveryPort['rejectOffer']>) => {
      offers = [];
      return Promise.resolve();
    }),
    arrivePickup: jest.fn((..._args: Parameters<CaptainDeliveryPort['arrivePickup']>) => {
      current = delivery('AT_PICKUP');
      return Promise.resolve(current);
    }),
    verifyPickup: jest.fn((..._args: Parameters<CaptainDeliveryPort['verifyPickup']>) => {
      current = delivery('PICKED_UP');
      return Promise.resolve(current);
    }),
    departPickup: jest.fn((..._args: Parameters<CaptainDeliveryPort['departPickup']>) => {
      current = delivery('IN_TRANSIT');
      return Promise.resolve(current);
    }),
    arriveDrop: jest.fn((..._args: Parameters<CaptainDeliveryPort['arriveDrop']>) => {
      current = delivery('AT_DROP');
      return Promise.resolve(current);
    }),
    complete: jest.fn((..._args: Parameters<CaptainDeliveryPort['complete']>) => {
      current = null;
      return Promise.resolve(completion());
    }),
    reportProblem: jest.fn((...args: Parameters<CaptainDeliveryPort['reportProblem']>) => {
      const [, reason, note] = args;
      current = null;
      return Promise.resolve({
        taskId: delivery('AT_DROP').taskId,
        orderId: delivery('AT_DROP').orderId,
        reason,
        note,
        reportedAt: '2026-07-25T10:45:00.000Z',
        orderStatus: 'PROBLEM_REPORTED',
        replayed: false,
      });
    }),
    release: jest.fn((...args: Parameters<CaptainDeliveryPort['release']>) => {
      const [, reason] = args;
      current = null;
      return Promise.resolve({
        taskId: delivery('ASSIGNED').taskId,
        orderId: delivery('ASSIGNED').orderId,
        reason,
        releasedAt: '2026-07-25T10:10:00.000Z',
        taskStatus: 'SEARCHING',
        orderStatus: 'CAPTAIN_SEARCHING',
        replayed: false,
      });
    }),
  };
}

function presenceClient(): jest.Mocked<CaptainPresencePort> {
  return {
    getAvailability: jest.fn(() => Promise.resolve('AVAILABLE')),
    setAvailability: jest.fn(),
    updateLocation: jest.fn((...args: Parameters<CaptainPresencePort['updateLocation']>) => {
      const [sample] = args;
      return Promise.resolve({
        sampleId: sample.sampleId,
        acceptedAt: sample.recordedAt,
        replayed: false,
      });
    }),
  };
}

function locationProvider(): jest.Mocked<CaptainLocationProvider> {
  return {
    requestForegroundPermission: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true }),
    ),
    getCurrentLocation: jest.fn(() => Promise.resolve(LOCATION)),
    watchLocations: jest.fn((..._args: Parameters<CaptainLocationProvider['watchLocations']>) =>
      Promise.resolve(() => undefined),
    ),
  };
}

function renderScreen(client: jest.Mocked<CaptainDeliveryPort>) {
  return render(
    <CaptainDeliveryScreen
      client={client}
      locationProvider={locationProvider()}
      presenceClient={presenceClient()}
    />,
  );
}

describe('CaptainDeliveryScreen production closure', () => {
  it('preserves the ten-second authoritative polling interval', () => {
    const intervalSpy = jest.spyOn(globalThis, 'setInterval');
    const view = renderScreen(deliveryClient(null));

    try {
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
    } finally {
      view.unmount();
      intervalSpy.mockRestore();
    }
  });

  it('removes expired offers and exposes every server-supported decline reason', async () => {
    const expired = delivery('OFFERED', '2020-01-01T00:00:00.000Z');
    const expiredView = renderScreen(deliveryClient(null, [expired]));

    try {
      expect(await expiredView.findByText('No active offers')).toBeTruthy();
      expect(expiredView.queryByTestId(`delivery-offer-${expired.assignmentId}`)).toBeNull();
    } finally {
      expiredView.unmount();
    }

    const offer = delivery('OFFERED');
    const client = deliveryClient(null, [offer]);
    const view = renderScreen(client);

    try {
      expect(await view.findByTestId(`delivery-offer-${offer.assignmentId}`)).toBeTruthy();
      fireEvent.press(view.getByText('Decline'));
      fireEvent.press(view.getByText('Low battery'));

      await waitFor(() => {
        expect(client.rejectOffer).toHaveBeenCalledWith(
          offer.assignmentId,
          'LOW_BATTERY',
          expect.any(String),
        );
      });
    } finally {
      view.unmount();
    }
  });

  it('uses the immutable server COD amount and requires explicit cash confirmation', async () => {
    const client = deliveryClient(delivery('AT_DROP'));
    const view = renderScreen(client);

    try {
      expect(await view.findByLabelText('Collect exactly ₹1499.00')).toBeTruthy();
      expect(view.queryByLabelText('Collected COD amount')).toBeNull();

      fireEvent.changeText(view.getByLabelText('Customer delivery OTP'), '654321');
      fireEvent.press(view.getByText('Complete delivery with OTP'));
      expect(client.complete).not.toHaveBeenCalled();

      fireEvent.press(view.getByText('I collected the exact cash amount shown above'));
      fireEvent.press(view.getByText('Complete delivery with OTP'));

      await waitFor(() => {
        expect(client.complete).toHaveBeenCalledWith(
          delivery('AT_DROP').taskId,
          149900,
          '654321',
          expect.any(Object),
          expect.any(String),
        );
      });
      expect(await view.findByText('Delivery completed and COD collection recorded.')).toBeTruthy();
    } finally {
      view.unmount();
    }
  });

  it('offers safe pre-pickup release reasons only after the captain opens issue controls', async () => {
    const client = deliveryClient(delivery('ASSIGNED'));
    const view = renderScreen(client);

    try {
      expect(await view.findByText('Report or release delivery')).toBeTruthy();
      expect(
        view.queryByText(
          'Stop in a safe place before using these controls. Do not type while riding.',
        ),
      ).toBeNull();

      fireEvent.press(view.getByText('Report or release delivery'));
      expect(
        view.getByText(
          'Stop in a safe place before using these controls. Do not type while riding.',
        ),
      ).toBeTruthy();
      fireEvent.press(view.getByText('Personal emergency'));
      fireEvent.press(view.getByText('Release to operations'));

      await waitFor(() => {
        expect(client.release).toHaveBeenCalledWith(
          delivery('ASSIGNED').taskId,
          'PERSONAL_EMERGENCY',
          null,
          expect.any(Object),
          expect.any(String),
        );
      });
      expect(await view.findByText('Delivery released to operations before pickup.')).toBeTruthy();
    } finally {
      view.unmount();
    }
  });

  it('escalates post-pickup custody without presenting cancellation or reassignment', async () => {
    const client = deliveryClient(delivery('IN_TRANSIT'));
    const view = renderScreen(client);

    try {
      expect(await view.findByText('Report or release delivery')).toBeTruthy();
      fireEvent.press(view.getByText('Report or release delivery'));

      expect(
        view.getByText(
          'After pickup, this reports a problem. It does not cancel the order or ' +
            'reassign package custody.',
        ),
      ).toBeTruthy();
      expect(view.queryByText('Cancel delivery')).toBeNull();
      fireEvent.press(view.getByText('Safety concern'));
      fireEvent.press(view.getByText('Escalate to operations'));

      await waitFor(() => {
        expect(client.reportProblem).toHaveBeenCalledWith(
          delivery('IN_TRANSIT').taskId,
          'SAFETY_CONCERN',
          null,
          expect.any(Object),
          expect.any(String),
        );
      });
      expect(
        await view.findByText('Problem escalated to operations. Package custody remains recorded.'),
      ).toBeTruthy();
    } finally {
      view.unmount();
    }
  });

  it('keeps an uncertain COD completion retryable with the original attempt identity', async () => {
    const source = deliveryClient(delivery('AT_DROP'));
    source.complete
      .mockRejectedValueOnce(new Error('Network result unknown'))
      .mockResolvedValueOnce(completion());
    const resilient = new ResilientCaptainDeliveryPort(source, jest.fn());
    const view = render(
      <CaptainDeliveryScreen
        client={resilient}
        locationProvider={locationProvider()}
        presenceClient={presenceClient()}
      />,
    );

    try {
      expect(await view.findByLabelText('Collect exactly ₹1499.00')).toBeTruthy();
      fireEvent.press(view.getByText('I collected the exact cash amount shown above'));
      fireEvent.changeText(view.getByLabelText('Customer delivery OTP'), '654321');
      fireEvent.press(view.getByText('Complete delivery with OTP'));

      expect(await view.findByText('Network result unknown')).toBeTruthy();
      expect(view.getByText('Complete delivery with OTP')).toBeTruthy();
      fireEvent.press(view.getByText('Complete delivery with OTP'));

      await waitFor(() => {
        expect(source.complete).toHaveBeenCalledTimes(2);
      });
      expect(source.complete.mock.calls[0]?.[4]).toBe(source.complete.mock.calls[1]?.[4]);
      expect(await view.findByText('Delivery completed and COD collection recorded.')).toBeTruthy();
    } finally {
      view.unmount();
    }
  });

  it('completes the deterministic captain COD journey from offer through delivery', async () => {
    const offer = delivery('OFFERED');
    const client = deliveryClient(null, [offer]);
    const view = renderScreen(client);

    try {
      expect(await view.findByTestId(`delivery-offer-${offer.assignmentId}`)).toBeTruthy();
      fireEvent.press(view.getByText('Accept delivery'));
      expect(await view.findByText('I arrived at the shop')).toBeTruthy();

      fireEvent.press(view.getByText('I arrived at the shop'));
      expect(await view.findByLabelText('Merchant pickup code')).toBeTruthy();

      fireEvent.changeText(view.getByLabelText('Merchant pickup code'), '123456');
      fireEvent.press(view.getByText('Verify package handover'));
      expect(await view.findByText('Start customer delivery')).toBeTruthy();

      fireEvent.press(view.getByText('Start customer delivery'));
      expect(await view.findByText('I arrived at the customer')).toBeTruthy();

      fireEvent.press(view.getByText('I arrived at the customer'));
      expect(await view.findByLabelText('Collect exactly ₹1499.00')).toBeTruthy();

      fireEvent.press(view.getByText('I collected the exact cash amount shown above'));
      fireEvent.changeText(view.getByLabelText('Customer delivery OTP'), '654321');
      fireEvent.press(view.getByText('Complete delivery with OTP'));

      expect(await view.findByText('Delivery completed and COD collection recorded.')).toBeTruthy();
      expect(client.acceptOffer).toHaveBeenCalledTimes(1);
      expect(client.arrivePickup).toHaveBeenCalledTimes(1);
      expect(client.verifyPickup).toHaveBeenCalledTimes(1);
      expect(client.departPickup).toHaveBeenCalledTimes(1);
      expect(client.arriveDrop).toHaveBeenCalledTimes(1);
      expect(client.complete).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
    }
  });
});
