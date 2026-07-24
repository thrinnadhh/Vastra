import type { MerchantApiSession } from '../auth/merchant-api-session';

export interface MerchantDeviceRegistrationInput {
  readonly deviceFingerprint: string;
  readonly pushToken: string;
  readonly appVersion: string;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
}

export type MerchantDeviceRegistrationFailureKind =
  'SESSION_EXPIRED' | 'OFFLINE_STALE' | 'BACKEND_REGISTRATION_FAILED';

export class MerchantDeviceRegistrationError extends Error {
  public constructor(
    public readonly kind: MerchantDeviceRegistrationFailureKind,
    public readonly status: number | null = null,
  ) {
    super(`Merchant device registration failed: ${kind}`);
    this.name = 'MerchantDeviceRegistrationError';
  }
}

export class HttpMerchantDeviceRegistrationClient {
  public constructor(private readonly session: MerchantApiSession) {}

  public async register(input: MerchantDeviceRegistrationInput): Promise<void> {
    let accessToken: string | null;
    try {
      accessToken = await this.session.getAccessToken();
    } catch {
      throw new MerchantDeviceRegistrationError('SESSION_EXPIRED');
    }
    if (accessToken === null) throw new MerchantDeviceRegistrationError('SESSION_EXPIRED');

    let response: Response;
    try {
      response = await fetch(`${this.session.apiBaseUrl}/me/devices`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceFingerprint: input.deviceFingerprint,
          platform: 'ANDROID',
          pushProvider: 'FCM',
          pushToken: input.pushToken,
          appVersion: input.appVersion,
          deviceModel: input.deviceModel,
          osVersion: input.osVersion,
        }),
      });
    } catch {
      throw new MerchantDeviceRegistrationError('OFFLINE_STALE');
    }

    if (response.ok) return;
    if (response.status === 401) {
      throw new MerchantDeviceRegistrationError('SESSION_EXPIRED', response.status);
    }
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new MerchantDeviceRegistrationError('OFFLINE_STALE', response.status);
    }
    throw new MerchantDeviceRegistrationError('BACKEND_REGISTRATION_FAILED', response.status);
  }
}
