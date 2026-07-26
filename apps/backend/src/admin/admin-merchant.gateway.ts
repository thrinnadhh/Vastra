import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  ADMIN_KYC_STATUSES,
  ADMIN_MERCHANT_ONBOARDING_STATUSES,
  ADMIN_PROFILE_STATUSES,
  type AdminMerchantListQuery,
  type AdminMerchantListItem,
  type AdminMerchantListPage,
} from './admin-actor-list.types';
import {
  AdminReadModelInvalidError,
  optionalPhoneLast4,
  requireAllowedString,
  requireArray,
  requireInteger,
  requireRecord,
  requireString,
  requireTimestamp,
  requireUuid,
} from './admin-read-model.parser';
import type { AdminMutationReasonCode } from './admin.types';

export type AdminMerchantSnapshot = Readonly<Record<string, unknown>>;
export type AdminMerchantTargetStatus = 'PAUSED' | 'SUSPENDED' | 'ACTIVE';

export interface AdminMerchantMutationInput {
  readonly actorId: string;
  readonly merchantId: string;
  readonly targetStatus: AdminMerchantTargetStatus;
  readonly reasonCode: AdminMutationReasonCode;
  readonly note: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
}

export interface AdminMerchantGateway {
  list(query: AdminMerchantListQuery): Promise<AdminMerchantListPage>;
  get(merchantId: string): Promise<AdminMerchantSnapshot | null>;
  setStatus(input: AdminMerchantMutationInput): Promise<AdminMerchantSnapshot>;
}

export class AdminMerchantGatewayUnavailableError extends Error {}
export class AdminMerchantIdempotencyConflictError extends Error {}
export class AdminMerchantStateConflictError extends Error {}

function parseListItem(value: unknown): AdminMerchantListItem {
  const record = requireRecord(value);
  return {
    id: requireUuid(record, 'id'),
    fullName: requireString(record, 'fullName'),
    legalName: requireString(record, 'legalName'),
    phoneLast4: optionalPhoneLast4(record, 'phoneLast4'),
    profileStatus: requireAllowedString(record, 'profileStatus', ADMIN_PROFILE_STATUSES),
    onboardingStatus: requireAllowedString(
      record,
      'onboardingStatus',
      ADMIN_MERCHANT_ONBOARDING_STATUSES,
    ),
    kycStatus: requireAllowedString(record, 'kycStatus', ADMIN_KYC_STATUSES),
    shopCount: requireInteger(record, 'shopCount'),
    openOrders: requireInteger(record, 'openOrders'),
    problemOrders30d: requireInteger(record, 'problemOrders30d'),
    updatedAt: requireTimestamp(record, 'updatedAt'),
  };
}

function parseListPage(value: unknown): AdminMerchantListPage {
  const record = requireRecord(value);
  const rawCursor = record['nextCursor'];
  const nextCursor =
    rawCursor === null
      ? null
      : (() => {
          const cursor = requireRecord(rawCursor);
          return {
            updatedAt: requireTimestamp(cursor, 'updatedAt'),
            id: requireUuid(cursor, 'id'),
          };
        })();
  return { items: requireArray(record['items']).map(parseListItem), nextCursor };
}

function parseSnapshot(value: unknown): AdminMerchantSnapshot | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AdminMerchantGatewayUnavailableError();
  }
  return value as AdminMerchantSnapshot;
}

@Injectable()
export class SupabaseAdminMerchantGateway implements AdminMerchantGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async list(query: AdminMerchantListQuery): Promise<AdminMerchantListPage> {
    const { data, error } = await this.client.rpc('list_admin_merchants', {
      p_query: query.query,
      p_profile_status: query.profileStatus,
      p_onboarding_status: query.onboardingStatus,
      p_kyc_status: query.kycStatus,
      p_cursor_updated_at: query.cursor?.updatedAt ?? null,
      p_cursor_id: query.cursor?.id ?? null,
      p_limit: query.limit,
    });
    if (error !== null) throw new AdminMerchantGatewayUnavailableError();
    try {
      return parseListPage(data);
    } catch (parseError: unknown) {
      if (parseError instanceof AdminReadModelInvalidError) {
        throw new AdminMerchantGatewayUnavailableError();
      }
      throw parseError;
    }
  }

  public async get(merchantId: string): Promise<AdminMerchantSnapshot | null> {
    const { data, error } = await this.client.rpc('get_admin_merchant_operations', {
      p_merchant_id: merchantId,
    });
    if (error !== null) throw new AdminMerchantGatewayUnavailableError();
    return parseSnapshot(data);
  }

  public async setStatus(input: AdminMerchantMutationInput): Promise<AdminMerchantSnapshot> {
    const { data, error } = await this.client.rpc('admin_set_merchant_operational_status', {
      p_actor_id: input.actorId,
      p_merchant_id: input.merchantId,
      p_target_status: input.targetStatus,
      p_reason_code: input.reasonCode,
      p_note: input.note,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) {
      if (error.message.includes('ADMIN_IDEMPOTENCY_CONFLICT')) {
        throw new AdminMerchantIdempotencyConflictError();
      }
      if (error.message.includes('ADMIN_MERCHANT_STATE_CONFLICT')) {
        throw new AdminMerchantStateConflictError();
      }
      throw new AdminMerchantGatewayUnavailableError();
    }
    const snapshot = parseSnapshot(data);
    if (snapshot === null) throw new AdminMerchantGatewayUnavailableError();
    return snapshot;
  }
}
