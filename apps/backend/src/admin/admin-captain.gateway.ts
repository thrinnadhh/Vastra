import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { AdminMutationReasonCode } from './admin.types';

export type AdminCaptainSnapshot = Readonly<Record<string, unknown>>;
export type AdminCaptainTargetStatus = 'SUSPENDED' | 'ACTIVE';
export type AdminCaptainAvailability = 'OFFLINE' | 'AVAILABLE' | 'ON_BREAK';

export interface AdminCaptainMutationInput {
  readonly actorId: string;
  readonly captainId: string;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
}

export interface AdminCaptainStatusInput extends AdminCaptainMutationInput {
  readonly targetStatus: AdminCaptainTargetStatus;
}

export interface AdminCaptainAvailabilityInput extends AdminCaptainMutationInput {
  readonly targetAvailability: AdminCaptainAvailability;
}

export interface AdminCaptainGateway {
  get(captainId: string): Promise<AdminCaptainSnapshot | null>;
  setStatus(input: AdminCaptainStatusInput): Promise<AdminCaptainSnapshot>;
  correctAvailability(input: AdminCaptainAvailabilityInput): Promise<AdminCaptainSnapshot>;
  releaseActiveAssignment(input: AdminCaptainMutationInput): Promise<AdminCaptainSnapshot>;
}

export class AdminCaptainGatewayUnavailableError extends Error {}
export class AdminCaptainStateConflictError extends Error {}
export class AdminCaptainIdempotencyConflictError extends Error {}

function parseSnapshot(value: unknown): AdminCaptainSnapshot | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminCaptainGatewayUnavailableError();
  }
  return value as AdminCaptainSnapshot;
}

@Injectable()
export class SupabaseAdminCaptainGateway implements AdminCaptainGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private async rpc(name: string, args: Record<string, unknown>): Promise<AdminCaptainSnapshot> {
    const { data, error } = await this.client.rpc(name, args);
    if (error !== null) {
      if (error.message.includes('ADMIN_IDEMPOTENCY_CONFLICT')) {
        throw new AdminCaptainIdempotencyConflictError();
      }
      if (error.message.includes('STATE_CONFLICT') || error.message.includes('ACTIVE_DELIVERY')) {
        throw new AdminCaptainStateConflictError();
      }
      throw new AdminCaptainGatewayUnavailableError();
    }
    const snapshot = parseSnapshot(data);
    if (snapshot === null) throw new AdminCaptainGatewayUnavailableError();
    return snapshot;
  }

  public async get(captainId: string): Promise<AdminCaptainSnapshot | null> {
    const { data, error } = await this.client.rpc('get_admin_captain_operations', {
      p_captain_id: captainId,
    });
    if (error !== null) throw new AdminCaptainGatewayUnavailableError();
    return parseSnapshot(data);
  }

  public setStatus(input: AdminCaptainStatusInput): Promise<AdminCaptainSnapshot> {
    return this.rpc('admin_set_captain_operational_status', {
      p_actor_id: input.actorId,
      p_captain_id: input.captainId,
      p_target_status: input.targetStatus,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public correctAvailability(input: AdminCaptainAvailabilityInput): Promise<AdminCaptainSnapshot> {
    return this.rpc('admin_correct_captain_availability', {
      p_actor_id: input.actorId,
      p_captain_id: input.captainId,
      p_target_availability: input.targetAvailability,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  public releaseActiveAssignment(input: AdminCaptainMutationInput): Promise<AdminCaptainSnapshot> {
    return this.rpc('admin_release_captain_assignment', {
      p_actor_id: input.actorId,
      p_captain_id: input.captainId,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
  }
}
