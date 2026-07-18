import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminAuditGateway, RecordAdminAuditInput } from './admin-audit.gateway';
import { AdminAuditService } from './admin-audit.service';

const CONTEXT = {
  actor: {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'admin@example.test',
    accountType: 'ADMIN',
    status: 'ACTIVE',
  },
  accessToken: 'token',
  supabase: {},
  assuranceLevel: 'aal2',
} as unknown as AuthenticatedRequestContext;

class GatewayStub implements AdminAuditGateway {
  public lastInput: RecordAdminAuditInput | null = null;

  public record(input: RecordAdminAuditInput) {
    this.lastInput = input;
    return Promise.resolve({
      id: '20000000-0000-4000-8000-000000000001',
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      reasonCode: input.reasonCode,
      note: input.note,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      change: { before: input.before, after: input.after },
      createdAt: '2026-07-18T00:00:00.000Z',
    });
  }

  public list() {
    return Promise.resolve([]);
  }
}

describe('AdminAuditService', () => {
  it('always derives the audit actor from the authenticated context', async () => {
    const gateway = new GatewayStub();
    const service = new AdminAuditService(gateway);
    await service.record(CONTEXT, {
      action: 'admin.order.cancel',
      resourceType: 'ORDER',
      resourceId: '30000000-0000-4000-8000-000000000001',
      reasonCode: 'CUSTOMER_REQUEST',
      note: null,
      requestId: 'request-1',
      idempotencyKey: '40000000-0000-4000-8000-000000000001',
      before: { status: 'CONFIRMED' },
      after: { status: 'CANCELLED' },
    });
    expect(gateway.lastInput?.actorId).toBe(CONTEXT.actor.id);
  });
});
