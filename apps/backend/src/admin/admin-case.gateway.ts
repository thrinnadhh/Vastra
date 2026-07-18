import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  AdminAddCaseNoteInput,
  AdminAssignCaseInput,
  AdminCaseListInput,
  AdminCaseMutationContext,
  AdminCaseSnapshot,
  AdminCreateCaseInput,
  AdminResolveCaseInput,
} from './admin-case.types';

export interface AdminCaseGateway {
  list(input: AdminCaseListInput): Promise<readonly AdminCaseSnapshot[]>;
  get(caseId: string): Promise<AdminCaseSnapshot | null>;
  create(input: AdminCreateCaseInput): Promise<AdminCaseSnapshot>;
  assign(input: AdminAssignCaseInput): Promise<AdminCaseSnapshot>;
  addNote(input: AdminAddCaseNoteInput): Promise<AdminCaseSnapshot>;
  escalate(input: AdminCaseMutationContext): Promise<AdminCaseSnapshot>;
  resolve(input: AdminResolveCaseInput): Promise<AdminCaseSnapshot>;
  close(input: AdminCaseMutationContext): Promise<AdminCaseSnapshot>;
}

export class AdminCaseGatewayUnavailableError extends Error {}
export class AdminCaseStateConflictError extends Error {}
export class AdminCaseIdempotencyConflictError extends Error {}

function parseCase(value: unknown): AdminCaseSnapshot | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminCaseGatewayUnavailableError();
  }
  return value as AdminCaseSnapshot;
}

@Injectable()
export class SupabaseAdminCaseGateway implements AdminCaseGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private async mutation(name: string, args: Record<string, unknown>): Promise<AdminCaseSnapshot> {
    const { data, error } = await this.client.rpc(name, args);
    if (error !== null) {
      if (error.message.includes('ADMIN_IDEMPOTENCY_CONFLICT')) {
        throw new AdminCaseIdempotencyConflictError();
      }
      if (error.message.includes('STATE_CONFLICT')) throw new AdminCaseStateConflictError();
      throw new AdminCaseGatewayUnavailableError();
    }
    const snapshot = parseCase(data);
    if (snapshot === null) throw new AdminCaseGatewayUnavailableError();
    return snapshot;
  }

  public async list(input: AdminCaseListInput): Promise<readonly AdminCaseSnapshot[]> {
    const { data, error } = await this.client.rpc('list_admin_cases', {
      p_status: input.status,
      p_priority: input.priority,
      p_assigned_to: input.assignedTo,
      p_limit: input.limit,
    });
    if (error !== null || !Array.isArray(data)) throw new AdminCaseGatewayUnavailableError();
    return data.map((value) => {
      const snapshot = parseCase(value);
      if (snapshot === null) throw new AdminCaseGatewayUnavailableError();
      return snapshot;
    });
  }

  public async get(caseId: string): Promise<AdminCaseSnapshot | null> {
    const { data, error } = await this.client.rpc('get_admin_case', { p_case_id: caseId });
    if (error !== null) throw new AdminCaseGatewayUnavailableError();
    return parseCase(data);
  }

  public create(input: AdminCreateCaseInput): Promise<AdminCaseSnapshot> {
    return this.mutation('admin_create_case', {
      p_actor_id: input.actorId,
      p_category: input.category,
      p_priority: input.priority,
      p_subject: input.subject,
      p_description: input.description,
      p_order_id: input.orderId,
      p_shop_id: input.shopId,
      p_delivery_task_id: input.deliveryTaskId,
      p_return_request_id: input.returnRequestId,
      p_merchant_id: input.merchantId,
      p_captain_id: input.captainId,
      p_reason_code: input.reasonCode,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public assign(input: AdminAssignCaseInput): Promise<AdminCaseSnapshot> {
    return this.mutation('admin_assign_case', {
      p_actor_id: input.actorId,
      p_case_id: input.caseId,
      p_assigned_to: input.assignedTo,
      p_assigned_team: input.assignedTeam,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public addNote(input: AdminAddCaseNoteInput): Promise<AdminCaseSnapshot> {
    return this.mutation('admin_add_case_note', {
      p_actor_id: input.actorId,
      p_case_id: input.caseId,
      p_message: input.message,
      p_attachment_object_key: input.attachmentObjectKey,
      p_reason_code: input.reasonCode,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public escalate(input: AdminCaseMutationContext): Promise<AdminCaseSnapshot> {
    return this.mutation('admin_escalate_case', {
      p_actor_id: input.actorId,
      p_case_id: input.caseId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public resolve(input: AdminResolveCaseInput): Promise<AdminCaseSnapshot> {
    return this.mutation('admin_resolve_case', {
      p_actor_id: input.actorId,
      p_case_id: input.caseId,
      p_resolution_code: input.resolutionCode,
      p_resolution_note: input.resolutionNote,
      p_reason_code: input.reasonCode,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public close(input: AdminCaseMutationContext): Promise<AdminCaseSnapshot> {
    return this.mutation('admin_close_case', {
      p_actor_id: input.actorId,
      p_case_id: input.caseId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }
}
