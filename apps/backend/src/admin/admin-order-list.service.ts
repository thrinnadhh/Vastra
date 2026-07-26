import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createAdminReadProviderUnavailableException,
  createInvalidAdminListQueryException,
} from './admin-http-error';
import {
  AdminListQueryInvalidError,
  encodeAdminListCursor,
  parseAdminListCursor,
  parseAdminListLimit,
  parseAdminOptionalEnum,
  parseAdminOptionalUuid,
} from './admin-list.validation';
import {
  AdminOrderListGatewayUnavailableError,
  type AdminOrderListGateway,
} from './admin-order-list.gateway';
import {
  ADMIN_OPERATIONAL_QUEUES,
  ADMIN_ORDER_STATUSES,
  type ListAdminOperationalOrdersResponse,
} from './admin-order-list.types';
import { ADMIN_ORDER_LIST_GATEWAY } from './admin.tokens';

@Injectable()
export class AdminOrderListService {
  public constructor(
    @Inject(ADMIN_ORDER_LIST_GATEWAY)
    private readonly gateway: AdminOrderListGateway,
  ) {}

  public async list(
    _context: AuthenticatedRequestContext,
    rawQueue: unknown,
    rawStatus: unknown,
    rawShopId: unknown,
    rawCursor: unknown,
    rawLimit: unknown,
  ): Promise<ListAdminOperationalOrdersResponse> {
    try {
      const page = await this.gateway.list({
        queue: parseAdminOptionalEnum(rawQueue, ADMIN_OPERATIONAL_QUEUES),
        status: parseAdminOptionalEnum(rawStatus, ADMIN_ORDER_STATUSES),
        shopId: parseAdminOptionalUuid(rawShopId),
        cursor: parseAdminListCursor(rawCursor),
        limit: parseAdminListLimit(rawLimit),
      });

      return {
        success: true,
        data: {
          orders: page.items,
          nextCursor: encodeAdminListCursor(page.nextCursor),
        },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      if (error instanceof AdminListQueryInvalidError) {
        throw createInvalidAdminListQueryException();
      }
      if (error instanceof AdminOrderListGatewayUnavailableError) {
        throw createAdminReadProviderUnavailableException();
      }
      throw error;
    }
  }
}
