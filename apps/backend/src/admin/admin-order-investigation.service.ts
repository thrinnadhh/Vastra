import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type {
  AdminOrderInvestigation,
  AdminOrderInvestigationGateway,
} from './admin-order-investigation.gateway';
import { ADMIN_ORDER_INVESTIGATION_GATEWAY } from './admin.tokens';

export class AdminOrderIdInvalidError extends Error {}
export class AdminOrderNotFoundError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class AdminOrderInvestigationService {
  public constructor(
    @Inject(ADMIN_ORDER_INVESTIGATION_GATEWAY)
    private readonly gateway: AdminOrderInvestigationGateway,
  ) {}

  public async get(
    _context: AuthenticatedRequestContext,
    rawOrderId: unknown,
  ): Promise<AdminOrderInvestigation> {
    if (typeof rawOrderId !== 'string' || !UUID_PATTERN.test(rawOrderId)) {
      throw new AdminOrderIdInvalidError();
    }
    const investigation = await this.gateway.get(rawOrderId);
    if (investigation === null) throw new AdminOrderNotFoundError();
    return investigation;
  }
}
