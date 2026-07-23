import { act, fireEvent, render } from '@testing-library/react-native';

import { CustomerOrderTracking } from './customer-order-tracking';
import { CustomerOrderError } from './customer-order.types';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const TRACKING = {
  orderId: ORDER_ID,
  deliveryTaskId: '20000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-1',
  orderStatus: 'CAPTAIN_AT_CUSTOMER',
  taskStatus: 'AT_DROP',
  captain: {
    displayName: 'Ravi',
    phoneLast4: '1234',
    vehicleType: 'BIKE',
    vehicleNumberLast4: '9876',
  },
  location: {
    latitude: 13.6,
    longitude: 79.4,
    recordedAt: '2026-07-22T10:00:00.000Z',
    stale: true,
  },
  estimatedArrivalAt: null,
  updatedAt: '2026-07-22T10:00:00.000Z',
};

describe('CustomerOrderTracking', () => {
  it('shows stale tracking and an allowed delivery OTP without private ids', async () => {
    const view = render(
      <CustomerOrderTracking
        orderId={ORDER_ID}
        orderStatus="CAPTAIN_AT_CUSTOMER"
        trackingClient={{
          getTracking: () => Promise.resolve(TRACKING),
          getDeliveryOtp: () =>
            Promise.resolve({
              orderId: ORDER_ID,
              secret: '1234',
              issuedAt: '2026-07-22T10:00:00.000Z',
              expiresAt: '2099-07-22T10:10:00.000Z',
            }),
        }}
      />,
    );
    expect(
      await view.findByText('The last location is old. The delivery partner may have moved.'),
    ).toBeTruthy();
    expect(await view.findByLabelText('Delivery OTP 1234')).toBeTruthy();
    expect(view.queryByText('private-id')).toBeNull();
  });

  it('does not request an OTP before the contractual status', async () => {
    const getDeliveryOtp = jest.fn();
    const view = render(
      <CustomerOrderTracking
        orderId={ORDER_ID}
        orderStatus="OUT_FOR_DELIVERY"
        trackingClient={{
          getTracking: () => Promise.resolve({ ...TRACKING, location: null }),
          getDeliveryOtp,
        }}
      />,
    );
    expect(
      await view.findByText('The delivery partner location is not available yet.'),
    ).toBeTruthy();
    expect(getDeliveryOtp).not.toHaveBeenCalled();
    expect(view.queryByLabelText('Delivery OTP unavailable')).toBeNull();
  });

  it('shows tracking-not-started before assignment', async () => {
    const getTracking = jest.fn();
    const view = render(
      <CustomerOrderTracking
        orderId={ORDER_ID}
        orderStatus="CAPTAIN_SEARCHING"
        trackingClient={{ getTracking, getDeliveryOtp: jest.fn() }}
      />,
    );
    expect(await view.findByText('Live delivery tracking has not started yet.')).toBeTruthy();
    expect(getTracking).not.toHaveBeenCalled();
  });

  it('hides tracking and OTP after completion', async () => {
    const getTracking = jest.fn();
    const getDeliveryOtp = jest.fn();
    const view = render(
      <CustomerOrderTracking
        orderId={ORDER_ID}
        orderStatus="COMPLETED"
        trackingClient={{ getTracking, getDeliveryOtp }}
      />,
    );
    expect(
      await view.findByText('Live delivery tracking is unavailable for this order stage.'),
    ).toBeTruthy();
    expect(view.queryByLabelText('Delivery OTP 1234')).toBeNull();
    expect(getTracking).not.toHaveBeenCalled();
    expect(getDeliveryOtp).not.toHaveBeenCalled();
  });

  it('does not carry tracking or OTP into another order or an unavailable lifecycle', async () => {
    const view = render(
      <CustomerOrderTracking
        orderId={ORDER_ID}
        orderStatus="CAPTAIN_AT_CUSTOMER"
        trackingClient={{
          getTracking: () => Promise.resolve(TRACKING),
          getDeliveryOtp: () =>
            Promise.resolve({
              orderId: ORDER_ID,
              secret: '1234',
              issuedAt: '2026-07-22T10:00:00.000Z',
              expiresAt: '2099-07-22T10:10:00.000Z',
            }),
        }}
      />,
    );

    expect(await view.findByText('Ravi')).toBeTruthy();
    expect(await view.findByLabelText('Delivery OTP 1234')).toBeTruthy();

    view.rerender(
      <CustomerOrderTracking
        orderId="10000000-0000-4000-8000-000000000002"
        orderStatus="COMPLETED"
        trackingClient={{ getTracking: jest.fn(), getDeliveryOtp: jest.fn() }}
      />,
    );

    expect(view.queryByText('Ravi')).toBeNull();
    expect(view.queryByLabelText('Delivery OTP 1234')).toBeNull();
    expect(
      await view.findByText('Live delivery tracking is unavailable for this order stage.'),
    ).toBeTruthy();
  });

  it('hides an already-expired OTP response', async () => {
    const view = render(
      <CustomerOrderTracking
        orderId={ORDER_ID}
        orderStatus="CAPTAIN_AT_CUSTOMER"
        trackingClient={{
          getTracking: () => Promise.resolve(TRACKING),
          getDeliveryOtp: () =>
            Promise.resolve({
              orderId: ORDER_ID,
              secret: '9999',
              issuedAt: '2020-01-01T00:00:00.000Z',
              expiresAt: '2020-01-01T00:01:00.000Z',
            }),
        }}
      />,
    );

    expect(await view.findByLabelText('Delivery OTP unavailable')).toBeTruthy();
    expect(view.queryByLabelText('Delivery OTP 9999')).toBeNull();
  });

  it('removes an OTP when its server expiry is reached', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-22T10:00:00.000Z'));
    try {
      const view = render(
        <CustomerOrderTracking
          orderId={ORDER_ID}
          orderStatus="CAPTAIN_AT_CUSTOMER"
          trackingClient={{
            getTracking: () => Promise.resolve(TRACKING),
            getDeliveryOtp: () =>
              Promise.resolve({
                orderId: ORDER_ID,
                secret: '5678',
                issuedAt: '2026-07-22T10:00:00.000Z',
                expiresAt: '2026-07-22T10:01:00.000Z',
              }),
          }}
        />,
      );

      expect(await view.findByLabelText('Delivery OTP 5678')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(view.queryByLabelText('Delivery OTP 5678')).toBeNull();
      expect(view.getByLabelText('Delivery OTP unavailable')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears tracking and OTP after an authentication failure', async () => {
    const getTracking = jest
      .fn()
      .mockResolvedValueOnce(TRACKING)
      .mockRejectedValueOnce(new CustomerOrderError('AUTHENTICATION', null, false));
    const view = render(
      <CustomerOrderTracking
        orderId={ORDER_ID}
        orderStatus="CAPTAIN_AT_CUSTOMER"
        trackingClient={{
          getTracking,
          getDeliveryOtp: () =>
            Promise.resolve({
              orderId: ORDER_ID,
              secret: '1234',
              issuedAt: '2026-07-22T10:00:00.000Z',
              expiresAt: '2099-07-22T10:10:00.000Z',
            }),
        }}
      />,
    );

    expect(await view.findByText('Ravi')).toBeTruthy();
    expect(await view.findByLabelText('Delivery OTP 1234')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Refresh delivery tracking'));
    expect(
      await view.findByText('Your session expired. Sign in again to view tracking.'),
    ).toBeTruthy();
    expect(view.queryByText('Ravi')).toBeNull();
    expect(view.queryByLabelText('Delivery OTP 1234')).toBeNull();
  });

  it('fails safely when tracking is unavailable', async () => {
    const view = render(
      <CustomerOrderTracking
        orderId={ORDER_ID}
        orderStatus="OUT_FOR_DELIVERY"
        trackingClient={{
          getTracking: () => Promise.reject(new Error('down')),
          getDeliveryOtp: () => Promise.reject(new Error('down')),
        }}
      />,
    );
    expect(await view.findByText('Live tracking is temporarily unavailable.')).toBeTruthy();
  });
});
