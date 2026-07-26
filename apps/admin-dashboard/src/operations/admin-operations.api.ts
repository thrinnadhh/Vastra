import type { ApiClient, OperationRequest, OperationResponse } from '@vastra/api-client';

import type { AdminDashboardSummary, AdminOperationalOrder } from './admin-operations.view';

type AdminOrderQuery = NonNullable<OperationRequest<'listAdminOperationalOrders'>['query']>;
type AdminOrderStatus = NonNullable<AdminOrderQuery['status']>;
type AdminOrderIssue = NonNullable<AdminOrderQuery['issue']>;

const ORDER_STATUSES = new Set<AdminOrderStatus>([
  'PAYMENT_PENDING',
  'WAITING_FOR_MERCHANT',
  'MERCHANT_ACCEPTED',
  'PACKING',
  'READY_FOR_PICKUP',
  'CAPTAIN_SEARCHING',
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_AT_STORE',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'CAPTAIN_AT_CUSTOMER',
  'DELIVERED',
  'COMPLETED',
  'PROBLEM_REPORTED',
  'CANCELLED',
]);

const ORDER_ISSUES = new Set<AdminOrderIssue>([
  'DELAYED',
  'UNASSIGNED',
  'MERCHANT_TIMEOUT',
  'CAPTAIN_ISSUE',
  'PAYMENT_ISSUE',
]);

export interface AdminOperationsSnapshot {
  readonly summary: AdminDashboardSummary;
  readonly orders: readonly AdminOperationalOrder[];
  readonly nextCursor: string | null;
}

export interface AdminOperationsApi {
  load(status: string, issue: string): Promise<AdminOperationsSnapshot>;
  loadMore(
    status: string,
    issue: string,
    cursor: string,
  ): Promise<Pick<AdminOperationsSnapshot, 'orders' | 'nextCursor'>>;
}

function createQuery(status: string, issue: string, cursor?: string): AdminOrderQuery {
  const query: AdminOrderQuery = {
    limit: 20,
    ...(ORDER_STATUSES.has(status as AdminOrderStatus)
      ? { status: status as AdminOrderStatus }
      : {}),
    ...(ORDER_ISSUES.has(issue as AdminOrderIssue) ? { issue: issue as AdminOrderIssue } : {}),
    ...(cursor === undefined ? {} : { cursor }),
  };
  return query;
}

export function createAdminOperationsApi(apiClient: ApiClient): AdminOperationsApi {
  const listOrders = async (
    status: string,
    issue: string,
    cursor?: string,
  ): Promise<OperationResponse<'listAdminOperationalOrders'>> => {
    const response = await apiClient.request('listAdminOperationalOrders', {
      query: createQuery(status, issue, cursor),
    });
    return response.data;
  };

  return {
    async load(status, issue) {
      const [summaryResponse, orders] = await Promise.all([
        apiClient.request('getAdminDashboard', {}),
        listOrders(status, issue),
      ]);
      return {
        summary: summaryResponse.data,
        orders: orders.orders,
        nextCursor: orders.nextCursor,
      };
    },
    async loadMore(status, issue, cursor) {
      const orders = await listOrders(status, issue, cursor);
      return { orders: orders.orders, nextCursor: orders.nextCursor };
    },
  };
}
