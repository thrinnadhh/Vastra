import type { AccountType } from '../auth/auth.types';

export const DEVICE_PLATFORMS = ['ANDROID', 'IOS', 'WEB'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const PUSH_PROVIDERS = ['FCM', 'APNS', 'WEB_PUSH'] as const;
export type PushProvider = (typeof PUSH_PROVIDERS)[number];

export interface RegisterDeviceRequest {
  readonly deviceFingerprint: string;
  readonly platform: DevicePlatform;
  readonly pushProvider: PushProvider | null;
  readonly pushToken: string | null;
  readonly appVersion: string;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
}

export interface RegisterDeviceGatewayCommand extends RegisterDeviceRequest {
  readonly userId: string;
  readonly appName: AccountType;
  readonly lastSeenAt: string;
}

export interface RegisteredDeviceSnapshot {
  readonly id: string;
  readonly userId: string;
  readonly deviceFingerprint: string;
  readonly platform: DevicePlatform;
  readonly pushProvider: PushProvider | null;
  readonly appName: AccountType;
  readonly appVersion: string;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
  readonly notificationEnabled: boolean;
  readonly orderSoundEnabled: boolean;
  readonly lastSeenAt: string;
  readonly revokedAt: string | null;
}

export interface RegisterDeviceResponse {
  readonly success: true;
  readonly data: {
    readonly id: string;
    readonly deviceFingerprint: string;
    readonly platform: DevicePlatform;
    readonly pushProvider: PushProvider | null;
    readonly appName: AccountType;
    readonly appVersion: string;
    readonly deviceModel: string | null;
    readonly osVersion: string | null;
    readonly notificationEnabled: boolean;
    readonly orderSoundEnabled: boolean;
    readonly lastSeenAt: string;
    readonly revokedAt: null;
  };
  readonly meta: {
    readonly requestId: null;
  };
}
