import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createMerchantOrderReadProviderUnavailableException,
  createMerchantOrderReadStateInvalidException,
} from './order-http-error';
import {
  MerchantDashboardDataInvalidError,
  type MerchantDashboardGateway,
  MerchantDashboardGatewayUnavailableError,
} from './merchant-dashboard.gateway';
import { MERCHANT_DASHBOARD_GATEWAY } from './merchant-dashboard.tokens';
import type { MerchantDashboardResponse } from './merchant-dashboard.types';

@Injectable()
export class MerchantDashboardService {
  public constructor(
    @Inject(MERCHANT_DASHBOARD_GATEWAY)
    private readonly gateway: MerchantDashboardGateway,
  ) {}

  public async get(context: AuthenticatedRequestContext): Promise<MerchantDashboardResponse> {
    try {
      const dashboard = await this.gateway.get(context.actor.id);
      return {
        success: true,
        data: { dashboard },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      if (error instanceof MerchantDashboardDataInvalidError) {
        throw createMerchantOrderReadStateInvalidException();
      }
      if (error instanceof MerchantDashboardGatewayUnavailableError) {
        throw createMerchantOrderReadProviderUnavailableException();
      }
      throw createMerchantOrderReadProviderUnavailableException();
    }
  }
}
