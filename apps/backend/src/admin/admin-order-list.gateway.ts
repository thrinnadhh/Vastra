import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  ADMIN_DELIVERY_TASK_STATUSES,
  ADMIN_OPERATIONAL_RESULT_QUEUES,
  ADMIN_ORDER_FULFILMENT_TYPES,
  ADMIN_ORDER_PAYMENT_STATUSES,
  ADMIN_ORDER_STATUSES,
  type AdminOperationalOrder,
  type AdminOperationalOrderPage,
  type AdminOperationalOrderQuery,
} from './admin-order-list.types';
import {
  AdminReadModelInvalidError,
  optionalPhoneLast4,
  optionalUuid,
  requireAllowedString,
  requireArray,
  requireBoolean,
  requireInteger,
  requireRecord,
  requireString,
  requireTimestamp,
  requireUuid,
} from './admin-read-model.parser';

export interface AdminOrderListGateway {
  list(query: AdminOperationalOrderQuery): Promise<AdminOperationalOrderPage>;
}

export class AdminOrderListGatewayUnavailableError extends Error {}

function parseOrder(value: unknown): AdminOperationalOrder {
  const record = requireRecord(value);
  const shop = requireRecord(record['shop']);
  const customer = requireRecord(record['customer']);
  const attention = requireRecord(record['attention']);
  const deliveryValue = record['delivery'];
  const delivery =
    deliveryValue === null
      ? null
      : (() => {
          const item = requireRecord(deliveryValue);
          return {
            taskId: requireUuid(item, 'taskId'),
            status: requireAllowedString(item, 'status', ADMIN_DELIVERY_TASK_STATUSES),
            assignedCaptainId: optionalUuid(item, 'assignedCaptainId'),
            updatedAt: requireTimestamp(item, 'updatedAt'),
          };
        })();

  return {
    id: requireUuid(record, 'id'),
    orderNumber: requireString(record, 'orderNumber'),
    orderStatus: requireAllowedString(record, 'orderStatus', ADMIN_ORDER_STATUSES),
    paymentStatus: requireAllowedString(record, 'paymentStatus', ADMIN_ORDER_PAYMENT_STATUSES),
    fulfilmentType: requireAllowedString(record, 'fulfilmentType', ADMIN_ORDER_FULFILMENT_TYPES),
    totalPaise: requireInteger(record, 'totalPaise'),
    operationalQueue: requireAllowedString(
      record,
      'operationalQueue',
      ADMIN_OPERATIONAL_RESULT_QUEUES,
    ),
    shop: {
      id: requireUuid(shop, 'id'),
      name: requireString(shop, 'name'),
    },
    customer: {
      id: requireUuid(customer, 'id'),
      displayName: requireString(customer, 'displayName'),
      phoneLast4: optionalPhoneLast4(customer, 'phoneLast4'),
    },
    delivery,
    attention: {
      alert: requireBoolean(attention, 'alert'),
      payment: requireBoolean(attention, 'payment'),
      refund: requireBoolean(attention, 'refund'),
      case: requireBoolean(attention, 'case'),
    },
    updatedAt: requireTimestamp(record, 'updatedAt'),
  };
}

function parsePage(value: unknown): AdminOperationalOrderPage {
  const record = requireRecord(value);
  const cursorValue = record['nextCursor'];
  const nextCursor =
    cursorValue === null
      ? null
      : (() => {
          const cursor = requireRecord(cursorValue);
          return {
            updatedAt: requireTimestamp(cursor, 'updatedAt'),
            id: requireUuid(cursor, 'id'),
          };
        })();
  return {
    items: requireArray(record['items']).map(parseOrder),
    nextCursor,
  };
}

@Injectable()
export class SupabaseAdminOrderListGateway implements AdminOrderListGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async list(query: AdminOperationalOrderQuery): Promise<AdminOperationalOrderPage> {
    const { data, error } = await this.client.rpc('list_admin_operational_orders', {
      p_queue: query.queue,
      p_status: query.status,
      p_shop_id: query.shopId,
      p_cursor_updated_at: query.cursor?.updatedAt ?? null,
      p_cursor_id: query.cursor?.id ?? null,
      p_limit: query.limit,
    });
    if (error !== null) throw new AdminOrderListGatewayUnavailableError();
    try {
      return parsePage(data);
    } catch (parseError: unknown) {
      if (parseError instanceof AdminReadModelInvalidError) {
        throw new AdminOrderListGatewayUnavailableError();
      }
      throw parseError;
    }
  }
}
