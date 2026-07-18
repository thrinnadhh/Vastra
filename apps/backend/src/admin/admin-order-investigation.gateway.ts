import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';

export type AdminOrderInvestigation = Readonly<Record<string, unknown>>;

export interface AdminOrderInvestigationGateway {
  get(orderId: string): Promise<AdminOrderInvestigation | null>;
}

export class AdminOrderInvestigationGatewayUnavailableError extends Error {}

@Injectable()
export class SupabaseAdminOrderInvestigationGateway implements AdminOrderInvestigationGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async get(orderId: string): Promise<AdminOrderInvestigation | null> {
    const { data, error } = await this.client.rpc('get_admin_order_investigation', {
      p_order_id: orderId,
    });
    if (error !== null) throw new AdminOrderInvestigationGatewayUnavailableError();
    if (data === null) return null;
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new AdminOrderInvestigationGatewayUnavailableError();
    }
    return data as AdminOrderInvestigation;
  }
}
