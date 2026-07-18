import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type {
  AdminAuditGateway,
  ListAdminAuditInput,
  RecordAdminAuditInput,
} from './admin-audit.gateway';
import { ADMIN_AUDIT_GATEWAY } from './admin.tokens';
import type { AdminAuditEntry } from './admin.types';

@Injectable()
export class AdminAuditService {
  public constructor(
    @Inject(ADMIN_AUDIT_GATEWAY)
    private readonly gateway: AdminAuditGateway,
  ) {}

  public record(
    context: AuthenticatedRequestContext,
    input: Omit<RecordAdminAuditInput, 'actorId'>,
  ): Promise<AdminAuditEntry> {
    return this.gateway.record({ ...input, actorId: context.actor.id });
  }

  public list(
    _context: AuthenticatedRequestContext,
    input: ListAdminAuditInput,
  ): Promise<readonly AdminAuditEntry[]> {
    return this.gateway.list(input);
  }
}
