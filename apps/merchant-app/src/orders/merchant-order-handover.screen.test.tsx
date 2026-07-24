import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { MerchantOrderHandoverActions } from './merchant-order-handover.screen';
import type {
  MerchantDeliveryProjection,
  MerchantOrderHandoverPort,
} from './merchant-order-handover.types';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const TASK_ID = '20000000-0000-4000-8000-000000000001';

function delivery(input: Partial<MerchantDeliveryProjection> = {}): MerchantDeliveryProjection {
  return {
    orderId: ORDER_ID,
    deliveryTaskId: TASK_ID,
    orderNumber: 'VAS-1',
    orderStatus: 'CAPTAIN_ASSIGNED',
    taskStatus: 'ASSIGNED',
    captainAssigned: true,
    captainAtStore: false,
    pickedUpAt: null,
    updatedAt: '2026-07-24T12:00:00.000Z',
    ...input,
  };
}

function port(snapshot: MerchantDeliveryProjection): jest.Mocked<MerchantOrderHandoverPort> {
  return {
    getDelivery: jest.fn().mockResolvedValue(snapshot),
    getPickupCode: jest.fn().mockResolvedValue({
      orderId: ORDER_ID,
      deliveryTaskId: TASK_ID,
      secret: '123456',
      issuedAt: '2026-07-24T12:00:00.000Z',
      expiresAt: '2026-07-24T12:10:00.000Z',
    }),
  };
}

describe('MerchantOrderHandoverActions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-24T12:01:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not request or render a pickup code before the captain arrives', async () => {
    const client = port(delivery());
    const view = render(
      <MerchantOrderHandoverActions
        handoverClient={client}
        onAuthoritativePickupConfirmed={jest.fn()}
        onSessionExpired={jest.fn()}
        orderId={ORDER_ID}
        pollIntervalMs={0}
      />,
    );

    expect(await view.findByText('Captain assigned')).toBeTruthy();
    expect(view.queryByLabelText('Show authorized merchant pickup code')).toBeNull();
    expect(view.queryByTestId('merchant-pickup-code')).toBeNull();
    expect(client.getPickupCode).not.toHaveBeenCalled();
  });

  it('reveals the code only after explicit action in authoritative at-store state', async () => {
    const client = port(delivery({ taskStatus: 'AT_PICKUP', captainAtStore: true }));
    const view = render(
      <MerchantOrderHandoverActions
        handoverClient={client}
        onAuthoritativePickupConfirmed={jest.fn()}
        onSessionExpired={jest.fn()}
        orderId={ORDER_ID}
        pollIntervalMs={0}
      />,
    );

    await view.findByText('Captain is at the store');
    expect(client.getPickupCode).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Show authorized merchant pickup code'));

    expect(await view.findByText('123456')).toBeTruthy();
    expect(client.getPickupCode).toHaveBeenCalledWith(ORDER_ID);
    fireEvent.press(view.getByLabelText('Hide merchant pickup code'));
    expect(view.queryByText('123456')).toBeNull();
  });

  it('blocks duplicate code requests while the first request is in flight', async () => {
    let resolveCode: MerchantOrderHandoverPort['getPickupCode'] extends (
      ...args: never[]
    ) => Promise<infer T>
      ? ((value: T) => void) | undefined
      : never;
    const pending = new Promise<Awaited<ReturnType<MerchantOrderHandoverPort['getPickupCode']>>>(
      (resolve) => {
        resolveCode = resolve;
      },
    );
    const client = port(delivery({ taskStatus: 'AT_PICKUP', captainAtStore: true }));
    client.getPickupCode.mockImplementation(() => pending);
    const view = render(
      <MerchantOrderHandoverActions
        handoverClient={client}
        onAuthoritativePickupConfirmed={jest.fn()}
        onSessionExpired={jest.fn()}
        orderId={ORDER_ID}
        pollIntervalMs={0}
      />,
    );

    await view.findByText('Captain is at the store');
    fireEvent.press(view.getByLabelText('Show authorized merchant pickup code'));
    fireEvent.press(view.getByLabelText('Show authorized merchant pickup code'));
    expect(client.getPickupCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCode?.({
        orderId: ORDER_ID,
        deliveryTaskId: TASK_ID,
        secret: '123456',
        issuedAt: '2026-07-24T12:00:00.000Z',
        expiresAt: '2026-07-24T12:10:00.000Z',
      });
      await pending;
    });
  });

  it('clears the code and reports completion only from authoritative pickup state', async () => {
    const client = port(delivery({ taskStatus: 'AT_PICKUP', captainAtStore: true }));
    const onPickup = jest.fn();
    const view = render(
      <MerchantOrderHandoverActions
        handoverClient={client}
        onAuthoritativePickupConfirmed={onPickup}
        onSessionExpired={jest.fn()}
        orderId={ORDER_ID}
        pollIntervalMs={1_000}
      />,
    );

    await view.findByText('Captain is at the store');
    fireEvent.press(view.getByLabelText('Show authorized merchant pickup code'));
    await view.findByText('123456');
    client.getDelivery.mockResolvedValue(
      delivery({
        orderStatus: 'PICKED_UP',
        taskStatus: 'PICKED_UP',
        captainAtStore: false,
        pickedUpAt: '2026-07-24T12:02:00.000Z',
      }),
    );

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    await waitFor(() => {
      expect(onPickup).toHaveBeenCalledTimes(1);
    });
    expect(view.queryByText('123456')).toBeNull();
    expect(view.getByText('Handover complete')).toBeTruthy();
  });
});
