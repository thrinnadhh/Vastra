import type { SupabaseClient } from '../auth/supabase-client.type';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type DeviceRegistrationGateway,
  DeviceRegistrationGatewayUnavailableError,
} from './device-registration.gateway';
import { DeviceRegistrationService } from './device-registration.service';
import type {
  RegisterDeviceGatewayCommand,
  RegisteredDeviceSnapshot,
} from './device-registration.types';

const emptySupabaseClient = Object.freeze({}) as unknown as SupabaseClient;
const USER_ID = '10000000-0000-0000-0000-000000000001';
const DEVICE_ID = '20000000-0000-0000-0000-000000000001';

function createContext(): AuthenticatedRequestContext {
  return {
    actor: {
      id: USER_ID,
      email: 'merchant@example.test',
      accountType: 'MERCHANT',
      status: 'ACTIVE',
    },
    accessToken: 'secret-access-token',
    supabase: emptySupabaseClient,
  };
}

class RecordingDeviceRegistrationGateway implements DeviceRegistrationGateway {
  public commands: RegisterDeviceGatewayCommand[] = [];
  public clients: SupabaseClient[] = [];
  public unavailable = false;
  public snapshotOverride: RegisteredDeviceSnapshot | null = null;

  public upsertDevice(
    client: SupabaseClient,
    command: RegisterDeviceGatewayCommand,
  ): Promise<RegisteredDeviceSnapshot> {
    if (this.unavailable) {
      return Promise.reject(new DeviceRegistrationGatewayUnavailableError());
    }

    this.clients.push(client);
    this.commands.push(command);

    return Promise.resolve(
      this.snapshotOverride ?? {
        id: DEVICE_ID,
        userId: command.userId,
        deviceFingerprint: command.deviceFingerprint,
        platform: command.platform,
        pushProvider: command.pushProvider,
        appName: command.appName,
        appVersion: command.appVersion,
        deviceModel: command.deviceModel,
        osVersion: command.osVersion,
        notificationEnabled: true,
        orderSoundEnabled: false,
        lastSeenAt: command.lastSeenAt,
        revokedAt: null,
      },
    );
  }
}

function requireHttpErrorCode(error: unknown): string {
  if (!(error instanceof HttpException)) {
    throw new TypeError('Expected HttpException');
  }

  const response: unknown = error.getResponse();

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new TypeError('Expected object response');
  }

  const errorValue = (response as Record<string, unknown>)['error'];

  if (typeof errorValue !== 'object' || errorValue === null || Array.isArray(errorValue)) {
    throw new TypeError('Expected error object');
  }

  const code = (errorValue as Record<string, unknown>)['code'];

  if (typeof code !== 'string') {
    throw new TypeError('Expected string error code');
  }

  return code;
}

describe('DeviceRegistrationService', () => {
  let gateway: RecordingDeviceRegistrationGateway;
  let service: DeviceRegistrationService;

  beforeEach(() => {
    gateway = new RecordingDeviceRegistrationGateway();
    service = new DeviceRegistrationService(gateway);
  });

  it('registers a device through the request-scoped client and derives ownership', async () => {
    const response = await service.registerDevice(createContext(), {
      deviceFingerprint: '  device-fingerprint-1  ',
      platform: 'IOS',
      pushProvider: 'FCM',
      pushToken: '  push-token-secret  ',
      appVersion: '  1.2.3  ',
      deviceModel: '  iPhone 17  ',
      osVersion: '  20.0  ',
    });

    expect(gateway.clients).toStrictEqual([emptySupabaseClient]);
    expect(gateway.commands).toHaveLength(1);

    const command = gateway.commands[0];

    if (command === undefined) {
      throw new TypeError('Expected a recorded command');
    }

    expect(command).toMatchObject({
      userId: USER_ID,
      appName: 'MERCHANT',
      deviceFingerprint: 'device-fingerprint-1',
      platform: 'IOS',
      pushProvider: 'FCM',
      pushToken: 'push-token-secret',
      appVersion: '1.2.3',
      deviceModel: 'iPhone 17',
      osVersion: '20.0',
    });
    expect(Number.isNaN(Date.parse(command.lastSeenAt))).toBe(false);

    expect(response).toStrictEqual({
      success: true,
      data: {
        id: DEVICE_ID,
        deviceFingerprint: 'device-fingerprint-1',
        platform: 'IOS',
        pushProvider: 'FCM',
        appName: 'MERCHANT',
        appVersion: '1.2.3',
        deviceModel: 'iPhone 17',
        osVersion: '20.0',
        notificationEnabled: true,
        orderSoundEnabled: false,
        lastSeenAt: command.lastSeenAt,
        revokedAt: null,
      },
      meta: {
        requestId: null,
      },
    });

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('push-token-secret');
    expect(serialized).not.toContain('secret-access-token');
  });

  it('supports a registration without push notifications', async () => {
    const response = await service.registerDevice(createContext(), {
      deviceFingerprint: 'browser-fingerprint',
      platform: 'WEB',
      pushProvider: null,
      pushToken: null,
      appVersion: '1.0.0',
    });

    expect(response.data.pushProvider).toBeNull();
    expect(response.data.deviceModel).toBeNull();
    expect(response.data.osVersion).toBeNull();
  });

  it('rejects a provider and token mismatch before calling the gateway', async () => {
    await expect(
      service.registerDevice(createContext(), {
        deviceFingerprint: 'device-fingerprint-1',
        platform: 'ANDROID',
        pushProvider: 'FCM',
        pushToken: null,
        appVersion: '1.0.0',
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'INVALID_DEVICE_REGISTRATION',
    );

    expect(gateway.commands).toStrictEqual([]);
  });

  it('rejects an incompatible platform and push provider', async () => {
    await expect(
      service.registerDevice(createContext(), {
        deviceFingerprint: 'device-fingerprint-1',
        platform: 'WEB',
        pushProvider: 'FCM',
        pushToken: 'push-token',
        appVersion: '1.0.0',
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'INVALID_DEVICE_REGISTRATION',
    );

    expect(gateway.commands).toStrictEqual([]);
  });

  it('rejects client-controlled ownership fields', async () => {
    await expect(
      service.registerDevice(createContext(), {
        deviceFingerprint: 'device-fingerprint-1',
        platform: 'ANDROID',
        pushProvider: 'FCM',
        pushToken: 'push-token',
        appVersion: '1.0.0',
        appName: 'ADMIN',
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'INVALID_DEVICE_REGISTRATION',
    );

    expect(gateway.commands).toStrictEqual([]);
  });

  it('maps provider failures to the standardized 503 error', async () => {
    gateway.unavailable = true;

    await expect(
      service.registerDevice(createContext(), {
        deviceFingerprint: 'device-fingerprint-1',
        platform: 'ANDROID',
        pushProvider: 'FCM',
        pushToken: 'push-token',
        appVersion: '1.0.0',
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'EXTERNAL_SERVICE_UNAVAILABLE',
    );
  });

  it('rejects a provider result owned by another user', async () => {
    gateway.snapshotOverride = {
      id: DEVICE_ID,
      userId: '30000000-0000-0000-0000-000000000001',
      deviceFingerprint: 'device-fingerprint-1',
      platform: 'ANDROID',
      pushProvider: 'FCM',
      appName: 'MERCHANT',
      appVersion: '1.0.0',
      deviceModel: null,
      osVersion: null,
      notificationEnabled: true,
      orderSoundEnabled: true,
      lastSeenAt: '2026-07-13T10:00:00.000Z',
      revokedAt: null,
    };

    await expect(
      service.registerDevice(createContext(), {
        deviceFingerprint: 'device-fingerprint-1',
        platform: 'ANDROID',
        pushProvider: 'FCM',
        pushToken: 'push-token',
        appVersion: '1.0.0',
      }),
    ).rejects.toSatisfy(
      (error: unknown) => requireHttpErrorCode(error) === 'DEVICE_REGISTRATION_STATE_INVALID',
    );
  });
});
