import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import { ACCOUNT_TYPES, type AccountType } from '../auth/auth.types';
import {
  DEVICE_PLATFORMS,
  PUSH_PROVIDERS,
  type DevicePlatform,
  type PushProvider,
  type RegisterDeviceGatewayCommand,
  type RegisteredDeviceSnapshot,
} from './device-registration.types';

export interface DeviceRegistrationGateway {
  upsertDevice(
    client: SupabaseClient,
    command: RegisterDeviceGatewayCommand,
  ): Promise<RegisteredDeviceSnapshot>;
}

export class DeviceRegistrationGatewayUnavailableError extends Error {
  public constructor() {
    super('Device registration provider unavailable');
    this.name = 'DeviceRegistrationGatewayUnavailableError';
  }
}

export class DeviceRegistrationGatewayDataInvalidError extends Error {
  public constructor() {
    super('Device registration provider returned invalid data');
    this.name = 'DeviceRegistrationGatewayDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAccountType(value: unknown): value is AccountType {
  return typeof value === 'string' && ACCOUNT_TYPES.some((candidate) => candidate === value);
}

function isDevicePlatform(value: unknown): value is DevicePlatform {
  return typeof value === 'string' && DEVICE_PLATFORMS.some((candidate) => candidate === value);
}

function isPushProvider(value: unknown): value is PushProvider {
  return typeof value === 'string' && PUSH_PROVIDERS.some((candidate) => candidate === value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DeviceRegistrationGatewayDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new DeviceRegistrationGatewayDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new DeviceRegistrationGatewayDataInvalidError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new DeviceRegistrationGatewayDataInvalidError();
  }

  return value;
}

function parseRegisteredDevice(value: unknown): RegisteredDeviceSnapshot {
  if (!isRecord(value)) {
    throw new DeviceRegistrationGatewayDataInvalidError();
  }

  const platform = value['platform'];
  const pushProvider = value['push_provider'];
  const appName = value['app_name'];

  if (!isDevicePlatform(platform) || !isAccountType(appName)) {
    throw new DeviceRegistrationGatewayDataInvalidError();
  }

  if (pushProvider !== null && !isPushProvider(pushProvider)) {
    throw new DeviceRegistrationGatewayDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    userId: requireString(value, 'user_id'),
    deviceFingerprint: requireString(value, 'device_fingerprint'),
    platform,
    pushProvider,
    appName,
    appVersion: requireString(value, 'app_version'),
    deviceModel: requireNullableString(value, 'device_model'),
    osVersion: requireNullableString(value, 'os_version'),
    notificationEnabled: requireBoolean(value, 'notification_enabled'),
    orderSoundEnabled: requireBoolean(value, 'order_sound_enabled'),
    lastSeenAt: requireTimestamp(value, 'last_seen_at'),
    revokedAt: requireNullableString(value, 'revoked_at'),
  };
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof DeviceRegistrationGatewayUnavailableError ||
    error instanceof DeviceRegistrationGatewayDataInvalidError
  ) {
    throw error;
  }

  throw new DeviceRegistrationGatewayUnavailableError();
}

@Injectable()
export class SupabaseDeviceRegistrationGateway implements DeviceRegistrationGateway {
  public async upsertDevice(
    client: SupabaseClient,
    command: RegisterDeviceGatewayCommand,
  ): Promise<RegisteredDeviceSnapshot> {
    try {
      const response = await client
        .from('user_devices')
        .upsert(
          {
            user_id: command.userId,
            device_fingerprint: command.deviceFingerprint,
            platform: command.platform,
            push_provider: command.pushProvider,
            push_token: command.pushToken,
            app_name: command.appName,
            app_version: command.appVersion,
            device_model: command.deviceModel,
            os_version: command.osVersion,
            last_seen_at: command.lastSeenAt,
            revoked_at: null,
            updated_at: command.lastSeenAt,
          } as never,
          {
            onConflict: 'user_id,device_fingerprint',
          },
        )
        .select(
          [
            'id',
            'user_id',
            'device_fingerprint',
            'platform',
            'push_provider',
            'app_name',
            'app_version',
            'device_model',
            'os_version',
            'notification_enabled',
            'order_sound_enabled',
            'last_seen_at',
            'revoked_at',
          ].join(', '),
        )
        .single();

      if (response.error !== null) {
        throw new DeviceRegistrationGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseRegisteredDevice(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
