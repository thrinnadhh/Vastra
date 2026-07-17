import type { MerchantApiSession } from '../auth/merchant-api-session';

export interface MerchantDeviceRegistrationInput {
  readonly deviceFingerprint: string;
  readonly pushToken: string;
  readonly appVersion: string;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
}

export class MerchantDeviceRegistrationError extends Error {
  public constructor() {
    super('Merchant device registration failed');
    this.name = 'MerchantDeviceRegistrationError';
  }
}

export class HttpMerchantDeviceRegistrationClient {
  public constructor(private readonly session: MerchantApiSession) {}

  public async register(input: MerchantDeviceRegistrationInput): Promise<void> {
    const accessToken = await this.session.getAccessToken();
    if (accessToken === null) throw new MerchantDeviceRegistrationError();

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
      throw new MerchantDeviceRegistrationError();
    }

    if (!response.ok) throw new MerchantDeviceRegistrationError();
  }
}
