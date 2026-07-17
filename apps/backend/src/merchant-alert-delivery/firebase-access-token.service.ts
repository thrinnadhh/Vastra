import { createSign } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import { MERCHANT_ALERT_DELIVERY_CONFIGURATION } from './merchant-alert-delivery.tokens';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const FIREBASE_MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_REFRESH_SKEW_SECONDS = 300;

export interface FcmAccessTokenProvider {
  getAccessToken(): Promise<string>;
}

export class FirebaseAccessTokenUnavailableError extends Error {
  public constructor(message = 'Firebase access token is unavailable') {
    super(message);
    this.name = 'FirebaseAccessTokenUnavailableError';
  }
}

interface CachedAccessToken {
  readonly value: string;
  readonly expiresAtSeconds: number;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function createServiceAccountAssertion(
  clientEmail: string,
  privateKey: string,
  nowSeconds: number,
): string {
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const claims = encodeJson({
    iss: clientEmail,
    sub: clientEmail,
    aud: GOOGLE_TOKEN_ENDPOINT,
    scope: FIREBASE_MESSAGING_SCOPE,
    iat: nowSeconds,
    exp: nowSeconds + 3_600,
  });
  const unsignedAssertion = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedAssertion);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${unsignedAssertion}.${signature}`;
}

function parseTokenResponse(value: unknown): {
  readonly accessToken: string;
  readonly expiresIn: number;
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FirebaseAccessTokenUnavailableError();
  }

  const record = value as Record<string, unknown>;
  const accessToken = record['access_token'];
  const expiresIn = record['expires_in'];

  if (
    typeof accessToken !== 'string' ||
    accessToken.trim().length === 0 ||
    typeof expiresIn !== 'number' ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new FirebaseAccessTokenUnavailableError();
  }

  return { accessToken, expiresIn };
}

@Injectable()
export class FirebaseAccessTokenService implements FcmAccessTokenProvider {
  private cachedToken: CachedAccessToken | null = null;

  public constructor(
    @Inject(MERCHANT_ALERT_DELIVERY_CONFIGURATION)
    private readonly configuration: MerchantAlertDeliveryConfiguration,
  ) {}

  public async getAccessToken(): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1_000);
    if (
      this.cachedToken !== null &&
      this.cachedToken.expiresAtSeconds - TOKEN_REFRESH_SKEW_SECONDS > nowSeconds
    ) {
      return this.cachedToken.value;
    }

    const credentials = this.configuration.credentials;
    if (!this.configuration.enabled || credentials === null) {
      throw new FirebaseAccessTokenUnavailableError('Merchant alert delivery is disabled');
    }

    const assertion = createServiceAccountAssertion(
      credentials.clientEmail,
      credentials.privateKey,
      nowSeconds,
    );
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });

    let response: Response;
    try {
      response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(this.configuration.requestTimeoutMs),
      });
    } catch {
      throw new FirebaseAccessTokenUnavailableError();
    }

    if (!response.ok) {
      throw new FirebaseAccessTokenUnavailableError(
        `Firebase OAuth exchange failed with status ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new FirebaseAccessTokenUnavailableError();
    }

    const parsed = parseTokenResponse(payload);
    this.cachedToken = {
      value: parsed.accessToken,
      expiresAtSeconds: nowSeconds + parsed.expiresIn,
    };
    return parsed.accessToken;
  }
}
