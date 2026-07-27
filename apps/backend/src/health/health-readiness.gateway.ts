import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';

const HEALTH_PROBE_TIMEOUT_MS = 2_000;

export interface HealthReadinessGateway {
  probe(): Promise<void>;
}

export const HEALTH_READINESS_GATEWAY = Symbol('HEALTH_READINESS_GATEWAY');

@Injectable()
export class SupabaseHealthReadinessGateway implements HealthReadinessGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async probe(): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, HEALTH_PROBE_TIMEOUT_MS);
    timer.unref();

    try {
      const { error } = await this.client
        .from('profiles')
        .select('id')
        .limit(1)
        .abortSignal(controller.signal);

      if (error !== null) throw new Error('Database readiness probe failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
