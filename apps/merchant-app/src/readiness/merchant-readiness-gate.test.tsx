import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { MerchantAlertRuntimeValue, MerchantAlertSetupState } from '../alerts/merchant-alert-notification.types';
import { MerchantReadinessGate } from './merchant-readiness-gate';

const mockUseMerchantAlertRuntime = jest.fn<MerchantAlertRuntimeValue, []>();

jest.mock('../alerts/merchant-alert-notification.runtime', () => ({
  useMerchantAlertRuntime: () => mockUseMerchantAlertRuntime(),
}));

function runtime(setupState: MerchantAlertSetupState): MerchantAlertRuntimeValue {
  return {
    activeAlert: null,
    setupState,
    diagnostics: {
      physicalDevice: setupState !== 'PHYSICAL_DEVICE_REQUIRED',
      permissionGranted: !['PERMISSION_DENIED', 'PERMISSION_BLOCKED'].includes(setupState),
      permissionCanAskAgain: setupState === 'PERMISSION_DENIED',
      channelReady: setupState !== 'CHANNEL_MISCONFIGURED',
      customSoundReady: setupState !== 'CHANNEL_MISCONFIGURED',
      vibrationReady: setupState !== 'CHANNEL_MISCONFIGURED',
      pushTokenReady: !['TOKEN_UNAVAILABLE', 'PHYSICAL_DEVICE_REQUIRED'].includes(setupState),
      backendRegistrationReady: setupState === 'READY',
      lastCheckedAt: '2026-07-24T12:00:00.000Z',
      failureReason: setupState === 'READY' ? null : `Failure ${setupState}`,
    },
    refreshSetup: jest.fn(() => Promise.resolve()),
    testNotification: jest.fn(() => Promise.resolve()),
    clearActiveAlert: jest.fn(() => Promise.resolve()),
  };
}

describe('MerchantReadinessGate', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('shows settings recovery only for a permanently blocked permission', () => {
    mockUseMerchantAlertRuntime.mockReturnValue(runtime('PERMISSION_BLOCKED'));
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const view = render(<MerchantReadinessGate onOpenDiagnostics={jest.fn()} />);

    fireEvent.press(view.getByLabelText('Open Android settings for merchant alerts'));

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(view.getByText('Notifications are blocked')).toBeTruthy();
  });

  it('keeps retry available for a recoverable token failure', () => {
    const value = runtime('TOKEN_UNAVAILABLE');
    mockUseMerchantAlertRuntime.mockReturnValue(value);
    const view = render(<MerchantReadinessGate onOpenDiagnostics={jest.fn()} />);

    fireEvent.press(view.getByLabelText('Retry merchant readiness checks'));

    expect(value.refreshSetup).toHaveBeenCalledTimes(1);
    expect(view.queryByLabelText('Open Android settings for merchant alerts')).toBeNull();
  });

  it('blocks duplicate retry interaction while checks are running', () => {
    const value = runtime('CHECKING');
    mockUseMerchantAlertRuntime.mockReturnValue(value);
    const view = render(<MerchantReadinessGate onOpenDiagnostics={jest.fn()} />);

    fireEvent.press(view.getByLabelText('Retry merchant readiness checks'));

    expect(value.refreshSetup).not.toHaveBeenCalled();
    expect(view.getByText('Checking…')).toBeTruthy();
  });

  it('opens diagnostics through the frozen accessibility contract', () => {
    mockUseMerchantAlertRuntime.mockReturnValue(runtime('OFFLINE_STALE'));
    const openDiagnostics = jest.fn();
    const view = render(<MerchantReadinessGate onOpenDiagnostics={openDiagnostics} />);

    fireEvent.press(view.getByLabelText('Open merchant alert diagnostics'));

    expect(openDiagnostics).toHaveBeenCalledTimes(1);
  });
});
