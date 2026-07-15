import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createInvalidMerchantOrderAlertRequestException,
  createMerchantOrderAlertExpiredException,
  createMerchantOrderAlertNotAcknowledgeableException,
  createMerchantOrderAlertNotFoundException,
  createMerchantOrderAlertProviderUnavailableException,
  createMerchantOrderAlertStateInvalidException,
} from './order-http-error';
import {
  type MerchantOrderAlertGateway,
  MerchantOrderAlertDataInvalidError,
  MerchantOrderAlertExpiredError,
  MerchantOrderAlertGatewayUnavailableError,
  MerchantOrderAlertNotAcknowledgeableError,
  MerchantOrderAlertNotFoundError,
} from './merchant-order-alert.gateway';
import { MERCHANT_ORDER_ALERT_GATEWAY } from './merchant-order-alert.tokens';
import type { AcknowledgeMerchantOrderAlertResponse } from './merchant-order-alert.types';
import {
  MerchantOrderAlertValidationError,
  parseMerchantOrderAlertId,
} from './merchant-order-alert.validation';

@Injectable()
export class MerchantOrderAlertService {
  public constructor(
    @Inject(MERCHANT_ORDER_ALERT_GATEWAY)
    private readonly gateway: MerchantOrderAlertGateway,
  ) {}

  public async acknowledgeAlert(
    context: AuthenticatedRequestContext,
    alertIdValue: unknown,
  ): Promise<AcknowledgeMerchantOrderAlertResponse> {
    try {
      const alertId = parseMerchantOrderAlertId(alertIdValue);
      const alert = await this.gateway.acknowledgeAlert(context.actor.id, alertId);

      return {
        success: true,
        data: { alert },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof MerchantOrderAlertValidationError) {
      throw createInvalidMerchantOrderAlertRequestException();
    }

    if (error instanceof MerchantOrderAlertNotFoundError) {
      throw createMerchantOrderAlertNotFoundException();
    }

    if (error instanceof MerchantOrderAlertExpiredError) {
      throw createMerchantOrderAlertExpiredException();
    }

    if (error instanceof MerchantOrderAlertNotAcknowledgeableError) {
      throw createMerchantOrderAlertNotAcknowledgeableException();
    }

    if (error instanceof MerchantOrderAlertDataInvalidError) {
      throw createMerchantOrderAlertStateInvalidException();
    }

    if (error instanceof MerchantOrderAlertGatewayUnavailableError) {
      throw createMerchantOrderAlertProviderUnavailableException();
    }

    throw error;
  }
}
