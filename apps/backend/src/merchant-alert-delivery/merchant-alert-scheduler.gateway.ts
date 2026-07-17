import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  MerchantAlertSchedulerGateway,
  MerchantAlertScheduleSummary,
} from './merchant-alert-scheduler.types';

export class MerchantAlertSchedulerGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant alert scheduler provider unavailable');
    this.name = 'MerchantAlertSchedulerGatewayUnavailableError';
  }
}

export class MerchantAlertSchedulerDataInvalidError extends Error {
  public constructor() {
    super('Merchant alert scheduler provider returned invalid data');
    this.name = 'MerchantAlertSchedulerDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const raw = record[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new MerchantAlertSchedulerDataInvalidError();
  }
  return value;
}

function parseSummary(value: unknown): MerchantAlertScheduleSummary {
  if (!isRecord(value)) throw new MerchantAlertSchedulerDataInvalidError();
  return {
    processed: requireNonNegativeInteger(value, 'processed'),
    remindersQueued: requireNonNegativeInteger(value, 'remindersQueued'),
    expired: requireNonNegativeInteger(value, 'expired'),
    stopped: requireNonNegativeInteger(value, 'stopped'),
  };
}

@Injectable()
export class SupabaseMerchantAlertSchedulerGateway implements MerchantAlertSchedulerGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async processDueAlerts(
    workerId: string,
    limit: number,
  ): Promise<MerchantAlertScheduleSummary> {
    try {
      const response = await this.client.rpc('process_due_merchant_order_alerts', {
        p_worker_id: workerId,
        p_limit: limit,
      });
      if (response.error !== null) throw new MerchantAlertSchedulerGatewayUnavailableError();
      return parseSummary(response.data);
    } catch (error: unknown) {
      if (
        error instanceof MerchantAlertSchedulerGatewayUnavailableError ||
        error instanceof MerchantAlertSchedulerDataInvalidError
      ) {
        throw error;
      }
      throw new MerchantAlertSchedulerGatewayUnavailableError();
    }
  }
}
