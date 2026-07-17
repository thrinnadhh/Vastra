import { Inject, Injectable } from '@nestjs/common';

import type { FcmAccessTokenProvider } from './firebase-access-token.service';
import { FirebaseAccessTokenUnavailableError } from './firebase-access-token.service';
import type { MerchantAlertDeliveryConfiguration } from './merchant-alert-delivery.configuration';
import type {
  MerchantAlertDeviceDestination,
  MerchantAlertDeviceResult,
  MerchantAlertDispatchClaim,
  MerchantAlertSender,
} from './merchant-alert-delivery.types';
import {
  FCM_ACCESS_TOKEN_PROVIDER,
  MERCHANT_ALERT_DELIVERY_CONFIGURATION,
} from './merchant-alert-delivery.tokens';
import { buildMerchantAlertFcmRequest } from './merchant-alert-fcm-payload';

interface FcmErrorDetails {
  readonly status: string | null;
  readonly errorCode: string | null;
  readonly message: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseProviderMessageId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return readString(value, 'name');
}

function parseFcmError(value: unknown): FcmErrorDetails {
  if (!isRecord(value) || !isRecord(value['error'])) {
    return { status: null, errorCode: null, message: null };
  }

  const error = value['error'];
  let errorCode: string | null = null;
  const details = error['details'];

  if (Array.isArray(details)) {
    for (const detail of details) {
      if (!isRecord(detail)) continue;
      const candidate = readString(detail, 'errorCode');
      if (candidate !== null) {
        errorCode = candidate;
        break;
      }
    }
  }

  return {
    status: readString(error, 'status'),
    errorCode,
    message: readString(error, 'message'),
  };
}

function isRetryableFailure(httpStatus: number, error: FcmErrorDetails): boolean {
  if (httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) return true;
  return ['INTERNAL', 'UNAVAILABLE', 'QUOTA_EXCEEDED'].includes(
    error.errorCode ?? error.status ?? '',
  );
}

function failureResult(
  deviceId: string,
  code: string,
  reason: string,
  retryable: boolean,
): MerchantAlertDeviceResult {
  return {
    deviceId,
    outcome: 'FAILED',
    providerMessageId: null,
    failureCode: code,
    failureReason: reason,
    retryable,
  };
}

@Injectable()
export class FcmMerchantAlertSender implements MerchantAlertSender {
  public constructor(
    @Inject(MERCHANT_ALERT_DELIVERY_CONFIGURATION)
    private readonly configuration: MerchantAlertDeliveryConfiguration,
    @Inject(FCM_ACCESS_TOKEN_PROVIDER)
    private readonly accessTokenProvider: FcmAccessTokenProvider,
  ) {}

  public async send(
    claim: MerchantAlertDispatchClaim,
    destination: MerchantAlertDeviceDestination,
  ): Promise<MerchantAlertDeviceResult> {
    const credentials = this.configuration.credentials;
    if (!this.configuration.enabled || credentials === null) {
      return failureResult(
        destination.deviceId,
        'FCM_DISABLED',
        'Merchant alert delivery is disabled',
        true,
      );
    }

    let accessToken: string;
    try {
      accessToken = await this.accessTokenProvider.getAccessToken();
    } catch (error: unknown) {
      const reason =
        error instanceof FirebaseAccessTokenUnavailableError
          ? error.message
          : 'Firebase access token is unavailable';
      return failureResult(destination.deviceId, 'FCM_AUTH_UNAVAILABLE', reason, true);
    }

    const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
      credentials.projectId,
    )}/messages:send`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildMerchantAlertFcmRequest(claim, destination)),
        signal: AbortSignal.timeout(this.configuration.requestTimeoutMs),
      });
    } catch {
      return failureResult(
        destination.deviceId,
        'FCM_NETWORK_ERROR',
        'FCM request failed before a response was received',
        true,
      );
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      if (response.ok) {
        return failureResult(
          destination.deviceId,
          'FCM_INVALID_RESPONSE',
          'FCM returned an unreadable success response',
          true,
        );
      }
    }

    if (response.ok) {
      const providerMessageId = parseProviderMessageId(payload);
      if (providerMessageId === null) {
        return failureResult(
          destination.deviceId,
          'FCM_INVALID_RESPONSE',
          'FCM response did not include a message name',
          true,
        );
      }

      return {
        deviceId: destination.deviceId,
        outcome: 'SENT',
        providerMessageId,
        failureCode: null,
        failureReason: null,
        retryable: false,
      };
    }

    const error = parseFcmError(payload);
    const status = String(response.status);
    const code = error.errorCode ?? error.status ?? `HTTP_${status}`;
    const reason = error.message ?? `FCM request failed with status ${status}`;
    return failureResult(
      destination.deviceId,
      code,
      reason,
      isRetryableFailure(response.status, error),
    );
  }
}
