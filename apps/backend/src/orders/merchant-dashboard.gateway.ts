import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { MerchantDashboardSnapshot } from './merchant-dashboard.types';

export interface MerchantDashboardGateway {
  get(merchantId: string): Promise<MerchantDashboardSnapshot>;
}

export class MerchantDashboardGatewayUnavailableError extends Error {}
export class MerchantDashboardDataInvalidError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MerchantDashboardDataInvalidError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new MerchantDashboardDataInvalidError();
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new MerchantDashboardDataInvalidError();
  return value;
}

function requireInteger(record: Record<string, unknown>, key: string): number {
  const raw = record[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new MerchantDashboardDataInvalidError();
  }
  return value;
}

function parseDashboard(value: unknown): MerchantDashboardSnapshot {
  const record = requireRecord(value);
  const shop = requireRecord(record['shop']);
  const orders = requireRecord(record['orders']);
  const alerts = requireRecord(record['alerts']);
  const inventory = requireRecord(record['inventory']);
  const sales = requireRecord(record['sales']);
  const generatedAt = requireString(record, 'generatedAt');
  if (Number.isNaN(Date.parse(generatedAt))) throw new MerchantDashboardDataInvalidError();

  return {
    shop: {
      id: requireString(shop, 'id'),
      name: requireString(shop, 'name'),
      operationalStatus: requireString(shop, 'operationalStatus'),
      acceptsOnlineOrders: requireBoolean(shop, 'acceptsOnlineOrders'),
    },
    orders: {
      waitingForMerchant: requireInteger(orders, 'waitingForMerchant'),
      packing: requireInteger(orders, 'packing'),
      readyForPickup: requireInteger(orders, 'readyForPickup'),
      activeDelivery: requireInteger(orders, 'activeDelivery'),
      problemReported: requireInteger(orders, 'problemReported'),
    },
    alerts: {
      unacknowledged: requireInteger(alerts, 'unacknowledged'),
    },
    inventory: {
      lowStockVariants: requireInteger(inventory, 'lowStockVariants'),
    },
    sales: {
      completedToday: requireInteger(sales, 'completedToday'),
      grossTodayPaise: requireInteger(sales, 'grossTodayPaise'),
    },
    generatedAt,
  };
}

@Injectable()
export class SupabaseMerchantDashboardGateway implements MerchantDashboardGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async get(merchantId: string): Promise<MerchantDashboardSnapshot> {
    const { data, error } = await this.client.rpc('get_merchant_operations_dashboard', {
      p_merchant_id: merchantId,
    });
    if (error !== null || data === null) throw new MerchantDashboardGatewayUnavailableError();
    return parseDashboard(data);
  }
}
