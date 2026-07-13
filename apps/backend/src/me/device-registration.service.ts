import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createDeviceRegistrationProviderUnavailableException,
  createDeviceRegistrationStateInvalidException,
  createInvalidDeviceRegistrationException,
} from './device-registration-http-error';
import {
  type DeviceRegistrationGateway,
  DeviceRegistrationGatewayDataInvalidError,
  DeviceRegistrationGatewayUnavailableError,
} from './device-registration.gateway';
import { DEVICE_REGISTRATION_GATEWAY } from './device-registration.tokens';
import {
  DEVICE_PLATFORMS,
  PUSH_PROVIDERS,
  type DevicePlatform,
  type PushProvider,
  type RegisterDeviceGatewayCommand,
  type RegisterDeviceRequest,
  type RegisterDeviceResponse,
  type RegisteredDeviceSnapshot,
} from './device-registration.types';

const MAX_DEVICE_FINGERPRINT_LENGTH = 255;
const MAX_PUSH_TOKEN_LENGTH = 4096;
const MAX_APP_VERSION_LENGTH = 64;
const MAX_DEVICE_MODEL_LENGTH = 120;
const MAX_OS_VERSION_LENGTH = 64;

const REGISTER_DEVICE_KEYS = new Set([
  'deviceFingerprint',
  'platform',
  'pushProvider',
  'pushToken',
  'appVersion',
  'deviceModel',
  'osVersion',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function invalidRequest(): never {
  throw createInvalidDeviceRegistrationException();
}

function requireTrimmedString(value: unknown, maximumLength: number): string {
  if (typeof value !== 'string') {
    return invalidRequest();
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > maximumLength) {
    return invalidRequest();
  }

  return trimmed;
}

function requireProperty(record: Record<string, unknown>, key: string): unknown {
  if (!hasOwn(record, key)) {
    return invalidRequest();
  }

  return record[key];
}

function requireNullableStringProperty(
  record: Record<string, unknown>,
  key: string,
  maximumLength: number,
): string | null {
  const value = requireProperty(record, key);

  if (value === null) {
    return null;
  }

  return requireTrimmedString(value, maximumLength);
}

function readOptionalNullableStringProperty(
  record: Record<string, unknown>,
  key: string,
  maximumLength: number,
): string | null {
  if (!hasOwn(record, key) || record[key] === null) {
    return null;
  }

  return requireTrimmedString(record[key], maximumLength);
}

function requireDevicePlatform(value: unknown): DevicePlatform {
  if (typeof value !== 'string') {
    return invalidRequest();
  }

  for (const candidate of DEVICE_PLATFORMS) {
    if (value === candidate) {
      return candidate;
    }
  }

  return invalidRequest();
}

function requireNullablePushProvider(value: unknown): PushProvider | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return invalidRequest();
  }

  for (const candidate of PUSH_PROVIDERS) {
    if (value === candidate) {
      return candidate;
    }
  }

  return invalidRequest();
}

function assertNoUnknownFields(record: Record<string, unknown>): void {
  if (Object.keys(record).some((key) => !REGISTER_DEVICE_KEYS.has(key))) {
    invalidRequest();
  }
}

function assertPushRegistrationIsCompatible(
  platform: DevicePlatform,
  pushProvider: PushProvider | null,
  pushToken: string | null,
): void {
  if ((pushProvider === null) !== (pushToken === null)) {
    invalidRequest();
  }

  if (pushProvider === null) {
    return;
  }

  if (
    (platform === 'ANDROID' && pushProvider !== 'FCM') ||
    (platform === 'WEB' && pushProvider !== 'WEB_PUSH') ||
    (platform === 'IOS' && pushProvider === 'WEB_PUSH')
  ) {
    invalidRequest();
  }
}

function parseRegisterDeviceRequest(body: unknown): RegisterDeviceRequest {
  if (!isRecord(body)) {
    return invalidRequest();
  }

  assertNoUnknownFields(body);

  const platform = requireDevicePlatform(requireProperty(body, 'platform'));
  const pushProvider = requireNullablePushProvider(requireProperty(body, 'pushProvider'));
  const pushToken = requireNullableStringProperty(body, 'pushToken', MAX_PUSH_TOKEN_LENGTH);

  assertPushRegistrationIsCompatible(platform, pushProvider, pushToken);

  return {
    deviceFingerprint: requireTrimmedString(
      requireProperty(body, 'deviceFingerprint'),
      MAX_DEVICE_FINGERPRINT_LENGTH,
    ),
    platform,
    pushProvider,
    pushToken,
    appVersion: requireTrimmedString(requireProperty(body, 'appVersion'), MAX_APP_VERSION_LENGTH),
    deviceModel: readOptionalNullableStringProperty(body, 'deviceModel', MAX_DEVICE_MODEL_LENGTH),
    osVersion: readOptionalNullableStringProperty(body, 'osVersion', MAX_OS_VERSION_LENGTH),
  };
}

@Injectable()
export class DeviceRegistrationService {
  public constructor(
    @Inject(DEVICE_REGISTRATION_GATEWAY)
    private readonly gateway: DeviceRegistrationGateway,
  ) {}

  public async registerDevice(
    context: AuthenticatedRequestContext,
    body: unknown,
  ): Promise<RegisterDeviceResponse> {
    const request = parseRegisterDeviceRequest(body);
    const command: RegisterDeviceGatewayCommand = {
      ...request,
      userId: context.actor.id,
      appName: context.actor.accountType,
      lastSeenAt: new Date().toISOString(),
    };

    try {
      const device = await this.gateway.upsertDevice(context.supabase, command);

      this.assertDeviceMatchesCommand(device, command);

      return {
        success: true,
        data: {
          id: device.id,
          deviceFingerprint: device.deviceFingerprint,
          platform: device.platform,
          pushProvider: device.pushProvider,
          appName: device.appName,
          appVersion: device.appVersion,
          deviceModel: device.deviceModel,
          osVersion: device.osVersion,
          notificationEnabled: device.notificationEnabled,
          orderSoundEnabled: device.orderSoundEnabled,
          lastSeenAt: device.lastSeenAt,
          revokedAt: null,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      if (error instanceof DeviceRegistrationGatewayUnavailableError) {
        throw createDeviceRegistrationProviderUnavailableException();
      }

      if (error instanceof DeviceRegistrationGatewayDataInvalidError) {
        throw createDeviceRegistrationStateInvalidException();
      }

      throw error;
    }
  }

  private assertDeviceMatchesCommand(
    device: RegisteredDeviceSnapshot,
    command: RegisterDeviceGatewayCommand,
  ): void {
    if (
      device.userId !== command.userId ||
      device.deviceFingerprint !== command.deviceFingerprint ||
      device.platform !== command.platform ||
      device.pushProvider !== command.pushProvider ||
      device.appName !== command.appName ||
      device.appVersion !== command.appVersion ||
      device.deviceModel !== command.deviceModel ||
      device.osVersion !== command.osVersion ||
      device.revokedAt !== null
    ) {
      throw new DeviceRegistrationGatewayDataInvalidError();
    }
  }
}
