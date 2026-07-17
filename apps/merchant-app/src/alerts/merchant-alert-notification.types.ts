export interface MerchantAlertNotificationPayload {
  readonly schemaVersion: '1';
  readonly kind: 'MERCHANT_NEW_ORDER';
  readonly alertId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly shopId: string;
  readonly expiresAt: string;
  readonly soundShouldPlay: true;
  readonly notificationId: string | null;
}

export type MerchantAlertSetupState =
  'CHECKING' | 'READY' | 'PERMISSION_DENIED' | 'UNSUPPORTED' | 'ERROR';

export interface MerchantAlertDiagnostics {
  readonly physicalDevice: boolean;
  readonly permissionGranted: boolean;
  readonly permissionCanAskAgain: boolean;
  readonly channelReady: boolean;
  readonly customSoundReady: boolean;
  readonly vibrationReady: boolean;
  readonly pushTokenReady: boolean;
  readonly backendRegistrationReady: boolean;
  readonly lastCheckedAt: string;
  readonly failureReason: string | null;
}

export interface MerchantAlertRuntimeValue {
  readonly activeAlert: MerchantAlertNotificationPayload | null;
  readonly setupState: MerchantAlertSetupState;
  readonly diagnostics: MerchantAlertDiagnostics;
  refreshSetup(): Promise<void>;
  testNotification(): Promise<void>;
  clearActiveAlert(): Promise<void>;
}
