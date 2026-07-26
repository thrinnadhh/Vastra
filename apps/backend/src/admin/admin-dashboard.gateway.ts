import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  AdminDashboardSummary,
  AdminOperationalOrder,
  AdminOrderCursor,
  AdminOrderIssue,
  AdminOrderListPage,
  AdminOrderStatus,
  AdminSearchResult,
  AdminSearchResultType,
} from './admin-dashboard.types';

export interface AdminOrderListInput {
  readonly status: AdminOrderStatus | null;
  readonly issue: AdminOrderIssue | null;
  readonly cursorCreatedAt: string | null;
  readonly cursorId: string | null;
  readonly limit: number;
}

export interface AdminDashboardGateway {
  getSummary(): Promise<AdminDashboardSummary>;
  search(query: string, limit: number): Promise<readonly AdminSearchResult[]>;
  listOrders(input: AdminOrderListInput): Promise<AdminOrderListPage>;
}

export class AdminDashboardGatewayUnavailableError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminDashboardGatewayUnavailableError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AdminDashboardGatewayUnavailableError();
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new AdminDashboardGatewayUnavailableError();
  }
  return value;
}

function parseSummary(value: unknown): AdminDashboardSummary {
  const record = requireRecord(value);
  return {
    openOrders: requireNumber(record, 'open_orders'),
    interventionOrders: requireNumber(record, 'intervention_orders'),
    searchingDeliveries: requireNumber(record, 'searching_deliveries'),
    activeDeliveries: requireNumber(record, 'active_deliveries'),
    openCases: requireNumber(record, 'open_cases'),
    suspendedMerchants: requireNumber(record, 'suspended_merchants'),
    suspendedCaptains: requireNumber(record, 'suspended_captains'),
    generatedAt: requireString(record, 'generated_at'),
  };
}

function parseResult(value: unknown): AdminSearchResult {
  const record = requireRecord(value);
  return {
    type: requireString(record, 'result_type') as AdminSearchResultType,
    id: requireString(record, 'resource_id'),
    primaryText: requireString(record, 'primary_text'),
    secondaryText: requireString(record, 'secondary_text'),
    status: requireString(record, 'status'),
    updatedAt: requireString(record, 'updated_at'),
  };
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') throw new AdminDashboardGatewayUnavailableError();
  return value;
}

function parseOrder(value: unknown): AdminOperationalOrder {
  const record = requireRecord(value);
  const customer = requireRecord(record['customer']);
  const shop = requireRecord(record['shop']);
  return {
    id: requireString(record, 'id'),
    orderNumber: requireString(record, 'orderNumber'),
    status: requireString(record, 'status') as AdminOperationalOrder['status'],
    paymentStatus: requireString(record, 'paymentStatus'),
    fulfilmentType: requireString(record, 'fulfilmentType'),
    totalPaise: requireNumber(record, 'totalPaise'),
    itemCount: requireNumber(record, 'itemCount'),
    customer: {
      id: requireString(customer, 'id'),
      name: requireNullableString(customer, 'name'),
      phoneNumber: requireNullableString(customer, 'phoneNumber'),
    },
    shop: {
      id: requireString(shop, 'id'),
      name: requireString(shop, 'name'),
      merchantId: requireString(shop, 'merchantId'),
    },
    deliveryTaskId: requireNullableString(record, 'deliveryTaskId'),
    deliveryStatus: requireNullableString(record, 'deliveryStatus'),
    interventionReason: requireNullableString(
      record,
      'interventionReason',
    ) as AdminOperationalOrder['interventionReason'],
    estimatedDeliveryAt: requireNullableString(record, 'estimatedDeliveryAt'),
    placedAt: requireNullableString(record, 'placedAt'),
    createdAt: requireString(record, 'createdAt'),
    updatedAt: requireString(record, 'updatedAt'),
  };
}

function parseCursor(value: unknown): AdminOrderCursor | null {
  if (value === null) return null;
  const record = requireRecord(value);
  return {
    createdAt: requireString(record, 'createdAt'),
    id: requireString(record, 'id'),
  };
}

function parseOrderPage(value: unknown): AdminOrderListPage {
  const record = requireRecord(value);
  const orders = record['orders'];
  if (!Array.isArray(orders)) throw new AdminDashboardGatewayUnavailableError();
  return {
    orders: orders.map(parseOrder),
    nextCursor: parseCursor(record['nextCursor']),
  };
}

@Injectable()
export class SupabaseAdminDashboardGateway implements AdminDashboardGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async getSummary(): Promise<AdminDashboardSummary> {
    const { data, error } = await this.client.rpc('get_admin_operations_dashboard', {});
    if (error !== null) throw new AdminDashboardGatewayUnavailableError();
    return parseSummary(data);
  }

  public async search(query: string, limit: number): Promise<readonly AdminSearchResult[]> {
    const { data, error } = await this.client.rpc('search_admin_operations', {
      p_query: query,
      p_limit: limit,
    });
    if (error !== null || !Array.isArray(data)) {
      throw new AdminDashboardGatewayUnavailableError();
    }
    return data.map(parseResult);
  }

  public async listOrders(input: AdminOrderListInput): Promise<AdminOrderListPage> {
    const { data, error } = await this.client.rpc('list_admin_operational_orders', {
      p_status: input.status,
      p_issue: input.issue,
      p_cursor_created_at: input.cursorCreatedAt,
      p_cursor_id: input.cursorId,
      p_limit: input.limit,
    });
    if (error !== null) throw new AdminDashboardGatewayUnavailableError();
    return parseOrderPage(data);
  }
}
