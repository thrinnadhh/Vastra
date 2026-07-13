import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthModule } from '../auth/auth.module';
import type { ProfileSnapshot } from '../auth/auth.types';
import { type AuthenticationGateway, type TokenVerificationResult } from '../auth/supabase.gateway';
import { AUTHENTICATION_GATEWAY } from '../auth/supabase.tokens';
import { type DeviceRegistrationGateway } from './device-registration.gateway';
import { DEVICE_REGISTRATION_GATEWAY } from './device-registration.tokens';
import type {
  RegisterDeviceGatewayCommand,
  RegisteredDeviceSnapshot,
} from './device-registration.types';
import { MeModule } from './me.module';

const emptySupabaseClient = Object.freeze({}) as unknown as SupabaseClient;
const USER_ID = '10000000-0000-0000-0000-000000000001';
const DEVICE_ID = '20000000-0000-0000-0000-000000000001';
const LAST_SEEN_AT = '2026-07-13T10:00:00.000Z';

class IntegrationAuthenticationGateway implements AuthenticationGateway {
  public verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    if (accessToken !== 'active-token') {
      return Promise.resolve({ valid: false, reason: 'INVALID' });
    }

    return Promise.resolve({
      valid: true,
      identity: {
        id: USER_ID,
        email: 'customer@example.test',
      },
    });
  }

  public findProfile(userId: string): Promise<ProfileSnapshot | null> {
    if (userId !== USER_ID) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      id: USER_ID,
      accountType: 'CUSTOMER',
      status: 'ACTIVE',
    });
  }

  public createUserClient(): SupabaseClient {
    return emptySupabaseClient;
  }
}

class IntegrationDeviceRegistrationGateway implements DeviceRegistrationGateway {
  public commands: RegisterDeviceGatewayCommand[] = [];

  public upsertDevice(
    client: SupabaseClient,
    command: RegisterDeviceGatewayCommand,
  ): Promise<RegisteredDeviceSnapshot> {
    if (client !== emptySupabaseClient) {
      throw new TypeError('Expected request-scoped Supabase client');
    }

    this.commands.push(command);

    return Promise.resolve({
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
      orderSoundEnabled: true,
      lastSeenAt: LAST_SEEN_AT,
      revokedAt: null,
    });
  }
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();

  if (!isHttpServer(server)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }

  return server;
}

describe('POST /me/devices integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  const gateway = new IntegrationDeviceRegistrationGateway();

  beforeAll(async () => {
    process.env['SUPABASE_URL'] = 'http://127.0.0.1:54321';
    process.env['SUPABASE_PUBLISHABLE_KEY'] = 'integration-publishable-key-placeholder';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'integration-service-role-key-placeholder';

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule, MeModule],
    })
      .overrideProvider(AUTHENTICATION_GATEWAY)
      .useValue(new IntegrationAuthenticationGateway())
      .overrideProvider(DEVICE_REGISTRATION_GATEWAY)
      .useValue(gateway)
      .compile();

    app = testingModule.createNestApplication();
    await app.init();
    httpServer = requireHttpServer(app);
  });

  beforeEach(() => {
    gateway.commands = [];
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('rejects a request without a bearer token', async () => {
    const response = await request(httpServer).post('/me/devices').send({
      deviceFingerprint: 'android-device-1',
      platform: 'ANDROID',
      pushProvider: 'FCM',
      pushToken: 'push-token-secret',
      appVersion: '1.0.0',
    });

    expect(response.status).toBe(401);
    expect(gateway.commands).toStrictEqual([]);
  });

  it('registers or refreshes the authenticated device', async () => {
    const response = await request(httpServer)
      .post('/me/devices')
      .set('Authorization', 'Bearer active-token')
      .send({
        deviceFingerprint: 'android-device-1',
        platform: 'ANDROID',
        pushProvider: 'FCM',
        pushToken: 'push-token-secret',
        appVersion: '1.0.0',
        deviceModel: 'Pixel',
        osVersion: '16',
      });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      success: true,
      data: {
        id: DEVICE_ID,
        deviceFingerprint: 'android-device-1',
        platform: 'ANDROID',
        pushProvider: 'FCM',
        appName: 'CUSTOMER',
        appVersion: '1.0.0',
        deviceModel: 'Pixel',
        osVersion: '16',
        notificationEnabled: true,
        orderSoundEnabled: true,
        lastSeenAt: LAST_SEEN_AT,
        revokedAt: null,
      },
      meta: {
        requestId: null,
      },
    });

    expect(gateway.commands).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain('push-token-secret');
  });

  it('rejects invalid device input before persistence', async () => {
    const response = await request(httpServer)
      .post('/me/devices')
      .set('Authorization', 'Bearer active-token')
      .send({
        deviceFingerprint: 'web-device-1',
        platform: 'WEB',
        pushProvider: 'FCM',
        pushToken: 'push-token',
        appVersion: '1.0.0',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_DEVICE_REGISTRATION',
      },
    });
    expect(gateway.commands).toStrictEqual([]);
  });
});
