import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  ADMIN_SEARCH_RESULT_TYPES,
  type AdminDashboardSummary,
  type AdminSearchResult,
  type AdminSearchResultType,
} from './admin-dashboard.types';

export interface AdminDashboardGateway {
  getSummary(): Promise<AdminDashboardSummary>;
  search(query: string, limit: number): Promise<readonly AdminSearchResult[]>;
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

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!Number.isFinite(Date.parse(value))) {
    throw new AdminDashboardGatewayUnavailableError();
  }
  return value;
}

function parseSummary(value: unknown): AdminDashboardSummary {
  const record = requireRecord(value);
  return {
    openOrders: requireNumber(record, 'open_orders'),
    interventionOrders: requireNumber(record, 'intervention_orders'),
    waitingMerchantOrders: requireNumber(record, 'waiting_merchant_orders'),
    stuckOrders: requireNumber(record, 'stuck_orders'),
    unassignedDeliveries: requireNumber(record, 'unassigned_deliveries'),
    searchingDeliveries: requireNumber(record, 'searching_deliveries'),
    activeDeliveries: requireNumber(record, 'active_deliveries'),
    alertAttention: requireNumber(record, 'alert_attention'),
    paymentAttention: requireNumber(record, 'payment_attention'),
    refundAttention: requireNumber(record, 'refund_attention'),
    openCases: requireNumber(record, 'open_cases'),
    suspendedMerchants: requireNumber(record, 'suspended_merchants'),
    suspendedCaptains: requireNumber(record, 'suspended_captains'),
    generatedAt: requireTimestamp(record, 'generated_at'),
  };
}

function parseResult(value: unknown): AdminSearchResult {
  const record = requireRecord(value);
  const type = requireString(record, 'result_type');
  if (!ADMIN_SEARCH_RESULT_TYPES.includes(type as AdminSearchResultType)) {
    throw new AdminDashboardGatewayUnavailableError();
  }
  return {
    type: type as AdminSearchResultType,
    id: requireString(record, 'resource_id'),
    primaryText: requireString(record, 'primary_text'),
    secondaryText: requireString(record, 'secondary_text'),
    status: requireString(record, 'status'),
    updatedAt: requireTimestamp(record, 'updated_at'),
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
}
