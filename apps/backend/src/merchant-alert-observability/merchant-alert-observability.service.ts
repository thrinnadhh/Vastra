import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  MerchantAlertObservabilityDataInvalidError,
  MerchantAlertObservabilityUnavailableError,
} from './merchant-alert-observability.gateway';
import { MERCHANT_ALERT_OBSERVABILITY_GATEWAY } from './merchant-alert-observability.tokens';
import type {
  MerchantAlertActivityResponse,
  MerchantAlertMetricsResponse,
  MerchantAlertObservabilityGateway,
} from './merchant-alert-observability.types';
import {
  MerchantAlertObservabilityValidationError,
  parseActivityQuery,
  parseMetricsWindow,
} from './merchant-alert-observability.validation';

function apiException(
  status: HttpStatus,
  code: 'VALIDATION_ERROR' | 'INTERNAL_ERROR' | 'EXTERNAL_SERVICE_UNAVAILABLE',
  message: string,
  retryable: boolean,
): HttpException {
  return new HttpException(
    {
      success: false,
      error: { code, message, details: null, retryable },
      requestId: null,
    },
    status,
  );
}

@Injectable()
export class MerchantAlertObservabilityService {
  public constructor(
    @Inject(MERCHANT_ALERT_OBSERVABILITY_GATEWAY)
    private readonly gateway: MerchantAlertObservabilityGateway,
  ) {}

  public async getMetrics(windowValue: unknown): Promise<MerchantAlertMetricsResponse> {
    try {
      const metrics = await this.gateway.getMetrics(parseMetricsWindow(windowValue));
      return { success: true, data: { metrics }, meta: { requestId: null } };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }

  public async listActivity(
    limitValue: unknown,
    beforeValue: unknown,
  ): Promise<MerchantAlertActivityResponse> {
    try {
      const query = parseActivityQuery(limitValue, beforeValue);
      const activity = await this.gateway.listActivity(query.limit, query.before);
      const last = activity.at(-1);
      return {
        success: true,
        data: {
          activity,
          nextCursor: activity.length === query.limit && last !== undefined ? last.createdAt : null,
        },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof MerchantAlertObservabilityValidationError) {
      throw apiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'The merchant alert observability query is invalid.',
        false,
      );
    }
    if (error instanceof MerchantAlertObservabilityDataInvalidError) {
      throw apiException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'INTERNAL_ERROR',
        'Merchant alert observability data is internally inconsistent.',
        false,
      );
    }
    if (error instanceof MerchantAlertObservabilityUnavailableError) {
      throw apiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'EXTERNAL_SERVICE_UNAVAILABLE',
        'Merchant alert observability is temporarily unavailable.',
        true,
      );
    }
    throw error;
  }
}
