import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminDashboardGateway } from './admin-dashboard.gateway';
import type { AdminDashboardSummary, AdminSearchResult } from './admin-dashboard.types';
import { ADMIN_DASHBOARD_GATEWAY } from './admin.tokens';

export class AdminSearchQueryInvalidError extends Error {}

@Injectable()
export class AdminDashboardService {
  public constructor(
    @Inject(ADMIN_DASHBOARD_GATEWAY)
    private readonly gateway: AdminDashboardGateway,
  ) {}

  public getSummary(_context: AuthenticatedRequestContext): Promise<AdminDashboardSummary> {
    return this.gateway.getSummary();
  }

  public search(
    _context: AuthenticatedRequestContext,
    rawQuery: unknown,
    rawLimit: unknown,
  ): Promise<readonly AdminSearchResult[]> {
    if (typeof rawQuery !== 'string') throw new AdminSearchQueryInvalidError();
    const query = rawQuery.trim();
    if (query.length < 2 || query.length > 120) throw new AdminSearchQueryInvalidError();
    const limit =
      typeof rawLimit === 'string' && /^\d+$/u.test(rawLimit)
        ? Math.min(50, Math.max(1, Number(rawLimit)))
        : 20;
    return this.gateway.search(query, limit);
  }
}
