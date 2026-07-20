import { act, fireEvent, render } from '@testing-library/react-native';

import type { MerchantOrderDetail, MerchantOrderReadPort } from '../orders/merchant-order.types';
import { MerchantUrgentAlertModal } from './merchant-urgent-alert.modal';
import type { MerchantAlertRuntimeValue } from './merchant-alert-notification.types';
import type { MerchantOrderAlertClient } from './merchant-order-alert.client';

const mockPlayer = {
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
};
const mockUseMerchantAlertRuntime = jest.fn<MerchantAlertRuntimeValue, []>();

type TestAlertRuntime = Omit<MerchantAlertRuntimeValue, 'clearActiveAlert'> & {
  readonly clearActiveAlert: jest.Mock<Promise<void>, []>;
};

jest.mock(
  'expo-audio',
  () => ({
    useAudioPlayer: () => mockPlayer,
  }),
  { virtual: true },
);

jest.mock('./merchant-alert-notification.runtime', () => ({
  useMerchantAlertRuntime: () => mockUseMerchantAlertRuntime(),
}));

const ALERT = {
  schemaVersion: '1' as const,
  kind: 'MERCHANT_NEW_ORDER' as const,
  alertId: '10000000-0000-4000-8000-000000000001',
  orderId: '20000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-ALERT-1',
  shopId: '30000000-0000-4000-8000-000000000001',
  expiresAt: '2026-07-21T10:01:00.000Z',
  soundShouldPlay: true as const,
  notificationId: 'notification-1',
};

function runtime(): TestAlertRuntime {
  return {
    activeAlert: ALERT,
    setupState: 'READY',
    diagnostics: {
      physicalDevice: true,
      permissionGranted: true,
      permissionCanAskAgain: true,
      channelReady: true,
      customSoundReady: true,
      vibrationReady: true,
      pushTokenReady: true,
      backendRegistrationReady: true,
      lastCheckedAt: '2026-07-21T10:00:00.000Z',
      failureReason: null,
    },
    refreshSetup: jest.fn(() => Promise.resolve()),
    testNotification: jest.fn(() => Promise.resolve()),
    clearActiveAlert: jest.fn(() => Promise.resolve()),
  };
}

function orderClient(status: MerchantOrderDetail['status'] = 'WAITING_FOR_MERCHANT') {
  return {
    getOrder: jest.fn(() => Promise.resolve({ status } as MerchantOrderDetail)),
  } satisfies Pick<MerchantOrderReadPort, 'getOrder'>;
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('MerchantUrgentAlertModal preservation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-21T10:00:00.000Z'));
    mockPlayer.pause.mockClear();
    mockPlayer.play.mockClear();
    mockPlayer.seekTo.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rings immediately and preserves the default 5-second authoritative poll', async () => {
    const value = runtime();
    const client = orderClient();
    mockUseMerchantAlertRuntime.mockReturnValue(value);
    const view = render(
      <MerchantUrgentAlertModal
        alertClient={{ acknowledge: jest.fn(() => Promise.resolve()) }}
        onOpenOrder={jest.fn()}
        orderClient={client}
      />,
    );

    try {
      await advance(0);
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
      expect(client.getOrder).toHaveBeenCalledTimes(1);

      await advance(4_999);
      expect(client.getOrder).toHaveBeenCalledTimes(1);

      await advance(1);
      expect(client.getOrder).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
    }
  });

  it('keeps ringing after a transient read failure and stops only for authoritative state', async () => {
    const value = runtime();
    const client = orderClient();
    client.getOrder
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ status: 'MERCHANT_ACCEPTED' } as MerchantOrderDetail);
    mockUseMerchantAlertRuntime.mockReturnValue(value);
    const view = render(
      <MerchantUrgentAlertModal
        alertClient={{ acknowledge: jest.fn(() => Promise.resolve()) }}
        onOpenOrder={jest.fn()}
        orderClient={client}
      />,
    );

    try {
      await advance(0);
      expect(value.clearActiveAlert.mock.calls).toHaveLength(0);
      expect(mockPlayer.play).toHaveBeenCalled();

      await advance(5_000);
      expect(value.clearActiveAlert.mock.calls).toHaveLength(1);
      expect(mockPlayer.pause).toHaveBeenCalled();
    } finally {
      view.unmount();
    }
  });

  it('acknowledges once, then stops sound, clears the alert, and opens the order', async () => {
    let resolveAcknowledgement: (() => void) | undefined;
    const acknowledgement = new Promise<void>((resolve) => {
      resolveAcknowledgement = resolve;
    });
    const alertClient: jest.Mocked<MerchantOrderAlertClient> = {
      acknowledge: jest.fn((...args: Parameters<MerchantOrderAlertClient['acknowledge']>) => {
        void args;
        return acknowledgement;
      }),
    };
    const value = runtime();
    const openOrder = jest.fn();
    mockUseMerchantAlertRuntime.mockReturnValue(value);
    const view = render(
      <MerchantUrgentAlertModal
        alertClient={alertClient}
        onOpenOrder={openOrder}
        orderClient={orderClient()}
      />,
    );

    try {
      await advance(0);
      fireEvent.press(view.getByLabelText('Acknowledge and open order VAS-ALERT-1'));
      fireEvent.press(view.getByLabelText('Acknowledge and open order VAS-ALERT-1'));
      expect(alertClient.acknowledge.mock.calls).toHaveLength(1);
      expect(value.clearActiveAlert.mock.calls).toHaveLength(0);

      await act(async () => {
        resolveAcknowledgement?.();
        await acknowledgement;
      });
      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(value.clearActiveAlert.mock.calls).toHaveLength(1);
      expect(openOrder).toHaveBeenCalledWith(ALERT.orderId);
    } finally {
      view.unmount();
    }
  });

  it('keeps the alert actionable when acknowledgement fails', async () => {
    const value = runtime();
    mockUseMerchantAlertRuntime.mockReturnValue(value);
    const view = render(
      <MerchantUrgentAlertModal
        alertClient={{ acknowledge: jest.fn(() => Promise.reject(new TypeError('offline'))) }}
        onOpenOrder={jest.fn()}
        orderClient={orderClient()}
      />,
    );

    try {
      await advance(0);
      fireEvent.press(view.getByLabelText('Acknowledge and open order VAS-ALERT-1'));
      expect(
        await view.findByText(
          'We could not acknowledge this alert. Check your connection and retry.',
        ),
      ).toBeTruthy();
      expect(value.clearActiveAlert.mock.calls).toHaveLength(0);
    } finally {
      view.unmount();
    }
  });
});
