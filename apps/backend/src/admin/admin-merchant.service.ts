import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  ADMIN_KYC_STATUSES,
  ADMIN_MERCHANT_ONBOARDING_STATUSES,
  ADMIN_PROFILE_STATUSES,
  type ListAdminMerchantsResponse,
} from './admin-actor-list.types';
import {
  createAdminReadProviderUnavailableException,
  createInvalidAdminListQueryException,
} from './admin-http-error';
import {
  AdminListQueryInvalidError,
  encodeAdminListCursor,
  parseAdminListCursor,
  parseAdminListLimit,
  parseAdminOptionalEnum,
  parseAdminOptionalSearch,
} from './admin-list.validation';
import {
  AdminMerchantGatewayUnavailableError,
  type AdminMerchantGateway,
  type AdminMerchantSnapshot,
  type AdminMerchantTargetStatus,
} from './admin-merchant.gateway';
import { ADMIN_MERCHANT_GATEWAY } from './admin.tokens';
import { ADMIN_MUTATION_REASON_CODES, type AdminMutationReasonCode } from './admin.types';

export class AdminMerchantRequestInvalidError extends Error {}
export class AdminMerchantNotFoundError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new AdminMerchantRequestInvalidError();
  }
  return value.trim();
}

function parseBody(value: unknown): { reasonCode: AdminMutationReasonCode; note: string | null } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminMerchantRequestInvalidError();
  }
  const record = value as Record<string, unknown>;
  const reasonCode = record['reasonCode'];
  if (
    typeof reasonCode !== 'string' ||
    !ADMIN_MUTATION_REASON_CODES.includes(reasonCode as AdminMutationReasonCode)
  ) {
    throw new AdminMerchantRequestInvalidError();
  }
  const rawNote = record['note'];
  if (rawNote === undefined || rawNote === null) {
    return { reasonCode: reasonCode as AdminMutationReasonCode, note: null };
  }
  if (typeof rawNote !== 'string') throw new AdminMerchantRequestInvalidError();
  const note = rawNote.trim();
  if (note.length === 0 || note.length > 1000) throw new AdminMerchantRequestInvalidError();
  return { reasonCode: reasonCode as AdminMutationReasonCode, note };
}

@Injectable()
export class AdminMerchantService {
  public constructor(
    @Inject(ADMIN_MERCHANT_GATEWAY)
    private readonly gateway: AdminMerchantGateway,
  ) {}

  public async list(
    _context: AuthenticatedRequestContext,
    queryValue: unknown,
    profileStatusValue: unknown,
    onboardingStatusValue: unknown,
    kycStatusValue: unknown,
    cursorValue: unknown,
    limitValue: unknown,
  ): Promise<ListAdminMerchantsResponse> {
    try {
      const page = await this.gateway.list({
        query: parseAdminOptionalSearch(queryValue),
        profileStatus: parseAdminOptionalEnum(profileStatusValue, ADMIN_PROFILE_STATUSES),
        onboardingStatus: parseAdminOptionalEnum(
          onboardingStatusValue,
          ADMIN_MERCHANT_ONBOARDING_STATUSES,
        ),
        kycStatus: parseAdminOptionalEnum(kycStatusValue, ADMIN_KYC_STATUSES),
        cursor: parseAdminListCursor(cursorValue),
        limit: parseAdminListLimit(limitValue),
      });
      return {
        success: true,
        data: { merchants: page.items, nextCursor: encodeAdminListCursor(page.nextCursor) },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      if (error instanceof AdminListQueryInvalidError) {
        throw createInvalidAdminListQueryException();
      }
      if (error instanceof AdminMerchantGatewayUnavailableError) {
        throw createAdminReadProviderUnavailableException();
      }
      throw error;
    }
  }

  public async get(
    _context: AuthenticatedRequestContext,
    merchantId: unknown,
  ): Promise<AdminMerchantSnapshot> {
    const snapshot = await this.gateway.get(requireUuid(merchantId));
    if (snapshot === null) throw new AdminMerchantNotFoundError();
    return snapshot;
  }

  public setStatus(
    context: AuthenticatedRequestContext,
    merchantId: unknown,
    idempotencyKey: unknown,
    body: unknown,
    targetStatus: AdminMerchantTargetStatus,
    requestId: string | null,
  ): Promise<AdminMerchantSnapshot> {
    const parsed = parseBody(body);
    return this.gateway.setStatus({
      actorId: context.actor.id,
      merchantId: requireUuid(merchantId),
      idempotencyKey: requireUuid(idempotencyKey),
      targetStatus,
      reasonCode: parsed.reasonCode,
      note: parsed.note,
      requestId,
    });
  }

  public approve(
    context: AuthenticatedRequestContext,
    merchantId: unknown,
    idempotencyKey: unknown,
    body: unknown,
    requestId: string | null,
  ): Promise<AdminMerchantSnapshot> {
    const parsed = parseBody(body);
    return this.gateway.approve({
      actorId: context.actor.id,
      merchantId: requireUuid(merchantId),
      idempotencyKey: requireUuid(idempotencyKey),
      targetStatus: 'ACTIVE',
      reasonCode: parsed.reasonCode,
      note: parsed.note,
      requestId,
    });
  }
}
