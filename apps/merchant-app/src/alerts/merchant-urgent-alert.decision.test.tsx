import { render } from '@testing-library/react-native';

import type {
  MerchantOrderDecisionPort,
  MerchantOrderDetail,
  MerchantOrderReadPort,
} from '../orders/merchant-order.types';
import { MerchantUrgentAlertModal } from './merchant-urgent-alert.modal';
import type { MerchantAlertRuntimeValue } from './merchant-alert-notification.types';

const mockUseMerchantAlertRuntime = jest.fn<MerchantAlertRuntimeValue, []>();

jest.mock(
  'expo-audio',
  () => ({
    useAudioPlayer: () => ({
      pause: jest.fn(),
      play: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
    }),
  }),
  { virtual: true },
);

jest.mock('./merchant-alert-notification.runtime', () => ({
  useMerchantAlertRuntime: () => mockUseMerchantAlertRuntime(),
}));

const ORDER_ID = '20000000-0000-4000-8000-000000000001';

function runtime(): MerchantAlertRuntimeValue {
  return {
    activeAlert: {
      schemaVersion: '1',
      kind: 'MERCHANT_NEW_ORDER',
      alertId: '10000000-0000-4000-8000-000000000001',
      orderId: ORDER_ID,
      orderNumber: 'VAS-ALERT-1',
      shopId: '30000000-0000-4000-8000-000000000001',
      expiresAt: '2099-07-24T12:10:00.000Z',
      soundShouldPlay: true,
      notificationId: 'notification-1',
    },
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
      lastCheckedAt: '2026-07-24T12:00:00.000Z',
      failureReason: null,
    },
    refreshSetup: jest.fn(() => Promise.resolve()),
    testNotification: jest.fn(() => Promise.resolve()),
    clearActiveAlert: jest.fn(() => Promise.resolve()),
  };
}

describe('MerchantUrgentAlertModal direct decisions', () => {
  it('renders the shared decision actions after authoritative order read', async () => {
    mockUseMerchantAlertRuntime.mockReturnValue(runtime());
    const orderClient = {
      getOrder: jest.fn(() =>
        Promise.resolve({
          id: ORDER_ID,
          orderNumber: 'VAS-ALERT-1',
          status: 'WAITING_FOR_MERCHANT',
        } as MerchantOrderDetail),
      ),
    } satisfies Pick<MerchantOrderReadPort, 'getOrder'>;
    const decisionClient: MerchantOrderDecisionPort = {
      acceptOrder: jest.fn(),
      rejectOrder: jest.fn(),
    };
    const view = render(
      <MerchantUrgentAlertModal
        alertClient={{ acknowledge: jest.fn(() => Promise.resolve()) }}
        authoritativePollIntervalMs={0}
        decisionClient={decisionClient}
        onOpenOrder={jest.fn()}
        orderClient={orderClient}
      />,
    );

    expect(
      await view.findByLabelText('Merchant order decision actions in urgent alert'),
    ).toBeTruthy();
    expect(view.getByLabelText('Accept complete merchant order')).toBeTruthy();
    expect(view.getByLabelText('Reject complete merchant order')).toBeTruthy();
  });
});
